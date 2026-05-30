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
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import CompanySelector from '@/components/CompanySelector';
import SectionHeader from '@/components/SectionHeader';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import { useCompany } from '@/context/CompanyContext';
import { fetchStockBalances, fetchWarehouses, StockBalance, Warehouse } from '@/api/inventory';
import { getCached, setCached } from '@/utils/cache';
import { getLowStockThreshold } from '@/utils/settings';
import { exportStockHealthPDF, StockHealthPDFData } from '@/utils/pdfExport';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

// ─── Computed data ────────────────────────────────────────────────────────────

type StockHealthData = StockHealthPDFData & {
  topByQty: StockBalance[];
  lowStock: StockBalance[];
};

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
function RankedItemList({ items, showLowWarning }: { items: StockBalance[]; showLowWarning?: boolean }) {
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
        const barPct = qty / maxQty;
        const isLast = i === items.length - 1;
        return (
          <View key={`${item.item_name}-${item.warehouse_name ?? ''}-${i}`}
            style={[itemStyles.row, !isLast && itemStyles.rowBorder]}
          >
            <View style={itemStyles.rankBadge}>
              {showLowWarning ? (
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
              <View style={itemStyles.barTrack}>
                <View style={[itemStyles.barFill, { width: `${barPct * 100}%` }]} />
              </View>
            </View>
            <View style={itemStyles.qtyCol}>
              <Text style={itemStyles.qty}>{qty.toLocaleString()}</Text>
              {item.unit && <Text style={itemStyles.unit}>{item.unit}</Text>}
            </View>
          </View>
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
  unit: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StockHealthScreen() {
  const navigation = useNavigation<Nav>();
  const { companyId } = useCompany();
  const [data, setData] = useState<StockHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const cacheKey = `stock-health:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const cached = await getCached<{ stock: StockBalance[]; warehouses: Warehouse[]; threshold: number }>(cacheKey);
      if (cached && !isRefresh) {
        setData(computeStockHealth(cached.data.stock, cached.data.warehouses, cached.data.threshold));
        setLoading(false);
        return;
      }

      const threshold = await getLowStockThreshold();
      const [stock, warehouses] = await Promise.all([
        fetchStockBalances(companyId ?? undefined),
        fetchWarehouses(companyId ?? undefined),
      ]);

      await setCached(cacheKey, { stock, warehouses, threshold });
      setData(computeStockHealth(stock, warehouses, threshold));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, cacheKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleExport = useCallback(async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportStockHealthPDF(data);
    } catch {
      // ignore
    } finally {
      setExporting(false);
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

          {/* Low stock items */}
          {data.lowStockItems > 0 && (
            <>
              <SectionHeader
                title="Low Stock Items"
                subtitle={`${data.lowStockItems} item${data.lowStockItems !== 1 ? 's' : ''} below threshold`}
              />
              <RankedItemList items={data.lowStock} showLowWarning />
            </>
          )}

          {/* Top items by quantity */}
          <SectionHeader title="Top Items by Quantity" subtitle="Highest stock levels" />
          <RankedItemList items={data.topByQty} />

          {/* Warehouse breakdown */}
          <SectionHeader title="Warehouse Distribution" subtitle="Total quantity per warehouse" />
          <WarehouseList stats={data.warehouseStats} />

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
