import React, { useCallback, useMemo, useState } from 'react';
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
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import CompanySelector from '@/components/CompanySelector';
import SectionHeader from '@/components/SectionHeader';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';
import { useCompany } from '@/context/CompanyContext';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import { fetchSalesOrders, SalesOrder } from '@/api/salesOrders';
import { getCached, setCached } from '@/utils/cache';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { exportProcurementAnalyticsPDF, ProcurementAnalyticsData } from '@/utils/pdfExport';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

// ─── Data shapes ──────────────────────────────────────────────────────────────

interface MonthBucket {
  label: string;
  yearMonth: string;
  poCount: number;
  soCount: number;
  poValue: number;
  soValue: number;
}

interface VendorRow {
  name: string;
  poCount: number;
  total: number;
}

interface CustomerRow {
  name: string;
  soCount: number;
  total: number;
}

interface StatusRow {
  status: string;
  count: number;
}

type Analytics = ProcurementAnalyticsData & { months: MonthBucket[]; valueDist: ValueDistRow[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getYearMonth(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getLast6Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

function getMonthsInRange(from: string, to: string): string[] {
  const result: string[] = [];
  const start = new Date(from);
  start.setDate(1);
  const end = new Date(to);
  const cur = new Date(start);
  while (cur <= end && result.length < 12) {
    result.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return result.length > 0 ? result : getLast6Months();
}

function monthLabel(ym: string): string {
  const parts = ym.split('-');
  const month = parseInt(parts[1], 10);
  return MONTH_NAMES[month - 1] ?? ym;
}

function computeAnalytics(
  pos: PurchaseOrder[],
  sos: SalesOrder[],
  fromISO?: string,
  toISO?: string,
): Analytics {
  const monthYMs = fromISO && toISO
    ? getMonthsInRange(fromISO, toISO)
    : getLast6Months();

  // Monthly buckets
  const monthMap = new Map<string, MonthBucket>();
  for (const ym of monthYMs) {
    monthMap.set(ym, { label: monthLabel(ym), yearMonth: ym, poCount: 0, soCount: 0, poValue: 0, soValue: 0 });
  }
  for (const po of pos) {
    const ym = getYearMonth(po.dt);
    if (monthMap.has(ym)) {
      const b = monthMap.get(ym)!;
      b.poCount += 1;
      b.poValue += po.total ?? 0;
    }
  }
  for (const so of sos) {
    const ym = getYearMonth(so.dt);
    if (monthMap.has(ym)) {
      const b = monthMap.get(ym)!;
      b.soCount += 1;
      b.soValue += so.total ?? 0;
    }
  }
  const months = monthYMs.map((ym) => monthMap.get(ym)!);

  // Top vendors
  const vendorMap = new Map<string, VendorRow>();
  for (const po of pos) {
    const name = po.vendor ?? 'Unknown';
    const existing = vendorMap.get(name);
    if (existing) {
      existing.poCount += 1;
      existing.total += po.total ?? 0;
    } else {
      vendorMap.set(name, { name, poCount: 1, total: po.total ?? 0 });
    }
  }
  const topVendors = Array.from(vendorMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top customers
  const customerMap = new Map<string, CustomerRow>();
  for (const so of sos) {
    const name = so.customer ?? 'Unknown';
    const existing = customerMap.get(name);
    if (existing) {
      existing.soCount += 1;
      existing.total += so.total ?? 0;
    } else {
      customerMap.set(name, { name, soCount: 1, total: so.total ?? 0 });
    }
  }
  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Status breakdowns
  const poStatusMap = new Map<string, number>();
  for (const po of pos) {
    const s = (po.status ?? 'Unknown').toLowerCase();
    poStatusMap.set(s, (poStatusMap.get(s) ?? 0) + 1);
  }
  const poStatuses: StatusRow[] = Array.from(poStatusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const soStatusMap = new Map<string, number>();
  for (const so of sos) {
    const s = (so.status ?? 'Unknown').toLowerCase();
    soStatusMap.set(s, (soStatusMap.get(s) ?? 0) + 1);
  }
  const soStatuses: StatusRow[] = Array.from(soStatusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const openPOs = pos.filter((p) => {
    const s = (p.status ?? '').toLowerCase();
    return s === 'open' || s === 'approved' || s === 'pending';
  }).length;
  const openSOs = sos.filter((s) => {
    const st = (s.status ?? '').toLowerCase();
    return st === 'open' || st === 'approved' || st === 'pending';
  }).length;

  return {
    totalPOValue: pos.reduce((sum, p) => sum + (p.total ?? 0), 0),
    totalSOValue: sos.reduce((sum, s) => sum + (s.total ?? 0), 0),
    openPOs,
    openSOs,
    totalPOs: pos.length,
    totalSOs: sos.length,
    months,
    topVendors,
    topCustomers,
    poStatuses,
    soStatuses,
    valueDist: computeValueDistribution(pos, sos),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPITile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={kpiStyles.tile}>
      <Text style={kpiStyles.value}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
      {sub != null && <Text style={kpiStyles.sub}>{sub}</Text>}
    </View>
  );
}
const kpiStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  value: { ...Typography.h3, textAlign: 'center' },
  label: { ...Typography.label, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },
  sub: { ...Typography.bodySmall, marginTop: 2, textAlign: 'center' },
});

type ChartMode = 'count' | 'value';

/** Vertical grouped bar chart for monthly trend */
function MonthlyTrendChart({ months, mode }: { months: MonthBucket[]; mode: ChartMode }) {
  const poKey: keyof MonthBucket = mode === 'value' ? 'poValue' : 'poCount';
  const soKey: keyof MonthBucket = mode === 'value' ? 'soValue' : 'soCount';
  const maxVal = Math.max(...months.flatMap((m) => [m[poKey] as number, m[soKey] as number]), 1);
  const BAR_HEIGHT = 80;

  function fmtBottom(po: number, so: number): string {
    if (mode === 'value') {
      const total = po + so;
      if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
      if (total >= 1_000) return `${(total / 1_000).toFixed(0)}K`;
      return String(Math.round(total));
    }
    return String(po + so);
  }

  return (
    <View style={chartStyles.card}>
      {/* Legend */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: Colors.text }]} />
          <Text style={chartStyles.legendLabel}>Purchase Orders</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: Colors.textMuted }]} />
          <Text style={chartStyles.legendLabel}>Sales Orders</Text>
        </View>
      </View>
      {/* Bars */}
      <View style={chartStyles.barsRow}>
        {months.map((m) => {
          const poVal = m[poKey] as number;
          const soVal = m[soKey] as number;
          const poH = maxVal > 0 ? (poVal / maxVal) * BAR_HEIGHT : 0;
          const soH = maxVal > 0 ? (soVal / maxVal) * BAR_HEIGHT : 0;
          return (
            <View key={m.yearMonth} style={chartStyles.monthCol}>
              <View style={[chartStyles.barTrack, { height: BAR_HEIGHT }]}>
                <View style={chartStyles.barsBottom}>
                  <View style={[chartStyles.bar, { height: Math.max(poH, 2), backgroundColor: Colors.text, marginRight: 2 }]} />
                  <View style={[chartStyles.bar, { height: Math.max(soH, 2), backgroundColor: Colors.textMuted }]} />
                </View>
              </View>
              <Text style={chartStyles.monthLabel}>{m.label}</Text>
              <Text style={chartStyles.monthCount}>{fmtBottom(poVal, soVal)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  legend: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: Radius.full },
  legendLabel: { fontSize: 11, color: Colors.textSecondary },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  monthCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', justifyContent: 'flex-end' },
  barsBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  bar: { width: 8, borderRadius: Radius.sm },
  monthLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  monthCount: { fontSize: 11, fontWeight: '700', color: Colors.text },
});

/** Ranked bar list (vendors / customers) */
function RankedBarList({ rows, valueKey, countKey }: {
  rows: (VendorRow | CustomerRow)[];
  valueKey: 'total';
  countKey: 'poCount' | 'soCount';
}) {
  if (rows.length === 0) {
    return (
      <View style={rankedStyles.empty}>
        <Text style={rankedStyles.emptyText}>No data available</Text>
      </View>
    );
  }
  const maxVal = Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <View style={rankedStyles.card}>
      {rows.map((row, i) => {
        const pct = row[valueKey] / maxVal;
        return (
          <View key={row.name} style={rankedStyles.row}>
            <View style={rankedStyles.rankBadge}>
              <Text style={rankedStyles.rankText}>{i + 1}</Text>
            </View>
            <View style={rankedStyles.nameCol}>
              <Text style={rankedStyles.name} numberOfLines={1}>{row.name}</Text>
              <View style={rankedStyles.barTrack}>
                <View style={[rankedStyles.barFill, { width: `${pct * 100}%` }]} />
              </View>
            </View>
            <View style={rankedStyles.valueCol}>
              <Text style={rankedStyles.amount}>{formatCurrency(row[valueKey])}</Text>
              <Text style={rankedStyles.count}>{row[countKey]} orders</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
const rankedStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  empty: {
    marginHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: { ...Typography.bodySmall },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  nameCol: { flex: 1, gap: 4 },
  name: { ...Typography.body, fontWeight: '600' },
  barTrack: {
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  barFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  valueCol: { alignItems: 'flex-end' },
  amount: { fontSize: 13, fontWeight: '700', color: Colors.text },
  count: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});

/** Status chips grid */
function StatusGrid({ rows, total }: { rows: StatusRow[]; total: number }) {
  if (rows.length === 0) {
    return (
      <View style={statusStyles.empty}>
        <Text style={statusStyles.emptyText}>No data</Text>
      </View>
    );
  }
  return (
    <View style={statusStyles.grid}>
      {rows.map((r) => {
        const pct = total > 0 ? ((r.count / total) * 100).toFixed(0) : '0';
        const barPct = total > 0 ? (r.count / total) * 100 : 0;
        return (
          <View key={r.status} style={statusStyles.chip}>
            <View style={statusStyles.chipTop}>
              <Text style={statusStyles.chipCount}>{r.count}</Text>
              <Text style={statusStyles.chipPct}>{pct}%</Text>
            </View>
            <View style={statusStyles.chipBar}>
              <View style={[statusStyles.chipBarFill, { width: `${barPct}%` }]} />
            </View>
            <Text style={statusStyles.chipLabel} numberOfLines={1}>
              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
const statusStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginHorizontal: Spacing.md },
  chip: {
    flex: 1,
    minWidth: 80,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm + 2,
  },
  chipTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chipCount: { fontSize: 16, fontWeight: '700', color: Colors.text },
  chipPct: { fontSize: 10, color: Colors.textMuted },
  chipBar: {
    height: 3,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginVertical: 4,
  },
  chipBarFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  chipLabel: { fontSize: 10, fontWeight: '500', color: Colors.textSecondary },
  empty: { marginHorizontal: Spacing.md, paddingVertical: Spacing.md, alignItems: 'center' },
  emptyText: { ...Typography.bodySmall },
});

// ─── Order Value Distribution ─────────────────────────────────────────────────

const VALUE_BUCKETS = [
  { label: '<10K', max: 10_000 },
  { label: '10-50K', max: 50_000 },
  { label: '50-100K', max: 100_000 },
  { label: '100-500K', max: 500_000 },
  { label: '500K+', max: Infinity },
];

interface ValueDistRow {
  label: string;
  poCount: number;
  soCount: number;
}

function computeValueDistribution(pos: PurchaseOrder[], sos: SalesOrder[]): ValueDistRow[] {
  const rows: ValueDistRow[] = VALUE_BUCKETS.map((b) => ({ label: b.label, poCount: 0, soCount: 0 }));

  const bucketIndex = (amount: number) => {
    for (let i = 0; i < VALUE_BUCKETS.length; i++) {
      if (amount < VALUE_BUCKETS[i].max) return i;
    }
    return VALUE_BUCKETS.length - 1;
  };

  for (const po of pos) {
    const idx = bucketIndex(po.total ?? 0);
    rows[idx].poCount++;
  }
  for (const so of sos) {
    const idx = bucketIndex(so.total ?? 0);
    rows[idx].soCount++;
  }
  return rows;
}

function ValueDistributionChart({ rows }: { rows: ValueDistRow[] }) {
  const hasData = rows.some((r) => r.poCount > 0 || r.soCount > 0);
  if (!hasData) return null;

  const maxCount = Math.max(...rows.flatMap((r) => [r.poCount, r.soCount]), 1);
  const BAR_HEIGHT = 72;

  return (
    <View style={distStyles.card}>
      <View style={distStyles.legend}>
        <View style={distStyles.legendItem}>
          <View style={[distStyles.legendDot, { backgroundColor: Colors.text }]} />
          <Text style={distStyles.legendLabel}>PO</Text>
        </View>
        <View style={distStyles.legendItem}>
          <View style={[distStyles.legendDot, { backgroundColor: Colors.textMuted }]} />
          <Text style={distStyles.legendLabel}>SO</Text>
        </View>
      </View>
      <View style={distStyles.barsRow}>
        {rows.map((r) => {
          const poH = (r.poCount / maxCount) * BAR_HEIGHT;
          const soH = (r.soCount / maxCount) * BAR_HEIGHT;
          return (
            <View key={r.label} style={distStyles.col}>
              <View style={[distStyles.barTrack, { height: BAR_HEIGHT }]}>
                <View style={distStyles.barsBottom}>
                  <View style={[distStyles.bar, { height: Math.max(poH, r.poCount > 0 ? 2 : 0), backgroundColor: Colors.text }]} />
                  <View style={[distStyles.bar, { height: Math.max(soH, r.soCount > 0 ? 2 : 0), backgroundColor: Colors.textMuted }]} />
                </View>
              </View>
              <Text style={distStyles.bucketLabel}>{r.label}</Text>
              {(r.poCount > 0 || r.soCount > 0) && (
                <Text style={distStyles.bucketTotal}>{r.poCount + r.soCount}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const distStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  legend: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: Radius.full },
  legendLabel: { fontSize: 11, color: Colors.textSecondary },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center', gap: 3 },
  barTrack: { width: '100%', justifyContent: 'flex-end' },
  barsBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  bar: { width: 9, borderRadius: Radius.sm },
  bucketLabel: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', lineHeight: 12 },
  bucketTotal: { fontSize: 10, fontWeight: '700', color: Colors.text },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const EMPTY_RANGE: DateRangeValue = { from: '', to: '' };

export default function ProcurementAnalyticsScreen() {
  const navigation = useNavigation<Nav>();
  const { companyId } = useCompany();
  const [rawData, setRawData] = useState<{ pos: PurchaseOrder[]; sos: SalesOrder[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(EMPTY_RANGE);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('count');

  const cacheKey = `procurement-analytics:${companyId ?? 'all'}`;

  const isDateActive = !!(dateRange.from || dateRange.to);

  const analytics = useMemo<Analytics | null>(() => {
    if (!rawData) return null;
    let { pos, sos } = rawData;
    if (isDateActive) {
      const from = dateRange.from ? new Date(dateRange.from) : null;
      const toDate = dateRange.to ? new Date(dateRange.to) : null;
      if (toDate) toDate.setHours(23, 59, 59, 999);
      pos = pos.filter((p) => {
        if (!p.dt) return true;
        const d = new Date(p.dt);
        if (from && d < from) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
      sos = sos.filter((s) => {
        if (!s.dt) return true;
        const d = new Date(s.dt);
        if (from && d < from) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
    }
    return computeAnalytics(
      pos,
      sos,
      isDateActive ? (dateRange.from || undefined) : undefined,
      isDateActive ? (dateRange.to || undefined) : undefined,
    );
  }, [rawData, dateRange, isDateActive]);

  const trendSubtitle = isDateActive
    ? `${dateRange.from || '…'} – ${dateRange.to || '…'}`
    : 'Orders placed in the last 6 months';

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const cached = await getCached<{ pos: PurchaseOrder[]; sos: SalesOrder[] }>(cacheKey);
      if (cached && !isRefresh) {
        setRawData(cached.data);
        setLoading(false);
        return;
      }

      const [pos, sos] = await Promise.all([
        fetchPurchaseOrders('all'),
        fetchSalesOrders('register', { companyId: companyId ?? undefined }),
      ]);

      await setCached(cacheKey, { pos, sos });
      setRawData({ pos, sos });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, cacheKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleExport = useCallback(async () => {
    if (!analytics) return;
    setExporting(true);
    try {
      await exportProcurementAnalyticsPDF(analytics);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  }, [analytics]);

  const handleToggleDateFilter = useCallback(() => {
    setShowDateFilter((v) => {
      if (v) {
        // closing: clear the filter
        setDateRange(EMPTY_RANGE);
      }
      return !v;
    });
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Procurement Analytics</Text>

        {/* Date filter toggle */}
        <TouchableOpacity
          style={[styles.iconBtn, isDateActive && styles.iconBtnActive]}
          onPress={handleToggleDateFilter}
          accessibilityLabel="Toggle date filter"
        >
          <Feather
            name="calendar"
            size={16}
            color={isDateActive ? '#fff' : Colors.text}
          />
          {isDateActive && (
            <Text style={styles.iconBtnBadge}>
              {dateRange.from?.slice(5) ?? ''}
              {dateRange.from && dateRange.to ? '–' : ''}
              {dateRange.to?.slice(5) ?? ''}
            </Text>
          )}
        </TouchableOpacity>

        {/* Export PDF */}
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={!analytics || exporting}
          accessibilityLabel="Export PDF"
        >
          <Feather name="file-text" size={18} color={analytics && !exporting ? Colors.text : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Company selector */}
      <CompanySelector />

      {/* Date range bar — shown when toggled */}
      {showDateFilter && (
        <View style={styles.dateBarWrapper}>
          <DateRangeBar value={dateRange} onChange={setDateRange} />
        </View>
      )}

      {loading ? (
        <ListScreenSkeleton />
      ) : error || !analytics ? (
        <ErrorView message="Failed to load analytics" onRetry={() => load()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.textMuted} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* KPI row */}
          <View style={styles.kpiRow}>
            <KPITile
              label="PO Value"
              value={formatCurrency(analytics.totalPOValue)}
              sub={`${analytics.totalPOs} orders`}
            />
            <KPITile
              label="SO Value"
              value={formatCurrency(analytics.totalSOValue)}
              sub={`${analytics.totalSOs} orders`}
            />
          </View>
          <View style={[styles.kpiRow, { marginTop: -Spacing.sm }]}>
            <KPITile label="Open POs" value={String(analytics.openPOs)} />
            <KPITile label="Open SOs" value={String(analytics.openSOs)} />
          </View>

          {/* Monthly trend */}
          <SectionHeader
            title="Monthly Trend"
            subtitle={trendSubtitle}
            action={
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeChip, chartMode === 'count' && styles.modeChipActive]}
                  onPress={() => setChartMode('count')}
                >
                  <Text style={[styles.modeChipText, chartMode === 'count' && styles.modeChipTextActive]}>Count</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeChip, chartMode === 'value' && styles.modeChipActive]}
                  onPress={() => setChartMode('value')}
                >
                  <Text style={[styles.modeChipText, chartMode === 'value' && styles.modeChipTextActive]}>Value</Text>
                </TouchableOpacity>
              </View>
            }
          />
          <MonthlyTrendChart months={analytics.months} mode={chartMode} />

          {/* Top vendors */}
          <SectionHeader title="Top Vendors" subtitle="By purchase order value" />
          <RankedBarList rows={analytics.topVendors} valueKey="total" countKey="poCount" />

          {/* Top customers */}
          <SectionHeader title="Top Customers" subtitle="By sales order value" />
          <RankedBarList rows={analytics.topCustomers} valueKey="total" countKey="soCount" />

          {/* Status breakdown */}
          <SectionHeader title="Purchase Order Status" />
          <StatusGrid rows={analytics.poStatuses} total={analytics.totalPOs} />

          <SectionHeader title="Sales Order Status" />
          <StatusGrid rows={analytics.soStatuses} total={analytics.totalSOs} />

          {/* Order value distribution */}
          <SectionHeader title="Order Value Distribution" subtitle="PO and SO counts by order size" />
          <ValueDistributionChart rows={analytics.valueDist} />

          <View style={styles.footer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2, flex: 1 },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
  },
  iconBtnActive: {
    borderColor: Colors.text,
    backgroundColor: Colors.text,
  },
  iconBtnBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  exportBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  dateBarWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  content: { paddingTop: Spacing.sm },
  modeToggle: { flexDirection: 'row', gap: 4 },
  modeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  modeChipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  modeChipText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  modeChipTextActive: { color: '#fff' },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  footer: { height: Spacing.xxl },
});
