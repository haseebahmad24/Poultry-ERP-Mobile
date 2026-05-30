import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import { fetchSalesOrders, SalesOrder } from '@/api/salesOrders';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import ScreenHeader from '@/components/ScreenHeader';
import ErrorView from '@/components/ErrorView';
import { getCached, setCached } from '@/utils/cache';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'DeliveryCalendar'>;

type OrderType = 'both' | 'po' | 'so';

const ORDER_TYPE_LABELS: { key: OrderType; label: string }[] = [
  { key: 'both', label: 'All' },
  { key: 'po', label: 'POs' },
  { key: 'so', label: 'SOs' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Monochrome dot shades — darkest = most urgent
const DOT_SHADES = {
  overdue: '#0a0a0a',
  today: '#525252',
  urgent: '#a3a3a3',
  soon: '#d4d4d4',
  normal: 'transparent',
};

interface CalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  inMonth: boolean;
  isToday: boolean;
  poCount: number;
  soCount: number;
  hasOverdue: boolean;
  hasToday: boolean;
  hasUrgent: boolean;
}

type OrderItem = { type: 'po'; order: PurchaseOrder } | { type: 'so'; order: SalesOrder };

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return toDateStr(new Date());
}

function getUrgency(deliveryDateStr: string): 'overdue' | 'today' | 'urgent' | 'soon' | 'normal' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deliveryDateStr);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'soon';
  return 'normal';
}

function buildCalendarWeeks(year: number, month: number): CalendarDay[][] {
  const today = todayStr();
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < cells.length / 7; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = cells[w * 7 + d];
      if (cell) {
        const ds = toDateStr(cell);
        week.push({
          date: cell,
          dateStr: ds,
          inMonth: true,
          isToday: ds === today,
          poCount: 0,
          soCount: 0,
          hasOverdue: false,
          hasToday: false,
          hasUrgent: false,
        });
      } else {
        // Pad with a ghost day from adjacent month
        const paddedDate = new Date(year, month, (w * 7 + d) - startDow + 1);
        const ds = toDateStr(paddedDate);
        week.push({
          date: paddedDate,
          dateStr: ds,
          inMonth: false,
          isToday: false,
          poCount: 0,
          soCount: 0,
          hasOverdue: false,
          hasToday: false,
          hasUrgent: false,
        });
      }
    }
    weeks.push(week);
  }
  return weeks;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function DeliveryCalendarScreen() {
  const navigation = useNavigation<Nav>();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [orderType, setOrderType] = useState<OrderType>('both');
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [sos, setSOs] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [cachedPOs, cachedSOs] = await Promise.all([
        getCached<PurchaseOrder[]>('delivery-cal:po'),
        getCached<SalesOrder[]>('delivery-cal:so'),
      ]);
      if (!isRefresh && cachedPOs && cachedSOs) {
        setPOs(cachedPOs.data);
        setSOs(cachedSOs.data);
        setLoading(false);
        if (!cachedPOs.stale && !cachedSOs.stale) return;
      }
      const [poData, soData] = await Promise.all([
        fetchPurchaseOrders('all'),
        fetchSalesOrders('register'),
      ]);
      const withDeliveryPOs = poData.filter(o => o.delivery_date);
      const withDeliverySOs = soData.filter(o => o.delivery_date);
      setPOs(withDeliveryPOs);
      setSOs(withDeliverySOs);
      await Promise.all([
        setCached('delivery-cal:po', withDeliveryPOs),
        setCached('delivery-cal:so', withDeliverySOs),
      ]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load delivery data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  // Build calendar weeks with delivery counts overlaid
  const weeks = useMemo(() => {
    const raw = buildCalendarWeeks(viewYear, viewMonth);
    const poByDate: Record<string, PurchaseOrder[]> = {};
    const soByDate: Record<string, SalesOrder[]> = {};

    for (const po of pos) {
      if (!po.delivery_date) continue;
      const ds = po.delivery_date.slice(0, 10);
      if (!poByDate[ds]) poByDate[ds] = [];
      poByDate[ds].push(po);
    }
    for (const so of sos) {
      if (!so.delivery_date) continue;
      const ds = so.delivery_date.slice(0, 10);
      if (!soByDate[ds]) soByDate[ds] = [];
      soByDate[ds].push(so);
    }

    return raw.map(week =>
      week.map(day => {
        const dayPOs = poByDate[day.dateStr] ?? [];
        const daySOs = soByDate[day.dateStr] ?? [];
        const allOrders = [...dayPOs.map(o => o.delivery_date!), ...daySOs.map(o => o.delivery_date!)];
        let hasOverdue = false, hasToday = false, hasUrgent = false;
        for (const ds of allOrders) {
          const u = getUrgency(ds);
          if (u === 'overdue') hasOverdue = true;
          if (u === 'today') hasToday = true;
          if (u === 'urgent') hasUrgent = true;
        }
        return { ...day, poCount: dayPOs.length, soCount: daySOs.length, hasOverdue, hasToday, hasUrgent };
      })
    );
  }, [viewYear, viewMonth, pos, sos]);

  // Orders for selected date
  const selectedOrders = useMemo<OrderItem[]>(() => {
    const result: OrderItem[] = [];
    if (orderType !== 'so') {
      for (const po of pos) {
        if (po.delivery_date?.slice(0, 10) === selectedDate) result.push({ type: 'po', order: po });
      }
    }
    if (orderType !== 'po') {
      for (const so of sos) {
        if (so.delivery_date?.slice(0, 10) === selectedDate) result.push({ type: 'so', order: so });
      }
    }
    return result;
  }, [selectedDate, orderType, pos, sos]);

  // Summary badge counts for the visible month
  const monthSummary = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    let overdueCount = 0, pendingCount = 0;
    for (const po of pos) {
      if (!po.delivery_date) continue;
      if (!po.delivery_date.startsWith(monthPrefix)) continue;
      const u = getUrgency(po.delivery_date.slice(0, 10));
      if (u === 'overdue') overdueCount++;
      else pendingCount++;
    }
    for (const so of sos) {
      if (!so.delivery_date) continue;
      if (!so.delivery_date.startsWith(monthPrefix)) continue;
      const u = getUrgency(so.delivery_date.slice(0, 10));
      if (u === 'overdue') overdueCount++;
      else pendingCount++;
    }
    return { overdueCount, pendingCount };
  }, [viewYear, viewMonth, pos, sos]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function goToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelectedDate(todayStr());
  }

  function dotShade(day: CalendarDay): string {
    if (!day.inMonth) return 'transparent';
    if (day.hasOverdue) return DOT_SHADES.overdue;
    if (day.hasToday) return DOT_SHADES.today;
    if (day.hasUrgent) return DOT_SHADES.urgent;
    if (day.poCount + day.soCount > 0) return DOT_SHADES.soon;
    return 'transparent';
  }

  function getDayCount(day: CalendarDay): number {
    if (orderType === 'po') return day.poCount;
    if (orderType === 'so') return day.soCount;
    return day.poCount + day.soCount;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <StatusBar style="dark" />
        <ScreenHeader title="Delivery Calendar" />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <StatusBar style="dark" />
        <ScreenHeader title="Delivery Calendar" />
        <ErrorView message={error} onRetry={() => load()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Delivery Calendar"
        right={
          <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Order type filter */}
        <View style={styles.typeRow}>
          {ORDER_TYPE_LABELS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeChip, orderType === t.key && styles.typeChipActive]}
              onPress={() => setOrderType(t.key)}
            >
              <Text style={[styles.typeChipText, orderType === t.key && styles.typeChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Feather name="chevron-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.monthCenter}>
            <Text style={styles.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            {(monthSummary.overdueCount > 0 || monthSummary.pendingCount > 0) && (
              <View style={styles.monthBadges}>
                {monthSummary.overdueCount > 0 && (
                  <View style={styles.badge}>
                    <Feather name="alert-circle" size={10} color={Colors.text} />
                    <Text style={styles.badgeText}>
                      {monthSummary.overdueCount} overdue
                    </Text>
                  </View>
                )}
                {monthSummary.pendingCount > 0 && (
                  <View style={styles.badge}>
                    <Feather name="calendar" size={10} color={Colors.textSecondary} />
                    <Text style={[styles.badgeText, { color: Colors.textSecondary }]}>
                      {monthSummary.pendingCount} pending
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Feather name="chevron-right" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Weekday header */}
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map(wd => (
            <View key={wd} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{wd}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarCard}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                const count = getDayCount(day);
                const isSelected = day.dateStr === selectedDate && day.inMonth;
                const hasDeliveries = count > 0;
                const shade = dotShade(day);
                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      day.isToday && !isSelected && styles.dayCellToday,
                    ]}
                    onPress={() => { if (day.inMonth) setSelectedDate(day.dateStr); }}
                    activeOpacity={day.inMonth ? 0.7 : 1}
                  >
                    <Text style={[
                      styles.dayNumber,
                      !day.inMonth && styles.dayNumberFaded,
                      day.isToday && styles.dayNumberToday,
                      isSelected && styles.dayNumberSelected,
                    ]}>
                      {day.date.getDate()}
                    </Text>
                    {hasDeliveries && day.inMonth ? (
                      <View style={styles.dotRow}>
                        <View style={[styles.dot, { backgroundColor: shade }]} />
                        {count > 1 && <View style={[styles.dot, { backgroundColor: shade, opacity: 0.5 }]} />}
                      </View>
                    ) : (
                      <View style={styles.dotRow} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Selected date details */}
        <View style={styles.detailSection}>
          <Text style={styles.detailHeading}>
            {selectedDate === todayStr() ? 'Today' : formatShortDate(selectedDate)}
            {selectedOrders.length > 0 ? ` — ${selectedOrders.length} delivery${selectedOrders.length > 1 ? 's' : ''}` : ''}
          </Text>
          {selectedOrders.length === 0 ? (
            <View style={styles.emptyDay}>
              <Feather name="calendar" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyDayText}>No deliveries scheduled</Text>
            </View>
          ) : (
            selectedOrders.map((item, idx) => (
              <OrderCard
                key={`${item.type}-${item.type === 'po' ? item.order.id : (item.order as SalesOrder).id}-${idx}`}
                item={item}
                onPress={() => {
                  if (item.type === 'po') {
                    navigation.navigate('PurchaseOrderDetail', { id: item.order.id });
                  } else {
                    navigation.navigate('SalesOrderDetail', { id: (item.order as SalesOrder).id });
                  }
                }}
              />
            ))
          )}
        </View>

        {/* Legend — dot shades explain urgency tiers */}
        <View style={styles.legend}>
          {([
            { shade: DOT_SHADES.overdue, label: 'Overdue' },
            { shade: DOT_SHADES.today, label: 'Due today' },
            { shade: DOT_SHADES.urgent, label: '1–3 days' },
            { shade: DOT_SHADES.soon, label: '4–7 days' },
          ] as const).map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.shade }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface OrderCardProps {
  item: OrderItem;
  onPress: () => void;
}

function OrderCard({ item, onPress }: OrderCardProps) {
  const isPO = item.type === 'po';
  const order = item.order;
  const numberLabel = isPO
    ? ((order as PurchaseOrder).po_number ?? `#${order.id}`)
    : ((order as SalesOrder).so_number ?? `#${order.id}`);
  const party = isPO
    ? ((order as PurchaseOrder).vendor ?? 'Unknown Vendor')
    : ((order as SalesOrder).customer ?? 'Unknown Customer');
  const total = order.total;
  const status = order.status ?? '';
  const deliveryDate = order.delivery_date!;
  const urgency = getUrgency(deliveryDate.slice(0, 10));
  const isOverdue = urgency === 'overdue';
  const isToday = urgency === 'today';

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.orderCardTop}>
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>{isPO ? 'PO' : 'SO'}</Text>
        </View>
        <Text style={styles.orderNumber}>{numberLabel}</Text>
        <View style={{ flex: 1 }} />
        <Feather name="chevron-right" size={14} color={Colors.textMuted} />
      </View>
      <Text style={styles.orderParty}>{party}</Text>
      <View style={styles.orderCardBottom}>
        <View style={styles.urgencyBadge}>
          <Feather
            name={isOverdue ? 'alert-circle' : isToday ? 'clock' : 'calendar'}
            size={11}
            color={isOverdue ? Colors.text : Colors.textSecondary}
          />
          <Text style={[styles.urgencyText, isOverdue && styles.urgencyTextOverdue]}>
            {isOverdue ? 'Overdue' : isToday ? 'Due today' : formatShortDate(deliveryDate)}
          </Text>
        </View>
        {status ? (
          <Text style={styles.orderStatus}>{status}</Text>
        ) : null}
        {total != null ? (
          <Text style={styles.orderTotal}>{formatCurrency(total, order.currency)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  typeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: { ...Typography.bodySmall, color: Colors.textSecondary, fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  monthCenter: { flex: 1, alignItems: 'center', gap: 4 },
  monthTitle: { ...Typography.h3 },
  monthBadges: { flexDirection: 'row', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.text },

  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: 2,
  },
  weekdayCell: { flex: 1, alignItems: 'center' },
  weekdayText: { ...Typography.label, fontSize: 11 },

  calendarCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 52,
    justifyContent: 'center',
    gap: 3,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    backgroundColor: Colors.background,
  },
  dayNumber: { ...Typography.body, fontWeight: '500' },
  dayNumberFaded: { color: Colors.textMuted, opacity: 0.4 },
  dayNumberToday: { fontWeight: '700' },
  dayNumberSelected: { color: '#fff', fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: Radius.full },

  todayBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  todayBtnText: { ...Typography.bodySmall, color: Colors.textSecondary, fontWeight: '600' },

  detailSection: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  detailHeading: { ...Typography.h4, marginBottom: 2 },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyDayText: { ...Typography.body, color: Colors.textMuted },

  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
  },
  orderCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.borderLight,
  },
  typePillText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  orderNumber: { ...Typography.h4, fontSize: 14 },
  orderParty: { ...Typography.body, color: Colors.textSecondary, fontSize: 13 },
  orderCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  urgencyText: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary },
  urgencyTextOverdue: { fontWeight: '700', color: Colors.text },
  orderStatus: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  orderTotal: { ...Typography.body, fontWeight: '600', marginLeft: 'auto' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: Radius.full },
  legendText: { ...Typography.bodySmall, fontSize: 11 },
});
