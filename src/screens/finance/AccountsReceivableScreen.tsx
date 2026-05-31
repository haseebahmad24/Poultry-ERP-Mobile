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
  fetchARSummary,
  fetchARInvoices,
  fetchARCustomers,
  ARSummary,
  ARInvoice,
  ARCustomer,
} from '@/api/accountsReceivable';
import ErrorView from '@/components/ErrorView';
import FinanceSummarySkeleton from '@/components/FinanceSummarySkeleton';
import SectionHeader from '@/components/SectionHeader';
import CompanySelector from '@/components/CompanySelector';
import AgingChart, { AgingBucket } from '@/components/AgingChart';
import { useCompany } from '@/context/CompanyContext';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import OfflineBanner from '@/components/OfflineBanner';
import { useOverdue } from '@/context/OverdueContext';
import { exportARSummaryPDF } from '@/utils/pdfExport';
import { getDueSoonDays } from '@/utils/settings';

type ARNavProp = NativeStackNavigationProp<FinanceStackParamList>;

type Tab = 'summary' | 'invoices' | 'customers';

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

type InvoiceFilter = 'all' | 'overdue' | 'due-soon';

export default function AccountsReceivableScreen() {
  const { companyId, selectedCompany } = useCompany();
  const { setAROverdue } = useOverdue();
  const navigation = useNavigation<ARNavProp>();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [summary, setSummary] = useState<ARSummary>({});
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [customers, setCustomers] = useState<ARCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [dueSoonDays, setDueSoonDays] = useState(7);

  const cacheKey = `ar:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<{ summary: ARSummary; invoices: ARInvoice[]; customers: ARCustomer[] }>(cacheKey);
      if (cached) {
        setSummary(cached.data.summary);
        setInvoices(cached.data.invoices);
        setCustomers(cached.data.customers);
        setStale(cached.stale);
        setLoading(false);
        setAROverdue(cached.data.invoices.filter((inv) => daysOverdue(inv.due_date, inv.status) > 0).length);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [sum, invs, custs] = await Promise.all([
        fetchARSummary(companyId),
        fetchARInvoices(companyId),
        fetchARCustomers(companyId),
      ]);
      setSummary(sum);
      setInvoices(invs);
      setCustomers(custs);
      setStale(false);
      setAROverdue(invs.filter((inv) => daysOverdue(inv.due_date, inv.status) > 0).length);
      await setCached(cacheKey, { summary: sum, invoices: invs, customers: custs });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, cacheKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getDueSoonDays().then(setDueSoonDays); }, []);

  if (loading) return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Accounts Receivable</Text>
      </View>
      <CompanySelector />
      <FinanceSummarySkeleton />
    </SafeAreaView>
  );
  if (error && !summary.total_outstanding) {
    return <ErrorView message={error} onRetry={() => load()} />;
  }

  const searchedInvoices = invoiceSearch.trim()
    ? invoices.filter((inv) => {
        const q = invoiceSearch.toLowerCase();
        return (
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.customer?.toLowerCase().includes(q) ||
          inv.status?.toLowerCase().includes(q)
        );
      })
    : invoices;

  const filteredInvoices = searchedInvoices.filter((inv) => {
    if (invoiceFilter === 'overdue') return daysOverdue(inv.due_date, inv.status) > 0;
    if (invoiceFilter === 'due-soon') {
      const d = daysDueIn(inv.due_date, inv.status);
      return d >= 0 && d <= dueSoonDays;
    }
    return true;
  }).slice().sort((a, b) => {
    return daysOverdue(b.due_date, b.status) - daysOverdue(a.due_date, a.status);
  });

  const overdueCount = invoices.filter((inv) => daysOverdue(inv.due_date, inv.status) > 0).length;
  const dueSoonCount = invoices.filter((inv) => { const d = daysDueIn(inv.due_date, inv.status); return d >= 0 && d <= dueSoonDays; }).length;

  const filteredCustomers = customerSearch.trim()
    ? customers.filter((c) => c.name?.toLowerCase().includes(customerSearch.toLowerCase()))
    : customers;

  const aging = summary.aging ?? {};
  const arAgingBuckets: AgingBucket[] = [
    { label: 'Current',      shortLabel: 'Current',  amount: aging.current  ?? 0, fill: AGING_FILLS[0] },
    { label: '1–30 days',    shortLabel: '1–30d',    amount: aging.days_30  ?? 0, fill: AGING_FILLS[1] },
    { label: '31–60 days',   shortLabel: '31–60d',   amount: aging.days_60  ?? 0, fill: AGING_FILLS[2] },
    { label: '61–90 days',   shortLabel: '61–90d',   amount: aging.days_90  ?? 0, fill: AGING_FILLS[3] },
    { label: 'Over 90 days', shortLabel: '90d+',     amount: aging.over_90  ?? 0, fill: AGING_FILLS[4] },
  ];

  const handleExportPDF = async () => {
    await exportARSummaryPDF({
      summary,
      invoices,
      customers,
      companyName: selectedCompany?.name ?? 'All Companies',
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Accounts Receivable</Text>
        {!loading && invoices.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
            <Feather name="file-text" size={13} color={Colors.text} />
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      <CompanySelector />

      <View style={styles.tabBar}>
        {(['summary', 'invoices', 'customers'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              {t === 'invoices' && overdueCount > 0 && (
                <View style={styles.overdueTabBadge}>
                  <Text style={styles.overdueTabBadgeText}>{overdueCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <OfflineBanner visible={!!(stale && error)} />

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
              <KPICard label="Customers" value={String(summary.customers_count ?? customers.length)} />
              <KPICard label="Invoices" value={String(summary.invoices_count ?? invoices.length)} />
            </View>

            <SectionHeader title="Aging Analysis" />
            <View style={styles.agingCard}>
              <AgingChart buckets={arAgingBuckets} />
            </View>

            {customers.length > 0 && (
              <>
                <SectionHeader title="Top Customers" meta="By outstanding" />
                <View style={styles.miniList}>
                  {customers.slice(0, 5).map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.miniRow}
                      onPress={() => navigation.navigate('CustomerDetail', {
                        customerId: c.id,
                        customerName: c.name ?? `Customer ${c.id}`,
                        outstanding: c.outstanding,
                        overdue: c.overdue,
                      })}
                    >
                      <Text style={styles.miniName} numberOfLines={1}>{c.name ?? `Customer ${c.id}`}</Text>
                      <View style={styles.miniRowRight}>
                        <Text style={styles.miniAmount}>{formatCurrency(c.outstanding ?? 0)}</Text>
                        <Feather name="chevron-right" size={14} color={Colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {activeTab === 'invoices' && (
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Feather name="search" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search invoices, customers…"
                  placeholderTextColor={Colors.textMuted}
                  value={invoiceSearch}
                  onChangeText={setInvoiceSearch}
                />
                {invoiceSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setInvoiceSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.filterChips}>
                {(['all', 'overdue', 'due-soon'] as InvoiceFilter[]).map((f) => {
                  const label = f === 'all' ? 'All' : f === 'overdue' ? `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}` : `Due Soon${dueSoonCount > 0 ? ` (${dueSoonCount})` : ''}`;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterChip, invoiceFilter === f && styles.filterChipActive]}
                      onPress={() => setInvoiceFilter(f)}
                    >
                      <Text style={[styles.filterChipText, invoiceFilter === f && styles.filterChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <SectionHeader
              title="Invoices"
              meta={`${filteredInvoices.length} record${filteredInvoices.length !== 1 ? 's' : ''}${invoiceFilter !== 'all' ? ` · ${invoiceFilter === 'overdue' ? 'overdue filter' : `due in ${dueSoonDays}d`}` : ''}`}
            />
            {filteredInvoices.length === 0 ? (
              <EmptyState icon="file-text" message={invoiceSearch ? 'No invoices match search' : `No ${invoiceFilter !== 'all' ? invoiceFilter + ' ' : ''}invoices found`} />
            ) : (
              <View style={styles.cardList}>
                {filteredInvoices.map((inv) => (
                  <InvoiceCard key={inv.id} invoice={inv} overdueDays={daysOverdue(inv.due_date, inv.status)} />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'customers' && (
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Feather name="search" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search customers…"
                  placeholderTextColor={Colors.textMuted}
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                />
                {customerSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCustomerSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <SectionHeader title="Customers" meta={`${filteredCustomers.length} records`} />
            {filteredCustomers.length === 0 ? (
              <EmptyState icon="users" message={customerSearch ? 'No customers match search' : 'No customers found'} />
            ) : (
              <View style={styles.cardList}>
                {filteredCustomers.map((c) => (
                  <CustomerCard
                    key={c.id}
                    customer={c}
                    onPress={() => navigation.navigate('CustomerDetail', {
                      customerId: c.id,
                      customerName: c.name ?? `Customer ${c.id}`,
                      outstanding: c.outstanding,
                      overdue: c.overdue,
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

function InvoiceCard({ invoice: inv, overdueDays }: { invoice: ARInvoice; overdueDays: number }) {
  const outstanding = inv.outstanding ?? (inv.amount ?? 0) - (inv.paid ?? 0);
  const isOverdue = overdueDays > 0;
  const isPaid = (inv.status ?? '').toUpperCase() === 'PAID';

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
          <Text style={styles.cardTitle}>{inv.invoice_number ?? `INV-${inv.id}`}</Text>
          <Text style={styles.cardSub}>{inv.customer ?? 'Unknown Customer'}</Text>
        </View>
        <View style={[styles.statusBadge, isPaid && styles.statusBadgeMuted]}>
          <Text style={[styles.statusText, isPaid && styles.statusTextMuted]}>{inv.status ?? '—'}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {inv.dt && (
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(inv.dt)}</Text>
          </View>
        )}
        {inv.due_date && (
          <View style={styles.metaItem}>
            <Feather name="clock" size={11} color={isOverdue ? Colors.text : Colors.textMuted} />
            <Text style={[styles.metaText, isOverdue && styles.metaTextOverdue]}>
              Due {formatShortDate(inv.due_date)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Total</Text>
          <Text style={styles.amtValue}>{formatCurrency(inv.amount ?? 0)}</Text>
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

function CustomerCard({ customer: c, onPress }: { customer: ARCustomer; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{c.name ?? `Customer ${c.id}`}</Text>
        {c.invoices_count != null && (
          <Text style={styles.countBadge}>{c.invoices_count} invoices</Text>
        )}
        <Feather name="chevron-right" size={16} color={Colors.textMuted} />
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Outstanding</Text>
          <Text style={styles.amtValue}>{formatCurrency(c.outstanding ?? 0)}</Text>
        </View>
        {c.overdue != null && c.overdue > 0 && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amtLabel}>Overdue</Text>
            <Text style={[styles.amtValue, styles.amtValueBold]}>{formatCurrency(c.overdue)}</Text>
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  exportBtnText: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary },

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
    backgroundColor: Colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.text,
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
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 0,
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

  filterChips: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  filterChipActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  filterChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
});
