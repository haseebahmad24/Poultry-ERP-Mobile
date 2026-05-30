import React, { useCallback, useEffect, useState } from 'react';
import {
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
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import SectionHeader from '@/components/SectionHeader';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import { useCompany } from '@/context/CompanyContext';
import { useOverdue } from '@/context/OverdueContext';
import { fetchAPBills, APBill } from '@/api/accountsPayable';
import { fetchARInvoices, ARInvoice } from '@/api/accountsReceivable';
import { fetchStockBalances, StockBalance } from '@/api/inventory';
import { getCached } from '@/utils/cache';
import { getLowStockThreshold, getDueSoonDays } from '@/utils/settings';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';
import type { AppTabParamList } from '@/navigation/AppNavigator';

type MoreNav = NativeStackNavigationProp<MoreStackParamList>;
type TabNav = BottomTabNavigationProp<AppTabParamList>;

function daysOverdue(dueDate: string | undefined, status: string | undefined): number {
  if (!dueDate) return 0;
  if ((status ?? '').toUpperCase() === 'PAID') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Returns days until due_date. Positive = not yet due. 0 = due today. Negative = overdue. */
function daysDueIn(dueDate: string | undefined, status: string | undefined): number {
  if (!dueDate) return -9999;
  const st = (status ?? '').toUpperCase();
  if (st === 'PAID' || st === 'RECEIVED' || st === 'CLOSED' || st === 'CANCELLED') return -9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / 86_400_000);
}

export default function AlertsScreen() {
  const moreNav = useNavigation<MoreNav>();
  const tabNav = moreNav.getParent<TabNav>();
  const { companyId } = useCompany();
  const { setAPOverdue, setAROverdue, setLowStock, setAPDueSoon, setARDueSoon } = useOverdue();

  const [overdueBills, setOverdueBills] = useState<APBill[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<ARInvoice[]>([]);
  const [lowStockItems, setLowStockItems] = useState<StockBalance[]>([]);
  const [dueSoonBills, setDueSoonBills] = useState<APBill[]>([]);
  const [dueSoonInvoices, setDueSoonInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [threshold, setThreshold] = useState(100);
  const [dueSoonDays, setDueSoonDaysState] = useState(7);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [t, dsd] = await Promise.all([getLowStockThreshold(), getDueSoonDays()]);
    setThreshold(t);
    setDueSoonDaysState(dsd);

    const apCacheKey = `ap:${companyId ?? 'all'}`;
    const arCacheKey = `ar:${companyId ?? 'all'}`;
    const invCacheKey = `inventory:stock:${companyId ?? 'all'}`;

    try {
      const [apBills, arInvoices, stock] = await Promise.all([
        getCached<{ bills: APBill[] }>(apCacheKey).then((c) =>
          c ? c.data.bills : fetchAPBills(companyId)
        ),
        getCached<{ invoices: ARInvoice[] }>(arCacheKey).then((c) =>
          c ? c.data.invoices : fetchARInvoices(companyId)
        ),
        getCached<StockBalance[]>(invCacheKey).then((c) =>
          c ? c.data : fetchStockBalances(companyId)
        ),
      ]);

      const bills = (apBills ?? [])
        .filter((b) => daysOverdue(b.due_date, b.status) > 0)
        .sort((a, b) => daysOverdue(b.due_date, b.status) - daysOverdue(a.due_date, a.status));

      const invoices = (arInvoices ?? [])
        .filter((i) => daysOverdue(i.due_date, i.status) > 0)
        .sort((a, b) => daysOverdue(b.due_date, b.status) - daysOverdue(a.due_date, a.status));

      const lowStock = (stock ?? [])
        .filter((s) => { const q = s.qty ?? 0; return q > 0 && q < t; })
        .sort((a, b) => (a.qty ?? 0) - (b.qty ?? 0));

      // Due soon: due within next dsd days, not yet overdue, not closed/paid
      const upcomingBills = (apBills ?? [])
        .filter((b) => { const d = daysDueIn(b.due_date, b.status); return d >= 0 && d <= dsd; })
        .sort((a, b) => daysDueIn(a.due_date, a.status) - daysDueIn(b.due_date, b.status));

      const upcomingInvoices = (arInvoices ?? [])
        .filter((i) => { const d = daysDueIn(i.due_date, i.status); return d >= 0 && d <= dsd; })
        .sort((a, b) => daysDueIn(a.due_date, a.status) - daysDueIn(b.due_date, b.status));

      setOverdueBills(bills);
      setOverdueInvoices(invoices);
      setLowStockItems(lowStock);
      setDueSoonBills(upcomingBills);
      setDueSoonInvoices(upcomingInvoices);

      setAPOverdue(bills.length);
      setAROverdue(invoices.length);
      setLowStock(lowStock.length);
      setAPDueSoon(upcomingBills.length);
      setARDueSoon(upcomingInvoices.length);
    } catch {
      // Keep existing state on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, setAPOverdue, setAROverdue, setLowStock, setAPDueSoon, setARDueSoon]);

  useEffect(() => { load(); }, [load]);

  const overdueTotal = overdueBills.length + overdueInvoices.length + lowStockItems.length;
  const dueSoonTotal = dueSoonBills.length + dueSoonInvoices.length;
  const totalAlerts = overdueTotal + dueSoonTotal;

  const allClear = totalAlerts === 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Alerts</Text>
        {!loading && overdueTotal > 0 && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{overdueTotal}</Text>
          </View>
        )}
        {!loading && dueSoonTotal > 0 && overdueTotal === 0 && (
          <View style={[styles.totalBadge, styles.dueSoonBadge]}>
            <Text style={styles.totalBadgeText}>{dueSoonTotal}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ListScreenSkeleton count={5} showTabs={false} showSearch={false} showBadge />
      ) : allClear ? (
        <View style={styles.allClear}>
          <Feather name="check-circle" size={48} color={Colors.textMuted} />
          <Text style={styles.allClearTitle}>All clear</Text>
          <Text style={styles.allClearSub}>No overdue bills, invoices, low-stock items, or upcoming due dates.</Text>
        </View>
      ) : (
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
          {/* Overdue AP Bills */}
          <SectionHeader
            title="Overdue Bills (AP)"
            meta={overdueBills.length > 0 ? `${overdueBills.length} bills` : 'None'}
          />
          {overdueBills.length === 0 ? (
            <EmptyAlert label="No overdue bills" />
          ) : (
            <View style={styles.card}>
              {overdueBills.map((bill, idx) => {
                const days = daysOverdue(bill.due_date, bill.status);
                return (
                  <TouchableOpacity
                    key={bill.id}
                    style={[styles.alertRow, idx < overdueBills.length - 1 && styles.alertRowBorder]}
                    activeOpacity={0.7}
                    onPress={() => tabNav?.navigate('Finance', { screen: 'AccountsPayable' } as any)}
                  >
                    <View style={styles.alertIcon}>
                      <Feather name="file-text" size={16} color={Colors.textSecondary} />
                    </View>
                    <View style={styles.alertBody}>
                      <Text style={styles.alertTitle}>
                        {bill.bill_number ?? `Bill #${bill.id}`}
                      </Text>
                      <Text style={styles.alertMeta}>
                        {bill.vendor ?? '—'} · Due {formatShortDate(bill.due_date ?? '')}
                      </Text>
                    </View>
                    <View style={styles.alertRight}>
                      <Text style={styles.alertAmount}>{formatCurrency(bill.outstanding ?? bill.amount ?? 0)}</Text>
                      <View style={styles.daysBadge}>
                        <Text style={styles.daysBadgeText}>{days}d overdue</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Overdue AR Invoices */}
          <SectionHeader
            title="Overdue Invoices (AR)"
            meta={overdueInvoices.length > 0 ? `${overdueInvoices.length} invoices` : 'None'}
          />
          {overdueInvoices.length === 0 ? (
            <EmptyAlert label="No overdue invoices" />
          ) : (
            <View style={styles.card}>
              {overdueInvoices.map((inv, idx) => {
                const days = daysOverdue(inv.due_date, inv.status);
                return (
                  <TouchableOpacity
                    key={inv.id}
                    style={[styles.alertRow, idx < overdueInvoices.length - 1 && styles.alertRowBorder]}
                    activeOpacity={0.7}
                    onPress={() => tabNav?.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
                  >
                    <View style={styles.alertIcon}>
                      <Feather name="file-text" size={16} color={Colors.textSecondary} />
                    </View>
                    <View style={styles.alertBody}>
                      <Text style={styles.alertTitle}>
                        {inv.invoice_number ?? `Invoice #${inv.id}`}
                      </Text>
                      <Text style={styles.alertMeta}>
                        {inv.customer ?? '—'} · Due {formatShortDate(inv.due_date ?? '')}
                      </Text>
                    </View>
                    <View style={styles.alertRight}>
                      <Text style={styles.alertAmount}>{formatCurrency(inv.outstanding ?? inv.amount ?? 0)}</Text>
                      <View style={styles.daysBadge}>
                        <Text style={styles.daysBadgeText}>{days}d overdue</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Low Stock Items */}
          <SectionHeader
            title={`Low Stock (threshold < ${threshold})`}
            meta={lowStockItems.length > 0 ? `${lowStockItems.length} items` : 'None'}
          />
          {lowStockItems.length === 0 ? (
            <EmptyAlert label="No low-stock items" />
          ) : (
            <View style={styles.card}>
              {lowStockItems.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.item_id}-${item.warehouse_id ?? idx}`}
                  style={[styles.alertRow, idx < lowStockItems.length - 1 && styles.alertRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.item_id) {
                      moreNav.navigate('MaterialDetail', {
                        materialId: item.item_id,
                        materialName: item.item_name,
                        materialCode: item.item_code,
                      });
                    } else {
                      tabNav?.navigate('Inventory');
                    }
                  }}
                >
                  <View style={styles.alertIcon}>
                    <Feather name="package" size={16} color={Colors.textSecondary} />
                  </View>
                  <View style={styles.alertBody}>
                    <Text style={styles.alertTitle}>{item.item_name}</Text>
                    <Text style={styles.alertMeta}>
                      {item.warehouse_name ?? 'All warehouses'} · {item.unit ?? 'units'}
                    </Text>
                  </View>
                  <View style={styles.alertRight}>
                    <Text style={styles.alertAmount}>{item.qty ?? 0}</Text>
                    <Text style={styles.alertAmountSub}>in stock</Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Due Soon — AP Bills */}
          {(dueSoonBills.length > 0 || dueSoonInvoices.length > 0) && (
            <View style={styles.dueSoonDivider}>
              <View style={styles.dueSoonDividerLine} />
              <Text style={styles.dueSoonDividerLabel}>UPCOMING</Text>
              <View style={styles.dueSoonDividerLine} />
            </View>
          )}

          {dueSoonBills.length > 0 && (
            <>
              <SectionHeader
                title={`Bills Due in ${dueSoonDays} Days (AP)`}
                meta={`${dueSoonBills.length} upcoming`}
              />
              <View style={styles.card}>
                {dueSoonBills.map((bill, idx) => {
                  const daysLeft = daysDueIn(bill.due_date, bill.status);
                  return (
                    <TouchableOpacity
                      key={bill.id}
                      style={[styles.alertRow, idx < dueSoonBills.length - 1 && styles.alertRowBorder]}
                      activeOpacity={0.7}
                      onPress={() => tabNav?.navigate('Finance', { screen: 'AccountsPayable' } as any)}
                    >
                      <View style={styles.alertIcon}>
                        <Feather name="clock" size={16} color={Colors.textSecondary} />
                      </View>
                      <View style={styles.alertBody}>
                        <Text style={styles.alertTitle}>
                          {bill.bill_number ?? `Bill #${bill.id}`}
                        </Text>
                        <Text style={styles.alertMeta}>
                          {bill.vendor ?? '—'} · Due {formatShortDate(bill.due_date ?? '')}
                        </Text>
                      </View>
                      <View style={styles.alertRight}>
                        <Text style={styles.alertAmount}>{formatCurrency(bill.outstanding ?? bill.amount ?? 0)}</Text>
                        <View style={[styles.daysBadge, styles.dueSoonChip]}>
                          <Text style={styles.daysBadgeText}>
                            {daysLeft === 0 ? 'due today' : `${daysLeft}d left`}
                          </Text>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Due Soon — AR Invoices */}
          {dueSoonInvoices.length > 0 && (
            <>
              <SectionHeader
                title={`Invoices Due in ${dueSoonDays} Days (AR)`}
                meta={`${dueSoonInvoices.length} upcoming`}
              />
              <View style={styles.card}>
                {dueSoonInvoices.map((inv, idx) => {
                  const daysLeft = daysDueIn(inv.due_date, inv.status);
                  return (
                    <TouchableOpacity
                      key={inv.id}
                      style={[styles.alertRow, idx < dueSoonInvoices.length - 1 && styles.alertRowBorder]}
                      activeOpacity={0.7}
                      onPress={() => tabNav?.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
                    >
                      <View style={styles.alertIcon}>
                        <Feather name="clock" size={16} color={Colors.textSecondary} />
                      </View>
                      <View style={styles.alertBody}>
                        <Text style={styles.alertTitle}>
                          {inv.invoice_number ?? `Invoice #${inv.id}`}
                        </Text>
                        <Text style={styles.alertMeta}>
                          {inv.customer ?? '—'} · Due {formatShortDate(inv.due_date ?? '')}
                        </Text>
                      </View>
                      <View style={styles.alertRight}>
                        <Text style={styles.alertAmount}>{formatCurrency(inv.outstanding ?? inv.amount ?? 0)}</Text>
                        <View style={[styles.daysBadge, styles.dueSoonChip]}>
                          <Text style={styles.daysBadgeText}>
                            {daysLeft === 0 ? 'due today' : `${daysLeft}d left`}
                          </Text>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function EmptyAlert({ label }: { label: string }) {
  return (
    <View style={styles.emptyAlert}>
      <Feather name="check" size={14} color={Colors.textMuted} style={{ marginRight: 6 }} />
      <Text style={styles.emptyAlertText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h2, flex: 1 },
  totalBadge: {
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  dueSoonBadge: {
    backgroundColor: Colors.textSecondary,
  },
  totalBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  alertRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  alertBody: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  alertMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  alertRight: { alignItems: 'flex-end', marginRight: 4 },
  alertAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  alertAmountSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  daysBadge: {
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
  },
  dueSoonChip: {
    borderStyle: 'dashed',
  },
  daysBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.text },

  dueSoonDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  dueSoonDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dueSoonDividerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textMuted,
  },

  emptyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyAlertText: { fontSize: 13, color: Colors.textMuted },

  allClear: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
  },
  allClearTitle: { ...Typography.h2 },
  allClearSub: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
