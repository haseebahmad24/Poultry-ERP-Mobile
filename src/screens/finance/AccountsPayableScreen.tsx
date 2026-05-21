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
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import { Colors, Radius, Spacing, Typography } from '@/theme';
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
import CompanySelector from '@/components/CompanySelector';
import { useCompany } from '@/context/CompanyContext';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import OfflineBanner from '@/components/OfflineBanner';
import { useOverdue } from '@/context/OverdueContext';

type APNavProp = NativeStackNavigationProp<FinanceStackParamList>;

type Tab = 'summary' | 'bills' | 'vendors';

// Grayscale aging fills — conveys severity without semantic color
const AGING_FILLS = ['#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827'];

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

export default function AccountsPayableScreen() {
  const { companyId } = useCompany();
  const { setAPOverdue } = useOverdue();
  const navigation = useNavigation<APNavProp>();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [summary, setSummary] = useState<APSummary>({});
  const [bills, setBills] = useState<APBill[]>([]);
  const [vendors, setVendors] = useState<APVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [billSearch, setBillSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');

  const cacheKey = `ap:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<{ summary: APSummary; bills: APBill[]; vendors: APVendor[] }>(cacheKey);
      if (cached) {
        setSummary(cached.data.summary);
        setBills(cached.data.bills);
        setVendors(cached.data.vendors);
        setStale(cached.stale);
        setLoading(false);
        setAPOverdue(cached.data.bills.filter((b) => daysOverdue(b.due_date, b.status) > 0).length);
        if (!cached.stale) return;
      }
    }
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
      setStale(false);
      setAPOverdue(bls.filter((b) => daysOverdue(b.due_date, b.status) > 0).length);
      await setCached(cacheKey, { summary: sum, bills: bls, vendors: vend });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, cacheKey]);

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
    return daysOverdue(b.due_date, b.status) - daysOverdue(a.due_date, a.status);
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
        <BackButton />
        <Text style={styles.headerTitle}>Accounts Payable</Text>
      </View>

      <CompanySelector />

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

      {stale && error && <OfflineBanner />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.textMuted}
          />
        }
      >
        {activeTab === 'summary' && (
          <>
            <View style={styles.kpiGrid}>
              <KPICard label="Total Outstanding" value={formatCurrency(summary.total_outstanding ?? 0)} />
              <KPICard label="Total Overdue" value={formatCurrency(summary.total_overdue ?? 0)} />
              <KPICard label="Vendors" value={String(summary.vendors_count ?? vendors.length)} />
              <KPICard label="Bills" value={String(summary.bills_count ?? bills.length)} />
            </View>

            <SectionHeader title="Aging Analysis" />
            <View style={styles.agingCard}>
              <AgingBar label="Current"     amount={aging.current ?? 0} total={totalAging} fill={AGING_FILLS[0]} />
              <AgingBar label="1–30 days"   amount={aging.days_30 ?? 0} total={totalAging} fill={AGING_FILLS[1]} />
              <AgingBar label="31–60 days"  amount={aging.days_60 ?? 0} total={totalAging} fill={AGING_FILLS[2]} />
              <AgingBar label="61–90 days"  amount={aging.days_90 ?? 0} total={totalAging} fill={AGING_FILLS[3]} />
              <AgingBar label="Over 90 days" amount={aging.over_90 ?? 0} total={totalAging} fill={AGING_FILLS[4]} />
            </View>

            {vendors.length > 0 && (
              <>
                <SectionHeader title="Top Vendors" meta="By outstanding" />
                <View style={styles.miniList}>
                  {vendors.slice(0, 5).map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={styles.miniRow}
                      onPress={() => navigation.navigate('VendorDetail', {
                        vendorId: v.id,
                        vendorName: v.name ?? `Vendor ${v.id}`,
                        outstanding: v.outstanding,
                        overdue: v.overdue,
                      })}
                    >
                      <Text style={styles.miniName} numberOfLines={1}>{v.name ?? `Vendor ${v.id}`}</Text>
                      <View style={styles.miniRowRight}>
                        <Text style={styles.miniAmount}>{formatCurrency(v.outstanding ?? 0)}</Text>
                        <Feather name="chevron-right" size={14} color={Colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {activeTab === 'bills' && (
          <>
            <View style={styles.searchContainer}>
              <Feather name="search" size={14} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search bills, vendors…"
                placeholderTextColor={Colors.textMuted}
                value={billSearch}
                onChangeText={setBillSearch}
              />
              {billSearch.length > 0 && (
                <TouchableOpacity onPress={() => setBillSearch('')}>
                  <Feather name="x" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <SectionHeader
              title="Bills"
              meta={overdueCount > 0
                ? `${filteredBills.length} records · ${overdueCount} overdue`
                : `${filteredBills.length} records`}
            />
            {filteredBills.length === 0 ? (
              <EmptyState icon="file-text" message={billSearch ? 'No bills match search' : 'No bills found'} />
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
              <Feather name="search" size={14} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search vendors…"
                placeholderTextColor={Colors.textMuted}
                value={vendorSearch}
                onChangeText={setVendorSearch}
              />
              {vendorSearch.length > 0 && (
                <TouchableOpacity onPress={() => setVendorSearch('')}>
                  <Feather name="x" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <SectionHeader title="Vendors" meta={`${filteredVendors.length} records`} />
            {filteredVendors.length === 0 ? (
              <EmptyState icon="briefcase" message={vendorSearch ? 'No vendors match search' : 'No vendors found'} />
            ) : (
              <View style={styles.cardList}>
                {filteredVendors.map((v) => (
                  <VendorCard
                    key={v.id}
                    vendor={v}
                    onPress={() => navigation.navigate('VendorDetail', {
                      vendorId: v.id,
                      vendorName: v.name ?? `Vendor ${v.id}`,
                      outstanding: v.outstanding,
                      overdue: v.overdue,
                    })}
                  />
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

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function AgingBar({ label, amount, total, fill }: {
  label: string; amount: number; total: number; fill: string;
}) {
  const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
  return (
    <View style={styles.agingRow}>
      <Text style={styles.agingLabel}>{label}</Text>
      <View style={styles.agingBarContainer}>
        <View style={[styles.agingBarFill, { width: `${pct}%` as any, backgroundColor: fill }]} />
      </View>
      <Text style={styles.agingAmount}>{formatCurrency(amount)}</Text>
    </View>
  );
}

function BillCard({ bill, overdueDays }: { bill: APBill; overdueDays: number }) {
  const outstanding = bill.outstanding ?? (bill.amount ?? 0) - (bill.paid ?? 0);
  const isOverdue = overdueDays > 0;
  const isPaid = (bill.status ?? '').toUpperCase() === 'PAID';

  return (
    <View style={styles.card}>
      {isOverdue && (
        <View style={styles.overdueBanner}>
          <Feather name="alert-circle" size={12} color={Colors.text} />
          <Text style={styles.overdueBannerText}>
            {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
          </Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{bill.bill_number ?? `Bill-${bill.id}`}</Text>
          <Text style={styles.cardSub}>{bill.vendor ?? 'Unknown Vendor'}</Text>
        </View>
        <View style={[styles.statusBadge, isPaid && styles.statusBadgeMuted]}>
          <Text style={[styles.statusText, isPaid && styles.statusTextMuted]}>{bill.status ?? '—'}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {bill.dt && (
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(bill.dt)}</Text>
          </View>
        )}
        {bill.due_date && (
          <View style={styles.metaItem}>
            <Feather name="clock" size={11} color={isOverdue ? Colors.text : Colors.textMuted} />
            <Text style={[styles.metaText, isOverdue && styles.metaTextOverdue]}>
              Due {formatShortDate(bill.due_date)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Total</Text>
          <Text style={styles.amtValue}>{formatCurrency(bill.amount ?? 0)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amtLabel}>Outstanding</Text>
          <Text style={[styles.amtValue, outstanding <= 0 && styles.amtValueMuted]}>
            {formatCurrency(outstanding)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function VendorCard({ vendor: v, onPress }: { vendor: APVendor; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{v.name ?? `Vendor ${v.id}`}</Text>
        {v.bills_count != null && (
          <Text style={styles.countBadge}>{v.bills_count} bills</Text>
        )}
        <Feather name="chevron-right" size={16} color={Colors.textMuted} />
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Outstanding</Text>
          <Text style={styles.amtValue}>{formatCurrency(v.outstanding ?? 0)}</Text>
        </View>
        {v.overdue != null && v.overdue > 0 && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amtLabel}>Overdue</Text>
            <Text style={[styles.amtValue, styles.amtValueBold]}>{formatCurrency(v.overdue)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Feather name={icon as any} size={32} color={Colors.textMuted} />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2, flex: 1 },

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
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overdueTabBadge: {
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.text,
  },
  overdueTabBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  kpiValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  kpiLabel: { ...Typography.bodySmall, color: Colors.textSecondary },

  agingCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  agingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  agingLabel: { fontSize: 12, color: Colors.textSecondary, width: 90 },
  agingBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  agingBarFill: { height: '100%', borderRadius: Radius.full },
  agingAmount: { fontSize: 12, fontWeight: '600', color: Colors.text, minWidth: 80, textAlign: 'right' },

  miniList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  miniName: { flex: 1, ...Typography.body },
  miniRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniAmount: { fontSize: 14, fontWeight: '700', color: Colors.text },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

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
  cardTitle: { ...Typography.h4 },
  cardSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

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

  cardMeta: { flexDirection: 'row', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  metaTextOverdue: { color: Colors.text, fontWeight: '700' },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amtLabel: { ...Typography.label },
  amtValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  amtValueMuted: { color: Colors.textMuted },
  amtValueBold: { fontWeight: '700' },

  countBadge: {
    fontSize: 11,
    color: Colors.textMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.background,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },

  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceHover,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  overdueBannerText: { fontSize: 12, fontWeight: '700', color: Colors.text },
});
