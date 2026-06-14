import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { AgingFills, Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import {
  fetchAPSummary,
  fetchAPBills,
  fetchAPVendors,
  APSummary,
  APBill,
  APVendor,
} from '@/api/accountsPayable';
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
import { exportAPSummaryPDF, exportFlaggedBillsPDF } from '@/utils/pdfExport';
import { exportAPBillsCSV } from '@/utils/csvExport';
import { getDueSoonDays } from '@/utils/settings';
import WeeklyScheduleCard, { WeekBucket } from '@/components/WeeklyScheduleCard';
import { getFlaggedIds, toggleFlagged, clearAllFlagged } from '@/utils/flaggedItems';
import { getReviewedIds, toggleReviewed, clearAllReviewed } from '@/utils/reviewedItems';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';

type APNavProp = NativeStackNavigationProp<FinanceStackParamList>;

type Tab = 'summary' | 'bills' | 'vendors';

// Grayscale aging fills — light (current) → dark (most overdue)
const AGING_FILLS = AgingFills;

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
  if (st === 'PAID' || st === 'CLOSED' || st === 'CANCELLED') return -9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / 86_400_000);
}

type BillFilter = 'all' | 'overdue' | 'due-soon';

export default function AccountsPayableScreen() {
  const { companyId, selectedCompany } = useCompany();
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
  const [billFilter, setBillFilter] = useState<BillFilter>('all');
  const [dueSoonDays, setDueSoonDays] = useState(7);
  const [flaggedBillIds, setFlaggedBillIds] = useState<Set<number>>(new Set());
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [reviewedBillIds, setReviewedBillIds] = useState<Set<number>>(new Set());
  const [showReviewedOnly, setShowReviewedOnly] = useState(false);
  const [billDateRange, setBillDateRange] = useState<DateRangeValue>({ from: '', to: '' });
  const [showDateFilter, setShowDateFilter] = useState(false);

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
  useEffect(() => { getDueSoonDays().then(setDueSoonDays); }, []);
  useEffect(() => { getFlaggedIds('bill').then(setFlaggedBillIds); }, []);
  useEffect(() => { getReviewedIds('bill').then(setReviewedBillIds); }, []);

  if (loading) return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Accounts Payable</Text>
      </View>
      <CompanySelector />
      <FinanceSummarySkeleton />
    </SafeAreaView>
  );
  if (error && !summary.total_outstanding) {
    return <ErrorView message={error} onRetry={() => load()} />;
  }

  const dateFilteredBills = (billDateRange.from || billDateRange.to)
    ? bills.filter((b) => {
        const d = b.dt ?? '';
        if (billDateRange.from && d < billDateRange.from) return false;
        if (billDateRange.to && d > billDateRange.to) return false;
        return true;
      })
    : bills;

  const searchedBills = billSearch.trim()
    ? dateFilteredBills.filter((b) => {
        const q = billSearch.toLowerCase();
        return (
          b.bill_number?.toLowerCase().includes(q) ||
          b.vendor?.toLowerCase().includes(q) ||
          b.status?.toLowerCase().includes(q)
        );
      })
    : dateFilteredBills;

  const filteredBills = searchedBills.filter((b) => {
    if (showFlaggedOnly && !flaggedBillIds.has(b.id)) return false;
    if (showReviewedOnly && !reviewedBillIds.has(b.id)) return false;
    if (billFilter === 'overdue') return daysOverdue(b.due_date, b.status) > 0;
    if (billFilter === 'due-soon') {
      const d = daysDueIn(b.due_date, b.status);
      return d >= 0 && d <= dueSoonDays;
    }
    return true;
  }).slice().sort((a, b) => {
    return daysOverdue(b.due_date, b.status) - daysOverdue(a.due_date, a.status);
  });

  const overdueCount = dateFilteredBills.filter((b) => daysOverdue(b.due_date, b.status) > 0).length;
  const dueSoonCount = dateFilteredBills.filter((b) => { const d = daysDueIn(b.due_date, b.status); return d >= 0 && d <= dueSoonDays; }).length;

  // Pay-by mini bar: bucket unpaid bills by urgency
  const payByStats = (() => {
    let overdueAmt = 0, weekAmt = 0, laterAmt = 0;
    for (const b of bills) {
      const outstanding = b.outstanding ?? (b.amount ?? 0) - (b.paid ?? 0);
      if (outstanding <= 0) continue;
      const od = daysOverdue(b.due_date, b.status);
      if (od > 0) { overdueAmt += outstanding; continue; }
      const dd = daysDueIn(b.due_date, b.status);
      if (dd >= 0 && dd <= 7) weekAmt += outstanding;
      else if (dd > 7) laterAmt += outstanding;
    }
    return { overdueAmt, weekAmt, laterAmt };
  })();

  // Weekly payment schedule — next 4 weeks + overdue
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
  const apWeeklyBuckets: WeekBucket[] = (() => {
    const buckets: WeekBucket[] = [
      { label: 'Overdue', sublabel: 'Past due', amount: 0, count: 0, isOverdue: true },
      { label: 'This Week', sublabel: fmtDateRange(getWeekRange(0).start, getWeekRange(0).end), amount: 0, count: 0 },
      { label: 'Week 2', sublabel: fmtDateRange(getWeekRange(1).start, getWeekRange(1).end), amount: 0, count: 0 },
      { label: 'Week 3', sublabel: fmtDateRange(getWeekRange(2).start, getWeekRange(2).end), amount: 0, count: 0 },
      { label: 'Week 4', sublabel: fmtDateRange(getWeekRange(3).start, getWeekRange(3).end), amount: 0, count: 0 },
      { label: 'Later', sublabel: '30+ days', amount: 0, count: 0 },
    ];
    for (const bill of bills) {
      const outstanding = bill.outstanding ?? (bill.amount ?? 0) - (bill.paid ?? 0);
      if (outstanding <= 0) continue;
      const od = daysOverdue(bill.due_date, bill.status);
      if (od > 0) { buckets[0].amount += outstanding; buckets[0].count++; continue; }
      const dd = daysDueIn(bill.due_date, bill.status);
      if (dd < 0) continue;
      if (dd < 7) { buckets[1].amount += outstanding; buckets[1].count++; }
      else if (dd < 14) { buckets[2].amount += outstanding; buckets[2].count++; }
      else if (dd < 21) { buckets[3].amount += outstanding; buckets[3].count++; }
      else if (dd < 30) { buckets[4].amount += outstanding; buckets[4].count++; }
      else { buckets[5].amount += outstanding; buckets[5].count++; }
    }
    return buckets;
  })();

  const filteredVendors = vendorSearch.trim()
    ? vendors.filter((v) => v.name?.toLowerCase().includes(vendorSearch.toLowerCase()))
    : vendors;

  // 30-day daily payment schedule — next 30 calendar days grouped by due_date
  const dailyPaymentSchedule: Array<{ dateStr: string; amount: number; count: number; isToday: boolean }> = (() => {
    const byDay = new Map<string, { amount: number; count: number }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const bill of bills) {
      if (!bill.due_date) continue;
      const outstanding = bill.outstanding ?? (bill.amount ?? 0) - (bill.paid ?? 0);
      if (outstanding <= 0) continue;
      const dd = daysDueIn(bill.due_date, bill.status);
      if (dd < 0 || dd >= 30) continue;
      const e = byDay.get(bill.due_date) ?? { amount: 0, count: 0 };
      e.amount += outstanding;
      e.count++;
      byDay.set(bill.due_date, e);
    }
    const todayStr = today.toISOString().slice(0, 10);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today.getTime() + i * 86_400_000);
      const dateStr = d.toISOString().slice(0, 10);
      const e = byDay.get(dateStr) ?? { amount: 0, count: 0 };
      return { dateStr, amount: e.amount, count: e.count, isToday: dateStr === todayStr };
    });
  })();

  const aging = summary.aging ?? {};
  const apAgingBuckets: AgingBucket[] = [
    { label: 'Current',      shortLabel: 'Current',  amount: aging.current  ?? 0, fill: AGING_FILLS[0] },
    { label: '1–30 days',    shortLabel: '1–30d',    amount: aging.days_30  ?? 0, fill: AGING_FILLS[1] },
    { label: '31–60 days',   shortLabel: '31–60d',   amount: aging.days_60  ?? 0, fill: AGING_FILLS[2] },
    { label: '61–90 days',   shortLabel: '61–90d',   amount: aging.days_90  ?? 0, fill: AGING_FILLS[3] },
    { label: 'Over 90 days', shortLabel: '90d+',     amount: aging.over_90  ?? 0, fill: AGING_FILLS[4] },
  ];

  const handleExportPDF = async () => {
    await exportAPSummaryPDF({
      summary,
      bills,
      vendors,
      companyName: selectedCompany?.name ?? 'All Companies',
    });
  };

  const handleExportBillsCSV = async () => {
    await exportAPBillsCSV({
      bills: filteredBills,
      companyName: selectedCompany?.name ?? 'All Companies',
    });
  };

  const handleExportFlaggedBillsPDF = async () => {
    const flaggedBills = filteredBills.filter((b) => flaggedBillIds.has(b.id));
    await exportFlaggedBillsPDF({
      bills: flaggedBills.length > 0 ? flaggedBills : filteredBills,
      companyName: selectedCompany?.name ?? 'All Companies',
      fromISO: billDateRange.from || undefined,
      toISO: billDateRange.to || undefined,
    });
  };

  const handleUnflagAll = async () => {
    await clearAllFlagged('bill');
    setFlaggedBillIds(new Set());
    setShowFlaggedOnly(false);
  };

  const handleUnreviewAll = async () => {
    await clearAllReviewed('bill');
    setReviewedBillIds(new Set());
    setShowReviewedOnly(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Accounts Payable</Text>
        {!loading && bills.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
            <Feather name="file-text" size={13} color={Colors.text} />
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        )}
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
              <KPICard label="Vendors" value={String(summary.vendors_count ?? vendors.length)} />
              <KPICard label="Bills" value={String(summary.bills_count ?? bills.length)} />
            </View>

            <SectionHeader title="Aging Analysis" />
            <View style={styles.agingCard}>
              <AgingChart buckets={apAgingBuckets} />
            </View>

            <SectionHeader title="Payment Schedule" meta="By week · upcoming" />
            <WeeklyScheduleCard buckets={apWeeklyBuckets} emptyLabel="No outstanding bills" />

            <SectionHeader title="30-Day Horizon" meta="Daily · tap for details" />
            <DailyPaymentCalendar
              days={dailyPaymentSchedule}
              onPressDay={(dateStr, amount, count) => {
                Alert.alert(
                  dateStr,
                  `${count} bill${count !== 1 ? 's' : ''} outstanding\nTotal: ${formatCurrency(amount)}`,
                );
              }}
            />

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
              <View style={styles.searchBar}>
                <Feather name="search" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search bills, vendors…"
                  placeholderTextColor={Colors.textMuted}
                  value={billSearch}
                  onChangeText={setBillSearch}
                />
                {billSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setBillSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                {(['all', 'overdue', 'due-soon'] as BillFilter[]).map((f) => {
                  const label = f === 'all' ? 'All' : f === 'overdue' ? `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}` : `Due Soon${dueSoonCount > 0 ? ` (${dueSoonCount})` : ''}`;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterChip, billFilter === f && styles.filterChipActive]}
                      onPress={() => setBillFilter(f)}
                    >
                      <Text style={[styles.filterChipText, billFilter === f && styles.filterChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.filterChip, showFlaggedOnly && styles.filterChipActive]}
                  onPress={() => setShowFlaggedOnly((v) => !v)}
                >
                  <Feather name="star" size={11} color={showFlaggedOnly ? Colors.surface : Colors.textSecondary} />
                  {flaggedBillIds.size > 0 && (
                    <Text style={[styles.filterChipText, showFlaggedOnly && styles.filterChipTextActive]}>
                      {` ${flaggedBillIds.size}`}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, showReviewedOnly && styles.filterChipActive]}
                  onPress={() => setShowReviewedOnly((v) => !v)}
                >
                  <Feather name="check-circle" size={11} color={showReviewedOnly ? Colors.surface : Colors.textSecondary} />
                  {reviewedBillIds.size > 0 && (
                    <Text style={[styles.filterChipText, showReviewedOnly && styles.filterChipTextActive]}>
                      {` ${reviewedBillIds.size}`}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, (showDateFilter || !!(billDateRange.from || billDateRange.to)) && styles.filterChipActive]}
                  onPress={() => {
                    if (showDateFilter) {
                      setShowDateFilter(false);
                      setBillDateRange({ from: '', to: '' });
                    } else {
                      setShowDateFilter(true);
                    }
                  }}
                >
                  <Feather name="calendar" size={11} color={(showDateFilter || billDateRange.from) ? Colors.surface : Colors.textSecondary} />
                  {(billDateRange.from || billDateRange.to) && (
                    <Text style={[styles.filterChipText, styles.filterChipTextActive]}>
                      {billDateRange.from ? billDateRange.from.slice(5) : '?'}–{billDateRange.to ? billDateRange.to.slice(5) : '?'}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
              {showDateFilter && (
                <DateRangeBar
                  value={billDateRange}
                  onChange={(v) => {
                    setBillDateRange(v);
                    if (!v.from && !v.to) setShowDateFilter(false);
                  }}
                />
              )}
            </View>
            {/* Pay-by summary row — shown when filter is 'all' and outstanding bills exist */}
            {billFilter === 'all' && bills.length > 0 && (payByStats.overdueAmt > 0 || payByStats.weekAmt > 0 || payByStats.laterAmt > 0) && (
              <View style={styles.payByBar}>
                {payByStats.overdueAmt > 0 && (
                  <View style={[styles.payByTile, styles.payByTileOverdue]}>
                    <Text style={styles.payByLabel}>OVERDUE</Text>
                    <Text style={styles.payByValue}>{formatCurrency(payByStats.overdueAmt)}</Text>
                  </View>
                )}
                {payByStats.weekAmt > 0 && (
                  <View style={styles.payByTile}>
                    <Text style={styles.payByLabel}>THIS WEEK</Text>
                    <Text style={styles.payByValue}>{formatCurrency(payByStats.weekAmt)}</Text>
                  </View>
                )}
                {payByStats.laterAmt > 0 && (
                  <View style={[styles.payByTile, styles.payByTileMuted]}>
                    <Text style={styles.payByLabel}>LATER</Text>
                    <Text style={[styles.payByValue, styles.payByValueMuted]}>{formatCurrency(payByStats.laterAmt)}</Text>
                  </View>
                )}
              </View>
            )}
            <SectionHeader
              title="Bills"
              meta={`${filteredBills.length} record${filteredBills.length !== 1 ? 's' : ''}${billFilter !== 'all' ? ` · ${billFilter === 'overdue' ? 'overdue filter' : `due in ${dueSoonDays}d`}` : ''}${billDateRange.from || billDateRange.to ? ` · ${billDateRange.from ? billDateRange.from.slice(5) : '?'}–${billDateRange.to ? billDateRange.to.slice(5) : '?'}` : ''}`}
              action={filteredBills.length > 0 ? (
                <View style={styles.actionRow}>
                  {showFlaggedOnly && flaggedBillIds.size > 0 && (
                    <>
                      <TouchableOpacity style={styles.csvBtn} onPress={handleExportFlaggedBillsPDF}>
                        <Feather name="file-text" size={11} color={Colors.textSecondary} />
                        <Text style={styles.csvBtnText}>PDF</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.csvBtn, styles.clearBtn]} onPress={handleUnflagAll}>
                        <Feather name="star" size={11} color={Colors.textSecondary} />
                        <Text style={styles.csvBtnText}>Unflag All</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {showReviewedOnly && reviewedBillIds.size > 0 && (
                    <TouchableOpacity style={[styles.csvBtn, styles.clearBtn]} onPress={handleUnreviewAll}>
                      <Feather name="check-circle" size={11} color={Colors.textSecondary} />
                      <Text style={styles.csvBtnText}>Clear Reviews</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.csvBtn} onPress={handleExportBillsCSV}>
                    <Feather name="download" size={11} color={Colors.textSecondary} />
                    <Text style={styles.csvBtnText}>CSV</Text>
                  </TouchableOpacity>
                </View>
              ) : undefined}
            />
            {filteredBills.length === 0 ? (
              <EmptyState icon="file-text" message={billSearch ? 'No bills match search' : 'No bills found'} />
            ) : (
              <View style={styles.cardList}>
                {filteredBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    overdueDays={daysOverdue(bill.due_date, bill.status)}
                    flagged={flaggedBillIds.has(bill.id)}
                    onToggleFlag={async () => {
                      await toggleFlagged('bill', bill.id);
                      const updated = await getFlaggedIds('bill');
                      setFlaggedBillIds(updated);
                    }}
                    reviewed={reviewedBillIds.has(bill.id)}
                    onToggleReview={async () => {
                      await toggleReviewed('bill', bill.id);
                      const updated = await getReviewedIds('bill');
                      setReviewedBillIds(updated);
                    }}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'vendors' && (
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Feather name="search" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search vendors…"
                  placeholderTextColor={Colors.textMuted}
                  value={vendorSearch}
                  onChangeText={setVendorSearch}
                />
                {vendorSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setVendorSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
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

function BillCard({ bill, overdueDays, flagged, onToggleFlag, reviewed, onToggleReview }: {
  bill: APBill;
  overdueDays: number;
  flagged?: boolean;
  onToggleFlag?: () => void;
  reviewed?: boolean;
  onToggleReview?: () => void;
}) {
  const outstanding = bill.outstanding ?? (bill.amount ?? 0) - (bill.paid ?? 0);
  const isOverdue = overdueDays > 0;
  const isPaid = (bill.status ?? '').toUpperCase() === 'PAID';

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
          <Text style={styles.cardTitle}>{bill.bill_number ?? `Bill-${bill.id}`}</Text>
          <Text style={styles.cardSub}>{bill.vendor ?? 'Unknown Vendor'}</Text>
        </View>
        <TouchableOpacity onPress={onToggleReview} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 4 }}>
          <Feather name="check-circle" size={16} color={reviewed ? Colors.text : Colors.borderLight} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggleFlag} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 8 }}>
          <Feather name="star" size={16} color={flagged ? Colors.text : Colors.borderLight} />
        </TouchableOpacity>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.text,
  },
  overdueTabBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.surface },

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
  filterChipTextActive: { color: Colors.surface, fontWeight: '600' },

  // Pay-by summary bar
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

// ─── Daily Payment Calendar ───────────────────────────────────────────────────

function fmtDayLabel(dateStr: string): { mo: string; day: string; dow: string } {
  const d = new Date(dateStr);
  return {
    mo: d.toLocaleString('default', { month: 'short' }),
    day: String(d.getDate()),
    dow: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()],
  };
}

function fmtAmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function DailyPaymentCalendar({
  days,
  onPressDay,
}: {
  days: Array<{ dateStr: string; amount: number; count: number; isToday: boolean }>;
  onPressDay: (dateStr: string, amount: number, count: number) => void;
}) {
  const maxAmt = Math.max(...days.map((d) => d.amount), 1);
  const hasAny = days.some((d) => d.count > 0);
  if (!hasAny) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={dpcStyles.scroll}
    >
      {days.map((day) => {
        const { mo, day: dayNum, dow } = fmtDayLabel(day.dateStr);
        const barH = day.amount > 0 ? Math.max(4, Math.round((day.amount / maxAmt) * 40)) : 0;
        const active = day.count > 0;
        return (
          <TouchableOpacity
            key={day.dateStr}
            style={[dpcStyles.cell, day.isToday && dpcStyles.cellToday]}
            activeOpacity={active ? 0.7 : 1}
            onPress={() => active && onPressDay(day.dateStr, day.amount, day.count)}
          >
            <Text style={[dpcStyles.dow, day.isToday && dpcStyles.dowToday]}>{dow}</Text>
            <Text style={[dpcStyles.dayNum, day.isToday && dpcStyles.dayNumToday]}>{dayNum}</Text>
            <Text style={[dpcStyles.mo, day.isToday && dpcStyles.moToday]}>{mo}</Text>
            <View style={dpcStyles.barTrack}>
              {barH > 0 && <View style={[dpcStyles.bar, { height: barH }, day.isToday && dpcStyles.barToday]} />}
            </View>
            {active && <Text style={[dpcStyles.amt, day.isToday && dpcStyles.amtToday]}>{fmtAmt(day.amount)}</Text>}
            {!active && <View style={dpcStyles.amtEmpty} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const dpcStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  cell: {
    width: 44,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  cellToday: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  dow: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.3 },
  dowToday: { color: Colors.surface },
  dayNum: { fontSize: 13, fontWeight: '700', color: Colors.text, marginTop: 1 },
  dayNumToday: { color: Colors.surface },
  mo: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  moToday: { color: Colors.surface },
  barTrack: { height: 44, justifyContent: 'flex-end', marginTop: 4 },
  bar: { width: 20, borderRadius: Radius.sm, backgroundColor: Colors.textSecondary },
  barToday: { backgroundColor: Colors.surface },
  amt: { fontSize: 10, fontWeight: '700', color: Colors.text, marginTop: 3 },
  amtToday: { color: Colors.surface },
  amtEmpty: { height: 12 },
});
