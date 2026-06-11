import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { AgingFills, Colors, Radius, Spacing, Typography } from '@/theme';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import { getAutoRefreshInterval, getDueSoonDays } from '@/utils/settings';
import { getUnreadCount } from '@/utils/notificationLog';
import { getBookmarks } from '@/utils/bookmarks';
import { getRecentlyViewed, RecentItem } from '@/utils/recentlyViewed';
import { getFlaggedIds } from '@/utils/flaggedItems';
import { exportDashboardSummaryPDF, exportUpcomingPaymentsPDF, exportFlaggedCombinedPDF } from '@/utils/pdfExport';
import { saveKpiSnapshot, loadKpiHistory, KpiHistoryEntry } from '@/utils/kpiHistory';
import { fetchAPBills, APBill } from '@/api/accountsPayable';
import { fetchARInvoices, ARInvoice } from '@/api/accountsReceivable';
import type { AppTabParamList } from '@/navigation/AppNavigator';

type Nav = BottomTabNavigationProp<AppTabParamList>;

// ─── Aging mini-chart types & helpers ────────────────────────────────────────

interface AgingMicroBucket {
  label: string;
  amount: number;
  fill: string;
}

const AGING_MICRO_FILLS = AgingFills;

function computeClientAging(
  items: Array<{ outstanding?: number; amount?: number; paid?: number; due_date?: string; status?: string }>,
): AgingMicroBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let current = 0, d30 = 0, d60 = 0, d90 = 0, over90 = 0;
  for (const item of items) {
    const st = (item.status ?? '').toUpperCase();
    if (['PAID', 'RECEIVED', 'CLOSED', 'CANCELLED'].includes(st)) continue;
    const amt = item.outstanding ?? Math.max(0, (item.amount ?? 0) - (item.paid ?? 0));
    if (!item.due_date) { current += amt; continue; }
    const due = new Date(item.due_date);
    due.setHours(0, 0, 0, 0);
    const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
    if (days <= 0) current += amt;
    else if (days <= 30) d30 += amt;
    else if (days <= 60) d60 += amt;
    else if (days <= 90) d90 += amt;
    else over90 += amt;
  }
  return [
    { label: 'Current', amount: current, fill: AGING_MICRO_FILLS[0] },
    { label: '1-30d', amount: d30, fill: AGING_MICRO_FILLS[1] },
    { label: '31-60d', amount: d60, fill: AGING_MICRO_FILLS[2] },
    { label: '61-90d', amount: d90, fill: AGING_MICRO_FILLS[3] },
    { label: '90+d', amount: over90, fill: AGING_MICRO_FILLS[4] },
  ];
}

function AgingMiniBar({ buckets }: { buckets: AgingMicroBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  const nonZero = buckets.filter((b) => b.amount > 0);
  if (total === 0) return (
    <Text style={agingMicroStyles.emptyLabel}>No outstanding</Text>
  );
  return (
    <View style={agingMicroStyles.row}>
      <View style={agingMicroStyles.barTrack}>
        {nonZero.map((b) => (
          <View key={b.label} style={[agingMicroStyles.barSegment, { flex: b.amount / total, backgroundColor: b.fill }]} />
        ))}
      </View>
      <View style={agingMicroStyles.legend}>
        {nonZero.map((b) => (
          <View key={b.label} style={agingMicroStyles.legendItem}>
            <View style={[agingMicroStyles.dot, { backgroundColor: b.fill }]} />
            <Text style={agingMicroStyles.legendLabel}>{b.label}</Text>
            <Text style={agingMicroStyles.legendAmt}>{formatCurrency(b.amount)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const agingMicroStyles = StyleSheet.create({
  row: { gap: 6 },
  barTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
  },
  barSegment: { height: '100%' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: Radius.full },
  legendLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  legendAmt: { fontSize: 10, color: Colors.text, fontWeight: '700' },
  emptyLabel: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
});

// ─── Month-over-Month Billing Card ───────────────────────────────────────────

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function MoMRow({
  label,
  thisVal,
  prevVal,
  thisLabel,
  prevLabel,
  last,
}: {
  label: string;
  thisVal: number;
  prevVal: number;
  thisLabel: string;
  prevLabel: string;
  last?: boolean;
}) {
  const pctChange = prevVal > 0 ? ((thisVal - prevVal) / prevVal) * 100 : null;
  const isUp = pctChange != null && pctChange > 0;
  const isDown = pctChange != null && pctChange < 0;
  return (
    <View style={[momStyles.row, !last && momStyles.rowBorder]}>
      <Text style={momStyles.rowLabel}>{label}</Text>
      <View style={momStyles.rowValues}>
        <View style={momStyles.monthBlock}>
          <Text style={momStyles.monthLabel}>{prevLabel}</Text>
          <Text style={momStyles.monthValue}>{fmtK(prevVal)}</Text>
        </View>
        <Feather
          name={isUp ? 'trending-up' : isDown ? 'trending-down' : 'minus'}
          size={14}
          color={isUp ? Colors.textSecondary : isDown ? Colors.text : Colors.textMuted}
        />
        <View style={momStyles.monthBlock}>
          <Text style={momStyles.monthLabel}>{thisLabel}</Text>
          <Text style={[momStyles.monthValue, momStyles.thisMoValue]}>{fmtK(thisVal)}</Text>
        </View>
        {pctChange != null && (
          <View style={[momStyles.badge, isUp ? momStyles.badgeUp : isDown ? momStyles.badgeDown : momStyles.badgeFlat]}>
            <Text style={momStyles.badgeText}>
              {pctChange > 0 ? '+' : ''}{pctChange.toFixed(0)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const momStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rowLabel: { width: 24, fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  rowValues: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  monthBlock: { flex: 1, alignItems: 'center' },
  monthLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500', textTransform: 'uppercase' },
  monthValue: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginTop: 1 },
  thisMoValue: { color: Colors.text },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeUp: { backgroundColor: Colors.borderLight },
  badgeDown: { backgroundColor: Colors.borderLight },
  badgeFlat: { backgroundColor: Colors.borderLight },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.text },
});

// ─── Week Activity ───────────────────────────────────────────────────────────

interface WeekActivity {
  thisCount: number;
  thisAmount: number;
  lastCount: number;
  lastAmount: number;
}

function computeWeekActivity(vouchers: RecentVoucher[]): WeekActivity | null {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const daysToMon = dow === 0 ? -6 : 1 - dow;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + daysToMon);
  thisMonday.setHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  let thisCount = 0, thisAmount = 0;
  let lastCount = 0, lastAmount = 0;

  for (const v of vouchers) {
    if (!v.dt) continue;
    const d = new Date(v.dt);
    if (d >= thisMonday) { thisCount++; thisAmount += v.amount ?? 0; }
    else if (d >= lastMonday) { lastCount++; lastAmount += v.amount ?? 0; }
  }

  if (thisCount === 0 && lastCount === 0) return null;
  return { thisCount, thisAmount, lastCount, lastAmount };
}

function WeekActivityCard({
  activity,
  onPress,
}: {
  activity: WeekActivity;
  onPress?: () => void;
}) {
  const pctChange = activity.lastCount > 0
    ? Math.round(((activity.thisCount - activity.lastCount) / activity.lastCount) * 100)
    : null;
  const isUp = pctChange != null && pctChange > 0;
  const isDown = pctChange != null && pctChange < 0;

  return (
    <TouchableOpacity
      style={waStyles.card}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
    >
      <View style={waStyles.tile}>
        <Text style={waStyles.tileCount}>{activity.thisCount}</Text>
        <Text style={waStyles.tileLabel}>THIS WEEK</Text>
        <Text style={waStyles.tileAmount}>{fmtK(activity.thisAmount)}</Text>
      </View>
      <View style={waStyles.divider} />
      <View style={waStyles.centerTile}>
        <Feather
          name={isUp ? 'trending-up' : isDown ? 'trending-down' : 'minus'}
          size={20}
          color={isUp ? Colors.text : isDown ? Colors.textSecondary : Colors.textMuted}
        />
        {pctChange != null && (
          <Text style={[waStyles.pctText, isUp && waStyles.pctUp, isDown && waStyles.pctDown]}>
            {pctChange > 0 ? '+' : ''}{pctChange}%
          </Text>
        )}
        <Text style={waStyles.vsLabel}>vs last week</Text>
      </View>
      <View style={waStyles.divider} />
      <View style={waStyles.tile}>
        <Text style={[waStyles.tileCount, waStyles.tileCountMuted]}>{activity.lastCount}</Text>
        <Text style={waStyles.tileLabel}>LAST WEEK</Text>
        <Text style={waStyles.tileAmount}>{fmtK(activity.lastAmount)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const waStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: 3,
  },
  centerTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 3,
    backgroundColor: Colors.background,
  },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  tileCount: { fontSize: 22, fontWeight: '700', color: Colors.text },
  tileCountMuted: { color: Colors.textSecondary },
  tileLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  tileAmount: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  pctText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  pctUp: { color: Colors.text },
  pctDown: { color: Colors.textSecondary },
  vsLabel: { fontSize: 10, color: Colors.textMuted },
});

// ─── Financial Health Score ───────────────────────────────────────────────────

interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  apPct: number;
  arPct: number;
}

function computeHealthScore(
  apBuckets: AgingMicroBucket[],
  arBuckets: AgingMicroBucket[],
): HealthScore | null {
  const apTotal = apBuckets.reduce((s, b) => s + b.amount, 0);
  const arTotal = arBuckets.reduce((s, b) => s + b.amount, 0);
  if (apTotal === 0 && arTotal === 0) return null;

  // Healthy = current (bucket 0) + at-risk 1-30d (bucket 1)
  const apHealthy = (apBuckets[0]?.amount ?? 0) + (apBuckets[1]?.amount ?? 0);
  const arHealthy = (arBuckets[0]?.amount ?? 0) + (arBuckets[1]?.amount ?? 0);
  const apPct = apTotal > 0 ? Math.round((apHealthy / apTotal) * 100) : 100;
  const arPct = arTotal > 0 ? Math.round((arHealthy / arTotal) * 100) : 100;

  // Weight equally; if one side has no data default to 100%
  const score = Math.round((apPct + arPct) / 2);
  const grade: HealthScore['grade'] =
    score >= 85 ? 'A' :
    score >= 70 ? 'B' :
    score >= 55 ? 'C' :
    score >= 40 ? 'D' : 'F';

  return { score, grade, apPct, arPct };
}

function FinancialHealthCard({ apBuckets, arBuckets, onPress }: {
  apBuckets: AgingMicroBucket[];
  arBuckets: AgingMicroBucket[];
  onPress?: () => void;
}) {
  const hs = computeHealthScore(apBuckets, arBuckets);
  const gradeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hs) return;
    gradeAnim.setValue(0);
    Animated.spring(gradeAnim, {
      toValue: 1,
      tension: 120,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [hs?.grade]);  // re-animate when grade changes

  if (!hs) return null;

  const gradeLabel: Record<string, string> = {
    A: 'Excellent', B: 'Good', C: 'Fair', D: 'At Risk', F: 'Critical',
  };

  const gradeScale = gradeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  const cardInner = (
    <>
      <View style={healthStyles.topRow}>
        <View style={healthStyles.scoreBlock}>
          <Text style={healthStyles.scoreNum}>{hs.score}</Text>
          <Text style={healthStyles.scoreLabel}>/ 100</Text>
        </View>
        <Animated.View style={[healthStyles.gradeBadge, { transform: [{ scale: gradeScale }] }]}>
          <Text style={healthStyles.gradeText}>{hs.grade}</Text>
        </Animated.View>
        <View style={healthStyles.statusBlock}>
          <Text style={healthStyles.statusLabel}>Financial Health</Text>
          <Text style={healthStyles.statusDesc}>{gradeLabel[hs.grade]}</Text>
        </View>
        {onPress && <Feather name="chevron-right" size={16} color={Colors.textMuted} />}
      </View>
      <View style={healthStyles.barsSection}>
        <View style={healthStyles.barRow}>
          <Text style={healthStyles.barLabel}>AP</Text>
          <View style={healthStyles.barTrack}>
            <View style={[healthStyles.barFill, { width: `${hs.apPct}%` as any }]} />
          </View>
          <Text style={healthStyles.barPct}>{hs.apPct}%</Text>
        </View>
        <View style={healthStyles.barRow}>
          <Text style={healthStyles.barLabel}>AR</Text>
          <View style={healthStyles.barTrack}>
            <View style={[healthStyles.barFill, { width: `${hs.arPct}%` as any }]} />
          </View>
          <Text style={healthStyles.barPct}>{hs.arPct}%</Text>
        </View>
      </View>
      <Text style={healthStyles.hint}>
        % of outstanding not yet overdue 30+ days{onPress ? ' · tap for full breakdown' : ''}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={healthStyles.card} onPress={onPress} activeOpacity={0.75}>
        {cardInner}
      </TouchableOpacity>
    );
  }
  return <View style={healthStyles.card}>{cardInner}</View>;
}

const healthStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scoreBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  scoreNum: { fontSize: 36, fontWeight: '800', color: Colors.text, lineHeight: 40 },
  scoreLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  gradeBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: { fontSize: 20, fontWeight: '900', color: Colors.surface },
  statusBlock: { flex: 1 },
  statusLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statusDesc: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 2 },
  barsSection: { gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, width: 20 },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  barPct: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, width: 32, textAlign: 'right' },
  hint: { fontSize: 10, color: Colors.textMuted },
});

// ─────────────────────────────────────────────────────────────────────────────

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
    icon: 'bar-chart',
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
  const [exportingPayments, setExportingPayments] = useState(false);
  const [exportingCombined, setExportingCombined] = useState(false);
  const [dueSoonBills, setDueSoonBills] = useState<APBill[]>([]);
  const [dueSoonInvoices, setDueSoonInvoices] = useState<ARInvoice[]>([]);
  const [topVendors, setTopVendors] = useState<Array<{ name: string; outstanding: number; billCount: number }>>([]);
  const [topCustomers, setTopCustomers] = useState<Array<{ name: string; outstanding: number; invoiceCount: number }>>([]);
  const [dueSoonDays, setDueSoonDays] = useState(7);
  const [flaggedBillCount, setFlaggedBillCount] = useState(0);
  const [flaggedInvoiceCount, setFlaggedInvoiceCount] = useState(0);
  const [apAgingBuckets, setApAgingBuckets] = useState<AgingMicroBucket[]>([]);
  const [arAgingBuckets, setArAgingBuckets] = useState<AgingMicroBucket[]>([]);
  const [monthComparison, setMonthComparison] = useState<{
    apThis: number; apPrev: number; arThis: number; arPrev: number;
    thisLabel: string; prevLabel: string;
  } | null>(null);
  const [kpiHistory, setKpiHistory] = useState<KpiHistoryEntry[]>([]);

  const cacheKey = `dashboard:${selectedCompany?.id ?? 'all'}`;

  const weekActivity = useMemo(() => computeWeekActivity(vouchers), [vouchers]);


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
      // Save daily KPI snapshot and refresh sparkline history
      await saveKpiSnapshot(selectedCompany?.id, data.kpis);
      loadKpiHistory(selectedCompany?.id).then(setKpiHistory).catch(() => {});
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
  useEffect(() => {
    loadKpiHistory(selectedCompany?.id).then(setKpiHistory).catch(() => {});
  }, [selectedCompany]);

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
    getFlaggedIds('bill').then((ids) => setFlaggedBillCount(ids.size));
    getFlaggedIds('invoice').then((ids) => setFlaggedInvoiceCount(ids.size));

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

      // Top vendors by outstanding balance (across all unpaid bills)
      const vendorMap = new Map<string, { outstanding: number; billCount: number }>();
      for (const b of (bills ?? [])) {
        const st = (b.status ?? '').toUpperCase();
        if (st === 'PAID' || st === 'CLOSED' || st === 'CANCELLED') continue;
        const name = b.vendor ?? 'Unknown';
        const amt = b.outstanding ?? 0;
        const v = vendorMap.get(name);
        if (v) { v.outstanding += amt; v.billCount += 1; }
        else vendorMap.set(name, { outstanding: amt, billCount: 1 });
      }
      const vendors = Array.from(vendorMap.entries())
        .map(([name, v]) => ({ name, ...v }))
        .filter((v) => v.outstanding > 0)
        .sort((a, b) => b.outstanding - a.outstanding)
        .slice(0, 3);
      setTopVendors(vendors);

      // Top customers by outstanding AR balance (across all unpaid invoices)
      const customerMap = new Map<string, { outstanding: number; invoiceCount: number }>();
      for (const inv of (invoices ?? [])) {
        const st = (inv.status ?? '').toUpperCase();
        if (st === 'PAID' || st === 'RECEIVED' || st === 'CLOSED' || st === 'CANCELLED') continue;
        const name = inv.customer ?? 'Unknown';
        const amt = inv.outstanding ?? 0;
        const c = customerMap.get(name);
        if (c) { c.outstanding += amt; c.invoiceCount += 1; }
        else customerMap.set(name, { outstanding: amt, invoiceCount: 1 });
      }
      const customers = Array.from(customerMap.entries())
        .map(([name, c]) => ({ name, ...c }))
        .filter((c) => c.outstanding > 0)
        .sort((a, b) => b.outstanding - a.outstanding)
        .slice(0, 3);
      setTopCustomers(customers);

      // Aging buckets computed client-side from all unpaid bills/invoices
      setApAgingBuckets(computeClientAging(bills ?? []));
      setArAgingBuckets(computeClientAging(invoices ?? []));

      // Month-over-month billing comparison
      const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now2 = new Date();
      const thisYM = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`;
      const prevDate = new Date(now2.getFullYear(), now2.getMonth() - 1, 1);
      const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const apThis = (bills ?? []).filter((b) => b.dt?.startsWith(thisYM)).reduce((s, b) => s + (b.amount ?? 0), 0);
      const apPrev = (bills ?? []).filter((b) => b.dt?.startsWith(prevYM)).reduce((s, b) => s + (b.amount ?? 0), 0);
      const arThis = (invoices ?? []).filter((inv) => inv.dt?.startsWith(thisYM)).reduce((s, inv) => s + (inv.amount ?? 0), 0);
      const arPrev = (invoices ?? []).filter((inv) => inv.dt?.startsWith(prevYM)).reduce((s, inv) => s + (inv.amount ?? 0), 0);
      if (apThis > 0 || apPrev > 0 || arThis > 0 || arPrev > 0) {
        setMonthComparison({
          apThis, apPrev, arThis, arPrev,
          thisLabel: MONTH_SHORT[now2.getMonth()],
          prevLabel: MONTH_SHORT[prevDate.getMonth()],
        });
      }
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

  const handleExportCombined = useCallback(async () => {
    setExportingCombined(true);
    try {
      const cid = selectedCompany?.id ?? 'all';
      const [flaggedBillIds, flaggedInvoiceIds, allBills, allInvoices] = await Promise.all([
        getFlaggedIds('bill'),
        getFlaggedIds('invoice'),
        getCached<{ bills: APBill[] }>(`ap:${cid}`).then((c) =>
          c ? c.data.bills : fetchAPBills(selectedCompany?.id)
        ),
        getCached<{ invoices: ARInvoice[] }>(`ar:${cid}`).then((c) =>
          c ? c.data.invoices : fetchARInvoices(selectedCompany?.id)
        ),
      ]);
      const flaggedBills = (allBills ?? []).filter((b) => flaggedBillIds.has(b.id));
      const flaggedInvoices = (allInvoices ?? []).filter((inv) => flaggedInvoiceIds.has(inv.id));
      await exportFlaggedCombinedPDF({
        bills: flaggedBills,
        invoices: flaggedInvoices,
        companyName: selectedCompany?.name,
      });
    } catch {
      // ignore
    } finally {
      setExportingCombined(false);
    }
  }, [selectedCompany]);

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
          <CompanySelector showAll variant="compact" />
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
              miniChart={prevNetIncome != null ? { prev: prevNetIncome, curr: netIncome } : undefined}
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

        {/* Quick Stats — 7-day KPI history sparkline */}
        {kpiHistory.length >= 1 && (
          <>
            <SectionHeader title="Revenue Trend" meta="month-to-date · last 7 days" />
            <QuickStatsCard
              history={kpiHistory}
              onPress={() => navigation.navigate('Finance', { screen: 'FinancialReports' } as any)}
            />
          </>
        )}

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

        {/* Month-over-Month AP/AR Billing Comparison */}
        {monthComparison != null && (
          <>
            <SectionHeader
              title="Month vs Month"
              meta="AP & AR billed · current vs prior"
            />
            <View style={momStyles.card}>
              <MoMRow
                label="AP"
                thisVal={monthComparison.apThis}
                prevVal={monthComparison.apPrev}
                thisLabel={monthComparison.thisLabel}
                prevLabel={monthComparison.prevLabel}
              />
              <MoMRow
                label="AR"
                thisVal={monthComparison.arThis}
                prevVal={monthComparison.arPrev}
                thisLabel={monthComparison.thisLabel}
                prevLabel={monthComparison.prevLabel}
                last
              />
            </View>
          </>
        )}

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

        {/* AP / AR Aging Breakdown */}
        {(apAgingBuckets.some((b) => b.amount > 0) || arAgingBuckets.some((b) => b.amount > 0)) && (
          <>
            <SectionHeader
              title="Aging Breakdown"
              meta="AP · AR outstanding"
              action={
                <TouchableOpacity
                  onPress={() => navigation.navigate('More', { screen: 'FinancialAnalytics' } as any)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View style={styles.topVendorsSeeAllRow}>
                    <Text style={styles.topVendorsSeeAll}>Analytics</Text>
                    <Feather name="chevron-right" size={12} color={Colors.text} />
                  </View>
                </TouchableOpacity>
              }
            />
            <View style={styles.agingMiniCard}>
              <View style={styles.agingMiniRow}>
                <Text style={styles.agingMiniRowLabel}>AP · Payable</Text>
                <AgingMiniBar buckets={apAgingBuckets} />
              </View>
              <View style={styles.agingMiniDivider} />
              <View style={styles.agingMiniRow}>
                <Text style={styles.agingMiniRowLabel}>AR · Receivable</Text>
                <AgingMiniBar buckets={arAgingBuckets} />
              </View>
            </View>
          </>
        )}

        {/* Financial Health Score */}
        {(apAgingBuckets.some((b) => b.amount > 0) || arAgingBuckets.some((b) => b.amount > 0)) && (
          <>
            <SectionHeader title="Financial Health Score" />
            <FinancialHealthCard
              apBuckets={apAgingBuckets}
              arBuckets={arAgingBuckets}
              onPress={() => navigation.navigate('More', { screen: 'FinancialAnalytics' } as any)}
            />
          </>
        )}

        {/* Top Vendors by Outstanding AP Balance */}
        {topVendors.length > 0 && (
          <>
            <SectionHeader
              title="Top Vendors"
              meta="by outstanding"
              action={
                <TouchableOpacity
                  onPress={() => navigation.navigate('Finance', { screen: 'AccountsPayable' } as any)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.topVendorsSeeAll}>View AP</Text>
                </TouchableOpacity>
              }
            />
            <View style={styles.topVendorsCard}>
              {topVendors.map((v, i) => {
                const maxOutstanding = topVendors[0].outstanding;
                const pct = maxOutstanding > 0 ? v.outstanding / maxOutstanding : 0;
                return (
                  <React.Fragment key={v.name}>
                    {i > 0 && <View style={styles.topVendorDivider} />}
                    <TouchableOpacity
                      style={styles.topVendorRow}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('Finance', { screen: 'AccountsPayable' } as any)}
                    >
                      <View style={styles.topVendorRank}>
                        <Text style={styles.topVendorRankText}>{i + 1}</Text>
                      </View>
                      <View style={styles.topVendorInfo}>
                        <Text style={styles.topVendorName} numberOfLines={1}>{v.name}</Text>
                        <View style={styles.topVendorBar}>
                          <View style={[styles.topVendorBarFill, { width: `${pct * 100}%` }]} />
                        </View>
                      </View>
                      <View style={styles.topVendorAmounts}>
                        <Text style={styles.topVendorAmt}>{formatCurrency(v.outstanding)}</Text>
                        <Text style={styles.topVendorCount}>{v.billCount} bill{v.billCount !== 1 ? 's' : ''}</Text>
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}

        {/* Top Customers by Outstanding AR Balance */}
        {topCustomers.length > 0 && (
          <>
            <SectionHeader
              title="Top Customers"
              meta="by outstanding"
              action={
                <TouchableOpacity
                  onPress={() => navigation.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.topVendorsSeeAll}>View AR</Text>
                </TouchableOpacity>
              }
            />
            <View style={styles.topVendorsCard}>
              {topCustomers.map((c, i) => {
                const maxOutstanding = topCustomers[0].outstanding;
                const pct = maxOutstanding > 0 ? c.outstanding / maxOutstanding : 0;
                return (
                  <React.Fragment key={c.name}>
                    {i > 0 && <View style={styles.topVendorDivider} />}
                    <TouchableOpacity
                      style={styles.topVendorRow}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
                    >
                      <View style={styles.topVendorRank}>
                        <Text style={styles.topVendorRankText}>{i + 1}</Text>
                      </View>
                      <View style={styles.topVendorInfo}>
                        <Text style={styles.topVendorName} numberOfLines={1}>{c.name}</Text>
                        <View style={styles.topVendorBar}>
                          <View style={[styles.topCustomerBarFill, { width: `${pct * 100}%` }]} />
                        </View>
                      </View>
                      <View style={styles.topVendorAmounts}>
                        <Text style={styles.topVendorAmt}>{formatCurrency(c.outstanding)}</Text>
                        <Text style={styles.topVendorCount}>{c.invoiceCount} invoice{c.invoiceCount !== 1 ? 's' : ''}</Text>
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}

        {/* This Week Cash Flow — compact AP outflow vs AR inflow summary */}
        {(dueSoonBills.length > 0 || dueSoonInvoices.length > 0) && (() => {
          const apTotal = dueSoonBills.reduce((s, b) => s + (b.outstanding ?? 0), 0);
          const arTotal = dueSoonInvoices.reduce((s, inv) => s + (inv.outstanding ?? 0), 0);
          const net = arTotal - apTotal;
          return (
            <>
              <SectionHeader
                title="Upcoming Cash"
                meta={`next ${dueSoonDays}d · outflow vs inflow`}
              />
              <View style={styles.weekCashCard}>
                <TouchableOpacity
                  style={styles.weekCashTile}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Finance', { screen: 'AccountsPayable' } as any)}
                >
                  <Text style={styles.weekCashTileValue}>{fmtK(apTotal)}</Text>
                  <Text style={styles.weekCashTileLabel}>AP Outflow</Text>
                  <Text style={styles.weekCashTileCount}>{dueSoonBills.length} bill{dueSoonBills.length !== 1 ? 's' : ''}</Text>
                </TouchableOpacity>
                <View style={styles.weekCashDivider} />
                <View style={styles.weekCashNetTile}>
                  <Text style={[
                    styles.weekCashNetValue,
                    net >= 0 ? styles.weekCashNetPos : styles.weekCashNetNeg,
                  ]}>
                    {net >= 0 ? '+' : ''}{fmtK(net)}
                  </Text>
                  <Text style={styles.weekCashNetLabel}>Net</Text>
                  <Text style={styles.weekCashNetHint}>{net >= 0 ? 'inflow' : 'outflow'}</Text>
                </View>
                <View style={styles.weekCashDivider} />
                <TouchableOpacity
                  style={styles.weekCashTile}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
                >
                  <Text style={styles.weekCashTileValue}>{fmtK(arTotal)}</Text>
                  <Text style={styles.weekCashTileLabel}>AR Inflow</Text>
                  <Text style={styles.weekCashTileCount}>{dueSoonInvoices.length} invoice{dueSoonInvoices.length !== 1 ? 's' : ''}</Text>
                </TouchableOpacity>
              </View>
            </>
          );
        })()}

        {/* Due Soon Payments — AP bills + AR invoices due within the configured window */}
        {(dueSoonBills.length > 0 || dueSoonInvoices.length > 0) && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Upcoming Payments</Text>
              <View style={styles.sectionHeaderRight}>
                <Text style={styles.sectionHeaderMeta}>due in {dueSoonDays}d</Text>
                <TouchableOpacity
                  onPress={async () => {
                    setExportingPayments(true);
                    try {
                      await exportUpcomingPaymentsPDF({
                        bills: dueSoonBills,
                        invoices: dueSoonInvoices,
                        dueSoonDays,
                        companyName: selectedCompany?.name,
                      });
                    } finally {
                      setExportingPayments(false);
                    }
                  }}
                  disabled={exportingPayments}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {exportingPayments
                    ? <ActivityIndicator size="small" color={Colors.textMuted} />
                    : <Feather name="file-text" size={14} color={Colors.textMuted} />}
                </TouchableOpacity>
              </View>
            </View>
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

        {/* Pending Actions card — flagged bills, flagged invoices, unread inbox */}
        {(flaggedBillCount > 0 || flaggedInvoiceCount > 0 || inboxUnread > 0) && (
          <>
            <SectionHeader
              title="Pending Actions"
              meta={`${flaggedBillCount + flaggedInvoiceCount + inboxUnread} item${flaggedBillCount + flaggedInvoiceCount + inboxUnread !== 1 ? 's' : ''}`}
              action={
                flaggedBillCount > 0 && flaggedInvoiceCount > 0 ? (
                  <TouchableOpacity
                    onPress={handleExportCombined}
                    disabled={exportingCombined}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Export combined flagged AP/AR report"
                  >
                    {exportingCombined
                      ? <ActivityIndicator size="small" color={Colors.textMuted} />
                      : <Feather name="file-text" size={14} color={Colors.textMuted} />}
                  </TouchableOpacity>
                ) : undefined
              }
            />
            <View style={styles.pendingCard}>
              {flaggedBillCount > 0 && (
                <TouchableOpacity
                  style={styles.pendingRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Finance', { screen: 'AccountsPayable' } as any)}
                >
                  <View style={[styles.pendingIcon, styles.pendingIconWarn]}>
                    <Feather name="star" size={13} color={Colors.textSecondary} />
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingLabel}>Flagged Bills</Text>
                    <Text style={styles.pendingSubLabel}>Marked for follow-up · AP</Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{flaggedBillCount}</Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              {flaggedBillCount > 0 && (flaggedInvoiceCount > 0 || inboxUnread > 0) && (
                <View style={styles.pendingDivider} />
              )}
              {flaggedInvoiceCount > 0 && (
                <TouchableOpacity
                  style={styles.pendingRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Finance', { screen: 'AccountsReceivable' } as any)}
                >
                  <View style={[styles.pendingIcon, styles.pendingIconBlue]}>
                    <Feather name="star" size={13} color={Colors.textSecondary} />
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingLabel}>Flagged Invoices</Text>
                    <Text style={styles.pendingSubLabel}>Marked for follow-up · AR</Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{flaggedInvoiceCount}</Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              {flaggedInvoiceCount > 0 && inboxUnread > 0 && (
                <View style={styles.pendingDivider} />
              )}
              {inboxUnread > 0 && (
                <TouchableOpacity
                  style={styles.pendingRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('More', { screen: 'Inbox' } as any)}
                >
                  <View style={[styles.pendingIcon, styles.pendingIconGray]}>
                    <Feather name="inbox" size={13} color={Colors.textSecondary} />
                    <View style={styles.pendingInboxDot} />
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingLabel}>Unread Notifications</Text>
                    <Text style={styles.pendingSubLabel}>In your inbox</Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{inboxUnread}</Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </>
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
                  case 'vendor':
                    navigation.navigate('Finance', {
                      screen: 'VendorDetail',
                      params: {
                        vendorId: item.entityId,
                        vendorName: item.title,
                        outstanding: item.navParams?.outstanding as number | undefined,
                        overdue: item.navParams?.overdue as number | undefined,
                      },
                    } as any);
                    break;
                  case 'customer':
                    navigation.navigate('Finance', {
                      screen: 'CustomerDetail',
                      params: {
                        customerId: item.entityId,
                        customerName: item.title,
                        outstanding: item.navParams?.outstanding as number | undefined,
                        overdue: item.navParams?.overdue as number | undefined,
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

        {/* Voucher count KPI with month comparison */}
        {kpis != null && (
          <>
            <SectionHeader title="Vouchers" meta="activity" />
            <View style={[styles.kpiGrid, { paddingBottom: 0 }]}>
              <View style={styles.kpiRow}>
                <KPICard
                  label="This Month"
                  value={String(kpis.vouchersMonth)}
                  subtext="vouchers posted"
                  trendPct={vouchersTrend}
                  miniChart={
                    kpis.vouchersPrevMonth != null
                      ? { prev: kpis.vouchersPrevMonth, curr: kpis.vouchersMonth }
                      : undefined
                  }
                  onPress={() => navigation.navigate('Finance', { screen: 'JournalEntries' } as any)}
                />
                <KPICard
                  label="Today"
                  value={String(kpis.vouchersToday)}
                  subtext={kpis.vouchersToday === 1 ? 'voucher today' : 'vouchers today'}
                  onPress={() => navigation.navigate('Finance', { screen: 'JournalEntries' } as any)}
                />
              </View>
            </View>
          </>
        )}

        {/* Week-over-week voucher activity */}
        {weekActivity != null && (
          <>
            <SectionHeader title="Week Activity" meta="this week vs last week" />
            <WeekActivityCard
              activity={weekActivity}
              onPress={() => navigation.navigate('Finance', { screen: 'JournalEntries' } as any)}
            />
          </>
        )}

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

// ─── Quick Stats Card — 7-day KPI History Sparkline ─────────────────────────

function fmtKpiShort(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(Math.round(val));
}

function fmtHistDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function QuickStatsCard({
  history,
  onPress,
}: {
  history: KpiHistoryEntry[];
  onPress?: () => void;
}) {
  if (history.length < 1) return null;

  const maxVal = Math.max(...history.flatMap((e) => [e.revenue, e.expenses]));
  if (maxVal <= 0) return null;

  const isSingleDay = history.length === 1;

  const latest = history[history.length - 1];
  const earliest = history[0];
  const netChange = latest.netIncome - earliest.netIncome;
  const netChangePct = !isSingleDay && earliest.netIncome !== 0
    ? Math.round(((latest.netIncome - earliest.netIncome) / Math.abs(earliest.netIncome)) * 100)
    : null;
  const trending = netChange > 0 ? 'trending-up' : netChange < 0 ? 'trending-down' : 'minus';
  const trendColor = netChange > 0 ? Colors.text : netChange < 0 ? Colors.textSecondary : Colors.textMuted;

  const BAR_MAX_H = 36;

  const Wrap = onPress ? TouchableOpacity : View;

  return (
    <Wrap
      onPress={onPress}
      activeOpacity={0.8}
      style={qsStyles.card}
    >
      <View style={qsStyles.header}>
        <View>
          <Text style={qsStyles.headerTitle}>{isSingleDay ? "TODAY'S SNAPSHOT" : '7-DAY TREND'}</Text>
          <Text style={qsStyles.headerSub}>
            {isSingleDay ? 'First day — trend builds over 7 days' : 'Revenue vs Expenses · month-to-date'}
          </Text>
        </View>
        {!isSingleDay && (
          <View style={qsStyles.trendPill}>
            <Feather name={trending as any} size={12} color={trendColor} />
            {netChangePct != null && (
              <Text style={[qsStyles.trendPct, { color: trendColor }]}>
                {netChangePct > 0 ? '+' : ''}{netChangePct}%
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={qsStyles.chartRow}>
        {history.map((entry, i) => {
          const isToday = i === history.length - 1;
          const revH = maxVal > 0 ? Math.max(2, Math.round((entry.revenue / maxVal) * BAR_MAX_H)) : 2;
          const expH = maxVal > 0 ? Math.max(2, Math.round((entry.expenses / maxVal) * BAR_MAX_H)) : 2;
          return (
            <View key={entry.date} style={qsStyles.dayCol}>
              <View style={[qsStyles.barTrack, { height: BAR_MAX_H }]}>
                <View style={qsStyles.barsGroup}>
                  <View style={[qsStyles.barRev, { height: revH }, isToday && qsStyles.barTodayRev]} />
                  <View style={[qsStyles.barExp, { height: expH }, isToday && qsStyles.barTodayExp]} />
                </View>
              </View>
              <Text style={[qsStyles.dateLabel, isToday && qsStyles.dateLabelToday]}>
                {isToday ? 'Now' : fmtHistDate(entry.date)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={qsStyles.legendRow}>
        <View style={qsStyles.legendItem}>
          <View style={[qsStyles.legendDot, qsStyles.legendDotRev]} />
          <Text style={qsStyles.legendLabel}>Rev {fmtKpiShort(latest.revenue)}</Text>
        </View>
        <View style={qsStyles.legendItem}>
          <View style={[qsStyles.legendDot, qsStyles.legendDotExp]} />
          <Text style={qsStyles.legendLabel}>Exp {fmtKpiShort(latest.expenses)}</Text>
        </View>
        <Text style={qsStyles.legendNet}>
          Net {latest.netIncome >= 0 ? '+' : ''}{fmtKpiShort(latest.netIncome)}
        </Text>
      </View>
    </Wrap>
  );
}

const qsStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  trendPct: {
    fontSize: 11,
    fontWeight: '600',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  barsGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    justifyContent: 'center',
  },
  barRev: {
    width: 5,
    backgroundColor: Colors.text,
    borderRadius: 2,
    opacity: 0.85,
  },
  barExp: {
    width: 5,
    backgroundColor: Colors.textMuted,
    borderRadius: 2,
    opacity: 0.6,
  },
  barTodayRev: {
    opacity: 1,
    backgroundColor: Colors.text,
  },
  barTodayExp: {
    opacity: 0.85,
    backgroundColor: Colors.textSecondary,
  },
  dateLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  dateLabelToday: {
    color: Colors.text,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendDotRev: { backgroundColor: Colors.text },
  legendDotExp: { backgroundColor: Colors.textMuted },
  legendLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  legendNet: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 'auto',
  },
});

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
  alertsDotText: { color: Colors.surface, fontSize: 10, fontWeight: '700' },
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

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  sectionHeaderTitle: { ...Typography.h4 },
  sectionHeaderMeta: { ...Typography.bodySmall, marginRight: Spacing.sm },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },

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
    fontSize: 10,
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

  agingMiniCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  agingMiniRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 6,
  },
  agingMiniRowLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  agingMiniDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },

  topVendorsCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  topVendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  topVendorDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 28 + Spacing.sm,
  },
  topVendorRank: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topVendorRankText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  topVendorInfo: { flex: 1, gap: 4 },
  topVendorName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  topVendorBar: {
    height: 3,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  topVendorBarFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  topCustomerBarFill: { height: '100%', backgroundColor: Colors.textSecondary, borderRadius: Radius.full },
  topVendorAmounts: { alignItems: 'flex-end' },
  topVendorAmt: { fontSize: 13, fontWeight: '700', color: Colors.text },
  topVendorCount: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  topVendorsSeeAll: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  topVendorsSeeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  pendingCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  pendingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 32 + Spacing.sm,
  },
  pendingIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIconWarn: { backgroundColor: Colors.surfaceHover },
  pendingIconBlue: { backgroundColor: Colors.surfaceHover },
  pendingIconGray: { backgroundColor: Colors.background },
  pendingInboxDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.text,
  },
  pendingInfo: { flex: 1 },
  pendingLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  pendingSubLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  pendingBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.text },

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
  quickBadgeText: { color: Colors.surface, fontSize: 10, fontWeight: '700' },
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

  weekCashCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  weekCashTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: 3,
  },
  weekCashTileValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  weekCashTileLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  weekCashTileCount: { fontSize: 11, color: Colors.textMuted },
  weekCashDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  weekCashNetTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: 3,
    backgroundColor: Colors.background,
  },
  weekCashNetValue: { fontSize: 17, fontWeight: '700' },
  weekCashNetPos: { color: Colors.text },
  weekCashNetNeg: { color: Colors.textSecondary },
  weekCashNetLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  weekCashNetHint: { fontSize: 11, color: Colors.textMuted },
});
