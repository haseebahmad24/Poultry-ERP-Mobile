import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import {
  fetchStockBalances,
  fetchStockLedger,
  fetchWarehouses,
  StockBalance,
  StockLedgerEntry,
  Warehouse,
} from '@/api/inventory';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import SectionHeader from '@/components/SectionHeader';
import CompanySelector from '@/components/CompanySelector';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';
import { useCompany } from '@/context/CompanyContext';
import { useOverdue } from '@/context/OverdueContext';
import { formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import OfflineBanner from '@/components/OfflineBanner';
import { getLowStockThreshold } from '@/utils/settings';
import { exportStockBalancePDF, exportWarehousesPDF } from '@/utils/pdfExport';
import type { InventoryStackParamList } from '@/navigation/InventoryNavigator';

type Tab = 'stock' | 'ledger' | 'warehouses';
type StockFilter = 'all' | 'low' | 'out';

export default function InventoryScreen() {
  const { companyId, selectedCompany } = useCompany();
  const { setLowStock } = useOverdue();
  const navigation = useNavigation<NativeStackNavigationProp<InventoryStackParamList>>();
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [stockData, setStockData] = useState<StockBalance[]>([]);
  const [ledgerData, setLedgerData] = useState<StockLedgerEntry[]>([]);
  const [warehouseData, setWarehouseData] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [lowStockThreshold, setLowStockThreshold] = useState(100);

  useEffect(() => {
    getLowStockThreshold().then(setLowStockThreshold);
  }, []);

  useEffect(() => {
    const count = stockData.filter((s) => { const q = s.qty ?? 0; return q > 0 && q < lowStockThreshold; }).length;
    setLowStock(count);
  }, [stockData, lowStockThreshold, setLowStock]);

  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });

  const loadStock = useCallback(async () => {
    const data = await fetchStockBalances(companyId);
    setStockData(data);
    await setCached(`inventory:stock:${companyId ?? 'all'}`, data);
  }, [companyId]);

  const loadLedger = useCallback(async () => {
    const data = await fetchStockLedger({ companyId, from: dateRange.from || undefined, to: dateRange.to || undefined });
    setLedgerData(data);
  }, [companyId, dateRange.from, dateRange.to]);

  const loadWarehouses = useCallback(async () => {
    const data = await fetchWarehouses(companyId);
    setWarehouseData(data);
  }, [companyId]);

  const stockCacheKey = `inventory:stock:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    let hadCachedData = false;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      const cached = await getCached<StockBalance[]>(stockCacheKey);
      if (cached) {
        hadCachedData = true;
        setStockData(cached.data);
        setIsStale(cached.stale);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    setError(null);
    try {
      await Promise.all([loadStock(), loadLedger(), loadWarehouses()]);
      setIsStale(false);
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
  }, [loadStock, loadLedger, loadWarehouses, stockCacheKey]);

  useEffect(() => { load(); }, [load]);

  const filteredStock = stockData.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      s.item_name?.toLowerCase().includes(q) ||
      s.warehouse_name?.toLowerCase().includes(q);
    const qty = s.qty ?? 0;
    const matchesStockFilter =
      stockFilter === 'all' ||
      (stockFilter === 'out' && qty <= 0) ||
      (stockFilter === 'low' && qty > 0 && qty < lowStockThreshold);
    return matchesSearch && matchesStockFilter;
  });

  const outOfStockCount = stockData.filter((s) => (s.qty ?? 0) <= 0).length;
  const lowStockCount = stockData.filter((s) => { const q = s.qty ?? 0; return q > 0 && q < lowStockThreshold; }).length;

  const filteredLedger = ledgerData.filter((e) =>
    !search || e.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.warehouse_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredWarehouses = warehouseData.filter((w) =>
    !search || w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.code?.toLowerCase().includes(search.toLowerCase()) ||
    w.type?.toLowerCase().includes(search.toLowerCase())
  );

  const tabMeta: Record<Tab, string> = {
    stock: `${stockData.length} items`,
    ledger: `${ledgerData.length} entries`,
    warehouses: `${warehouseData.length} warehouses`,
  };

  const handleExportPDF = async () => {
    const companyName = selectedCompany?.name ?? 'All Companies';
    const filterLabel = stockFilter === 'all' ? 'All' : stockFilter === 'low' ? 'Low Stock' : 'Out of Stock';
    await exportStockBalancePDF({
      rows: filteredStock,
      companyName,
      filter: filterLabel,
    });
  };

  const handleWarehouseExportPDF = async () => {
    const companyName = selectedCompany?.name ?? 'All Companies';
    await exportWarehousesPDF({ warehouses: filteredWarehouses, companyName });
  };

  if (error && stockData.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        {!loading && <Text style={styles.headerSub}>{tabMeta[activeTab]}</Text>}
        {!loading && activeTab === 'stock' && filteredStock.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
            <Feather name="file-text" size={13} color={Colors.text} />
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        )}
        {!loading && activeTab === 'warehouses' && filteredWarehouses.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={handleWarehouseExportPDF}>
            <Feather name="file-text" size={13} color={Colors.text} />
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      <CompanySelector />
      <OfflineBanner visible={isStale} />

      {loading ? (
        <ListScreenSkeleton count={8} showTabs showSearch={false} showBadge />
      ) : (
      <>
      <View style={styles.tabBar}>
        {(['stock', 'ledger', 'warehouses'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'stock' ? 'Stock' : tab === 'ledger' ? 'Ledger' : 'Warehouses'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'ledger' && (
        <DateRangeBar value={dateRange} onChange={setDateRange} />
      )}

      {activeTab === 'stock' && (
        <View style={styles.stockFilterBar}>
          {([
            { key: 'all', label: 'All' },
            { key: 'low', label: `Low Stock${lowStockCount > 0 ? ` (${lowStockCount})` : ''}` },
            { key: 'out', label: `Out of Stock${outOfStockCount > 0 ? ` (${outOfStockCount})` : ''}` },
          ] as { key: StockFilter; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.stockFilterChip, stockFilter === key && styles.stockFilterChipActive]}
              onPress={() => setStockFilter(key)}
            >
              <Text style={[styles.stockFilterChipText, stockFilter === key && styles.stockFilterChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.searchContainer}>
        <Feather name="search" size={14} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'warehouses' ? 'Search warehouses…' : 'Search items or warehouses…'
          }
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

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
        {activeTab === 'stock' && (
          <>
            <SectionHeader
              title="Current Stock"
              meta={`${filteredStock.length} records${stockFilter !== 'all' ? ' (filtered)' : ''}`}
            />
            {filteredStock.length === 0 ? (
              <EmptyState message={
                stockFilter === 'out' ? 'No out-of-stock items' :
                stockFilter === 'low' ? 'No low-stock items' :
                'No stock balances found'
              } />
            ) : (
              <View style={styles.cardList}>
                {filteredStock.map((item, idx) => (
                  <StockCard
                    key={`${item.item_id ?? item.item_name}-${idx}`}
                    item={item}
                    lowThreshold={lowStockThreshold}
                    onPress={item.item_id != null ? () => navigation.navigate('ItemLedger', {
                      item_id: item.item_id!,
                      item_name: item.item_name,
                      item_code: item.item_code,
                    }) : undefined}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'ledger' && (
          <>
            <SectionHeader
              title="Movement Log"
              meta={`${filteredLedger.length} entries${(dateRange.from || dateRange.to) ? ' (filtered)' : ''}`}
            />
            {filteredLedger.length === 0 ? (
              <EmptyState message="No ledger entries found" />
            ) : (
              <View style={styles.cardList}>
                {filteredLedger.map((entry, idx) => (
                  <LedgerCard key={`${entry.id ?? idx}`} entry={entry} />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'warehouses' && (
          <>
            <SectionHeader title="Warehouses" meta={`${filteredWarehouses.length} locations`} />
            {filteredWarehouses.length === 0 ? (
              <EmptyState message="No warehouses found" />
            ) : (
              <View style={styles.cardList}>
                {filteredWarehouses.map((wh, idx) => (
                  <WarehouseCard key={wh.id ?? idx} warehouse={wh} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      </>
      )}
    </SafeAreaView>
  );
}

function StockCard({
  item,
  lowThreshold,
  onPress,
}: {
  item: StockBalance;
  lowThreshold: number;
  onPress?: () => void;
}) {
  const qty = item.qty ?? 0;
  const isOut = qty <= 0;
  const isLow = qty > 0 && qty < lowThreshold;
  const statusLabel = isOut ? 'Out' : isLow ? 'Low' : null;

  const inner = (
    <View style={styles.cardRow}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.item_name}</Text>
        {item.item_code && <Text style={styles.cardCode}>{item.item_code}</Text>}
        {item.warehouse_name && <Text style={styles.cardSub}>{item.warehouse_name}</Text>}
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.qtyValue}>{qty.toLocaleString()}</Text>
        <View style={styles.qtyMeta}>
          {item.unit && <Text style={styles.qtyUnit}>{item.unit}</Text>}
          {statusLabel && (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{statusLabel}</Text>
            </View>
          )}
        </View>
        {onPress && <Feather name="chevron-right" size={14} color={Colors.textMuted} style={{ marginTop: 4 }} />}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.card}>{inner}</View>;
}

function LedgerCard({ entry }: { entry: StockLedgerEntry }) {
  const vtype = entry.voucher_type ?? '';
  const qtyIn = entry.qty_in ?? 0;
  const qtyOut = entry.qty_out ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.ledgerHeader}>
        <View style={styles.voucherBadge}>
          <Text style={styles.voucherBadgeText}>{vtype || 'TXN'}</Text>
        </View>
        <Text style={styles.ledgerVoucherNo} numberOfLines={1}>{entry.voucher_no ?? '—'}</Text>
        <Text style={styles.ledgerDate}>{formatShortDate(entry.dt)}</Text>
      </View>
      <View style={styles.ledgerBody}>
        <Text style={styles.ledgerItem} numberOfLines={1}>{entry.item_name ?? '—'}</Text>
        {entry.warehouse_name && <Text style={styles.ledgerWarehouse}>{entry.warehouse_name}</Text>}
      </View>
      <View style={styles.ledgerQtys}>
        {qtyIn !== 0 && (
          <View style={styles.qtyPill}>
            <Feather name="arrow-up" size={11} color={Colors.textSecondary} />
            <Text style={styles.qtyPillLabel}>IN</Text>
            <Text style={styles.qtyPillValue}>{qtyIn.toLocaleString()}</Text>
          </View>
        )}
        {qtyOut !== 0 && (
          <View style={styles.qtyPill}>
            <Feather name="arrow-down" size={11} color={Colors.textSecondary} />
            <Text style={styles.qtyPillLabel}>OUT</Text>
            <Text style={styles.qtyPillValue}>{qtyOut.toLocaleString()}</Text>
          </View>
        )}
        {entry.balance != null && (
          <View style={styles.qtyPill}>
            <Text style={styles.qtyPillLabel}>BAL</Text>
            <Text style={styles.qtyPillValue}>{entry.balance.toLocaleString()}</Text>
          </View>
        )}
        {entry.unit && <Text style={styles.qtyUnit}>{entry.unit}</Text>}
      </View>
    </View>
  );
}

function WarehouseCard({ warehouse: wh }: { warehouse: Warehouse }) {
  const isActive = wh.is_active !== false;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <View style={styles.whNameRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{wh.name}</Text>
            <View style={[styles.statusPill, !isActive && styles.statusPillMuted]}>
              <Text style={[styles.statusPillText, !isActive && styles.statusPillTextMuted]}>
                {isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          {wh.code && <Text style={styles.cardCode}>{wh.code}</Text>}
          {wh.type && <Text style={styles.cardSub}>{wh.type}</Text>}
          {wh.address && (
            <Text style={styles.whAddress} numberOfLines={2}>{wh.address}</Text>
          )}
        </View>
        {(wh.total_items != null || wh.total_qty != null) && (
          <View style={styles.whStats}>
            {wh.total_items != null && (
              <View style={styles.whStat}>
                <Text style={styles.whStatValue}>{wh.total_items.toLocaleString()}</Text>
                <Text style={styles.whStatLabel}>Items</Text>
              </View>
            )}
            {wh.total_qty != null && (
              <View style={styles.whStat}>
                <Text style={styles.whStatValue}>{wh.total_qty.toLocaleString()}</Text>
                <Text style={styles.whStatLabel}>Qty</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Feather name="box" size={32} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
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
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, flex: 1 },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  exportBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.text },
  tabText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.text, fontWeight: '700' },

  stockFilterBar: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  stockFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  stockFilterChipActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  stockFilterChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  stockFilterChipTextActive: { color: '#ffffff', fontWeight: '600' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  card: {
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.xs,
  },

  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardLeft: { flex: 1, gap: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardTitle: { ...Typography.h4 },
  cardCode: { ...Typography.bodySmall, color: Colors.textMuted },
  cardSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  qtyValue: { ...Typography.h2 },
  qtyMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  qtyUnit: { ...Typography.label, color: Colors.textMuted },

  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusPillText: { fontSize: 10, fontWeight: '600', color: Colors.text },
  statusPillMuted: { opacity: 0.5 },
  statusPillTextMuted: { color: Colors.textSecondary },

  ledgerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  voucherBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  voucherBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.text },
  ledgerVoucherNo: { flex: 1, ...Typography.bodySmall, color: Colors.textSecondary },
  ledgerDate: { ...Typography.bodySmall, color: Colors.textMuted },

  ledgerBody: { gap: 2 },
  ledgerItem: { ...Typography.h4 },
  ledgerWarehouse: { ...Typography.bodySmall, color: Colors.textSecondary },

  ledgerQtys: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  qtyPill: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  qtyPillLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  qtyPillValue: { fontSize: 13, fontWeight: '600', color: Colors.text },

  whNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  whAddress: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  whStats: { alignItems: 'flex-end', gap: 8 },
  whStat: { alignItems: 'flex-end' },
  whStatValue: { fontSize: 16, fontWeight: '700', color: Colors.text },
  whStatLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
