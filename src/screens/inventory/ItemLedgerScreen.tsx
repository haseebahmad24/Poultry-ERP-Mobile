import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchStockLedger, StockLedgerEntry } from '@/api/inventory';
import { exportItemLedgerPDF } from '@/utils/pdfExport';
import DetailSkeleton from '@/components/DetailSkeleton';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';
import { useCompany } from '@/context/CompanyContext';
import { formatShortDate } from '@/utils/currency';
import type { InventoryStackParamList } from '@/navigation/InventoryNavigator';

type RouteType = RouteProp<InventoryStackParamList, 'ItemLedger'>;

export default function ItemLedgerScreen() {
  const route = useRoute<RouteType>();
  const { item_id, item_name, item_code, warehouse_id, warehouse_name } = route.params;
  const { companyId, selectedCompany } = useCompany();

  const [entries, setEntries] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchStockLedger({
        companyId,
        itemId: item_id,
        warehouseId: warehouse_id,
        from: dateRange.from || undefined,
        to: dateRange.to || undefined,
      });
      setEntries(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, item_id, warehouse_id, dateRange.from, dateRange.to]);

  useEffect(() => { load(); }, [load]);

  const hasDateFilter = !!(dateRange.from || dateRange.to);

  const totalIn = entries.reduce((s, e) => s + (e.qty_in ?? 0), 0);
  const totalOut = entries.reduce((s, e) => s + (e.qty_out ?? 0), 0);

  // Compute running balance client-side when the API doesn't provide balance fields
  const entriesWithBalance = React.useMemo(() => {
    const allMissingBalance = entries.length > 0 && entries.every((e) => e.balance == null);
    if (!allMissingBalance) return entries.map((e) => ({ entry: e, computedBalance: null as number | null }));
    // Sort chronologically (oldest first) and accumulate qty_in − qty_out
    const sorted = [...entries].sort((a, b) => (a.dt ?? '').localeCompare(b.dt ?? ''));
    let running = 0;
    return sorted.map((entry) => {
      running += (entry.qty_in ?? 0) - (entry.qty_out ?? 0);
      return { entry, computedBalance: running };
    });
  }, [entries]);

  const latestBalance = entries.length > 0
    ? (entries[entries.length - 1].balance ?? entriesWithBalance[entriesWithBalance.length - 1]?.computedBalance ?? null)
    : null;

  const handleExportPDF = async () => {
    await exportItemLedgerPDF({
      itemName: item_name,
      itemCode: item_code,
      companyName: selectedCompany?.name ?? 'Company',
      dateRange: { from: dateRange.from, to: dateRange.to },
      entries,
      totalIn,
      totalOut,
      currentBalance: latestBalance,
    });
  };

  if (loading) return <SafeAreaView style={{flex:1,backgroundColor:Colors.background}} edges={['top']}><StatusBar style="dark" /><DetailSkeleton tileCount={3} listCount={6} /></SafeAreaView>;
  if (error && entries.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{item_name}</Text>
          <View style={styles.headerSubRow}>
            {item_code && <Text style={styles.headerSub}>{item_code}</Text>}
            {warehouse_name && (
              <>
                {item_code && <Text style={styles.headerSubDot}>·</Text>}
                <Feather name="map-pin" size={10} color={Colors.textMuted} />
                <Text style={styles.headerSubWarehouse} numberOfLines={1}>{warehouse_name}</Text>
              </>
            )}
          </View>
        </View>
        {entries.length > 0 && (
          <TouchableOpacity style={styles.pdfBtn} onPress={handleExportPDF}>
            <Feather name="file-text" size={18} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total In</Text>
          <Text style={styles.summaryValue}>+{totalIn.toLocaleString()}</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Out</Text>
          <Text style={styles.summaryValue}>-{totalOut.toLocaleString()}</Text>
        </View>
        {latestBalance != null && (
          <>
            <View style={styles.summarySep} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Balance</Text>
              <Text style={[styles.summaryValue, latestBalance <= 0 && styles.summaryValueMuted]}>
                {latestBalance.toLocaleString()}
              </Text>
            </View>
          </>
        )}
      </View>

      <DateRangeBar value={dateRange} onChange={setDateRange} />

      {entriesWithBalance.length >= 2 && (
        <BalanceSparkline entries={entriesWithBalance} />
      )}

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
        <SectionHeader
          title="Movement Log"
          meta={`${entries.length} entries${hasDateFilter ? ' (filtered)' : ''}`}
        />

        {entriesWithBalance.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="box" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No ledger entries found</Text>
            {hasDateFilter && (
              <TouchableOpacity onPress={() => setDateRange({ from: '', to: '' })}>
                <Text style={styles.emptyLink}>Clear date filter</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.cardList}>
            {entriesWithBalance.map(({ entry, computedBalance }, idx) => (
              <LedgerCard key={`${entry.id ?? idx}`} entry={entry} computedBalance={computedBalance} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Balance Sparkline ────────────────────────────────────────────────────────

const SPARK_H = 56;
const SPARK_DOT_R = 2.5;
const SPARK_DOT_R_SEL = 4.5;

function BalanceSparkline({
  entries,
}: {
  entries: Array<{ entry: StockLedgerEntry; computedBalance: number | null }>;
}) {
  const [chartW, setChartW] = React.useState(0);
  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);

  const balances = useMemo(
    () => entries.map(({ entry, computedBalance }) =>
      entry.balance != null ? entry.balance : (computedBalance ?? 0)
    ),
    [entries]
  );

  const maxVal = Math.max(...balances.map(Math.abs), 1);
  const minVal = Math.min(...balances, 0);
  const range = maxVal - minVal;
  const getY = (v: number) => SPARK_H * (1 - (v - minVal) / (range || 1));

  const pts = chartW > 0
    ? balances.map((v, i) => ({ x: (i / (balances.length - 1)) * chartW, y: getY(v) }))
    : [];

  const zeroY = range > 0 ? getY(0) : SPARK_H;
  const hasNeg = minVal < 0;
  const lastBal = balances[balances.length - 1] ?? 0;
  const colW = chartW > 0 ? chartW / entries.length : 0;
  const selEntry = selectedIdx != null ? entries[selectedIdx] : null;
  const selBalance = selectedIdx != null ? balances[selectedIdx] : null;

  return (
    <View style={sparkStyles.card}>
      <View style={sparkStyles.headerRow}>
        <Text style={sparkStyles.label}>BALANCE TREND</Text>
        {selectedIdx != null ? (
          <TouchableOpacity
            onPress={() => setSelectedIdx(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={11} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <Text style={[sparkStyles.lastVal, lastBal < 0 && sparkStyles.lastValNeg]}>
            {lastBal >= 0 ? '+' : ''}{lastBal.toLocaleString()} current
          </Text>
        )}
      </View>
      <View
        style={sparkStyles.chartArea}
        onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
      >
        {chartW > 0 && (
          <>
            {/* Selected column highlight */}
            {selectedIdx !== null && pts[selectedIdx] && (
              <View
                style={{
                  position: 'absolute',
                  left: pts[selectedIdx].x - colW / 2,
                  top: 0,
                  width: colW,
                  height: SPARK_H,
                  backgroundColor: Colors.borderLight,
                  borderRadius: 3,
                }}
                pointerEvents="none"
              />
            )}
            {hasNeg && (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: zeroY,
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: Colors.borderLight,
                }}
              />
            )}
            {pts.map((pt, i) => {
              if (i === 0) return null;
              const prev = pts[i - 1];
              const dx = pt.x - prev.x;
              const dy = pt.y - prev.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View
                  key={`seg-${i}`}
                  style={{
                    position: 'absolute',
                    width: len,
                    height: 1.5,
                    backgroundColor: lastBal < 0 ? Colors.textSecondary : Colors.text,
                    left: (prev.x + pt.x) / 2 - len / 2,
                    top: (prev.y + pt.y) / 2 - 0.75,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}
            {pts.map((pt, i) => {
              const v = balances[i];
              const isSel = i === selectedIdx;
              const isLast = i === pts.length - 1;
              const r = isSel ? SPARK_DOT_R_SEL : (isLast ? SPARK_DOT_R + 1.5 : SPARK_DOT_R);
              return (
                <View
                  key={`dot-${i}`}
                  style={{
                    position: 'absolute',
                    width: r * 2,
                    height: r * 2,
                    borderRadius: r,
                    backgroundColor: v < 0 ? Colors.textSecondary : Colors.text,
                    left: pt.x - r,
                    top: pt.y - r,
                    borderWidth: isSel ? 2 : 1.5,
                    borderColor: Colors.surface,
                    opacity: (isSel || isLast) ? 1 : 0.55,
                  }}
                />
              );
            })}
            {/* Touch hit zones — one per column */}
            {pts.map((pt, i) => (
              <TouchableOpacity
                key={`hit-${i}`}
                style={{
                  position: 'absolute',
                  left: pt.x - colW / 2,
                  top: 0,
                  width: colW,
                  height: SPARK_H,
                }}
                activeOpacity={1}
                onPress={() => setSelectedIdx((prev) => (prev === i ? null : i))}
              />
            ))}
          </>
        )}
      </View>
      {selEntry ? (
        <View style={sparkStyles.snapRow}>
          <Text style={sparkStyles.snapDate}>{formatShortDate(selEntry.entry.dt ?? '')}</Text>
          <View style={sparkStyles.snapAmounts}>
            {(selEntry.entry.qty_in ?? 0) !== 0 && (
              <Text style={sparkStyles.snapIn}>+{(selEntry.entry.qty_in ?? 0).toLocaleString()} in</Text>
            )}
            {(selEntry.entry.qty_out ?? 0) !== 0 && (
              <Text style={sparkStyles.snapOut}>−{(selEntry.entry.qty_out ?? 0).toLocaleString()} out</Text>
            )}
            <Text style={[sparkStyles.snapBal, (selBalance ?? 0) < 0 && sparkStyles.lastValNeg]}>
              = {selBalance?.toLocaleString() ?? '?'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={sparkStyles.footerRow}>
          <Text style={sparkStyles.footerLabel}>
            {entries[0]?.entry.dt ? formatShortDate(entries[0].entry.dt) : ''}
          </Text>
          <Text style={sparkStyles.footerLabel}>tap dot to inspect</Text>
          <Text style={sparkStyles.footerLabel}>
            {entries[entries.length - 1]?.entry.dt ? formatShortDate(entries[entries.length - 1].entry.dt) : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  lastVal: { fontSize: 12, fontWeight: '700', color: Colors.text },
  lastValNeg: { color: Colors.textSecondary },
  chartArea: {
    height: SPARK_H,
    position: 'relative',
    overflow: 'visible',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { fontSize: 10, color: Colors.textMuted },
  snapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  snapDate: { fontSize: 11, fontWeight: '600', color: Colors.text },
  snapAmounts: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  snapIn: { fontSize: 11, color: Colors.text },
  snapOut: { fontSize: 11, color: Colors.textSecondary },
  snapBal: { fontSize: 12, fontWeight: '700', color: Colors.text },
});

function LedgerCard({ entry, computedBalance }: { entry: StockLedgerEntry; computedBalance: number | null }) {
  const vtype = entry.voucher_type ?? '';
  const qtyIn = entry.qty_in ?? 0;
  const qtyOut = entry.qty_out ?? 0;
  const balanceToShow = entry.balance != null ? entry.balance : computedBalance;
  const isComputed = entry.balance == null && computedBalance != null;

  return (
    <View style={styles.card}>
      <View style={styles.ledgerHeader}>
        <View style={styles.voucherBadge}>
          <Text style={styles.voucherBadgeText}>{vtype || 'TXN'}</Text>
        </View>
        <Text style={styles.ledgerVoucherNo} numberOfLines={1}>{entry.voucher_no ?? '—'}</Text>
        <Text style={styles.ledgerDate}>{formatShortDate(entry.dt)}</Text>
      </View>
      {entry.warehouse_name && (
        <Text style={styles.ledgerWarehouse}>{entry.warehouse_name}</Text>
      )}
      <View style={styles.ledgerQtys}>
        {qtyIn !== 0 && (
          <View style={styles.qtyPill}>
            <Feather name="arrow-up" size={11} color={Colors.textSecondary} />
            <Text style={styles.qtyPillLabel}>IN</Text>
            <Text style={styles.qtyPillValue}>+{qtyIn.toLocaleString()}</Text>
          </View>
        )}
        {qtyOut !== 0 && (
          <View style={styles.qtyPill}>
            <Feather name="arrow-down" size={11} color={Colors.textSecondary} />
            <Text style={styles.qtyPillLabel}>OUT</Text>
            <Text style={styles.qtyPillValue}>-{qtyOut.toLocaleString()}</Text>
          </View>
        )}
        {balanceToShow != null && (
          <View style={styles.qtyPill}>
            <Text style={[styles.qtyPillLabel, isComputed && styles.qtyPillLabelComputed]}>
              {isComputed ? '~BAL' : 'BAL'}
            </Text>
            <Text style={[styles.qtyPillValue, isComputed && styles.qtyPillValueComputed]}>
              {balanceToShow.toLocaleString()}
            </Text>
          </View>
        )}
        {entry.unit && <Text style={styles.qtyUnit}>{entry.unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  headerText: { flex: 1 },
  headerTitle: { ...Typography.h3 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap', marginTop: 2 },
  headerSubDot: { fontSize: 10, color: Colors.textMuted },
  headerSubWarehouse: { fontSize: 11, color: Colors.textMuted, flex: 1 },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { ...Typography.bodySmall, color: Colors.textMuted },
  summaryValue: { ...Typography.h4, fontWeight: '700', marginTop: 2 },
  summaryValueMuted: { color: Colors.textSecondary },
  summarySep: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: Colors.border },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  cardList: { gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  voucherBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  voucherBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: Colors.text },
  ledgerVoucherNo: { flex: 1, ...Typography.body, color: Colors.text, fontWeight: '600' },
  ledgerDate: { ...Typography.bodySmall, color: Colors.textMuted },
  ledgerWarehouse: { ...Typography.bodySmall, color: Colors.textSecondary },
  ledgerQtys: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  qtyPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  qtyPillLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  qtyPillLabelComputed: { color: Colors.textSecondary, fontStyle: 'italic' },
  qtyPillValue: { ...Typography.body, fontWeight: '700', color: Colors.text },
  qtyPillValueComputed: { color: Colors.textSecondary, fontStyle: 'italic' },
  qtyUnit: { ...Typography.bodySmall, color: Colors.textMuted },

  pdfBtn: { padding: 4 },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { ...Typography.body, color: Colors.textMuted },
  emptyLink: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
});
