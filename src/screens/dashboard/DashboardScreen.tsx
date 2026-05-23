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
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { useOverdue } from '@/context/OverdueContext';
import { fetchDashboardData, KPIs, RecentVoucher, VoucherTypeStat } from '@/api/dashboard';
import KPICard from '@/components/KPICard';
import SectionHeader from '@/components/SectionHeader';
import ErrorView from '@/components/ErrorView';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import CompanySelector from '@/components/CompanySelector';
import OfflineBanner from '@/components/OfflineBanner';
import VoucherActivityChart from '@/components/VoucherActivityChart';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import type { AppTabParamList } from '@/navigation/AppNavigator';

type Nav = BottomTabNavigationProp<AppTabParamList>;

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

  const cacheKey = `dashboard:${selectedCompany?.id ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    let hadCachedData = false;
    if (isRefresh) {
      setRefreshing(true);
    } else {
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
    setError(null);
    try {
      const data = await fetchDashboardData(selectedCompany?.id ?? undefined);
      setKpis(data.kpis);
      setVouchers(data.recentVouchers);
      setVoucherTypeStats(data.voucherTypeStats);
      setIsStale(false);
      await setCached(cacheKey, { kpis: data.kpis, recentVouchers: data.recentVouchers, voucherTypeStats: data.voucherTypeStats });
    } catch (e: any) {
      if (hadCachedData) {
        setIsStale(true);
      } else {
        setError(String(e?.message ?? e));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompany, cacheKey]);

  useEffect(() => { load(); }, [load]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  if (loading) return <DashboardSkeleton />;
  if (error && !kpis) return <ErrorView message={error} onRetry={() => load()} />;

  const netIncome = (kpis?.revenue ?? 0) - (kpis?.expenses ?? 0);

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
        <SectionHeader title="This Month" meta={`${kpis?.vouchersMonth ?? 0} vouchers`} />
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KPICard
              label="Revenue"
              value={formatCurrency(kpis?.revenue ?? 0)}
              subtext="Month to date · tap"
              onPress={() => navigation.navigate('Finance', { screen: 'FinancialReports' } as any)}
            />
            <KPICard
              label="Expenses"
              value={formatCurrency(kpis?.expenses ?? 0)}
              subtext="Month to date · tap"
              onPress={() => navigation.navigate('Finance', { screen: 'JournalEntries' } as any)}
            />
          </View>
          <View style={styles.kpiRow}>
            <KPICard
              label="Net Income"
              value={formatCurrency(netIncome)}
              subtext={(netIncome >= 0 ? 'Profit' : 'Loss') + ' · tap'}
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

        {/* Quick Actions */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((qa) => {
            const isAlerts = qa.label === 'Alerts';
            return (
              <TouchableOpacity
                key={qa.label}
                style={styles.quickCard}
                activeOpacity={0.7}
                onPress={() => qa.navigate(navigation)}
              >
                <View style={styles.quickIconWrap}>
                  <Feather name={qa.icon as any} size={22} color={Colors.text} />
                  {isAlerts && totalAlerts > 0 && (
                    <View style={styles.quickBadge}>
                      <Text style={styles.quickBadgeText}>{totalAlerts > 9 ? '9+' : totalAlerts}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.quickLabel}>{qa.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
  financeStatusCount: { fontSize: 22, fontWeight: '700', color: Colors.text },
  financeStatusLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  financeStatusSub: { fontSize: 11, color: Colors.textMuted },

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
