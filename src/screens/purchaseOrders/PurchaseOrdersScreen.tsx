import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import OfflineBanner from '@/components/OfflineBanner';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import { exportPOListPDF } from '@/utils/pdfExport';
import { schedulePoDeliveryReminder } from '@/utils/notifications';
import { MoreStackParamList } from '@/navigation/MoreNavigator';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'PurchaseOrders'>;
type RouteType = RouteProp<MoreStackParamList, 'PurchaseOrders'>;

type DeliveryUrgency = 'overdue' | 'today' | 'urgent' | 'soon' | null;
interface DeliveryStatus { label: string; urgency: DeliveryUrgency }

function getDeliveryStatus(deliveryDate: string | undefined, status: string | undefined): DeliveryStatus | null {
  const s = (status ?? '').toUpperCase();
  if (!deliveryDate || ['CLOSED', 'CANCELLED', 'RECEIVED', 'COMPLETE'].includes(s)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deliveryDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, urgency: 'overdue' };
  if (days === 0) return { label: 'Due today', urgency: 'today' };
  if (days <= 3) return { label: `Due in ${days}d`, urgency: 'urgent' };
  if (days <= 7) return { label: `Due in ${days}d`, urgency: 'soon' };
  return null;
}

type StatusTab = 'all' | 'open' | 'progress';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'progress', label: 'In Progress' },
];

export default function PurchaseOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const initialVendor = route.params?.initialVendor ?? '';
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState(initialVendor);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });

  const cacheKey = `purchase-orders:${activeTab}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<PurchaseOrder[]>(cacheKey);
      if (cached) {
        setOrders(cached.data);
        setIsStale(cached.stale);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else if (orders.length === 0) setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrders(
        activeTab === 'progress' ? 'progress' : activeTab === 'open' ? 'open' : 'all'
      );
      setOrders(data);
      setIsStale(false);
      await setCached(cacheKey, data);
      // Best-effort: schedule PO delivery reminder based on fresh data
      schedulePoDeliveryReminder(data).catch(() => {});
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, cacheKey]);

  useEffect(() => { load(); }, [load]);

  if (error && orders.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  const filtered = orders.filter((po) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesSearch =
        po.po_number?.toLowerCase().includes(q) ||
        po.vendor?.toLowerCase().includes(q) ||
        po.status?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (dateRange.from && po.dt && po.dt < dateRange.from) return false;
    if (dateRange.to && po.dt && po.dt > dateRange.to) return false;
    return true;
  });

  const filteredTotal = filtered.reduce((s, po) => s + (po.total ?? 0), 0);
  const filteredAvg = filtered.length > 0 ? filteredTotal / filtered.length : 0;

  const deliveryPerf = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let overdueCount = 0, thisWeekCount = 0, onTrackCount = 0, completedCount = 0;
    for (const po of orders) {
      const st = (po.status ?? '').toUpperCase();
      const isClosed = ['CLOSED', 'CANCELLED', 'RECEIVED', 'COMPLETE'].includes(st);
      if (isClosed) { completedCount++; continue; }
      if (!po.delivery_date) continue;
      const due = new Date(po.delivery_date);
      due.setHours(0, 0, 0, 0);
      const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
      if (days < 0) overdueCount++;
      else if (days <= 7) thisWeekCount++;
      else onTrackCount++;
    }
    return { overdueCount, thisWeekCount, onTrackCount, completedCount };
  }, [orders]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const tabLabel = STATUS_TABS.find((t) => t.key === activeTab)?.label ?? 'All';
      await exportPOListPDF({ orders: filtered, tabLabel });
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Purchase Orders</Text>
        {!loading && <Text style={styles.headerSub}>{filtered.length} records</Text>}
        {!loading && filtered.length > 0 && (
          exporting ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : (
            <TouchableOpacity
              onPress={handleExport}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="file-text" size={18} color={Colors.text} />
            </TouchableOpacity>
          )
        )}
      </View>

      <OfflineBanner visible={!!(isStale && error)} />

      {loading ? (
        <ListScreenSkeleton count={6} showTabs showSearch />
      ) : (
        <>
          <View style={styles.searchContainer}>
            <Feather name="search" size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search PO number, vendor…"
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tabBar}>
            {STATUS_TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, activeTab === t.key && styles.tabActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <DateRangeBar value={dateRange} onChange={setDateRange} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={Colors.textMuted}
              />
            }
          >
            {activeTab === 'all' && orders.length > 0 && (
              <DeliveryPerfCard perf={deliveryPerf} />
            )}

            <SectionHeader title="Orders" meta={`${filtered.length} total`} />

            {filtered.length > 0 && filteredTotal > 0 && (
              <View style={styles.statsStrip}>
                <Text style={styles.statsStripKey}>Total</Text>
                <Text style={styles.statsStripVal}>{formatCurrency(filteredTotal)}</Text>
                <View style={styles.statsStripDivider} />
                <Text style={styles.statsStripKey}>Avg</Text>
                <Text style={styles.statsStripVal}>{formatCurrency(filteredAvg)}</Text>
              </View>
            )}

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="shopping-cart" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {search ? 'No orders match search' : 'No purchase orders found'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {filtered.map((po) => (
                  <POCard
                    key={po.id}
                    po={po}
                    onPress={() => navigation.navigate('PurchaseOrderDetail', { id: po.id })}
                  />
                ))}
              </View>
            )}

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

interface DeliveryPerf {
  overdueCount: number;
  thisWeekCount: number;
  onTrackCount: number;
  completedCount: number;
}

function DeliveryPerfCard({ perf }: { perf: DeliveryPerf }) {
  const total = perf.overdueCount + perf.thisWeekCount + perf.onTrackCount + perf.completedCount;
  if (total === 0) return null;
  const tiles: Array<{ label: string; value: number; sub: string; dim?: boolean }> = [
    { label: 'Overdue', value: perf.overdueCount, sub: 'delivery past due' },
    { label: 'This Week', value: perf.thisWeekCount, sub: 'due in 7 days' },
    { label: 'On Track', value: perf.onTrackCount, sub: '7+ days out' },
    { label: 'Completed', value: perf.completedCount, sub: 'closed / received', dim: true },
  ].filter((t) => t.value > 0);

  return (
    <View style={dpStyles.card}>
      <View style={dpStyles.header}>
        <Feather name="truck" size={13} color={Colors.textSecondary} />
        <Text style={dpStyles.title}>Delivery Status</Text>
      </View>
      <View style={dpStyles.tileRow}>
        {tiles.map((t) => (
          <View key={t.label} style={dpStyles.tile}>
            <Text style={[dpStyles.tileValue, t.dim && dpStyles.tileValueDim]}>{t.value}</Text>
            <Text style={dpStyles.tileLabel}>{t.label}</Text>
            <Text style={dpStyles.tileSub}>{t.sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const dpStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  title: { fontSize: 12, fontWeight: '700', color: Colors.text, letterSpacing: 0.3 },
  tileRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 2,
  },
  tileValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  tileValueDim: { color: Colors.textSecondary },
  tileLabel: { fontSize: 11, fontWeight: '600', color: Colors.text },
  tileSub: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
});

function POCard({ po, onPress }: { po: PurchaseOrder; onPress: () => void }) {
  const total = po.total ?? 0;
  const received = po.received ?? 0;
  const progressPct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  const showProgress = received > 0 || (po.status ?? '').toUpperCase() === 'PARTIAL';
  const isClosed = ['CLOSED', 'CANCELLED'].includes((po.status ?? '').toUpperCase());
  const delivery = getDeliveryStatus(po.delivery_date, po.status);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.poNumber}>{po.po_number ?? `PO-${po.id}`}</Text>
          <Text style={styles.poVendor} numberOfLines={1}>{po.vendor ?? 'Unknown Vendor'}</Text>
        </View>
        <View style={[styles.statusBadge, isClosed && styles.statusBadgeMuted]}>
          <Text style={[styles.statusText, isClosed && styles.statusTextMuted]}>
            {po.status ?? 'UNKNOWN'}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {po.dt && (
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(po.dt)}</Text>
          </View>
        )}
        {po.delivery_date && (
          <View style={styles.metaItem}>
            <Feather name="truck" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(po.delivery_date)}</Text>
          </View>
        )}
        <Text style={styles.metaAmount}>{formatCurrency(total)}</Text>
      </View>

      {delivery && (
        <View style={[styles.deliveryChip, delivery.urgency === 'overdue' && styles.deliveryChipOverdue]}>
          <Feather
            name={delivery.urgency === 'overdue' ? 'alert-circle' : 'clock'}
            size={11}
            color={Colors.text}
          />
          <Text style={styles.deliveryChipText}>{delivery.label}</Text>
        </View>
      )}

      {showProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progressPct)}% received</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Feather name="chevron-right" size={14} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2, flex: 1 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.text },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.text, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statsStripKey: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  statsStripVal: { fontSize: 12, fontWeight: '700', color: Colors.text },
  statsStripDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: Colors.border, marginHorizontal: 2 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardInfo: { flex: 1 },
  poNumber: { ...Typography.h4 },
  poVendor: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeMuted: { opacity: 0.5 },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  statusTextMuted: { color: Colors.textSecondary },

  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  metaAmount: { fontSize: 14, fontWeight: '700', color: Colors.text, marginLeft: 'auto' },

  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
  },
  deliveryChipOverdue: {
    borderColor: Colors.text,
    backgroundColor: Colors.borderLight,
  },
  deliveryChipText: { fontSize: 11, fontWeight: '600', color: Colors.text },

  progressContainer: { gap: 4 },
  progressBar: {
    height: 3,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
  },
  progressText: { fontSize: 10, color: Colors.textMuted, textAlign: 'right' },

  cardFooter: { alignItems: 'flex-end' },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
