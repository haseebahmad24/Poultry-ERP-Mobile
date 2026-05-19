import React, { useCallback, useEffect, useState } from 'react';
import {
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
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import {
  fetchAPSummary,
  fetchAPBills,
  fetchAPVendors,
  APSummary,
  APBill,
  APVendor,
} from '@/api/accountsPayable';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import CompanyPicker from '@/components/CompanyPicker';
import { useCompany } from '@/context/CompanyContext';
import { formatCurrency, formatShortDate } from '@/utils/currency';

type Tab = 'summary' | 'bills' | 'vendors';

const BILL_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PAID:      { bg: Colors.successBg,   fg: Colors.success },
  PARTIAL:   { bg: Colors.orangeBg,    fg: Colors.orange },
  UNPAID:    { bg: Colors.dangerBg,    fg: Colors.danger },
  OVERDUE:   { bg: Colors.dangerBg,    fg: Colors.danger },
  DRAFT:     { bg: Colors.warningBg,   fg: Colors.warning },
};

function daysOverdue(dueDate: string | undefined, status: string | undefined): number {
  if (!dueDate) return 0;
  const paid = (status ?? '').toUpperCase() === 'PAID';
  if (paid) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

export default function AccountsPayableScreen() {
  const { companyId } = useCompany();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [summary, setSummary] = useState<APSummary>({});
  const [bills, setBills] = useState<APBill[]>([]);
  const [vendors, setVendors] = useState<APVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billSearch, setBillSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [sum, bls, vend] = await Promise.all([
        fetchAPSummary(companyId),
        fetchAPBills(companyId),
        fetchAPVendors(companyId),
      ]);
      setSummary(sum);
      setBills(bls);
      setVendors(vend);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView message="Loading accounts payable…" />;
  if (error && !summary.total_outstanding) {
    return <ErrorView message={error} onRetry={() => load()} />;
  }

  const filteredBills = (billSearch.trim()
    ? bills.filter((b) => {
        const q = billSearch.toLowerCase();
        return (
          b.bill_number?.toLowerCase().includes(q) ||
          b.vendor?.toLowerCase().includes(q) ||
          b.status?.toLowerCase().includes(q)
        );
      })
    : bills
  ).slice().sort((a, b) => {
    const da = daysOverdue(a.due_date, a.status);
    const db = daysOverdue(b.due_date, b.status);
    return db - da; // overdue first, most overdue at top
  });

  const overdueCount = bills.filter((b) => daysOverdue(b.due_date, b.status) > 0).length;

  const filteredVendors = vendorSearch.trim()
    ? vendors.filter((v) => v.name?.toLowerCase().includes(vendorSearch.toLowerCase()))
    : vendors;

  const aging = summary.aging ?? {};
  const totalAging = (aging.current ?? 0) + (aging.days_30 ?? 0) +
    (aging.days_60 ?? 0) + (aging.days_90 ?? 0) + (aging.over_90 ?? 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton color={Colors.primary} />
        <Text style={styles.headerTitle}>Accounts Payable</Text>
      </View>

      <CompanyPicker />

      <View style={styles.tabBar}>
        {(['summary', 'bills', 'vendors'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              {t === 'bills' && overdueCount > 0 && (
                <View style={styles.overdueTabBadge}>
                  <Text style={styles.overdueTabBadgeText}>{overdueCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.primary}
          />
        }
      >
        {activeTab === 'summary' && (
          <>
            {/* KPI Cards */}
            <View style={styles.kpiGrid}>
              <KPICard
                label="Total Outstanding"
                value={formatCurrency(summary.total_outstanding ?? 0)}
                color={Colors.danger}
              />
              <KPICard
                label="Total Overdue"
                value={formatCurrency(summary.total_overdue ?? 0)}
                color={Colors.orange}
              />
              <KPICard
                label="Vendors"
                value={String(summary.vendors_count ?? vendors.length)}
                color={Colors.primary}
              />
              <KPICard
                label="Bills"
                value={String(summary.bills_count ?? bills.length)}
                color={Colors.textSecondary}
              />
            </View>

            {/* Aging breakdown */}
            <SectionHeader title="Aging Analysis" />
            <View style={styles.agingCard}>
              <AgingBar
                label="Current"
                amount={aging.current ?? 0}
                total={totalAging}
                color={Colors.success}
              />
              <AgingBar
                label="1–30 days"
                amount={aging.days_30 ?? 0}
                total={totalAging}
                color={Colors.warning}
              />
              <AgingBar
                label="31–60 days"
                amount={aging.days_60 ?? 0}
                total={totalAging}
                color={Colors.orange}
              />
              <AgingBar
                label="61–90 days"
                amount={aging.days_90 ?? 0}
                total={totalAging}
                color={Colors.danger}
              />
              <AgingBar
                label="Over 90 days"
                amount={aging.over_90 ?? 0}
                total={totalAging}
                color={Colors.primaryDark}
              />
            </View>

            {/* Top vendors */}
            {vendors.length > 0 && (
              <>
                <SectionHeader title="Top Vendors" meta="By outstanding" />
                <View style={styles.miniList}>
                  {vendors.slice(0, 5).map((v) => (
                    <View key={v.id} style={styles.miniRow}>
                      <Text style={styles.miniName} numberOfLines={1}>{v.name ?? `Vendor ${v.id}`}</Text>
                      <Text style={[styles.miniAmount, { color: Colors.danger }]}>
                        {formatCurrency(v.outstanding ?? 0)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {activeTab === 'bills' && (
          <>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search bills, vendors…"
                placeholderTextColor={Colors.textMuted}
                value={billSearch}
                onChangeText={setBillSearch}
              />
            </View>
            <SectionHeader
              title="Bills"
              meta={overdueCount > 0 ? `${filteredBills.length} records · ${overdueCount} overdue` : `${filteredBills.length} records`}
            />
            {filteredBills.length === 0 ? (
              <EmptyState icon="🧾" message={billSearch ? 'No bills match search' : 'No bills found'} />
            ) : (
              <View style={styles.cardList}>
                {filteredBills.map((bill) => (
                  <BillCard key={bill.id} bill={bill} overdueDays={daysOverdue(bill.due_date, bill.status)} />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'vendors' && (
          <>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search vendors…"
                placeholderTextColor={Colors.textMuted}
                value={vendorSearch}
                onChangeText={setVendorSearch}
              />
            </View>
            <SectionHeader title="Vendors" meta={`${filteredVendors.length} records`} />
            {filteredVendors.length === 0 ? (
              <EmptyState icon="🏪" message={vendorSearch ? 'No vendors match search' : 'No vendors found'} />
            ) : (
              <View style={styles.cardList}>
                {filteredVendors.map((v) => (
                  <VendorCard key={v.id} vendor={v} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function AgingBar({ label, amount, total, color }: {
  label: string; amount: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
  return (
    <View style={styles.agingRow}>
      <Text style={styles.agingLabel}>{label}</Text>
      <View style={styles.agingBarContainer}>
        <View style={[styles.agingBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.agingAmount, { color }]}>{formatCurrency(amount)}</Text>
    </View>
  );
}

function BillCard({ bill, overdueDays }: { bill: APBill; overdueDays: number }) {
  const statusKey = (bill.status ?? '').toUpperCase();
  const colors = BILL_STATUS_COLORS[statusKey] ?? { bg: Colors.borderLight, fg: Colors.textSecondary };
  const outstanding = bill.outstanding ?? (bill.amount ?? 0) - (bill.paid ?? 0);
  const isOverdue = overdueDays > 0;

  return (
    <View style={[styles.card, isOverdue && styles.cardOverdue]}>
      {isOverdue && (
        <View style={styles.overdueBanner}>
          <Text style={styles.overdueBannerText}>⚠ {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{bill.bill_number ?? `Bill-${bill.id}`}</Text>
          <Text style={styles.cardSub}>{bill.vendor ?? 'Unknown Vendor'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusText, { color: colors.fg }]}>{bill.status ?? '—'}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {bill.dt && <Text style={styles.metaText}>📅 {formatShortDate(bill.dt)}</Text>}
        {bill.due_date && (
          <Text style={[styles.metaText, isOverdue && styles.metaTextOverdue]}>
            ⏰ Due {formatShortDate(bill.due_date)}
          </Text>
        )}
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Total</Text>
          <Text style={styles.amtValue}>{formatCurrency(bill.amount ?? 0)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amtLabel}>Outstanding</Text>
          <Text style={[styles.amtValue, { color: outstanding > 0 ? Colors.danger : Colors.success }]}>
            {formatCurrency(outstanding)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function VendorCard({ vendor: v }: { vendor: APVendor }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{v.name ?? `Vendor ${v.id}`}</Text>
        {v.bills_count != null && (
          <Text style={styles.countBadge}>{v.bills_count} bills</Text>
        )}
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Outstanding</Text>
          <Text style={[styles.amtValue, { color: Colors.danger }]}>
            {formatCurrency(v.outstanding ?? 0)}
          </Text>
        </View>
        {v.overdue != null && v.overdue > 0 && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amtLabel}>Overdue</Text>
            <Text style={[styles.amtValue, { color: Colors.orange }]}>
              {formatCurrency(v.overdue)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    ...Shadow.card,
  },
  kpiValue: { fontSize: 18, fontWeight: '700' },
  kpiLabel: { ...Typography.bodySmall, color: Colors.textSecondary },

  agingCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  agingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  agingLabel: { fontSize: 12, color: Colors.textSecondary, width: 90 },
  agingBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  agingBarFill: { height: '100%', borderRadius: Radius.full },
  agingAmount: { fontSize: 12, fontWeight: '600', minWidth: 80, textAlign: 'right' },

  miniList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
  },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  miniName: { flex: 1, ...Typography.body },
  miniAmount: { fontSize: 14, fontWeight: '700' },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardInfo: { flex: 1 },
  cardTitle: { ...Typography.h4 },
  cardSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardMeta: { flexDirection: 'row', gap: Spacing.md },
  metaText: { fontSize: 12, color: Colors.textSecondary },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amtLabel: { ...Typography.label },
  amtValue: { fontSize: 15, fontWeight: '700', color: Colors.text },

  countBadge: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.subtle,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: { ...Typography.body, color: Colors.textMuted },

  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.background,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
  },

  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overdueTabBadge: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  overdueTabBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  cardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  overdueBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  overdueBannerText: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  metaTextOverdue: { color: Colors.danger, fontWeight: '600' },
});
