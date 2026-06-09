import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useCompany } from '@/context/CompanyContext';
import { fetchStockBalances, fetchWarehouses, fetchStockLedger, StockBalance, StockLedgerEntry, Warehouse } from '@/api/inventory';
import { getCached, setCached } from '@/utils/cache';
import { getLowStockThreshold } from '@/utils/settings';
import { exportStockHealthPDF, exportOutOfStockPDF, StockHealthPDFData } from '@/utils/pdfExport';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

// ─── Computed data ────────────────────────────────────────────────────────────

type StockHealthData = StockHealthPDFData & {
  topByQty: StockBalance[];
  lowStock: StockBalance[];
  outOfStock: StockBalance[];
};

interface VelocityItem {
  itemName: string;
  totalIn: number;
  totalOut: number;
  totalMovement: number;
}

function computeLedgerAnalysis(
  ledger: StockLedgerEntry[],
  stock: StockBalance[],
): { velocityItems: VelocityItem[]; dusMap: Map<string, number> } {
  // Period from first→last ledger date (default 180 days if unknown)
  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const e of ledger) {
    if (!e.dt) continue;
    const ms = new Date(e.dt).getTime();
    if (!isNaN(ms)) { if (ms < minMs) minMs = ms; if (ms > maxMs) maxMs = ms; }
  }
  const periodDays = (isFinite(minMs) && isFinite(maxMs))
    ? Math.max(1, Math.ceil((maxMs - minMs) / 86_400_000))
    : 180;

  // Aggregate by item name
  const map = new Map<string, { totalIn: number; totalOut: number }>();
  for (const e of ledger) {
    const name = e.item_name ?? 'Unknown';
    const v = map.get(name) ?? { totalIn: 0, totalOut: 0 };
    v.totalIn += e.qty_in ?? 0;
    v.totalOut += e.qty_out ?? 0;
    map.set(name, v);
  }

  // Top-8 velocity items (for VelocityCard)
  const velocityItems = Array.from(map.entries())
    .map(([itemName, { totalIn, totalOut }]) => ({
      itemName, totalIn, totalOut, totalMovement: totalIn + totalOut,
    }))
    .filter((v) => v.totalMovement > 0)
    .sort((a, b) => b.totalMovement - a.totalMovement)
    .slice(0, 8);

  // Stock qty lookup by item name
  const stockMap = new Map<string, number>();
  for (const s of stock) {
    stockMap.set(s.item_name, (stockMap.get(s.item_name) ?? 0) + (s.qty ?? 0));
  }

  // Days Until Stockout for all items with outflow
  const dusMap = new Map<string, number>();
  for (const [itemName, { totalOut }] of map.entries()) {
    if (totalOut <= 0) continue;
    const currentQty = stockMap.get(itemName) ?? 0;
    if (currentQty <= 0) continue;
    const dailyOut = totalOut / periodDays;
    const days = Math.round(currentQty / dailyOut);
    if (days < 365) dusMap.set(itemName, days);
  }

  return { velocityItems, dusMap };
}

function computeStockHealth(stock: StockBalance[], _warehouses: Warehouse[], threshold: number): StockHealthData {
  const allItems = stock;
  const inStock = allItems.filter((s) => (s.qty ?? 0) >= threshold);
  const lowStockList = allItems.filter((s) => { const q = s.qty ?? 0; return q > 0 && q < threshold; });
  const outOfStock = allItems.filter((s) => (s.qty ?? 0) <= 0);

  const topByQty = [...allItems]
    .filter((s) => (s.qty ?? 0) > 0)
    .sort((a, b) => (b.qty ?? 0) - (a.qty ?? 0))
    .slice(0, 8);

  const lowSorted = [...lowStockList].sort((a, b) => (a.qty ?? 0) - (b.qty ?? 0)).slice(0, 8);

  const outOfStockSorted = [...outOfStock].sort((a, b) =>
    (a.item_name ?? '').localeCompare(b.item_name ?? '')
  );

  // Group by warehouse
  const warehouseMap = new Map<string, { itemCount: number; totalQty: number }>();
  for (const s of allItems) {
    const name = s.warehouse_name ?? 'Unassigned';
    const existing = warehouseMap.get(name);
    if (existing) {
      existing.itemCount += 1;
      existing.totalQty += s.qty ?? 0;
    } else {
      warehouseMap.set(name, { itemCount: 1, totalQty: s.qty ?? 0 });
    }
  }
  const warehouseStats = Array.from(warehouseMap.entries())
    .map(([warehouse, stats]) => ({ warehouse, ...stats }))
    .sort((a, b) => b.totalQty - a.totalQty);

  return {
    totalItems: allItems.length,
    inStockItems: inStock.length,
    lowStockItems: lowStockList.length,
    outOfStockItems: outOfStock.length,
    topByQty,
    lowStock: lowSorted,
    outOfStock: outOfStockSorted,
    warehouseStats,
    threshold,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StockStatusBar({ data }: { data: StockHealthData }) {
  const { totalItems, inStockItems, lowStockItems, outOfStockItems } = data;
  const total = totalItems || 1;

  return (
    <View style={barStyles.card}>
      {/* Summary row */}
      <View style={barStyles.summaryRow}>
        <View style={barStyles.summaryItem}>
          <Text style={barStyles.summaryCount}>{inStockItems}</Text>
          <Text style={barStyles.summaryLabel}>Healthy</Text>
        </View>
        <View style={barStyles.divider} />
        <View style={barStyles.summaryItem}>
          <Text style={[barStyles.summaryCount, lowStockItems > 0 && barStyles.warnText]}>{lowStockItems}</Text>
          <Text style={barStyles.summaryLabel}>Low Stock</Text>
        </View>
        <View style={barStyles.divider} />
        <View style={barStyles.summaryItem}>
          <Text style={[barStyles.summaryCount, outOfStockItems > 0 && barStyles.dangerText]}>{outOfStockItems}</Text>
          <Text style={barStyles.summaryLabel}>Out of Stock</Text>
        </View>
        <View style={barStyles.divider} />
        <View style={barStyles.summaryItem}>
          <Text style={barStyles.summaryCount}>{totalItems}</Text>
          <Text style={barStyles.summaryLabel}>Total Items</Text>
        </View>
      </View>

      {/* Stacked bar */}
      <View style={barStyles.bar}>
        {inStockItems > 0 && (
          <View style={[barStyles.segment, barStyles.segHealthy, { flex: inStockItems / total }]} />
        )}
        {lowStockItems > 0 && (
          <View style={[barStyles.segment, barStyles.segLow, { flex: lowStockItems / total }]} />
        )}
        {outOfStockItems > 0 && (
          <View style={[barStyles.segment, barStyles.segOut, { flex: outOfStockItems / total }]} />
        )}
        {totalItems === 0 && <View style={[barStyles.segment, { flex: 1, backgroundColor: Colors.borderLight }]} />}
      </View>

      {/* Legend */}
      <View style={barStyles.legend}>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.dot, barStyles.segHealthy]} />
          <Text style={barStyles.legendText}>Healthy (≥{data.threshold})</Text>
        </View>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.dot, barStyles.segLow]} />
          <Text style={barStyles.legendText}>Low ({'<'}{data.threshold})</Text>
        </View>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.dot, barStyles.segOut]} />
          <Text style={barStyles.legendText}>Out of stock</Text>
        </View>
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryCount: { ...Typography.h3 },
  summaryLabel: { ...Typography.label, textTransform: 'uppercase' },
  warnText: { color: Colors.textSecondary },
  dangerText: { color: Colors.textSecondary },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: Colors.border,
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
  },
  segment: { height: '100%' },
  segHealthy: { backgroundColor: Colors.text },
  segLow: { backgroundColor: Colors.textSecondary },
  segOut: { backgroundColor: Colors.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  legendText: { fontSize: 11, color: Colors.textSecondary },
});

/** Ranked item list */
function RankedItemList({ items, showLowWarning, showOutOfStock, dusMap, onPress }: {
  items: StockBalance[];
  showLowWarning?: boolean;
  showOutOfStock?: boolean;
  dusMap?: Map<string, number>;
  onPress?: (item: StockBalance) => void;
}) {
  if (items.length === 0) {
    return (
      <View style={itemStyles.empty}>
        <Text style={itemStyles.emptyText}>No items</Text>
      </View>
    );
  }
  const maxQty = Math.max(...items.map((s) => s.qty ?? 0), 1);

  return (
    <View style={itemStyles.card}>
      {items.map((item, i) => {
        const qty = item.qty ?? 0;
        const barPct = showOutOfStock ? 0 : qty / maxQty;
        const isLast = i === items.length - 1;
        const dus = showLowWarning && dusMap ? dusMap.get(item.item_name) : undefined;
        const dusBg = dus != null
          ? (dus <= 7 ? '#1a1a1a' : dus <= 14 ? '#555' : '#999')
          : undefined;
        return (
          <TouchableOpacity
            key={`${item.item_name}-${item.warehouse_name ?? ''}-${i}`}
            style={[itemStyles.row, !isLast && itemStyles.rowBorder]}
            activeOpacity={onPress ? 0.6 : 1}
            onPress={onPress ? () => onPress(item) : undefined}
          >
            <View style={itemStyles.rankBadge}>
              {showOutOfStock ? (
                <Feather name="x-circle" size={14} color={Colors.textMuted} />
              ) : showLowWarning ? (
                <Feather name="alert-circle" size={14} color={Colors.textSecondary} />
              ) : (
                <Text style={itemStyles.rankText}>{i + 1}</Text>
              )}
            </View>
            <View style={itemStyles.nameCol}>
              <Text style={itemStyles.name} numberOfLines={1}>{item.item_name}</Text>
              {item.warehouse_name && (
                <Text style={itemStyles.warehouse} numberOfLines={1}>{item.warehouse_name}</Text>
              )}
              {!showOutOfStock && (
                <View style={itemStyles.barTrack}>
                  <View style={[itemStyles.barFill, { width: `${barPct * 100}%` }]} />
                </View>
              )}
            </View>
            <View style={itemStyles.qtyCol}>
              <Text style={[itemStyles.qty, showOutOfStock && itemStyles.qtyZero]}>
                {showOutOfStock ? '0' : qty.toLocaleString()}
              </Text>
              {item.unit && <Text style={itemStyles.unit}>{item.unit}</Text>}
            </View>
            {dus != null && (
              <View style={[itemStyles.dusBadge, { backgroundColor: dusBg }]}>
                <Text style={itemStyles.dusText}>~{dus}d</Text>
              </View>
            )}
            {onPress && <Feather name="chevron-right" size={14} color={Colors.textMuted} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const itemStyles = StyleSheet.create({
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
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
  nameCol: { flex: 1, gap: 3 },
  name: { ...Typography.body, fontWeight: '600' },
  warehouse: { fontSize: 11, color: Colors.textMuted },
  barTrack: {
    height: 3,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  barFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  qtyCol: { alignItems: 'flex-end' },
  qty: { fontSize: 14, fontWeight: '700', color: Colors.text },
  qtyZero: { color: Colors.textMuted },
  unit: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  dusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dusText: { fontSize: 10, fontWeight: '700', color: '#fff' },
});

/** Warehouse utilisation list */
function WarehouseList({ stats }: { stats: StockHealthData['warehouseStats'] }) {
  if (stats.length === 0) {
    return (
      <View style={whStyles.empty}>
        <Text style={whStyles.emptyText}>No warehouse data</Text>
      </View>
    );
  }
  const maxQty = Math.max(...stats.map((s) => s.totalQty), 1);

  return (
    <View style={whStyles.card}>
      {stats.map((s, i) => {
        const isLast = i === stats.length - 1;
        const pct = s.totalQty / maxQty;
        return (
          <View key={s.warehouse} style={[whStyles.row, !isLast && whStyles.rowBorder]}>
            <View style={whStyles.nameCol}>
              <Text style={whStyles.name} numberOfLines={1}>{s.warehouse}</Text>
              <Text style={whStyles.sub}>{s.itemCount} item{s.itemCount !== 1 ? 's' : ''}</Text>
              <View style={whStyles.barTrack}>
                <View style={[whStyles.barFill, { width: `${pct * 100}%` }]} />
              </View>
            </View>
            <Text style={whStyles.qty}>{s.totalQty.toLocaleString()}</Text>
          </View>
        );
      })}
    </View>
  );
}

const whStyles = StyleSheet.create({
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  nameCol: { flex: 1, gap: 3 },
  name: { ...Typography.body, fontWeight: '600' },
  sub: { fontSize: 11, color: Colors.textMuted },
  barTrack: {
    height: 3,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  barFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  qty: { fontSize: 14, fontWeight: '700', color: Colors.text },
});

/** Stock velocity: items with highest IN + OUT movement */
function VelocityCard({ items }: { items: VelocityItem[] }) {
  if (items.length === 0) return null;
  const maxMovement = items[0]?.totalMovement ?? 1;

  return (
    <View style={velocityStyles.card}>
      <View style={velocityStyles.legend}>
        <View style={velocityStyles.legendItem}>
          <View style={[velocityStyles.legendDot, velocityStyles.legendDotIn]} />
          <Text style={velocityStyles.legendLabel}>IN</Text>
        </View>
        <View style={velocityStyles.legendItem}>
          <View style={[velocityStyles.legendDot, velocityStyles.legendDotOut]} />
          <Text style={velocityStyles.legendLabel}>OUT</Text>
        </View>
      </View>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const inPct = item.totalMovement > 0 ? item.totalIn / item.totalMovement : 0;
        const barPct = item.totalMovement / maxMovement;
        return (
          <View
            key={item.itemName}
            style={[velocityStyles.row, !isLast && velocityStyles.rowBorder]}
          >
            <View style={velocityStyles.rankBadge}>
              <Text style={velocityStyles.rankText}>{i + 1}</Text>
            </View>
            <View style={velocityStyles.nameCol}>
              <Text style={velocityStyles.name} numberOfLines={1}>{item.itemName}</Text>
              <View style={velocityStyles.barTrack}>
                <View style={[velocityStyles.barFull, { width: `${barPct * 100}%` }]}>
                  <View style={[velocityStyles.barIn, { flex: inPct }]} />
                  <View style={[velocityStyles.barOut, { flex: 1 - inPct }]} />
                </View>
              </View>
            </View>
            <View style={velocityStyles.statsCol}>
              <Text style={velocityStyles.total}>{item.totalMovement.toLocaleString()}</Text>
              <View style={velocityStyles.inOutRow}>
                <Text style={velocityStyles.inLabel}>+{item.totalIn.toLocaleString()}</Text>
                <Text style={velocityStyles.outLabel}> −{item.totalOut.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const velocityStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: Radius.full },
  legendDotIn: { backgroundColor: Colors.text },
  legendDotOut: { backgroundColor: Colors.textMuted },
  legendLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
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
  name: { fontSize: 13, fontWeight: '600', color: Colors.text },
  barTrack: {
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFull: {
    height: '100%',
    flexDirection: 'row',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barIn: { backgroundColor: Colors.text },
  barOut: { backgroundColor: Colors.textMuted },
  statsCol: { alignItems: 'flex-end' },
  total: { fontSize: 13, fontWeight: '700', color: Colors.text },
  inOutRow: { flexDirection: 'row', marginTop: 1 },
  inLabel: { fontSize: 10, color: Colors.text, fontWeight: '600' },
  outLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
});

// ─── Item Detail Modal ────────────────────────────────────────────────────────

function ItemDetailModal({
  item,
  allStock,
  companyId,
  onClose,
}: {
  item: StockBalance;
  allStock: StockBalance[];
  companyId?: string | number;
  onClose: () => void;
}) {
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);

  // All warehouse rows for this item (aggregate by warehouse)
  const warehouseRows = React.useMemo(() => {
    const rows = allStock.filter(
      (s) => s.item_name === item.item_name || (item.item_id != null && s.item_id === item.item_id)
    );
    const map = new Map<string, { qty: number; unit?: string }>();
    for (const r of rows) {
      const wh = r.warehouse_name ?? 'Unassigned';
      const existing = map.get(wh);
      if (existing) {
        existing.qty += r.qty ?? 0;
      } else {
        map.set(wh, { qty: r.qty ?? 0, unit: r.unit });
      }
    }
    return Array.from(map.entries())
      .map(([warehouse, { qty, unit }]) => ({ warehouse, qty, unit }))
      .sort((a, b) => b.qty - a.qty);
  }, [allStock, item]);

  const totalQty = warehouseRows.reduce((s, r) => s + r.qty, 0);

  useEffect(() => {
    setLedgerLoading(true);
    fetchStockLedger({ itemId: item.item_id, companyId })
      .then((entries) => setLedger(entries.slice(0, 15)))
      .catch(() => setLedger([]))
      .finally(() => setLedgerLoading(false));
  }, [item.item_id, companyId]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <TouchableOpacity style={modalStyles.backdropTap} activeOpacity={1} onPress={onClose} />
        <View style={modalStyles.sheet}>
          {/* Handle */}
          <View style={modalStyles.handle} />

          {/* Header */}
          <View style={modalStyles.header}>
            <View style={modalStyles.headerInfo}>
              <Text style={modalStyles.headerName} numberOfLines={2}>{item.item_name}</Text>
              {item.item_code && <Text style={modalStyles.headerCode}>{item.item_code}</Text>}
            </View>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={modalStyles.body}>
            {/* Summary tiles */}
            <View style={modalStyles.tileRow}>
              <View style={modalStyles.tile}>
                <Text style={modalStyles.tileValue}>{totalQty.toLocaleString()}</Text>
                <Text style={modalStyles.tileLabel}>Total Stock</Text>
              </View>
              <View style={modalStyles.tileDivider} />
              <View style={modalStyles.tile}>
                <Text style={modalStyles.tileValue}>{warehouseRows.length}</Text>
                <Text style={modalStyles.tileLabel}>Warehouses</Text>
              </View>
              {item.unit && (
                <>
                  <View style={modalStyles.tileDivider} />
                  <View style={modalStyles.tile}>
                    <Text style={modalStyles.tileValue}>{item.unit}</Text>
                    <Text style={modalStyles.tileLabel}>Unit</Text>
                  </View>
                </>
              )}
            </View>

            {/* Per-warehouse breakdown */}
            <Text style={modalStyles.sectionTitle}>STOCK BY WAREHOUSE</Text>
            <View style={modalStyles.card}>
              {warehouseRows.length === 0 ? (
                <Text style={modalStyles.emptyText}>No warehouse data</Text>
              ) : (
                warehouseRows.map((row, i) => {
                  const pct = totalQty > 0 ? row.qty / totalQty : 0;
                  const isLast = i === warehouseRows.length - 1;
                  return (
                    <View key={row.warehouse} style={[modalStyles.whRow, !isLast && modalStyles.rowBorder]}>
                      <View style={modalStyles.whNameCol}>
                        <Text style={modalStyles.whName} numberOfLines={1}>{row.warehouse}</Text>
                        <View style={modalStyles.barTrack}>
                          <View style={[modalStyles.barFill, { width: `${pct * 100}%` }]} />
                        </View>
                      </View>
                      <View style={modalStyles.whQtyCol}>
                        <Text style={modalStyles.whQty}>{row.qty.toLocaleString()}</Text>
                        <Text style={modalStyles.whPct}>{Math.round(pct * 100)}%</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Recent ledger entries */}
            <Text style={modalStyles.sectionTitle}>RECENT ACTIVITY</Text>
            {ledgerLoading ? (
              <ActivityIndicator size="small" color={Colors.textMuted} style={{ marginVertical: 16 }} />
            ) : ledger.length === 0 ? (
              <View style={modalStyles.card}>
                <Text style={modalStyles.emptyText}>No ledger entries found</Text>
              </View>
            ) : (
              <View style={modalStyles.card}>
                {ledger.map((entry, i) => {
                  const isIn = (entry.qty_in ?? 0) > 0;
                  const qty = isIn ? entry.qty_in : entry.qty_out;
                  const isLast = i === ledger.length - 1;
                  return (
                    <View key={entry.id ?? i} style={[modalStyles.ledgerRow, !isLast && modalStyles.rowBorder]}>
                      <View style={[modalStyles.ledgerDot, isIn ? modalStyles.dotIn : modalStyles.dotOut]} />
                      <View style={modalStyles.ledgerInfo}>
                        <Text style={modalStyles.ledgerVoucher} numberOfLines={1}>
                          {entry.voucher_type ?? '—'}{entry.voucher_no ? ` · ${entry.voucher_no}` : ''}
                        </Text>
                        <Text style={modalStyles.ledgerDate}>{entry.dt}</Text>
                      </View>
                      <View style={modalStyles.ledgerQtyCol}>
                        <Text style={[modalStyles.ledgerQty, isIn ? modalStyles.qtyIn : modalStyles.qtyOut]}>
                          {isIn ? '+' : '−'}{(qty ?? 0).toLocaleString()}
                        </Text>
                        {entry.balance != null && (
                          <Text style={modalStyles.ledgerBal}>bal: {entry.balance.toLocaleString()}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTap: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  headerInfo: { flex: 1 },
  headerName: { ...Typography.h3 },
  headerCode: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingTop: Spacing.md, paddingHorizontal: Spacing.md },
  tileRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  tile: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 2 },
  tileDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  tileValue: { ...Typography.h3 },
  tileLabel: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  emptyText: { padding: Spacing.md, color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  whRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10, gap: Spacing.sm },
  whNameCol: { flex: 1, gap: 4 },
  whName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  barTrack: { height: 3, backgroundColor: Colors.background, borderRadius: Radius.full, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  whQtyCol: { alignItems: 'flex-end' },
  whQty: { fontSize: 14, fontWeight: '700', color: Colors.text },
  whPct: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10, gap: Spacing.sm },
  ledgerDot: { width: 8, height: 8, borderRadius: Radius.full },
  dotIn: { backgroundColor: Colors.text },
  dotOut: { backgroundColor: Colors.textSecondary },
  ledgerInfo: { flex: 1 },
  ledgerVoucher: { fontSize: 12, fontWeight: '600', color: Colors.text },
  ledgerDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  ledgerQtyCol: { alignItems: 'flex-end' },
  ledgerQty: { fontSize: 13, fontWeight: '700' },
  qtyIn: { color: Colors.text },
  qtyOut: { color: Colors.textSecondary },
  ledgerBal: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StockHealthScreen() {
  const navigation = useNavigation<Nav>();
  const { companyId } = useCompany();
  const [data, setData] = useState<StockHealthData | null>(null);
  const [allStock, setAllStock] = useState<StockBalance[]>([]);
  const [velocityItems, setVelocityItems] = useState<VelocityItem[]>([]);
  const [dusMap, setDusMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingOOS, setExportingOOS] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockBalance | null>(null);

  const cacheKey = `stock-health:${companyId ?? 'all'}`;
  const ledgerCacheKey = `stock-velocity:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const cached = await getCached<{ stock: StockBalance[]; warehouses: Warehouse[]; threshold: number }>(cacheKey);
      const ledgerCached = await getCached<StockLedgerEntry[]>(ledgerCacheKey);

      if (cached && ledgerCached && !isRefresh) {
        const s = cached.data.stock;
        setAllStock(s);
        setData(computeStockHealth(s, cached.data.warehouses, cached.data.threshold));
        const { velocityItems: vi, dusMap: dm } = computeLedgerAnalysis(ledgerCached.data, s);
        setVelocityItems(vi);
        setDusMap(dm);
        setLoading(false);
        return;
      }

      const threshold = await getLowStockThreshold();
      const [stock, warehouses, ledger] = await Promise.all([
        fetchStockBalances(companyId ?? undefined),
        fetchWarehouses(companyId ?? undefined),
        fetchStockLedger({ companyId: companyId ?? undefined }),
      ]);

      await Promise.all([
        setCached(cacheKey, { stock, warehouses, threshold }),
        setCached(ledgerCacheKey, ledger),
      ]);
      setAllStock(stock);
      setData(computeStockHealth(stock, warehouses, threshold));
      const { velocityItems: vi, dusMap: dm } = computeLedgerAnalysis(ledger, stock);
      setVelocityItems(vi);
      setDusMap(dm);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, cacheKey, ledgerCacheKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleExport = useCallback(async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportStockHealthPDF({ ...data, outOfStock: data.outOfStock });
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  }, [data]);

  const handleExportOOS = useCallback(async () => {
    if (!data || data.outOfStockItems === 0) return;
    setExportingOOS(true);
    try {
      await exportOutOfStockPDF({
        items: data.outOfStock ?? [],
        totalItems: data.totalItems,
        inStockItems: data.inStockItems,
      });
    } catch {
      // ignore
    } finally {
      setExportingOOS(false);
    }
  }, [data]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Stock Health</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={!data || exporting}
          accessibilityLabel="Export PDF"
        >
          <Feather name="file-text" size={18} color={data && !exporting ? Colors.text : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Company selector */}
      <CompanySelector />

      {loading ? (
        <ListScreenSkeleton />
      ) : error || !data ? (
        <ErrorView message="Failed to load stock data" onRetry={() => load()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.textMuted} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Stock health overview */}
          <SectionHeader title="Stock Health Overview" subtitle={`Threshold: ${data.threshold} units`} />
          <StockStatusBar data={data} />

          {/* Out-of-stock items */}
          {data.outOfStockItems > 0 && (
            <>
              <SectionHeader
                title="Out of Stock"
                subtitle={`${data.outOfStockItems} item${data.outOfStockItems !== 1 ? 's' : ''} with zero stock`}
                action={
                  <TouchableOpacity
                    onPress={handleExportOOS}
                    disabled={exportingOOS}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Export out-of-stock reorder list"
                  >
                    {exportingOOS
                      ? <ActivityIndicator size="small" color={Colors.textMuted} />
                      : <Feather name="file-text" size={14} color={Colors.textMuted} />}
                  </TouchableOpacity>
                }
              />
              <RankedItemList items={data.outOfStock} showOutOfStock onPress={setSelectedItem} />
            </>
          )}

          {/* Low stock items */}
          {data.lowStockItems > 0 && (
            <>
              <SectionHeader
                title="Low Stock Items"
                subtitle={`${data.lowStockItems} item${data.lowStockItems !== 1 ? 's' : ''} below threshold`}
              />
              <RankedItemList items={data.lowStock} showLowWarning dusMap={dusMap} onPress={setSelectedItem} />
            </>
          )}

          {/* Top items by quantity */}
          <SectionHeader title="Top Items by Quantity" subtitle="Highest stock levels" />
          <RankedItemList items={data.topByQty} onPress={setSelectedItem} />

          {/* Stock velocity */}
          {velocityItems.length > 0 && (
            <>
              <SectionHeader
                title="Stock Velocity"
                subtitle="Top 8 items by combined movement"
              />
              <VelocityCard items={velocityItems} />
            </>
          )}

          {/* Warehouse breakdown */}
          <SectionHeader title="Warehouse Distribution" subtitle="Total quantity per warehouse" />
          <WarehouseList stats={data.warehouseStats} />

          <View style={styles.footer} />
        </ScrollView>
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          allStock={allStock}
          companyId={companyId ?? undefined}
          onClose={() => setSelectedItem(null)}
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
  exportBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  content: { paddingTop: Spacing.sm },
  footer: { height: Spacing.xxl },
});
