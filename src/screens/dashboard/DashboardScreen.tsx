import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { useOverdue } from '@/context/OverdueContext';
import { fetchDashboardData, fetchSupplyChainSnapshot, KPIs, RecentVoucher, SupplyChainSnapshot, VoucherTypeStat } from '@/api/dashboard';
import KPICard from '@/components/KPICard';
import SectionHeader from '@/components/SectionHeader';
import ErrorView from '@/components/ErrorView';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import CompanySelector from '@/components/CompanySelector';
import OfflineBanner from '@/components/OfflineBanner';
import VoucherActivityChart from '@/components/VoucherActivityChart';
import VoucherSparkline from '@/components/VoucherSparkline';
import RecentlyViewedSection from '@/components/RecentlyViewedSection';
import UpcomingDeliveriesSection from '@/components/UpcomingDeliveriesSection';
import DueSoonPaymentsSection from '@/components/DueSoonPaymentsSection';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import { getAutoRefreshInterval, getDueSoonDays } from '@/utils/settings';
import { getUnreadCount } from '@/utils/notificationLog';
import { getBookmarks } from '@/utils/bookmarks';
import { getRecentlyViewed, RecentItem } from '@/utils/recentlyViewed';
import { exportDashboardSummaryPDF } from '@/utils/pdfExport';
import { fetchAPBills, APBill } from '@/api/accountsPayable';
import { fetchARInvoices, ARInvoice } from '@/api/accountsReceivable';
import type { AppTabParamList } from '@/navigation/AppNavigator';

type Nav = BottomTabNavigationProp<AppTabParamList>;

function formatLastUpdated(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return '1 hr ago';
  return `${diffHr} hr ago`;
}

type QuickAction = {
  label: string;
  icon: string;
  navigate: (nav: Nav) => void;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Journal Entry',
    icon: 'book-open',
    navigate: (nav) => nav.navigate('Finance', { screen: 'JournalEntries' }),
  },
  {
    label: 'Purchase Order',
    icon: 'shopping-cart',
    navigate: (nav) => nav.navigate('More', { screen: 'PurchaseOrders' }),
  },
  {
    label: 'Sales Order',
    icon: 'package',
    navigate: (nav) => nav.navigate('More', { screen: 'SalesOrders' }),
  },
  {
    label: 'Goods Receipt',
    icon: 'truck',
    navigate: (nav) => nav.navigate('More', { screen: 'GRN' }),
  },
  {
    label: 'Trial Balance',
    icon: 'bar-chart-2',
    navigate: (nav) => nav.navigate('Finance', { screen: 'TrialBalance' }),
  },
  {
    label: 'Inventory',
    icon: 'box',
    navigate: (nav) => nav.navigate('Inventory'),
  },
  {
    label: 'Alerts',
    icon: 'bell',
    navigate: (nav) => nav.navigate('More', { screen: 'Alerts' } as any),
  },
  {
    label: 'Inbox',
    icon: 'inbox',
    navigate: (nav) => nav.navigate('More', { screen: 'Inbox' } as any),
  },
  {
    label: 'Bookmarks',
    icon: 'bookmark',
    navigate: (nav) => nav.navigate('More', { screen: 'Bookmarks' } as any),
  },
  {
    label: 'Cash Flow',
    icon: 'trending-up',
    navigate: (nav) => nav.navigate('Finance', { screen: 'CashFlow' } as any),
  },
  {
    label: 'Partners',
    icon: 'users',
    navigate: (nav) => nav.navigate('More', { screen: 'Partners' } as any),
  },
  {
    label: 'Reports',
    icon: 'pie-chart',
    navigate: (nav) => nav.navigate('Finance', { screen: 'FinancialReports' } as any),
  },
  {
    label: 'Deliveries',
    icon: 'calendar',
    navigate: (nav) => nav.navigate('More', { screen: 'DeliveryCalendar' } as any),
  },
  {
    label: 'Analytics',
    icon: 'trending-up',
    navigate: (nav) => nav.navigate('More', { screen: 'ProcurementAnalytics' } as any),
  },
];

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { authState, logout } = useAuth();
  const { selectedCompany } = useCompany();
  const { totalAlerts, apOverdue, arOverdue } = useOverdue();
  const user = authState.status === 'authenticated' ? authState.user : null;

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [vouchers, setVouchers] = useState<RecentVoucher[]>([]);
  const [voucherTypeStats, setVoucherTypeStats] = useState<VoucherTypeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [, setTick] = useState(0);
  const [supplyChain, setSupplyChain] = useState<SupplyChainSnapshot | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [dueSoonBills, setDueSoonBills] = useState<APBill[]>([]);
  const [dueSoonInvoices, setDueSoonInvoices] = useState<ARInvoice[]>([]);
  const [dueSoonDays, setDueSoonDays] = useState(7);

  const cacheKey = `dashboard:${selectedCompany?.id ?? 'all'}`;

  const load = useCallback(async (isRefresh = false, isSilent = false) => {
    let hadCachedData = false;
    if (isRefresh && !isSilent) {
      setRefreshing(true);
    } else if (!isRefresh && !isSilent) {
      const cached = await getCached<{ kpis: KPIs; recentVouchers: RecentVoucher[]; voucherTypeStats?: VoucherTypeStat[] }>(cacheKey);
      if (cached) {
        hadCachedData = true;
        setKpis(cached.data.kpis);
        setVouchers(cached.data.recentVouchers);
        setVoucherTypeStats(cached.data.voucherTypeStats ?? []);
        setIsStale(cached.stale);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    if (!isSilent) setError(null);
    try {
      const data = await fetchDashboardData(selectedCompany?.id ?? undefined);
      setKpis(data.kpis);
      setVouchers(data.recentVouchers);
      setVoucherTypeStats(data.voucherTypeStats);
      setIsStale(false);
      setLastUpdated(new Date());
      await setCached(cacheKey, { kpis: data.kpis, recentVouchers: data.recentVouchers, voucherTypeStats: data.voucherTypeStats });
    } catch (e: any) {
      if (isSilent) {
        // silent auto-refresh: don't clobber UI on transient failure
      } else if (hadCachedData) {
        setIsStale(true);
      } else {
        setError(String(e?.message ?? e));
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedCompany, cacheKey]);

  useEffect(() => { load(); }, [load]);

  // Lazy supply chain fetch — runs after main data, doesn't block render
  useEffect(() => {
    fetchSupplyChainSnapshot(selectedCompany?.id ?? undefined)
      .then(setSupplyChain)
      .catch(() => {});
  }, [selectedCompany]);

  // Re-read auto-refresh interval, inbox unread count, recently viewed, and due-soon on focus
  useFocusEffect(useCallback(() => {
    getAutoRefreshInterval().then(setAutoRefreshInterval);
    getUnreadCount().then(setInboxUnread);
    getBookmarks().then((list) => setBookmarkCount(list.length));
    getRecentlyViewed().then((items) => setRecentItems(items.slice(0, 5)));

    // Load due-soon payments from AP/AR cache (zero extra API calls)
    const cid = selectedCompany?.id ?? 'all';
    Promise.all([
      getDueSoonDays(),
      getCached<{ bills: APBill[] }>(`ap:${cid}`).then((c) =>
        c ? c.data.bills : fetchAPBills(selectedCompany?.id)
      ),
      getCached<{ invoices: ARInvoice[] }>(`ar:${cid}`).then((c) =>
        c ? c.data.invoices : fetchARInvoices(selectedCompany?.id)
      ),
    ]).then(([dsd, bills, invoices]) => {
      setDueSoonDays(dsd);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filterDueSoon = (dueDate: string | undefined, status: string | undefined) => {
        if (!dueDate) return false;
        const st = (status ?? '').toUpperCase();
        if (st === 'PAID' || st === 'RECEIVED' || st === 'CLOSED' || st === 'CANCELLED') return false;
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        const d = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
        return d >= 0 && d <= dsd;
      };

      setDueSoonBills((bills ?? []).filter((b) => filterDueSoon(b.due_date, b.status)));
      setDueSoonInvoices((invoices ?? []).filter((inv) => filterDueSoon(inv.due_date, inv.status)));
    }).catch(() => {});
  }, [selectedCompany]));

  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const ms = autoRefreshInterval * 60 * 1000;
    const timer = setInterval(() => { load(true, true); }, ms);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, load]);

  // Tick every 60s so the "Updated X min ago" label stays current
  useEffect(() => {
    if (!lastUpdated) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const handleExportPDF = async () => {
    if (!kpis) return;
    setExporting(true);
    try {
      await exportDashboardSummaryPDF({
        companyName: selectedCompany?.name ?? 'All Companies',
        asOf: new Date().toISOString().slice(0, 10),
        kpis,
        voucherTypeStats,
        recentVouchers: vouchers,
        supplyChain,
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (error && !kpis) return <ErrorView message={error} onRetry={() => load()} />;

  const netIncome = (kpis?.revenue ?? 0) - (kpis?.expenses ?? 0);

  function trendPct(current: number, prev: number | null | undefined): number | null {
    if (prev == null || prev === 0) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
  }
  const revenueTrend = trendPct(kpis?.revenue ?? 0, kpis?.revenuePrevMonth);
  const expensesTrend = trendPct(kpis?.expenses ?? 0, kpis?.expensesPrevMonth);
  const prevNetIncome =
    kpis?.revenuePrevMonth != null && kpis?.expensesPrevMonth != null
      ? kpis.revenuePrevMonth - kpis.expensesPrevMonth
      : null;
  const netIncomeTrend = trendPct(netIncome, prevNetIncome);
  const vouchersTrend = trendPct(kpis?.vouchersMonth ?? 0, kpis?.vouchersPrevMonth ?? null);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.greeting}>
            {greeting}, {user?.name?.split(' ')[0] ?? 'there'}
          </Text>
          <Text style={styles.subGreeting}>
            {user?.role ?? 'Poultry ERP'} · Today
            {lastUpdated
              ? ` · Updated ${formatLastUpdated(lastUpdated)}`
              : ''}
            {autoRefreshInterval > 0 ? ` · Refresh ${autoRefreshInterval}m` : ''}
          </Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('More', { screen: 'Search' } as any)}
          >
            <Feather name="search" size={18} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={handleExportPDF}
            disabled={exporting || !kpis}
          >
            {exporting
              ? <ActivityIndicator size="small" color={Colors.text} />
              : <Feather name="file-text" size={18} color={kpis ? Colors.text : Colors.textMuted} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.alertsBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('More', { screen: 'Alerts' } as any)}
          >
            <Feather name="bell" size={18} color={Colors.text} />
            {totalAlerts > 0 && (
              <View style={styles.alertsDot}>
                <Text style={styles.alertsDotText}>{totalAlerts > 9 ? '9+' : totalAlerts}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Feather name="log-out" size={14} color={Colors.textSecondary} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CompanySelector showAll />
      <OfflineBanner visible={isStale} />

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
        {error && (
          <View style={styles.inlineError}>
            <Feather name="alert-circle" size={14} color={Colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}

        {/* KPI Grid */}
        <SectionHeader
          title="This Month"
          meta={(() => {
            const base = `${kpis?.vouchersMonth ?? 0} vouchers`;
            if (vouchersTrend != null && isFinite(vouchersTrend)) {
              const sign = vouchersTrend >= 0 ? '+' : '';
              return `${base} · ${sign}${vouchersTrend.toFixed(0)}% vs last mo`;
            }
            return base;
          })()}
        />
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KPICard
              label="Revenue"
              value={formatCurrency(kpis?.revenue ?? 0)}
              subtext="Month to date · tap"
              trendPct={revenueTrend}
              onPress={() => navigation.navigate('Finance', { screen: 'FinancialReports' } as any)}
            />
            <KPICard
              label="Expenses"
              value={formatCurrency(kpis?.expenses ?? 0)}
              subtext="Month to date · tap"
              trendPct={expensesTrend}
              trendInverted
              onPress={() => navigation.navigate('Finance', { screen: 'JournalEntries' } as any)}
            />
          </View>
          <View style={styles.kpiRow}>
            <KPICard
              label="Net Income"
              value={formatCurrency(netIncome)}
              subtext={(netIncome >= 0 ? 'Profit' : 'Loss') + ' · tap'}
              trendPct={netIncomeTrend}
              onPress={() => navigation.navigate('Finance', { screen: 'FinancialReports' } as any)}
            />
            <KPICard
              label="Cash & Bank"
              value={formatCurrency(kpis?.cash ?? 0)}
              subtext="Current balance"
            />
          </View>
          <View style={styles.kpiRow}>
            <KPICard
              label="Receivables"
              value={formatCurrency(kpis?.totalAR ?? 0)}
              subtext="Total AR · tap to view"
              onPress={() => navigation.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
            />
            <KPICard
              label="Payables"
              value={formatCurrency(kpis?.totalAP ?? 0)}
              subtext="Total AP · tap to view"
              onPress={() => navigation.navigate('Finance', { screen: 'AccountsPayable' } as any)}
            />
          </View>
        </View>

        {/* Working Capital */}
        <SectionHeader title="Working Capital" />
        <View style={styles.wcCard}>
          <WCRow label="Cash & Bank" value={kpis?.cash ?? 0} />
          <WCRow label="+ Receivables" value={kpis?.totalAR ?? 0} />
          <WCRow label="− Payables" value={-(kpis?.totalAP ?? 0)} />
          <View style={styles.wcDivider} />
          <WCRow
            label="Net Working Capital"
            value={(kpis?.cash ?? 0) + (kpis?.totalAR ?? 0) - (kpis?.totalAP ?? 0)}
            bold
          />
        </View>

        {/* Finance Health — AR vs AP comparison, only when both loaded */}
        {kpis != null && (kpis.totalAR > 0 || kpis.totalAP > 0) && (() => {
          const ar = kpis.totalAR ?? 0;
          const ap = kpis.totalAP ?? 0;
          const net = ar - ap;
          const total = ar + ap;
          const arPct = total > 0 ? ar / total : 0.5;
          const ratio = ap > 0 ? ar / ap : null;
          return (
            <>
              <SectionHeader title="Finance Health" meta="AR vs AP" />
              <View style={styles.fhCard}>
                <View style={styles.fhBarTrack}>
                  <View style={[styles.fhBarAR, { flex: arPct }]} />
                  <View style={[styles.fhBarAP, { flex: 1 - arPct }]} />
                </View>
                <View style={styles.fhLegend}>
                  <View style={styles.fhLegendItem}>
                    <View style={[styles.fhDot, styles.fhDotAR]} />
                    <View>
                      <Text style={styles.fhLegendLabel}>RECEIVABLES</Text>
                      <Text style={styles.fhLegendValue}>{formatCurrency(ar)}</Text>
                    </View>
                  </View>
                  <View style={styles.fhLegendCenter}>
                    <Text style={styles.fhNetLabel}>{net >= 0 ? 'Net +' : 'Net '}{formatCurrency(Math.abs(net))}</Text>
                    {ratio != null && (
                      <Text style={styles.fhRatio}>ratio {ratio.toFixed(2)}×</Text>
                    )}
                  </View>
                  <View style={[styles.fhLegendItem, { alignItems: 'flex-end' }]}>
                    <View>
                      <Text style={[styles.fhLegendLabel, { textAlign: 'right' }]}>PAYABLES</Text>
                      <Text style={styles.fhLegendValue}>{formatCurrency(ap)}</Text>
                    </View>
                    <View style={[styles.fhDot, styles.fhDotAP]} />
                  </View>
                </View>
              </View>
            </>
          );
        })()}

        {/* Supply Chain Snapshot */}
        {supplyChain !== null && (
          <>
            <SectionHeader title="Supply Chain" meta="live" />
            <View style={styles.scRow}>
              <TouchableOpacity
                style={styles.scCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('More', { screen: 'PurchaseOrders' } as any)}
              >
                <Text style={styles.scCount}>{supplyChain.openPOs}</Text>
                <Text style={styles.scLabel}>Open POs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('More', { screen: 'SalesOrders' } as any)}
              >
                <Text style={styles.scCount}>{supplyChain.openSOs}</Text>
                <Text style={styles.scLabel}>Open SOs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Inventory')}
              >
                <Text style={styles.scCount}>{supplyChain.activeMaterials}</Text>
                <Text style={styles.scLabel}>Materials</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('More', { screen: 'DeliveryCalendar' } as any)}
              >
                <Text style={[
                  styles.scCount,
                  supplyChain.deliveriesOverdue > 0 && { fontWeight: '700' },
                ]}>
                  {supplyChain.deliveriesOverdue > 0
                    ? supplyChain.deliveriesOverdue
                    : supplyChain.deliveriesDueThisWeek}
                </Text>
                <Text style={styles.scLabel}>
                  {supplyChain.deliveriesOverdue > 0 ? 'Overdue' : 'Due 7d'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Upcoming Deliveries */}
        {supplyChain !== null && (supplyChain.openPOList.length > 0 || supplyChain.openSOList.length > 0) && (
          <>
            <SectionHeader title="Upcoming Deliveries" meta="next 14 days" />
            <UpcomingDeliveriesSection
              pos={supplyChain.openPOList}
              sos={supplyChain.openSOList}
              onPressEntry={(type, id) => {
                if (type === 'po') {
                  navigation.navigate('More', { screen: 'PurchaseOrderDetail', params: { id } } as any);
                } else {
                  navigation.navigate('More', { screen: 'SalesOrderDetail', params: { id } } as any);
                }
              }}
              onPressViewAll={() => navigation.navigate('More', { screen: 'DeliveryCalendar' } as any)}
            />
          </>
        )}

        {/* Finance Status — show when there are overdue items */}
        {(apOverdue > 0 || arOverdue > 0) && (
          <>
            <SectionHeader title="Finance Status" />
            <View style={styles.financeStatusRow}>
              {apOverdue > 0 && (
                <TouchableOpacity
                  style={styles.financeStatusCard}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Finance', { screen: 'AccountsPayable' } as any)}
                >
                  <View style={styles.financeStatusTop}>
                    <Feather name="alert-circle" size={14} color={Colors.textSecondary} />
                    <Text style={styles.financeStatusCount}>{apOverdue}</Text>
                  </View>
                  <Text style={styles.financeStatusLabel}>Overdue Bills</Text>
                  <Text style={styles.financeStatusSub}>Tap to view AP</Text>
                </TouchableOpacity>
              )}
              {arOverdue > 0 && (
                <TouchableOpacity
                  style={styles.financeStatusCard}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
                >
                  <View style={styles.financeStatusTop}>
                    <Feather name="alert-circle" size={14} color={Colors.textSecondary} />
                    <Text style={styles.financeStatusCount}>{arOverdue}</Text>
                  </View>
                  <Text style={styles.financeStatusLabel}>Overdue Invoices</Text>
                  <Text style={styles.financeStatusSub}>Tap to view AR</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Due Soon Payments — AP bills + AR invoices due within the configured window */}
        {(dueSoonBills.length > 0 || dueSoonInvoices.length > 0) && (
          <>
            <SectionHeader
              title="Upcoming Payments"
              meta={`due in ${dueSoonDays}d`}
            />
            <DueSoonPaymentsSection
              bills={dueSoonBills}
              invoices={dueSoonInvoices}
              dueSoonDays={dueSoonDays}
              onPressBills={() => navigation.navigate('Finance', { screen: 'AccountsPayable' } as any)}
              onPressInvoices={() => navigation.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
              onPressViewAll={() => navigation.navigate('Finance', { screen: 'CashFlow' } as any)}
            />
          </>
        )}

        {/* Inbox unread banner — shown when notification history has unread entries */}
        {inboxUnread > 0 && (
          <TouchableOpacity
            style={styles.inboxBanner}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('More', { screen: 'Inbox' } as any)}
          >
            <View style={styles.inboxBannerIcon}>
              <Feather name="inbox" size={15} color={Colors.text} />
              <View style={styles.inboxBannerDot} />
            </View>
            <Text style={styles.inboxBannerText}>
              {inboxUnread === 1
                ? '1 unread notification in your inbox'
                : `${inboxUnread} unread notifications in your inbox`}
            </Text>
            <Feather name="chevron-right" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Recently Viewed */}
        {recentItems.length > 0 && (
          <>
            <SectionHeader title="Recently Viewed" meta={`${recentItems.length} items`} />
            <RecentlyViewedSection
              items={recentItems}
              onPress={(item) => {
                switch (item.type) {
                  case 'po':
                    navigation.navigate('More', { screen: 'PurchaseOrderDetail', params: { id: Number(item.entityId) } } as any);
                    break;
                  case 'so':
                    navigation.navigate('More', { screen: 'SalesOrderDetail', params: { id: Number(item.entityId) } } as any);
                    break;
                  case 'partner':
                    navigation.navigate('More', {
                      screen: 'PartnerDetail',
                      params: {
                        partnerId: Number(item.entityId),
                        partnerName: item.title,
                        isVendor: Boolean(item.navParams?.isVendor),
                        isCustomer: Boolean(item.navParams?.isCustomer),
                      },
                    } as any);
                    break;
                  case 'material':
                    navigation.navigate('More', {
                      screen: 'MaterialDetail',
                      params: {
                        materialId: Number(item.entityId),
                        materialName: item.title,
                        materialCode: item.navParams?.materialCode as string | undefined,
                        materialType: item.navParams?.materialType as string | undefined,
                        materialUnit: item.navParams?.materialUnit as string | undefined,
                        materialCategory: item.navParams?.materialCategory as string | undefined,
                        materialStatus: item.navParams?.materialStatus as string | undefined,
                        materialDescription: item.navParams?.materialDescription as string | undefined,
                      },
                    } as any);
                    break;
                }
              }}
            />
          </>
        )}

        {/* Quick Actions */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((qa) => {
            const isAlerts = qa.label === 'Alerts';
            const isInbox = qa.label === 'Inbox';
            const isBookmarks = qa.label === 'Bookmarks';
            const badgeCount = isAlerts ? totalAlerts : isInbox ? inboxUnread : isBookmarks ? bookmarkCount : 0;
            return (
              <TouchableOpacity
                key={qa.label}
                style={styles.quickCard}
                activeOpacity={0.7}
                onPress={() => qa.navigate(navigation)}
              >
                <View style={styles.quickIconWrap}>
                  <Feather name={qa.icon as any} size={22} color={Colors.text} />
                  {badgeCount > 0 && (
                    <View style={styles.quickBadge}>
                      <Text style={styles.quickBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.quickLabel}>{qa.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 7-day sparkline */}
        {(kpis?.dailyVouchers?.length ?? 0) > 0 && (
          <>
            <SectionHeader title="Last 7 Days" meta="daily vouchers" />
            <VoucherSparkline days={kpis!.dailyVouchers} />
          </>
        )}

        {/* Voucher Activity by Type */}
        {voucherTypeStats.length > 0 && (
          <>
            <SectionHeader
              title="Activity by Type"
              meta={`${kpis?.vouchersMonth ?? 0} this month`}
            />
            <VoucherActivityChart stats={voucherTypeStats} />
          </>
        )}

        {/* Recent Vouchers */}
        <SectionHeader
          title="Recent Activity"
          meta={`${kpis?.vouchersToday ?? 0} today`}
        />
        {vouchers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recent vouchers</Text>
          </View>
        ) : (
          <View style={styles.voucherList}>
            {vouchers.map((v) => {
              const isDraft = v.status === 'DRAFT';
              return (
                <TouchableOpacity
                  key={v.id}
                  style={styles.voucherRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Finance', { screen: 'JournalEntries' } as any)}
                >
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{v.type}</Text>
                  </View>
                  <View style={styles.voucherInfo}>
                    <Text style={styles.voucherNum}>{v.number ?? `#${v.id}`}</Text>
                    <Text style={styles.voucherDate}>{formatShortDate(v.dt)}</Text>
                  </View>
                  <View style={styles.voucherRight}>
                    <Text style={styles.voucherAmount}>{formatCurrency(v.amount)}</Text>
                    <Text style={[styles.voucherStatus, isDraft && styles.voucherStatusDraft]}>
                      {v.status ?? '—'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.voucherViewAll}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Finance', { screen: 'JournalEntries' } as any)}
            >
              <Text style={styles.voucherViewAllText}>View all journal entries</Text>
              <Feather name="arrow-right" size={13} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function WCRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <View style={styles.wcRow}>
      <Text style={[styles.wcLabel, bold && styles.wcLabelBold]}>{label}</Text>
      <Text style={[styles.wcValue, bold && styles.wcValueBold]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBarLeft: { flex: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertsBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertsDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  alertsDotText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  greeting: { fontSize: 18, fontWeight: '700', color: Colors.text },
  subGreeting: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  logoutText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  inlineErrorText: { color: Colors.text, fontSize: 13, flex: 1 },

  kpiGrid: { paddingHorizontal: Spacing.md, gap: 10 },
  kpiRow: { flexDirection: 'row', gap: 10 },

  wcCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 10,
  },
  wcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wcLabel: { fontSize: 13, color: Colors.textSecondary },
  wcLabelBold: { fontWeight: '700', color: Colors.text, fontSize: 14 },
  wcValue: { fontSize: 13, fontWeight: '500', color: Colors.text },
  wcValueBold: { fontSize: 15, fontWeight: '700' },
  wcDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  fhCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  fhBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
  },
  fhBarAR: { backgroundColor: Colors.text },
  fhBarAP: { backgroundColor: Colors.textMuted },
  fhLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fhLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fhDot: { width: 8, height: 8, borderRadius: Radius.full },
  fhDotAR: { backgroundColor: Colors.text },
  fhDotAP: { backgroundColor: Colors.textMuted },
  fhLegendLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  fhLegendValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  fhLegendCenter: { alignItems: 'center' },
  fhNetLabel: { fontSize: 12, fontWeight: '700', color: Colors.text },
  fhRatio: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  scRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  scCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  scCount: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  scLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  financeStatusRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  financeStatusCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.text,
    padding: Spacing.md,
    gap: 4,
  },
  financeStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  financeStatusCount: { ...Typography.h1 },
  financeStatusLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  financeStatusSub: { fontSize: 11, color: Colors.textMuted },

  inboxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  inboxBannerIcon: {
    position: 'relative',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxBannerDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.surface,
  },
  inboxBannerText: { flex: 1, fontSize: 12, color: Colors.textSecondary },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  quickCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  quickIconWrap: {
    position: 'relative',
  },
  quickBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  quickBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  quickLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  voucherList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  voucherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: 10,
  },
  typeBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 42,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  typeText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  voucherInfo: { flex: 1 },
  voucherNum: { fontSize: 13, fontWeight: '600', color: Colors.text },
  voucherDate: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  voucherRight: { alignItems: 'flex-end' },
  voucherAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  voucherStatus: { fontSize: 10, fontWeight: '600', marginTop: 1, color: Colors.text },
  voucherStatusDraft: { color: Colors.textMuted, fontWeight: '400' },

  voucherViewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  voucherViewAllText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
