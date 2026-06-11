import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
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
  avgValue: number;
}

interface CustomerRow {
  name: string;
  soCount: number;
  total: number;
  avgValue: number;
}

interface StatusRow {
  status: string;
  count: number;
}

interface DeliveryPerf {
  overdueCount: number;
  onTrackCount: number;
  noDateCount: number;
  avgOverdueDays: number;
  overdueValue: number;
}

interface LeadTimeRow {
  vendor: string;
  avgDays: number;
  minDays: number;
  maxDays: number;
  poCount: number;
}

interface MonthLeadTime {
  monthLabel: string;
  avgDays: number;
  poCount: number;
  isCurrent: boolean;
}

type Analytics = ProcurementAnalyticsData & {
  months: MonthBucket[];
  valueDist: ValueDistRow[];
  deliveryPerf: DeliveryPerf;
  leadTime: LeadTimeRow[];
  leadTimeTrend: MonthLeadTime[];
};

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
      vendorMap.set(name, { name, poCount: 1, total: po.total ?? 0, avgValue: 0 });
    }
  }
  const topVendors = Array.from(vendorMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((v) => ({ ...v, avgValue: v.poCount > 0 ? v.total / v.poCount : 0 }));

  // Top customers
  const customerMap = new Map<string, CustomerRow>();
  for (const so of sos) {
    const name = so.customer ?? 'Unknown';
    const existing = customerMap.get(name);
    if (existing) {
      existing.soCount += 1;
      existing.total += so.total ?? 0;
    } else {
      customerMap.set(name, { name, soCount: 1, total: so.total ?? 0, avgValue: 0 });
    }
  }
  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((c) => ({ ...c, avgValue: c.soCount > 0 ? c.total / c.soCount : 0 }));

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
    deliveryPerf: computeDeliveryPerformance(pos),
    leadTime: computeLeadTime(pos),
    leadTimeTrend: computeLeadTimeTrend(pos),
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

function fmtAvg(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M avg`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K avg`;
  return `${Math.round(val)} avg`;
}

/** Ranked bar list (vendors / customers) */
function RankedBarList({ rows, valueKey, countKey, onPress }: {
  rows: (VendorRow | CustomerRow)[];
  valueKey: 'total';
  countKey: 'poCount' | 'soCount';
  onPress?: (row: VendorRow | CustomerRow) => void;
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
        const isLast = i === rows.length - 1;
        const inner = (
          <>
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
              {row.avgValue > 0 && (
                <Text style={rankedStyles.avg}>{fmtAvg(row.avgValue)}</Text>
              )}
            </View>
            {onPress && <Feather name="bar-chart-2" size={14} color={Colors.textMuted} />}
          </>
        );
        return onPress ? (
          <TouchableOpacity
            key={row.name}
            style={[rankedStyles.row, !isLast && rankedStyles.rowBorder]}
            onPress={() => onPress(row)}
            activeOpacity={0.7}
          >
            {inner}
          </TouchableOpacity>
        ) : (
          <View key={row.name} style={[rankedStyles.row, !isLast && rankedStyles.rowBorder]}>
            {inner}
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
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
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
  avg: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
});

// ─── Ranked compare modal ─────────────────────────────────────────────────────

interface RankedCompareModalProps {
  primary: VendorRow | CustomerRow;
  allRows: (VendorRow | CustomerRow)[];
  countKey: 'poCount' | 'soCount';
  monthlyValues: { label: string; value: number }[];
  compareRow: VendorRow | CustomerRow | null;
  compareMonthlyValues: { label: string; value: number }[];
  onSelectCompare: (row: VendorRow | CustomerRow) => void;
  onClearCompare: () => void;
  onClose: () => void;
}

function RankedCompareModal({
  primary, allRows, countKey, monthlyValues, compareRow,
  compareMonthlyValues, onSelectCompare, onClearCompare, onClose,
}: RankedCompareModalProps) {
  const [showPicker, setShowPicker] = useState(false);
  const orderLabel = countKey === 'poCount' ? 'POs' : 'SOs';

  const maxMonthly = Math.max(
    ...monthlyValues.map((m) => m.value),
    ...compareMonthlyValues.map((m) => m.value),
    1,
  );

  const allLabels = monthlyValues.map((m) => m.label);
  const compareMap = new Map(compareMonthlyValues.map((m) => [m.label, m.value]));

  const countField: 'poCount' | 'soCount' = countKey;
  const primaryCount = 'poCount' in primary ? (primary as VendorRow).poCount : (primary as CustomerRow).soCount;
  const compareCount = compareRow
    ? ('poCount' in compareRow ? (compareRow as VendorRow).poCount : (compareRow as CustomerRow).soCount)
    : 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={rcmStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={rcmStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={rcmStyles.handle} />

          {/* Header */}
          <View style={rcmStyles.headerRow}>
            <View style={rcmStyles.headerInfo}>
              <Text style={rcmStyles.headerTitle} numberOfLines={1}>
                {compareRow ? `${primary.name} vs ${compareRow.name}` : primary.name}
              </Text>
              <Text style={rcmStyles.headerSub}>
                {compareRow ? 'Value comparison · last 6 months' : `${orderLabel} · tap compare for side-by-side`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={rcmStyles.closeBtn}>
              <Feather name="x" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Stats tiles */}
          <View style={rcmStyles.tilesRow}>
            {/* Primary */}
            <View style={rcmStyles.tileGroup}>
              <Text style={rcmStyles.tileGroupLabel} numberOfLines={1}>{primary.name}</Text>
              <Text style={rcmStyles.tileValue}>{formatCurrency(primary.total)}</Text>
              <Text style={rcmStyles.tileSub}>{primaryCount} {orderLabel}</Text>
              {primary.avgValue > 0 && (
                <Text style={rcmStyles.tileSub}>{fmtAvg(primary.avgValue)}</Text>
              )}
            </View>

            {compareRow ? (
              <>
                {/* Divider with vs */}
                <View style={rcmStyles.vsDivider}>
                  <Text style={rcmStyles.vsText}>vs</Text>
                </View>
                {/* Compare */}
                <TouchableOpacity style={rcmStyles.tileGroup} onPress={onClearCompare} activeOpacity={0.7}>
                  <Text style={rcmStyles.tileGroupLabel} numberOfLines={1}>{compareRow.name}</Text>
                  <Text style={rcmStyles.tileValue}>{formatCurrency(compareRow.total)}</Text>
                  <Text style={rcmStyles.tileSub}>{compareCount} {orderLabel}</Text>
                  {compareRow.avgValue > 0 && (
                    <Text style={rcmStyles.tileSub}>{fmtAvg(compareRow.avgValue)}</Text>
                  )}
                  <Text style={rcmStyles.clearHint}>tap to clear</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={rcmStyles.compareBtn}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
              >
                <Feather name="git-merge" size={14} color={Colors.textMuted} />
                <Text style={rcmStyles.compareBtnLabel}>Compare</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Monthly bars */}
          <View style={rcmStyles.chartArea}>
            {allLabels.map((label) => {
              const priVal = monthlyValues.find((m) => m.label === label)?.value ?? 0;
              const cmpVal = compareMap.get(label) ?? 0;
              const priH = Math.max(3, (priVal / maxMonthly) * 48);
              const cmpH = Math.max(3, (cmpVal / maxMonthly) * 48);
              return (
                <View key={label} style={rcmStyles.monthCol}>
                  <View style={rcmStyles.barsGroup}>
                    <View style={[rcmStyles.barPrimary, { height: priH }]} />
                    {compareRow && <View style={[rcmStyles.barCompare, { height: cmpH }]} />}
                  </View>
                  <Text style={rcmStyles.monthLabel}>{label}</Text>
                </View>
              );
            })}
          </View>

          {/* Legend */}
          {compareRow && (
            <View style={rcmStyles.legendRow}>
              <View style={rcmStyles.legendItem}>
                <View style={[rcmStyles.legendDot, rcmStyles.legendDotPrimary]} />
                <Text style={rcmStyles.legendLabel} numberOfLines={1}>{primary.name}</Text>
              </View>
              <View style={rcmStyles.legendItem}>
                <View style={[rcmStyles.legendDot, rcmStyles.legendDotCompare]} />
                <Text style={rcmStyles.legendLabel} numberOfLines={1}>{compareRow.name}</Text>
              </View>
            </View>
          )}

          {/* Picker for compare selection */}
          {showPicker && !compareRow && (
            <View style={rcmStyles.pickerArea}>
              <Text style={rcmStyles.pickerTitle}>Compare with:</Text>
              <FlatList
                data={allRows.filter((r) => r.name !== primary.name)}
                keyExtractor={(r) => r.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={rcmStyles.pickerRow}
                    onPress={() => { onSelectCompare(item); setShowPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={rcmStyles.pickerRowLabel} numberOfLines={1}>{item.name}</Text>
                    <Text style={rcmStyles.pickerRowValue}>{formatCurrency(item.total)}</Text>
                  </TouchableOpacity>
                )}
                style={rcmStyles.pickerList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const rcmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.md,
  },
  handle: {
    width: 36, height: 4, borderRadius: Radius.full,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.md },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  tilesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    paddingVertical: Spacing.md,
  },
  tileGroup: { flex: 1, gap: 3 },
  tileGroupLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  tileValue: { fontSize: 16, fontWeight: '800', color: Colors.text },
  tileSub: { fontSize: 10, color: Colors.textMuted },
  clearHint: { fontSize: 9, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  vsDivider: {
    width: 28, alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  vsText: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  compareBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.md, borderStyle: 'dashed',
  },
  compareBtnLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: Spacing.sm },
  monthCol: { flex: 1, alignItems: 'center', gap: 4 },
  barsGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barPrimary: { width: 10, backgroundColor: Colors.text, borderRadius: Radius.sm },
  barCompare: { width: 10, backgroundColor: Colors.textSecondary, borderRadius: Radius.sm },
  monthLabel: { fontSize: 9, color: Colors.textMuted },
  legendRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 2, marginBottom: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: Radius.full },
  legendDotPrimary: { backgroundColor: Colors.text },
  legendDotCompare: { backgroundColor: Colors.textSecondary },
  legendLabel: { fontSize: 11, color: Colors.textMuted, maxWidth: 100 },
  pickerArea: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingTop: Spacing.md, maxHeight: 160 },
  pickerTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: Spacing.sm },
  pickerList: { flexGrow: 0 },
  pickerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight,
  },
  pickerRowLabel: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '500' },
  pickerRowValue: { fontSize: 12, color: Colors.textSecondary },
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

function computeDeliveryPerformance(pos: PurchaseOrder[]): DeliveryPerf {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let overdueCount = 0;
  let onTrackCount = 0;
  let noDateCount = 0;
  let totalOverdueDays = 0;
  let overdueValue = 0;

  for (const po of pos) {
    const s = (po.status ?? '').toLowerCase();
    const isOpen = s === 'open' || s === 'approved' || s === 'pending' || s === '';
    if (!isOpen) continue;

    if (!po.delivery_date) { noDateCount++; continue; }
    const dd = new Date(po.delivery_date);
    if (isNaN(dd.getTime())) { noDateCount++; continue; }
    dd.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - dd.getTime()) / 86_400_000);
    if (diffDays > 0) {
      overdueCount++;
      totalOverdueDays += diffDays;
      overdueValue += po.total ?? 0;
    } else {
      onTrackCount++;
    }
  }

  return {
    overdueCount,
    onTrackCount,
    noDateCount,
    avgOverdueDays: overdueCount > 0 ? totalOverdueDays / overdueCount : 0,
    overdueValue,
  };
}

function computeLeadTime(pos: PurchaseOrder[]): LeadTimeRow[] {
  const vendorMap = new Map<string, { days: number[]; total: number }>();
  for (const po of pos) {
    if (!po.dt || !po.delivery_date) continue;
    const orderDate = new Date(po.dt);
    const delivDate = new Date(po.delivery_date);
    if (isNaN(orderDate.getTime()) || isNaN(delivDate.getTime())) continue;
    const days = Math.round((delivDate.getTime() - orderDate.getTime()) / 86_400_000);
    if (days < 0 || days > 365) continue;
    const name = po.vendor ?? 'Unknown';
    const existing = vendorMap.get(name);
    if (existing) {
      existing.days.push(days);
      existing.total += po.total ?? 0;
    } else {
      vendorMap.set(name, { days: [days], total: po.total ?? 0 });
    }
  }
  return Array.from(vendorMap.entries())
    .filter(([, v]) => v.days.length >= 1)
    .map(([vendor, v]) => ({
      vendor,
      avgDays: Math.round(v.days.reduce((s, d) => s + d, 0) / v.days.length),
      minDays: Math.min(...v.days),
      maxDays: Math.max(...v.days),
      poCount: v.days.length,
    }))
    .sort((a, b) => a.avgDays - b.avgDays)
    .slice(0, 8);
}

function computeLeadTimeTrend(pos: PurchaseOrder[]): MonthLeadTime[] {
  const now = new Date();
  const buckets: { key: string; monthLabel: string; isCurrent: boolean; days: number[] }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      monthLabel: d.toLocaleString('default', { month: 'short' }),
      isCurrent: i === 0,
      days: [],
    });
  }
  for (const po of pos) {
    if (!po.dt || !po.delivery_date) continue;
    const orderDate = new Date(po.dt);
    const delivDate = new Date(po.delivery_date);
    if (isNaN(orderDate.getTime()) || isNaN(delivDate.getTime())) continue;
    const days = Math.round((delivDate.getTime() - orderDate.getTime()) / 86_400_000);
    if (days < 0 || days > 365) continue;
    const monthKey = po.dt.slice(0, 7);
    const bucket = buckets.find((b) => b.key === monthKey);
    if (bucket) bucket.days.push(days);
  }
  return buckets.map((b) => ({
    monthLabel: b.monthLabel,
    avgDays: b.days.length > 0 ? Math.round(b.days.reduce((s, d) => s + d, 0) / b.days.length) : 0,
    poCount: b.days.length,
    isCurrent: b.isCurrent,
  }));
}

function computeVendorMonthlyTrend(pos: PurchaseOrder[], vendorName: string): MonthLeadTime[] {
  const now = new Date();
  const buckets: { key: string; monthLabel: string; isCurrent: boolean; days: number[] }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      monthLabel: d.toLocaleString('default', { month: 'short' }),
      isCurrent: i === 0,
      days: [],
    });
  }
  for (const po of pos) {
    if (!po.dt || !po.delivery_date || po.vendor !== vendorName) continue;
    const orderDate = new Date(po.dt);
    const delivDate = new Date(po.delivery_date);
    if (isNaN(orderDate.getTime()) || isNaN(delivDate.getTime())) continue;
    const days = Math.round((delivDate.getTime() - orderDate.getTime()) / 86_400_000);
    if (days < 0 || days > 365) continue;
    const monthKey = po.dt.slice(0, 7);
    const bucket = buckets.find((b) => b.key === monthKey);
    if (bucket) bucket.days.push(days);
  }
  return buckets.map((b) => ({
    monthLabel: b.monthLabel,
    avgDays: b.days.length > 0 ? Math.round(b.days.reduce((s, d) => s + d, 0) / b.days.length) : 0,
    poCount: b.days.length,
    isCurrent: b.isCurrent,
  }));
}

function computeEntityMonthlyValues(
  items: { vendor?: string; customer?: string; dt?: string; date?: string; total?: number }[],
  nameField: 'vendor' | 'customer',
  entityName: string,
): { label: string; value: number }[] {
  const now = new Date();
  const buckets = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, 0);
  }
  for (const item of items) {
    if ((item[nameField] ?? '') !== entityName) continue;
    const rawDate = item.dt ?? item.date;
    if (!rawDate) continue;
    const d = new Date(rawDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + (item.total ?? 0));
    }
  }
  return Array.from(buckets.entries()).map(([key, value]) => ({
    label: key.slice(5),
    value,
  }));
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
  bucketLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', lineHeight: 13 },
  bucketTotal: { fontSize: 10, fontWeight: '700', color: Colors.text },
});

// ─── Delivery Performance Card ────────────────────────────────────────────────

function DeliveryPerfCard({ perf }: { perf: DeliveryPerf }) {
  const { overdueCount, onTrackCount, noDateCount, avgOverdueDays, overdueValue } = perf;
  const total = overdueCount + onTrackCount + noDateCount;
  if (total === 0) return null;

  const fmtK = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  return (
    <View style={delivStyles.card}>
      <Text style={delivStyles.title}>OPEN PO DELIVERY STATUS</Text>

      {/* Tiles */}
      <View style={delivStyles.tileRow}>
        <View style={delivStyles.tile}>
          <Text style={[delivStyles.tileValue, overdueCount > 0 && delivStyles.danger]}>
            {overdueCount}
          </Text>
          <Text style={delivStyles.tileLabel}>Overdue</Text>
        </View>
        <View style={[delivStyles.tile, delivStyles.tileMid]}>
          <Text style={delivStyles.tileValue}>{onTrackCount}</Text>
          <Text style={delivStyles.tileLabel}>On Track</Text>
        </View>
        <View style={delivStyles.tile}>
          <Text style={[delivStyles.tileValue, overdueCount > 0 && delivStyles.warn]}>
            {avgOverdueDays > 0 ? `${Math.round(avgOverdueDays)}d` : '—'}
          </Text>
          <Text style={delivStyles.tileLabel}>Avg Late</Text>
        </View>
      </View>

      {/* Stacked bar */}
      {total > 0 && (
        <View style={delivStyles.bar}>
          {overdueCount > 0 && <View style={[delivStyles.seg, delivStyles.segOverdue, { flex: overdueCount }]} />}
          {onTrackCount > 0 && <View style={[delivStyles.seg, delivStyles.segOnTrack, { flex: onTrackCount }]} />}
          {noDateCount > 0 && <View style={[delivStyles.seg, delivStyles.segNoDate, { flex: noDateCount }]} />}
        </View>
      )}

      {/* Legend */}
      <View style={delivStyles.legend}>
        <View style={delivStyles.legendItem}>
          <View style={[delivStyles.dot, delivStyles.segOverdue]} />
          <Text style={delivStyles.legendLabel}>
            {overdueCount} overdue{overdueValue > 0 ? ` · ${fmtK(overdueValue)}` : ''}
          </Text>
        </View>
        <View style={delivStyles.legendItem}>
          <View style={[delivStyles.dot, delivStyles.segOnTrack]} />
          <Text style={delivStyles.legendLabel}>{onTrackCount} on track</Text>
        </View>
        {noDateCount > 0 && (
          <View style={delivStyles.legendItem}>
            <View style={[delivStyles.dot, delivStyles.segNoDate]} />
            <Text style={delivStyles.legendLabel}>{noDateCount} no date set</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const delivStyles = StyleSheet.create({
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
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tileRow: { flexDirection: 'row' },
  tile: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, gap: 2 },
  tileMid: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  tileValue: { fontSize: 20, fontWeight: '800', color: Colors.text },
  tileLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  danger: { color: Colors.text },
  warn: { color: Colors.textSecondary },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
  },
  seg: { height: '100%' },
  segOverdue: { backgroundColor: Colors.text },
  segOnTrack: { backgroundColor: Colors.textSecondary },
  segNoDate: { backgroundColor: Colors.borderLight },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  legendLabel: { fontSize: 11, color: Colors.textSecondary },
});

// ─── Lead Time Chart ──────────────────────────────────────────────────────────

function LeadTimeChart({ rows, onPress }: { rows: LeadTimeRow[]; onPress?: (vendor: string) => void }) {
  if (rows.length === 0) {
    return (
      <View style={ltStyles.empty}>
        <Text style={ltStyles.emptyText}>No lead time data — set delivery dates on POs</Text>
      </View>
    );
  }
  const maxDays = Math.max(...rows.map((r) => r.avgDays), 1);

  return (
    <View style={ltStyles.card}>
      <View style={ltStyles.legendRow}>
        <View style={ltStyles.legendItem}>
          <View style={[ltStyles.dot, { backgroundColor: Colors.text }]} />
          <Text style={ltStyles.legendLabel}>Fastest → Slowest · tap for monthly trend</Text>
        </View>
      </View>
      {rows.map((row, i) => {
        const barPct = (row.avgDays / maxDays) * 100;
        return (
          <TouchableOpacity
            key={row.vendor}
            style={ltStyles.row}
            activeOpacity={onPress ? 0.6 : 1}
            onPress={onPress ? () => onPress(row.vendor) : undefined}
          >
            <View style={ltStyles.rankBadge}>
              <Text style={ltStyles.rankText}>{i + 1}</Text>
            </View>
            <View style={ltStyles.nameCol}>
              <Text style={ltStyles.vendorName} numberOfLines={1}>{row.vendor}</Text>
              <View style={ltStyles.barTrack}>
                <View style={[ltStyles.barFill, { width: `${barPct}%` as any }]} />
              </View>
            </View>
            <View style={ltStyles.statsCol}>
              <Text style={ltStyles.avgDays}>{row.avgDays}d avg</Text>
              <Text style={ltStyles.range}>{row.minDays}–{row.maxDays}d · {row.poCount} PO{row.poCount !== 1 ? 's' : ''}</Text>
            </View>
            {onPress && <Feather name="chevron-right" size={14} color={Colors.textMuted} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function VendorLeadTimeModal({
  vendor,
  trend,
  compareVendor,
  compareTrend,
  otherVendors,
  onSelectCompare,
  onClearCompare,
  onClose,
}: {
  vendor: string;
  trend: MonthLeadTime[];
  compareVendor: string | null;
  compareTrend: MonthLeadTime[];
  otherVendors: LeadTimeRow[];
  onSelectCompare: (vendor: string) => void;
  onClearCompare: () => void;
  onClose: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const hasAny = trend.some((m) => m.poCount > 0);
  const BAR_H = 72;

  // Primary vendor stats
  const primaryAvg = (() => {
    const withData = trend.filter((m) => m.poCount > 0);
    if (withData.length === 0) return 0;
    return Math.round(withData.reduce((s, m) => s + m.avgDays, 0) / withData.length);
  })();
  const primaryTotal = trend.reduce((s, m) => s + m.poCount, 0);

  // Compare vendor stats
  const compareAvg = (() => {
    if (!compareVendor) return 0;
    const withData = compareTrend.filter((m) => m.poCount > 0);
    if (withData.length === 0) return 0;
    return Math.round(withData.reduce((s, m) => s + m.avgDays, 0) / withData.length);
  })();

  // Shared max for comparison chart
  const maxDays = Math.max(
    ...trend.map((m) => m.avgDays),
    ...(compareTrend.length > 0 ? compareTrend.map((m) => m.avgDays) : []),
    1,
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={vltModalStyles.backdrop}>
        <TouchableOpacity style={vltModalStyles.backdropTap} activeOpacity={1} onPress={onClose} />
        <View style={vltModalStyles.sheet}>
          <View style={vltModalStyles.handle} />
          <View style={vltModalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={vltModalStyles.title} numberOfLines={1}>
                {compareVendor ? `${vendor} vs ${compareVendor}` : vendor}
              </Text>
              <Text style={vltModalStyles.subtitle}>
                {compareVendor ? 'Lead time comparison · 6 months' : '6-month lead time trend'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Summary tiles */}
          <View style={vltModalStyles.tileRow}>
            <View style={vltModalStyles.tile}>
              <Text style={vltModalStyles.tileValue}>{primaryAvg}d</Text>
              <Text style={vltModalStyles.tileLabel} numberOfLines={1}>
                {compareVendor ? vendor.split(' ')[0] : 'Avg Lead Time'}
              </Text>
            </View>
            {compareVendor ? (
              <>
                <View style={vltModalStyles.tileDivider} />
                <View style={vltModalStyles.tile}>
                  <Text style={vltModalStyles.tileValue}>{compareAvg}d</Text>
                  <Text style={vltModalStyles.tileLabel} numberOfLines={1}>
                    {compareVendor.split(' ')[0]}
                  </Text>
                </View>
                <View style={vltModalStyles.tileDivider} />
                <View style={vltModalStyles.tile}>
                  <Text style={[vltModalStyles.tileValue, { fontSize: 16 }]}>
                    {primaryAvg > compareAvg
                      ? `+${primaryAvg - compareAvg}d slower`
                      : primaryAvg < compareAvg
                      ? `${compareAvg - primaryAvg}d faster`
                      : 'Same'}
                  </Text>
                  <Text style={vltModalStyles.tileLabel}>vs compare</Text>
                </View>
              </>
            ) : (
              <>
                <View style={vltModalStyles.tileDivider} />
                <View style={vltModalStyles.tile}>
                  <Text style={vltModalStyles.tileValue}>{primaryTotal}</Text>
                  <Text style={vltModalStyles.tileLabel}>POs with Delivery Date</Text>
                </View>
              </>
            )}
          </View>

          {/* Legend row when comparing */}
          {compareVendor && (
            <View style={vltModalStyles.compareLegend}>
              <View style={vltModalStyles.compareLegendItem}>
                <View style={[vltModalStyles.compareDot, vltModalStyles.compareDotPrimary]} />
                <Text style={vltModalStyles.compareLegendLabel} numberOfLines={1}>{vendor}</Text>
              </View>
              <View style={vltModalStyles.compareLegendItem}>
                <View style={[vltModalStyles.compareDot, vltModalStyles.compareDotSecondary]} />
                <Text style={vltModalStyles.compareLegendLabel} numberOfLines={1}>{compareVendor}</Text>
              </View>
              <TouchableOpacity
                onPress={onClearCompare}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={vltModalStyles.clearCompareBtn}
              >
                <Feather name="x-circle" size={14} color={Colors.textMuted} />
                <Text style={vltModalStyles.clearCompareText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 6-bar trend chart — solo or comparison */}
          {hasAny ? (
            <View style={vltModalStyles.barsRow}>
              {trend.map((m, idx) => {
                const primaryH = m.poCount > 0 ? Math.max(4, Math.round((m.avgDays / maxDays) * BAR_H)) : 0;
                const compareM = compareTrend[idx];
                const compareH = compareM && compareM.poCount > 0
                  ? Math.max(4, Math.round((compareM.avgDays / maxDays) * BAR_H))
                  : 0;
                return (
                  <View key={m.monthLabel} style={vltModalStyles.col}>
                    {/* Value labels */}
                    {compareVendor ? (
                      <View style={vltModalStyles.compareValueRow}>
                        {m.poCount > 0 && (
                          <Text style={vltModalStyles.compareValuePrimary}>{m.avgDays}</Text>
                        )}
                        {compareM && compareM.poCount > 0 && (
                          <Text style={vltModalStyles.compareValueSecondary}>{compareM.avgDays}</Text>
                        )}
                      </View>
                    ) : (
                      m.avgDays > 0 && (
                        <Text style={[vltModalStyles.valueLabel, m.isCurrent && vltModalStyles.valueLabelActive]}>
                          {m.avgDays}d
                        </Text>
                      )
                    )}
                    <View style={[vltModalStyles.barWrap, { height: BAR_H }]}>
                      {compareVendor ? (
                        <View style={vltModalStyles.compareBarGroup}>
                          {primaryH > 0
                            ? <View style={[vltModalStyles.bar, vltModalStyles.compareBarPrimary, { height: primaryH }, m.isCurrent && vltModalStyles.barActive]} />
                            : <View style={vltModalStyles.barEmpty} />}
                          {compareH > 0
                            ? <View style={[vltModalStyles.bar, vltModalStyles.compareBarSecondary, { height: compareH }]} />
                            : <View style={vltModalStyles.barEmpty} />}
                        </View>
                      ) : (
                        m.poCount > 0 ? (
                          <View style={[vltModalStyles.bar, { height: primaryH }, m.isCurrent && vltModalStyles.barActive]} />
                        ) : (
                          <View style={vltModalStyles.barEmpty} />
                        )
                      )}
                    </View>
                    <Text style={[vltModalStyles.monthLabel, m.isCurrent && vltModalStyles.monthLabelActive]}>
                      {m.monthLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={vltModalStyles.emptyState}>
              <Text style={vltModalStyles.emptyText}>No delivery dates recorded for this vendor</Text>
            </View>
          )}

          {/* Compare / picker footer */}
          {!compareVendor && otherVendors.length > 0 && !showPicker && (
            <TouchableOpacity
              style={vltModalStyles.compareBtn}
              onPress={() => setShowPicker(true)}
            >
              <Feather name="git-merge" size={14} color={Colors.text} />
              <Text style={vltModalStyles.compareBtnText}>Compare with another vendor</Text>
            </TouchableOpacity>
          )}

          {/* Inline vendor picker */}
          {showPicker && !compareVendor && (
            <View style={vltModalStyles.pickerContainer}>
              <View style={vltModalStyles.pickerHeader}>
                <Text style={vltModalStyles.pickerTitle}>Select vendor to compare</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Feather name="x" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={otherVendors}
                keyExtractor={(r) => r.vendor}
                style={{ maxHeight: 180 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={vltModalStyles.pickerRow}
                    onPress={() => { setShowPicker(false); onSelectCompare(item.vendor); }}
                  >
                    <Text style={vltModalStyles.pickerVendor} numberOfLines={1}>{item.vendor}</Text>
                    <Text style={vltModalStyles.pickerAvg}>{item.avgDays}d avg</Text>
                    <Feather name="chevron-right" size={13} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderLight }} />}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const vltModalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing.xxl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  tileRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tile: { flex: 1, alignItems: 'center', gap: 3 },
  tileDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  tileValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  tileLabel: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  valueLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  valueLabelActive: { color: Colors.textSecondary, fontWeight: '700' },
  barWrap: { justifyContent: 'flex-end' },
  bar: { width: 20, borderRadius: Radius.sm, backgroundColor: Colors.border },
  barActive: { backgroundColor: Colors.textSecondary },
  barEmpty: { width: 20, height: 2, backgroundColor: Colors.borderLight, borderRadius: Radius.full },
  monthLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  monthLabelActive: { color: Colors.text, fontWeight: '700' },
  poCount: { fontSize: 10, color: Colors.textMuted },
  emptyState: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  // Comparison additions
  compareLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  compareLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  compareDot: { width: 8, height: 8, borderRadius: 2 },
  compareDotPrimary: { backgroundColor: Colors.text },
  compareDotSecondary: { backgroundColor: Colors.textMuted },
  compareLegendLabel: { fontSize: 11, color: Colors.textSecondary, flex: 1 },
  clearCompareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearCompareText: { fontSize: 11, color: Colors.textMuted },

  compareValueRow: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', marginBottom: 2 },
  compareValuePrimary: { fontSize: 9, fontWeight: '700', color: Colors.text },
  compareValueSecondary: { fontSize: 9, fontWeight: '600', color: Colors.textMuted },

  compareBarGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, justifyContent: 'center' },
  compareBarPrimary: { backgroundColor: Colors.text },
  compareBarSecondary: { backgroundColor: Colors.textMuted, width: 8 },

  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  compareBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },

  pickerContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerTitle: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  pickerVendor: { flex: 1, fontSize: 13, color: Colors.text },
  pickerAvg: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
});

const ltStyles = StyleSheet.create({
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
  emptyText: { ...Typography.bodySmall, textAlign: 'center' },
  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  legendLabel: { fontSize: 11, color: Colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
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
  vendorName: { ...Typography.body, fontWeight: '600' },
  barTrack: {
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  barFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  statsCol: { alignItems: 'flex-end' },
  avgDays: { fontSize: 13, fontWeight: '700', color: Colors.text },
  range: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});

function LeadTimeTrendChart({ data }: { data: MonthLeadTime[] }) {
  const hasAny = data.some((m) => m.poCount > 0);
  if (!hasAny) return null;

  const BAR_H = 60;
  const maxDays = Math.max(...data.map((m) => m.avgDays), 1);

  const trendDir = (() => {
    const withData = data.filter((m) => m.poCount > 0);
    if (withData.length < 2) return 0;
    const first = withData[0].avgDays;
    const last = withData[withData.length - 1].avgDays;
    return last - first;
  })();

  return (
    <View style={ltTrendStyles.card}>
      <View style={ltTrendStyles.headerRow}>
        <Text style={ltTrendStyles.title}>6-MONTH LEAD TIME TREND</Text>
        <Text style={ltTrendStyles.meta}>avg order-to-delivery days</Text>
        {trendDir !== 0 && (
          <View style={ltTrendStyles.trendPill}>
            <Feather
              name={trendDir > 0 ? 'trending-up' : 'trending-down'}
              size={10}
              color={Colors.textMuted}
            />
            <Text style={ltTrendStyles.trendText}>
              {Math.abs(trendDir)}d {trendDir > 0 ? 'slower' : 'faster'}
            </Text>
          </View>
        )}
      </View>
      <View style={ltTrendStyles.barsRow}>
        {data.map((m) => {
          const barH = m.poCount > 0 ? Math.max(4, Math.round((m.avgDays / maxDays) * BAR_H)) : 0;
          return (
            <View key={m.monthLabel} style={ltTrendStyles.col}>
              {m.avgDays > 0 && (
                <Text style={[ltTrendStyles.valueLabel, m.isCurrent && ltTrendStyles.valueLabelActive]}>
                  {m.avgDays}d
                </Text>
              )}
              <View style={[ltTrendStyles.barWrap, { height: BAR_H }]}>
                {m.poCount > 0 ? (
                  <View style={[ltTrendStyles.bar, { height: barH }, m.isCurrent && ltTrendStyles.barActive]} />
                ) : (
                  <View style={ltTrendStyles.barEmpty} />
                )}
              </View>
              <Text style={[ltTrendStyles.monthLabel, m.isCurrent && ltTrendStyles.monthLabelActive]}>
                {m.monthLabel}
              </Text>
              {m.poCount > 0 && (
                <Text style={ltTrendStyles.poCount}>{m.poCount}po</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const ltTrendStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  title: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, flex: 1 },
  meta: { fontSize: 10, color: Colors.textMuted },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  trendText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  valueLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  valueLabelActive: { color: Colors.textSecondary, fontWeight: '700' },
  barWrap: { justifyContent: 'flex-end' },
  bar: {
    width: 20,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  barActive: { backgroundColor: Colors.textSecondary },
  barEmpty: { width: 20, height: 2, backgroundColor: Colors.borderLight, borderRadius: Radius.full },
  monthLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  monthLabelActive: { color: Colors.text, fontWeight: '700' },
  poCount: { fontSize: 10, color: Colors.textMuted },
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
  const [selectedLeadTimeVendor, setSelectedLeadTimeVendor] = useState<string | null>(null);
  const [vendorLeadTrend, setVendorLeadTrend] = useState<MonthLeadTime[]>([]);
  const [compareLeadTimeVendor, setCompareLeadTimeVendor] = useState<string | null>(null);
  const [compareLeadTrend, setCompareLeadTrend] = useState<MonthLeadTime[]>([]);

  // Ranked list compare state
  const [selectedRankedVendor, setSelectedRankedVendor] = useState<VendorRow | null>(null);
  const [compareRankedVendor, setCompareRankedVendor] = useState<VendorRow | null>(null);
  const [selectedRankedCustomer, setSelectedRankedCustomer] = useState<CustomerRow | null>(null);
  const [compareRankedCustomer, setCompareRankedCustomer] = useState<CustomerRow | null>(null);

  const rankedVendorMonthly = useMemo(() =>
    selectedRankedVendor && rawData
      ? computeEntityMonthlyValues(rawData.pos, 'vendor', selectedRankedVendor.name)
      : [],
  [selectedRankedVendor, rawData]);

  const compareVendorMonthly = useMemo(() =>
    compareRankedVendor && rawData
      ? computeEntityMonthlyValues(rawData.pos, 'vendor', compareRankedVendor.name)
      : [],
  [compareRankedVendor, rawData]);

  const rankedCustomerMonthly = useMemo(() =>
    selectedRankedCustomer && rawData
      ? computeEntityMonthlyValues(rawData.sos, 'customer', selectedRankedCustomer.name)
      : [],
  [selectedRankedCustomer, rawData]);

  const compareCustomerMonthly = useMemo(() =>
    compareRankedCustomer && rawData
      ? computeEntityMonthlyValues(rawData.sos, 'customer', compareRankedCustomer.name)
      : [],
  [compareRankedCustomer, rawData]);

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

  const handleLeadTimeVendorPress = useCallback((vendor: string) => {
    if (!rawData) return;
    const trend = computeVendorMonthlyTrend(rawData.pos, vendor);
    setVendorLeadTrend(trend);
    setSelectedLeadTimeVendor(vendor);
    setCompareLeadTimeVendor(null);
    setCompareLeadTrend([]);
  }, [rawData]);

  const handleCompareVendorSelect = useCallback((vendor: string) => {
    if (!rawData) return;
    const trend = computeVendorMonthlyTrend(rawData.pos, vendor);
    setCompareLeadTimeVendor(vendor);
    setCompareLeadTrend(trend);
  }, [rawData]);

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
            color={isDateActive ? Colors.surface : Colors.text}
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
          <SectionHeader title="Top Vendors" subtitle="By purchase order value · tap to compare" />
          <RankedBarList
            rows={analytics.topVendors}
            valueKey="total"
            countKey="poCount"
            onPress={(row) => {
              setSelectedRankedVendor(row as VendorRow);
              setCompareRankedVendor(null);
            }}
          />

          {/* Top customers */}
          <SectionHeader title="Top Customers" subtitle="By sales order value · tap to compare" />
          <RankedBarList
            rows={analytics.topCustomers}
            valueKey="total"
            countKey="soCount"
            onPress={(row) => {
              setSelectedRankedCustomer(row as CustomerRow);
              setCompareRankedCustomer(null);
            }}
          />

          {/* Status breakdown */}
          <SectionHeader title="Purchase Order Status" />
          <StatusGrid rows={analytics.poStatuses} total={analytics.totalPOs} />

          <SectionHeader title="Sales Order Status" />
          <StatusGrid rows={analytics.soStatuses} total={analytics.totalSOs} />

          {/* Order value distribution */}
          <SectionHeader title="Order Value Distribution" subtitle="PO and SO counts by order size" />
          <ValueDistributionChart rows={analytics.valueDist} />

          {/* Delivery performance */}
          <SectionHeader title="Delivery Performance" subtitle="Open PO deadline status" />
          <DeliveryPerfCard perf={analytics.deliveryPerf} />

          {/* Supplier Lead Time */}
          <SectionHeader title="Supplier Lead Time" subtitle="Order-to-delivery days per vendor" />
          <LeadTimeChart rows={analytics.leadTime} onPress={handleLeadTimeVendorPress} />

          {/* Lead Time Monthly Trend */}
          <SectionHeader title="Lead Time Trend" subtitle="Avg days by order month · last 6 months" />
          <LeadTimeTrendChart data={analytics.leadTimeTrend} />

          <View style={styles.footer} />
        </ScrollView>
      )}

      {selectedLeadTimeVendor != null && (
        <VendorLeadTimeModal
          vendor={selectedLeadTimeVendor}
          trend={vendorLeadTrend}
          compareVendor={compareLeadTimeVendor}
          compareTrend={compareLeadTrend}
          otherVendors={(analytics?.leadTime ?? []).filter((r) => r.vendor !== selectedLeadTimeVendor)}
          onSelectCompare={handleCompareVendorSelect}
          onClearCompare={() => { setCompareLeadTimeVendor(null); setCompareLeadTrend([]); }}
          onClose={() => { setSelectedLeadTimeVendor(null); setCompareLeadTimeVendor(null); setCompareLeadTrend([]); }}
        />
      )}

      {selectedRankedVendor != null && (
        <RankedCompareModal
          primary={selectedRankedVendor}
          allRows={analytics?.topVendors ?? []}
          countKey="poCount"
          monthlyValues={rankedVendorMonthly}
          compareRow={compareRankedVendor}
          compareMonthlyValues={compareVendorMonthly}
          onSelectCompare={(row) => setCompareRankedVendor(row as VendorRow)}
          onClearCompare={() => setCompareRankedVendor(null)}
          onClose={() => { setSelectedRankedVendor(null); setCompareRankedVendor(null); }}
        />
      )}

      {selectedRankedCustomer != null && (
        <RankedCompareModal
          primary={selectedRankedCustomer}
          allRows={analytics?.topCustomers ?? []}
          countKey="soCount"
          monthlyValues={rankedCustomerMonthly}
          compareRow={compareRankedCustomer}
          compareMonthlyValues={compareCustomerMonthly}
          onSelectCompare={(row) => setCompareRankedCustomer(row as CustomerRow)}
          onClearCompare={() => setCompareRankedCustomer(null)}
          onClose={() => { setSelectedRankedCustomer(null); setCompareRankedCustomer(null); }}
        />
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
    color: Colors.surface,
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
  modeChipTextActive: { color: Colors.surface },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  footer: { height: Spacing.xxl },
});
