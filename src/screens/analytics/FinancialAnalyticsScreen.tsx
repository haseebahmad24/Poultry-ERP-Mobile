import React, { useCallback, useState } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import CompanySelector from '@/components/CompanySelector';
import SectionHeader from '@/components/SectionHeader';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import AgingChart, { AgingBucket } from '@/components/AgingChart';
import { useCompany } from '@/context/CompanyContext';
import {
  fetchAPSummary,
  fetchAPVendors,
  fetchAPBills,
  APSummary,
  APVendor,
  APBill,
} from '@/api/accountsPayable';
import {
  fetchARSummary,
  fetchARCustomers,
  fetchARInvoices,
  ARSummary,
  ARCustomer,
  ARInvoice,
} from '@/api/accountsReceivable';
import { getCached, setCached } from '@/utils/cache';
import { formatCurrency } from '@/utils/currency';
import { exportFinancialAnalyticsPDF } from '@/utils/pdfExport';
import { saveAgingSnapshot, loadAgingSnapshot, AgingSnapshot } from '@/utils/agingSnapshot';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';
import type { AppTabParamList } from '@/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type TabNav = BottomTabNavigationProp<AppTabParamList>;

// Grayscale fills: lightest (current) → darkest (most overdue)
const AGING_FILLS = ['#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827'];

interface FinancialData {
  apSummary: APSummary;
  arSummary: ARSummary;
  topVendors: APVendor[];
  topCustomers: ARCustomer[];
  apBills: APBill[];
  arInvoices: ARInvoice[];
}

function buildAgingBuckets(
  aging: APSummary['aging'] | ARSummary['aging'] | undefined,
): AgingBucket[] {
  return [
    {
      label: 'Current',
      shortLabel: 'Current',
      amount: aging?.current ?? 0,
      fill: AGING_FILLS[0],
    },
    {
      label: '1-30 Days',
      shortLabel: '1-30d',
      amount: aging?.days_30 ?? 0,
      fill: AGING_FILLS[1],
    },
    {
      label: '31-60 Days',
      shortLabel: '31-60d',
      amount: aging?.days_60 ?? 0,
      fill: AGING_FILLS[2],
    },
    {
      label: '61-90 Days',
      shortLabel: '61-90d',
      amount: aging?.days_90 ?? 0,
      fill: AGING_FILLS[3],
    },
    {
      label: '90+ Days',
      shortLabel: '90+d',
      amount: aging?.over_90 ?? 0,
      fill: AGING_FILLS[4],
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <View style={tileStyles.tile}>
      <Text style={tileStyles.label}>{label}</Text>
      <Text style={[tileStyles.value, danger && tileStyles.danger]}>{value}</Text>
      {sub != null && <Text style={tileStyles.sub}>{sub}</Text>}
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    minHeight: 72,
    justifyContent: 'center',
  },
  label: { ...Typography.label, color: Colors.textMuted, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '700', color: Colors.text },
  danger: { color: Colors.text },
  sub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
});

function NetPositionCard({
  arTotal,
  apTotal,
}: {
  arTotal: number;
  apTotal: number;
}) {
  const net = arTotal - apTotal;
  const isPositive = net >= 0;

  return (
    <View style={netStyles.card}>
      <View style={netStyles.row}>
        <View style={netStyles.col}>
          <Text style={netStyles.colLabel}>RECEIVABLE (AR)</Text>
          <Text style={netStyles.colAmount}>{formatCurrency(arTotal)}</Text>
        </View>
        <View style={netStyles.minus}>
          <Text style={netStyles.op}>-</Text>
        </View>
        <View style={netStyles.col}>
          <Text style={netStyles.colLabel}>PAYABLE (AP)</Text>
          <Text style={netStyles.colAmount}>{formatCurrency(apTotal)}</Text>
        </View>
        <View style={netStyles.equals}>
          <Text style={netStyles.op}>=</Text>
        </View>
        <View style={[netStyles.col, netStyles.netCol]}>
          <Text style={netStyles.colLabel}>NET POSITION</Text>
          <Text style={[netStyles.netAmount, isPositive ? netStyles.positive : netStyles.negative]}>
            {isPositive ? '+' : ''}{formatCurrency(net)}
          </Text>
        </View>
      </View>
      <Text style={netStyles.hint}>
        {isPositive
          ? 'You are owed more than you owe'
          : 'You owe more than you are owed'}
      </Text>
    </View>
  );
}

const netStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  col: {
    flex: 2,
    alignItems: 'center',
  },
  netCol: {
    flex: 2.5,
  },
  minus: { flex: 0.5, alignItems: 'center' },
  equals: { flex: 0.5, alignItems: 'center' },
  op: { fontSize: 18, fontWeight: '700', color: Colors.textMuted },
  colLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 3,
  },
  colAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  netAmount: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  positive: { color: Colors.text },
  negative: { color: Colors.text },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

function PartnerRankList({
  label,
  items,
  maxAmount,
}: {
  label: string;
  items: { id: number; name: string; outstanding: number; count: number; overdue?: number; onPress?: () => void }[];
  maxAmount: number;
}) {
  if (items.length === 0) return null;

  return (
    <View style={rankStyles.card}>
      {items.map((item, idx) => {
        const barWidth = maxAmount > 0 ? (item.outstanding / maxAmount) * 100 : 0;
        const RowWrapper = item.onPress ? TouchableOpacity : View;
        return (
          <RowWrapper
            key={item.id}
            style={[rankStyles.row, idx < items.length - 1 && rankStyles.rowBorder]}
            {...(item.onPress ? { onPress: item.onPress, activeOpacity: 0.7 } : {})}
          >
            <Text style={rankStyles.rank}>{idx + 1}</Text>
            <View style={rankStyles.info}>
              <View style={rankStyles.topLine}>
                <Text style={rankStyles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={rankStyles.amount}>{formatCurrency(item.outstanding)}</Text>
              </View>
              <View style={rankStyles.barTrack}>
                <View style={[rankStyles.barFill, { width: `${barWidth}%` }]} />
              </View>
              <Text style={rankStyles.sub}>{item.count} {label}</Text>
            </View>
            {item.onPress && (
              <Feather name="chevron-right" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
            )}
          </RowWrapper>
        );
      })}
    </View>
  );
}

const rankStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rank: {
    width: 20,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  info: { flex: 1, gap: 5 },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  name: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  amount: { fontSize: 13, fontWeight: '700', color: Colors.text },
  barTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
  },
  sub: { ...Typography.bodySmall, color: Colors.textMuted },
});

// ─── Monthly Net Position Trend ───────────────────────────────────────────────

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthBucket {
  label: string;
  apAmount: number;
  arAmount: number;
}

function buildMonthlyBuckets(bills: APBill[], invoices: ARInvoice[]): MonthBucket[] {
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ label: MONTH_NAMES_SHORT[d.getMonth()], apAmount: 0, arAmount: 0 });

    for (const bill of bills) {
      if (bill.dt && bill.dt.startsWith(ym)) {
        months[months.length - 1].apAmount += bill.amount ?? 0;
      }
    }
    for (const inv of invoices) {
      if (inv.dt && inv.dt.startsWith(ym)) {
        months[months.length - 1].arAmount += inv.amount ?? 0;
      }
    }
  }
  return months;
}

function fmtCompact(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(Math.round(val));
}

function MonthlyNetChart({ bills, invoices }: { bills: APBill[]; invoices: ARInvoice[] }) {
  const months = buildMonthlyBuckets(bills, invoices);
  const hasData = months.some((m) => m.apAmount > 0 || m.arAmount > 0);
  if (!hasData) return null;

  const BAR_HEIGHT = 72;
  const maxVal = Math.max(...months.flatMap((m) => [m.apAmount, m.arAmount]), 1);

  return (
    <View style={netChartStyles.card}>
      {/* Legend */}
      <View style={netChartStyles.legend}>
        <View style={netChartStyles.legendItem}>
          <View style={[netChartStyles.dot, { backgroundColor: Colors.textSecondary }]} />
          <Text style={netChartStyles.legendLabel}>AP (Payable)</Text>
        </View>
        <View style={netChartStyles.legendItem}>
          <View style={[netChartStyles.dot, { backgroundColor: Colors.text }]} />
          <Text style={netChartStyles.legendLabel}>AR (Receivable)</Text>
        </View>
      </View>
      {/* Bars */}
      <View style={netChartStyles.barsRow}>
        {months.map((m, idx) => {
          const apH = maxVal > 0 ? (m.apAmount / maxVal) * BAR_HEIGHT : 0;
          const arH = maxVal > 0 ? (m.arAmount / maxVal) * BAR_HEIGHT : 0;
          const net = m.arAmount - m.apAmount;
          return (
            <View key={idx} style={netChartStyles.monthCol}>
              <View style={[netChartStyles.barTrack, { height: BAR_HEIGHT }]}>
                <View style={netChartStyles.barsBottom}>
                  <View style={[netChartStyles.bar, { height: Math.max(apH, 2), backgroundColor: Colors.textSecondary, marginRight: 2 }]} />
                  <View style={[netChartStyles.bar, { height: Math.max(arH, 2), backgroundColor: Colors.text }]} />
                </View>
              </View>
              <Text style={netChartStyles.monthLabel}>{m.label}</Text>
              {(m.apAmount > 0 || m.arAmount > 0) && (
                <Text style={[netChartStyles.netLabel, net >= 0 ? netChartStyles.netPos : netChartStyles.netNeg]}>
                  {net >= 0 ? '+' : ''}{fmtCompact(net)}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const netChartStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  legend: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  legendLabel: { fontSize: 11, color: Colors.textSecondary },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  monthCol: { flex: 1, alignItems: 'center', gap: 3 },
  barTrack: { width: '100%', justifyContent: 'flex-end' },
  barsBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  bar: { width: 8, borderRadius: Radius.sm },
  monthLabel: { fontSize: 10, color: Colors.textMuted },
  netLabel: { fontSize: 10, fontWeight: '700' },
  netPos: { color: Colors.textSecondary },
  netNeg: { color: Colors.text },
});

// ─── Aging Delta Row ─────────────────────────────────────────────────────────

interface AgingFields {
  current?: number;
  days_30?: number;
  days_60?: number;
  days_90?: number;
  over_90?: number;
}

function fmtDelta(d: number | null): string | null {
  if (d == null) return null;
  const abs = Math.abs(d);
  const compact = abs >= 1_000_000
    ? `${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1_000
      ? `${(abs / 1_000).toFixed(0)}K`
      : String(Math.round(abs));
  return (d >= 0 ? '+' : '−') + compact;
}

function AgingDeltaRow({
  current,
  previous,
}: {
  current: AgingFields | undefined;
  previous: AgingFields;
}) {
  const buckets: { label: string; cur: number; prev: number }[] = [
    { label: 'Current', cur: current?.current ?? 0, prev: previous.current },
    { label: '1-30d', cur: current?.days_30 ?? 0, prev: previous.days_30 },
    { label: '31-60d', cur: current?.days_60 ?? 0, prev: previous.days_60 },
    { label: '61-90d', cur: current?.days_90 ?? 0, prev: previous.days_90 },
    { label: '90+d', cur: current?.over_90 ?? 0, prev: previous.over_90 },
  ];

  const hasChange = buckets.some((b) => b.cur !== b.prev);
  if (!hasChange) return (
    <Text style={deltaStyles.noChange}>No change since last snapshot</Text>
  );

  return (
    <View style={deltaStyles.row}>
      {buckets.map((b) => {
        const delta = b.cur - b.prev;
        if (b.cur === 0 && b.prev === 0) return null;
        const label = fmtDelta(delta);
        return (
          <View key={b.label} style={deltaStyles.item}>
            <Text style={deltaStyles.bucketLabel}>{b.label}</Text>
            {label != null && delta !== 0 ? (
              <Text style={[deltaStyles.delta, delta > 0 ? deltaStyles.up : deltaStyles.down]}>{label}</Text>
            ) : (
              <Text style={deltaStyles.flat}>—</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const deltaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.sm,
  },
  item: { alignItems: 'center', minWidth: 48 },
  bucketLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500', textTransform: 'uppercase' },
  delta: { fontSize: 11, fontWeight: '700' },
  up: { color: Colors.text },
  down: { color: Colors.textSecondary },
  flat: { fontSize: 11, color: Colors.textMuted },
  noChange: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', paddingTop: Spacing.sm },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FinancialAnalyticsScreen() {
  const navigation = useNavigation<Nav>();
  const tabNav = navigation.getParent<TabNav>();
  const { companyId, selectedCompany } = useCompany();

  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [prevSnapshot, setPrevSnapshot] = useState<AgingSnapshot | null>(null);

  const cacheKey = `financial-analytics:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<FinancialData>(cacheKey);
      if (cached) {
        setData(cached.data);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const cid = companyId;
      const snapshotKey = String(cid ?? 'all');

      const [apSummary, arSummary, topVendors, topCustomers, apBills, arInvoices, prev] = await Promise.all([
        fetchAPSummary(cid),
        fetchARSummary(cid),
        fetchAPVendors(cid),
        fetchARCustomers(cid),
        getCached<{ bills: APBill[] }>(`ap:${cid ?? 'all'}`).then((c) =>
          c ? c.data.bills : fetchAPBills(cid)
        ),
        getCached<{ invoices: ARInvoice[] }>(`ar:${cid ?? 'all'}`).then((c) =>
          c ? c.data.invoices : fetchARInvoices(cid)
        ),
        loadAgingSnapshot(snapshotKey),
      ]);

      setPrevSnapshot(prev);

      const fresh: FinancialData = { apSummary, arSummary, topVendors, topCustomers, apBills, arInvoices };
      setData(fresh);
      setError(null);
      await setCached(cacheKey, fresh);

      // Save today's snapshot (only updates if different calendar day from prev)
      await saveAgingSnapshot({
        ts: new Date().toISOString(),
        companyId: snapshotKey,
        apAging: {
          current: apSummary.aging?.current ?? 0,
          days_30: apSummary.aging?.days_30 ?? 0,
          days_60: apSummary.aging?.days_60 ?? 0,
          days_90: apSummary.aging?.days_90 ?? 0,
          over_90: apSummary.aging?.over_90 ?? 0,
        },
        arAging: {
          current: arSummary.aging?.current ?? 0,
          days_30: arSummary.aging?.days_30 ?? 0,
          days_60: arSummary.aging?.days_60 ?? 0,
          days_90: arSummary.aging?.days_90 ?? 0,
          over_90: arSummary.aging?.over_90 ?? 0,
        },
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, cacheKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportFinancialAnalyticsPDF(data, selectedCompany?.name);
    } finally {
      setExporting(false);
    }
  };

  // ── Render ──

  const renderContent = () => {
    if (!data) return null;
    const { apSummary, arSummary, topVendors, topCustomers, apBills, arInvoices } = data;

    const apTotal = apSummary.total_outstanding ?? 0;
    const arTotal = arSummary.total_outstanding ?? 0;
    const apOverdue = apSummary.total_overdue ?? 0;
    const arOverdue = arSummary.total_overdue ?? 0;

    const apBuckets = buildAgingBuckets(apSummary.aging);
    const arBuckets = buildAgingBuckets(arSummary.aging);

    const top5Vendors = [...topVendors]
      .sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0))
      .slice(0, 5);
    const top5Customers = [...topCustomers]
      .sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0))
      .slice(0, 5);

    const maxVendorAmt = top5Vendors[0]?.outstanding ?? 1;
    const maxCustomerAmt = top5Customers[0]?.outstanding ?? 1;

    const goToAP = () => tabNav?.navigate('Finance', { screen: 'AccountsPayable' } as any);
    const goToAR = () => tabNav?.navigate('Finance', { screen: 'AccountsReceivable' } as any);

    return (
      <>
        {/* Net Position */}
        <NetPositionCard arTotal={arTotal} apTotal={apTotal} />

        {/* Monthly Net Position Trend */}
        <SectionHeader title="6-Month Trend" meta="AP vs AR · billed per month" />
        <MonthlyNetChart bills={apBills ?? []} invoices={arInvoices ?? []} />

        {/* ── AP Section ── */}
        <TouchableOpacity activeOpacity={0.7} onPress={goToAP}>
          <SectionHeader
            title="Accounts Payable"
            meta={`${apSummary.vendors_count ?? 0} vendors · ${apSummary.bills_count ?? 0} bills  ›`}
          />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={goToAP}>
          <View style={styles.tileRow}>
            <SummaryTile
              label="Total Outstanding"
              value={formatCurrency(apTotal)}
              sub="across all vendors"
            />
            <SummaryTile
              label="Overdue"
              value={formatCurrency(apOverdue)}
              danger={apOverdue > 0}
              sub={apOverdue > 0 ? 'past due date' : 'none overdue'}
            />
          </View>
        </TouchableOpacity>

        {/* AP Aging */}
        <View style={styles.agingCard}>
          <View style={styles.agingTitleRow}>
            <Text style={styles.agingTitle}>AP Aging Breakdown</Text>
            {prevSnapshot && (
              <Text style={styles.agingSnapshotMeta}>
                vs {new Date(prevSnapshot.ts).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>
          <AgingChart buckets={apBuckets} barHeight={14} />
          {prevSnapshot && (
            <AgingDeltaRow
              current={apSummary.aging}
              previous={prevSnapshot.apAging}
            />
          )}
        </View>

        {/* Top Vendors */}
        {top5Vendors.length > 0 && (
          <>
            <SectionHeader
              title="Top Vendors by Outstanding"
              meta={`top ${top5Vendors.length}`}
            />
            <PartnerRankList
              label="bills"
              items={top5Vendors.map((v) => ({
                id: v.id,
                name: v.name ?? `Vendor #${v.id}`,
                outstanding: v.outstanding ?? 0,
                count: v.bills_count ?? 0,
                overdue: v.overdue ?? 0,
                onPress: () =>
                  tabNav?.navigate('Finance', {
                    screen: 'VendorDetail',
                    params: {
                      vendorId: v.id,
                      vendorName: v.name ?? `Vendor #${v.id}`,
                      outstanding: v.outstanding,
                      overdue: v.overdue,
                    },
                  } as any),
              }))}
              maxAmount={maxVendorAmt}
            />
          </>
        )}

        {/* ── AR Section ── */}
        <TouchableOpacity activeOpacity={0.7} onPress={goToAR}>
          <SectionHeader
            title="Accounts Receivable"
            meta={`${arSummary.customers_count ?? 0} customers · ${arSummary.invoices_count ?? 0} invoices  ›`}
          />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={goToAR}>
          <View style={styles.tileRow}>
            <SummaryTile
              label="Total Outstanding"
              value={formatCurrency(arTotal)}
              sub="across all customers"
            />
            <SummaryTile
              label="Overdue"
              value={formatCurrency(arOverdue)}
              danger={arOverdue > 0}
              sub={arOverdue > 0 ? 'past due date' : 'none overdue'}
            />
          </View>
        </TouchableOpacity>

        {/* AR Aging */}
        <View style={styles.agingCard}>
          <View style={styles.agingTitleRow}>
            <Text style={styles.agingTitle}>AR Aging Breakdown</Text>
            {prevSnapshot && (
              <Text style={styles.agingSnapshotMeta}>
                vs {new Date(prevSnapshot.ts).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>
          <AgingChart buckets={arBuckets} barHeight={14} />
          {prevSnapshot && (
            <AgingDeltaRow
              current={arSummary.aging}
              previous={prevSnapshot.arAging}
            />
          )}
        </View>

        {/* Top Customers */}
        {top5Customers.length > 0 && (
          <>
            <SectionHeader
              title="Top Customers by Outstanding"
              meta={`top ${top5Customers.length}`}
            />
            <PartnerRankList
              label="invoices"
              items={top5Customers.map((c) => ({
                id: c.id,
                name: c.name ?? `Customer #${c.id}`,
                outstanding: c.outstanding ?? 0,
                count: c.invoices_count ?? 0,
                overdue: c.overdue ?? 0,
                onPress: () =>
                  tabNav?.navigate('Finance', {
                    screen: 'CustomerDetail',
                    params: {
                      customerId: c.id,
                      customerName: c.name ?? `Customer #${c.id}`,
                      outstanding: c.outstanding,
                      overdue: c.overdue,
                    },
                  } as any),
              }))}
              maxAmount={maxCustomerAmt}
            />
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Financial Analytics</Text>
          <Text style={styles.headerSub}>AP · AR · Net Position</Text>
        </View>
        {data && (
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <Feather name={exporting ? 'loader' : 'download'} size={16} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <CompanySelector />

      {loading ? (
        <ListScreenSkeleton rows={6} />
      ) : error ? (
        <ErrorView message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.text}
            />
          }
        >
          {renderContent()}
        </ScrollView>
      )}
    </SafeAreaView>
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
  headerText: { flex: 1 },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },
  exportBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.md },

  tileRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },

  agingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  agingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  agingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agingSnapshotMeta: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});
