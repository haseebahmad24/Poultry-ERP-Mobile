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
import { useAuth } from '@/context/AuthContext';
import { fetchDashboardData, KPIs, RecentVoucher } from '@/api/dashboard';
import KPICard from '@/components/KPICard';
import SectionHeader from '@/components/SectionHeader';
import ErrorView from '@/components/ErrorView';
import LoadingView from '@/components/LoadingView';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { formatCurrency, formatShortDate } from '@/utils/currency';

const VOUCHER_COLORS: Record<string, { bg: string; fg: string }> = {
  JV:  { bg: '#e8eaf6', fg: '#283593' },
  GRN: { bg: '#e8f5e9', fg: '#2e7d32' },
  DN:  { bg: '#fff3e0', fg: '#e65100' },
  PAY: { bg: '#e3f2fd', fg: '#1565c0' },
  REC: { bg: '#f3e5f5', fg: '#6a1b9a' },
  INV: { bg: '#fce4ec', fg: '#c62828' },
  SO:  { bg: '#e0f7fa', fg: '#00695c' },
  PO:  { bg: '#f1f8e9', fg: '#558b2f' },
};

const QUICK_ACTIONS = [
  { label: 'Journal Entry', icon: '📒', screen: 'JournalEntries', enabled: false },
  { label: 'Purchase Order', icon: '🛒', screen: 'PurchaseOrders', enabled: true },
  { label: 'Sales Order', icon: '📦', screen: 'SalesOrders', enabled: false },
  { label: 'Goods Receipt', icon: '🚚', screen: 'GRN', enabled: false },
  { label: 'Trial Balance', icon: '⚖️', screen: 'TrialBalance', enabled: false },
  { label: 'Inventory', icon: '🏭', screen: 'Inventory', enabled: true },
  { label: 'Materials', icon: '🧪', screen: 'Materials', enabled: true },
];

export default function DashboardScreen({ navigation }: any) {
  const { authState, logout } = useAuth();
  const user = authState.status === 'authenticated' ? authState.user : null;

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [vouchers, setVouchers] = useState<RecentVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardData();
      setKpis(data.kpis);
      setVouchers(data.recentVouchers);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  if (loading) return <LoadingView message="Loading dashboard…" />;
  if (error && !kpis) return <ErrorView message={error} onRetry={() => load()} />;

  const netIncome = (kpis?.revenue ?? 0) - (kpis?.expenses ?? 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

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
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
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
        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* KPI Grid */}
        <SectionHeader title="This Month" meta={`${kpis?.vouchersMonth ?? 0} vouchers`} />
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KPICard
              label="Revenue"
              value={formatCurrency(kpis?.revenue ?? 0)}
              subtext="Month to date"
              valueColor={Colors.success}
            />
            <KPICard
              label="Expenses"
              value={formatCurrency(kpis?.expenses ?? 0)}
              subtext="Month to date"
              valueColor={Colors.danger}
            />
          </View>
          <View style={styles.kpiRow}>
            <KPICard
              label="Net Income"
              value={formatCurrency(netIncome)}
              subtext={netIncome >= 0 ? 'Profit' : 'Loss'}
              valueColor={netIncome >= 0 ? Colors.success : Colors.danger}
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
              subtext="Total AR"
              valueColor={Colors.primaryLight}
            />
            <KPICard
              label="Payables"
              value={formatCurrency(kpis?.totalAP ?? 0)}
              subtext="Total AP"
              valueColor={Colors.orange}
            />
          </View>
        </View>

        {/* Working Capital */}
        <SectionHeader title="Working Capital" />
        <View style={styles.wcCard}>
          <WCRow label="Cash & Bank" value={kpis?.cash ?? 0} />
          <WCRow label="+ Receivables" value={kpis?.totalAR ?? 0} color={Colors.primaryLight} />
          <WCRow label="− Payables" value={-(kpis?.totalAP ?? 0)} color={Colors.orange} />
          <View style={styles.wcDivider} />
          <WCRow
            label="Net Working Capital"
            value={(kpis?.cash ?? 0) + (kpis?.totalAR ?? 0) - (kpis?.totalAP ?? 0)}
            bold
            color={((kpis?.cash ?? 0) + (kpis?.totalAR ?? 0) - (kpis?.totalAP ?? 0)) >= 0
              ? Colors.success : Colors.danger}
          />
        </View>

        {/* Quick Actions */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((qa) => (
            <TouchableOpacity
              key={qa.screen}
              style={[styles.quickCard, !qa.enabled && styles.quickCardDisabled]}
              activeOpacity={qa.enabled ? 0.7 : 1}
              onPress={() => qa.enabled && navigation.navigate(qa.screen)}
            >
              <Text style={[styles.quickIcon, !qa.enabled && { opacity: 0.4 }]}>{qa.icon}</Text>
              <Text style={[styles.quickLabel, !qa.enabled && styles.quickLabelDisabled]}>
                {qa.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
              const colors = VOUCHER_COLORS[v.type] ?? { bg: '#f5f5f5', fg: '#546e7a' };
              const statusColor =
                v.status === 'POSTED'
                  ? Colors.success
                  : v.status === 'DRAFT'
                  ? Colors.warning
                  : Colors.textMuted;
              return (
                <View key={v.id} style={styles.voucherRow}>
                  <View style={[styles.typeBadge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.typeText, { color: colors.fg }]}>{v.type}</Text>
                  </View>
                  <View style={styles.voucherInfo}>
                    <Text style={styles.voucherNum}>{v.number ?? `#${v.id}`}</Text>
                    <Text style={styles.voucherDate}>{formatShortDate(v.dt)}</Text>
                  </View>
                  <View style={styles.voucherRight}>
                    <Text style={styles.voucherAmount}>{formatCurrency(v.amount)}</Text>
                    <Text style={[styles.voucherStatus, { color: statusColor }]}>
                      {v.status ?? '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
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
  color,
  bold,
}: {
  label: string;
  value: number;
  color?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.wcRow}>
      <Text style={[styles.wcLabel, bold && styles.wcLabelBold]}>{label}</Text>
      <Text style={[styles.wcValue, { color: color ?? Colors.text }, bold && styles.wcValueBold]}>
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
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  topBarLeft: { flex: 1 },
  greeting: { fontSize: 18, fontWeight: '700', color: '#fff' },
  subGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  inlineError: {
    backgroundColor: '#fce4ec',
    marginHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  inlineErrorText: { color: Colors.danger, fontSize: 13 },

  kpiGrid: { paddingHorizontal: Spacing.md, gap: 10 },
  kpiRow: { flexDirection: 'row', gap: 10 },

  wcCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.card,
    gap: 10,
  },
  wcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wcLabel: { fontSize: 13, color: Colors.textSecondary },
  wcLabelBold: { fontWeight: '700', color: Colors.text, fontSize: 14 },
  wcValue: { fontSize: 13, fontWeight: '600' },
  wcValueBold: { fontSize: 15, fontWeight: '700' },
  wcDivider: { height: 1, backgroundColor: Colors.border },

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
    padding: Spacing.sm + 4,
    alignItems: 'center',
    gap: 6,
    ...Shadow.subtle,
  },
  quickCardDisabled: { opacity: 0.55 },
  quickIcon: { fontSize: 26 },
  quickLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  quickLabelDisabled: { color: Colors.textMuted },

  voucherList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
  },
  voucherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 10,
  },
  typeBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 42,
    alignItems: 'center',
  },
  typeText: { fontSize: 11, fontWeight: '700' },
  voucherInfo: { flex: 1 },
  voucherNum: { fontSize: 13, fontWeight: '600', color: Colors.text },
  voucherDate: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  voucherRight: { alignItems: 'flex-end' },
  voucherAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  voucherStatus: { fontSize: 10, fontWeight: '500', marginTop: 1 },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadow.subtle,
  },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
