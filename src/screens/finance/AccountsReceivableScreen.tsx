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
import { exportARSummaryPDF, exportFlaggedInvoicesPDF } from '@/utils/pdfExport';
import { exportARInvoicesCSV } from '@/utils/csvExport';
import { getDueSoonDays } from '@/utils/settings';
import WeeklyScheduleCard, { WeekBucket } from '@/components/WeeklyScheduleCard';
import { getFlaggedIds, toggleFlagged, clearAllFlagged } from '@/utils/flaggedItems';
import { getReviewedIds, toggleReviewed, clearAllReviewed } from '@/utils/reviewedItems';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';

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
  const [flaggedInvoiceIds, setFlaggedInvoiceIds] = useState<Set<number>>(new Set());
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [reviewedInvoiceIds, setReviewedInvoiceIds] = useState<Set<number>>(new Set());
  const [showReviewedOnly, setShowReviewedOnly] = useState(false);
  const [invDateRange, setInvDateRange] = useState<DateRangeValue>({ from: '', to: '' });
  const [showDateFilter, setShowDateFilter] = useState(false);

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
  useEffect(() => { getFlaggedIds('invoice').then(setFlaggedInvoiceIds); }, []);
  useEffect(() => { getReviewedIds('invoice').then(setReviewedInvoiceIds); }, []);

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

  const dateFilteredInvoices = (invDateRange.from || invDateRange.to)
    ? invoices.filter((inv) => {
        const d = inv.dt ?? '';
        if (invDateRange.from && d < invDateRange.from) return false;
        if (invDateRange.to && d > invDateRange.to) return false;
        return true;
      })
    : invoices;

  const searchedInvoices = invoiceSearch.trim()
    ? dateFilteredInvoices.filter((inv) => {
        const q = invoiceSearch.toLowerCase();
        return (
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.customer?.toLowerCase().includes(q) ||
          inv.status?.toLowerCase().includes(q)
        );
      })
    : dateFilteredInvoices;

  const filteredInvoices = searchedInvoices.filter((inv) => {
    if (showFlaggedOnly && !flaggedInvoiceIds.has(inv.id)) return false;
    if (showReviewedOnly && !reviewedInvoiceIds.has(inv.id)) return false;
    if (invoiceFilter === 'overdue') return daysOverdue(inv.due_date, inv.status) > 0;
    if (invoiceFilter === 'due-soon') {
      const d = daysDueIn(inv.due_date, inv.status);
      return d >= 0 && d <= dueSoonDays;
    }
    return true;
  }).slice().sort((a, b) => {
    return daysOverdue(b.due_date, b.status) - daysOverdue(a.due_date, a.status);
  });

  const overdueCount = dateFilteredInvoices.filter((inv) => daysOverdue(inv.due_date, inv.status) > 0).length;
  const dueSoonCount = dateFilteredInvoices.filter((inv) => { const d = daysDueIn(inv.due_date, inv.status); return d >= 0 && d <= dueSoonDays; }).length;

  // Collect-by mini bar: bucket uncollected invoices by urgency
  const collectByStats = (() => {
    let overdueAmt = 0, weekAmt = 0, laterAmt = 0;
    for (const inv of invoices) {
      const outstanding = inv.outstanding ?? (inv.amount ?? 0) - (inv.paid ?? 0);
      if (outstanding <= 0) continue;
      const od = daysOverdue(inv.due_date, inv.status);
      if (od > 0) { overdueAmt += outstanding; continue; }
      const dd = daysDueIn(inv.due_date, inv.status);
      if (dd >= 0 && dd <= 7) weekAmt += outstanding;
      else if (dd > 7) laterAmt += outstanding;
    }
    return { overdueAmt, weekAmt, laterAmt };
  })();

  // Weekly collection schedule — next 4 weeks + overdue
  function getWeekRange(weekOffset: number): { start: Date; end: Date } {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(now.getTime() + weekOffset * 7 * 86_400_000);
    const end = new Date(start.getTime() + 6 * 86_400_000);
    return { start, end };
  }
  function fmtDateRange(start: Date, end: Date): string {
    const mo = (d: Date) => d.toLocaleString('default', { month: 'short' });
    const day = (d: Date) => d.getDate();
    if (start.getMonth() === end.getMonth()) return `${mo(start)} ${day(start)}–${day(end)}`;
    return `${mo(start)} ${day(start)}–${mo(end)} ${day(end)}`;
  }
  const arWeeklyBuckets: WeekBucket[] = (() => {
    const buckets: WeekBucket[] = [
      { label: 'Overdue', sublabel: 'Past due', amount: 0, count: 0, isOverdue: true },
      { label: 'This Week', sublabel: fmtDateRange(getWeekRange(0).start, getWeekRange(0).end), amount: 0, count: 0 },
      { label: 'Week 2', sublabel: fmtDateRange(getWeekRange(1).start, getWeekRange(1).end), amount: 0, count: 0 },
      { label: 'Week 3', sublabel: fmtDateRange(getWeekRange(2).start, getWeekRange(2).end), amount: 0, count: 0 },
      { label: 'Week 4', sublabel: fmtDateRange(getWeekRange(3).start, getWeekRange(3).end), amount: 0, count: 0 },
      { label: 'Later', sublabel: '30+ days', amount: 0, count: 0 },
    ];
    for (const inv of invoices) {
      const outstanding = inv.outstanding ?? (inv.amount ?? 0) - (inv.paid ?? 0);
      if (outstanding <= 0) continue;
      const od = daysOverdue(inv.due_date, inv.status);
      if (od > 0) { buckets[0].amount += outstanding; buckets[0].count++; continue; }
      const dd = daysDueIn(inv.due_date, inv.status);
      if (dd < 0) continue;
      if (dd < 7) { buckets[1].amount += outstanding; buckets[1].count++; }
      else if (dd < 14) { buckets[2].amount += outstanding; buckets[2].count++; }
      else if (dd < 21) { buckets[3].amount += outstanding; buckets[3].count++; }
      else if (dd < 30) { buckets[4].amount += outstanding; buckets[4].count++; }
      else { buckets[5].amount += outstanding; buckets[5].count++; }
    }
    return buckets;
  })();

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

  const handleExportInvoicesCSV = async () => {
    await exportARInvoicesCSV({
      invoices: filteredInvoices,
      companyName: selectedCompany?.name ?? 'All Companies',
    });
  };

  const handleExportFlaggedInvoicesPDF = async () => {
    const flaggedInvoices = filteredInvoices.filter((inv) => flaggedInvoiceIds.has(inv.id));
    await exportFlaggedInvoicesPDF({
      invoices: flaggedInvoices.length > 0 ? flaggedInvoices : filteredInvoices,
      companyName: selectedCompany?.name ?? 'All Companies',
      fromISO: invDateRange.from || undefined,
      toISO: invDateRange.to || undefined,
    });
  };

  const handleUnflagAll = async () => {
    await clearAllFlagged('invoice');
    setFlaggedInvoiceIds(new Set());
    setShowFlaggedOnly(false);
  };

  const handleUnreviewAll = async () => {
    await clearAllReviewed('invoice');
    setReviewedInvoiceIds(new Set());
    setShowReviewedOnly(false);
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

            <SectionHeader title="Collection Schedule" meta="By week · upcoming" />
            <WeeklyScheduleCard buckets={arWeeklyBuckets} emptyLabel="No outstanding invoices" />

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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.filterChips}
              >
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
                <TouchableOpacity
                  style={[styles.filterChip, showFlaggedOnly && styles.filterChipActive]}
                  onPress={() => setShowFlaggedOnly((v) => !v)}
                >
                  <Feather name="star" size={11} color={showFlaggedOnly ? '#fff' : Colors.textSecondary} />
                  {flaggedInvoiceIds.size > 0 && (
                    <Text style={[styles.filterChipText, showFlaggedOnly && styles.filterChipTextActive]}>
                      {` ${flaggedInvoiceIds.size}`}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, showReviewedOnly && styles.filterChipActive]}
                  onPress={() => setShowReviewedOnly((v) => !v)}
                >
                  <Feather name="check-circle" size={11} color={showReviewedOnly ? '#fff' : Colors.textSecondary} />
                  {reviewedInvoiceIds.size > 0 && (
                    <Text style={[styles.filterChipText, showReviewedOnly && styles.filterChipTextActive]}>
                      {` ${reviewedInvoiceIds.size}`}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, (showDateFilter || !!(invDateRange.from || invDateRange.to)) && styles.filterChipActive]}
                  onPress={() => {
                    if (showDateFilter) {
                      setShowDateFilter(false);
                      setInvDateRange({ from: '', to: '' });
                    } else {
                      setShowDateFilter(true);
                    }
                  }}
                >
                  <Feather name="calendar" size={11} color={(showDateFilter || invDateRange.from) ? '#fff' : Colors.textSecondary} />
                  {(invDateRange.from || invDateRange.to) && (
                    <Text style={[styles.filterChipText, styles.filterChipTextActive]}>
                      {invDateRange.from ? invDateRange.from.slice(5) : '?'}–{invDateRange.to ? invDateRange.to.slice(5) : '?'}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
              {showDateFilter && (
                <DateRangeBar
                  value={invDateRange}
                  onChange={(v) => {
                    setInvDateRange(v);
                    if (!v.from && !v.to) setShowDateFilter(false);
                  }}
                />
              )}
            </View>
            {/* Collect-by summary row — shown when filter is 'all' and outstanding invoices exist */}
            {invoiceFilter === 'all' && invoices.length > 0 && (collectByStats.overdueAmt > 0 || collectByStats.weekAmt > 0 || collectByStats.laterAmt > 0) && (
              <View style={styles.payByBar}>
                {collectByStats.overdueAmt > 0 && (
                  <View style={[styles.payByTile, styles.payByTileOverdue]}>
                    <Text style={styles.payByLabel}>OVERDUE</Text>
                    <Text style={styles.payByValue}>{formatCurrency(collectByStats.overdueAmt)}</Text>
                  </View>
                )}
                {collectByStats.weekAmt > 0 && (
                  <View style={styles.payByTile}>
                    <Text style={styles.payByLabel}>THIS WEEK</Text>
                    <Text style={styles.payByValue}>{formatCurrency(collectByStats.weekAmt)}</Text>
                  </View>
                )}
                {collectByStats.laterAmt > 0 && (
                  <View style={[styles.payByTile, styles.payByTileMuted]}>
                    <Text style={styles.payByLabel}>LATER</Text>
                    <Text style={[styles.payByValue, styles.payByValueMuted]}>{formatCurrency(collectByStats.laterAmt)}</Text>
                  </View>
                )}
              </View>
            )}
            <SectionHeader
              title="Invoices"
              meta={`${filteredInvoices.length} record${filteredInvoices.length !== 1 ? 's' : ''}${invoiceFilter !== 'all' ? ` · ${invoiceFilter === 'overdue' ? 'overdue filter' : `due in ${dueSoonDays}d`}` : ''}${invDateRange.from || invDateRange.to ? ` · ${invDateRange.from ? invDateRange.from.slice(5) : '?'}–${invDateRange.to ? invDateRange.to.slice(5) : '?'}` : ''}`}
              action={filteredInvoices.length > 0 ? (
                <View style={styles.actionRow}>
                  {showFlaggedOnly && flaggedInvoiceIds.size > 0 && (
                    <>
                      <TouchableOpacity style={styles.csvBtn} onPress={handleExportFlaggedInvoicesPDF}>
                        <Feather name="file-text" size={11} color={Colors.textSecondary} />
                        <Text style={styles.csvBtnText}>PDF</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.csvBtn, styles.clearBtn]} onPress={handleUnflagAll}>
                        <Feather name="star" size={11} color={Colors.textSecondary} />
                        <Text style={styles.csvBtnText}>Unflag All</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {showReviewedOnly && reviewedInvoiceIds.size > 0 && (
                    <TouchableOpacity style={[styles.csvBtn, styles.clearBtn]} onPress={handleUnreviewAll}>
                      <Feather name="check-circle" size={11} color={Colors.textSecondary} />
                      <Text style={styles.csvBtnText}>Clear Reviews</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.csvBtn} onPress={handleExportInvoicesCSV}>
                    <Feather name="download" size={11} color={Colors.textSecondary} />
                    <Text style={styles.csvBtnText}>CSV</Text>
                  </TouchableOpacity>
                </View>
              ) : undefined}
            />
            {filteredInvoices.length === 0 ? (
              <EmptyState icon="file-text" message={invoiceSearch ? 'No invoices match search' : `No ${invoiceFilter !== 'all' ? invoiceFilter + ' ' : ''}invoices found`} />
            ) : (
              <View style={styles.cardList}>
                {filteredInvoices.map((inv) => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    overdueDays={daysOverdue(inv.due_date, inv.status)}
                    flagged={flaggedInvoiceIds.has(inv.id)}
                    onToggleFlag={async () => {
                      await toggleFlagged('invoice', inv.id);
                      const updated = await getFlaggedIds('invoice');
                      setFlaggedInvoiceIds(updated);
                    }}
                    reviewed={reviewedInvoiceIds.has(inv.id)}
                    onToggleReview={async () => {
                      await toggleReviewed('invoice', inv.id);
                      const updated = await getReviewedIds('invoice');
                      setReviewedInvoiceIds(updated);
                    }}
                  />
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

function InvoiceCard({ invoice: inv, overdueDays, flagged, onToggleFlag, reviewed, onToggleReview }: {
  invoice: ARInvoice;
  overdueDays: number;
  flagged?: boolean;
  onToggleFlag?: () => void;
  reviewed?: boolean;
  onToggleReview?: () => void;
}) {
  const outstanding = inv.outstanding ?? (inv.amount ?? 0) - (inv.paid ?? 0);
  const isOverdue = overdueDays > 0;
  const isPaid = (inv.status ?? '').toUpperCase() === 'PAID';

  return (
    <View style={[styles.card, reviewed && styles.cardReviewed]}>
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
        <TouchableOpacity onPress={onToggleReview} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 4 }}>
          <Feather name="check-circle" size={16} color={reviewed ? Colors.text : Colors.borderLight} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggleFlag} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 8 }}>
          <Feather name="star" size={16} color={flagged ? Colors.text : Colors.borderLight} />
        </TouchableOpacity>
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
  csvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  csvBtnText: { fontSize: 10, fontWeight: '500', color: Colors.textSecondary },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtn: { borderColor: Colors.borderLight },

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
  cardReviewed: { opacity: 0.6 },
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
    paddingRight: Spacing.md,
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

  // Collect-by summary bar
  payByBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  payByTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  payByTileOverdue: { backgroundColor: Colors.surfaceHover },
  payByTileMuted: { opacity: 0.7 },
  payByLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  payByValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  payByValueMuted: { color: Colors.textSecondary },
});
