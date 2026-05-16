import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
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
import {
  fetchStockBalances,
  fetchStockLedger,
  StockBalance,
  StockLedgerEntry,
} from '@/api/inventory';
import ErrorView from '@/components/ErrorView';
import LoadingView from '@/components/LoadingView';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { formatCurrency, formatShortDate } from '@/utils/currency';

type Tab = 'stock' | 'ledger';

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

function voucherColors(type?: string) {
  if (!type) return { bg: '#f5f5f5', fg: '#546e7a' };
  const key = type.toUpperCase();
  return VOUCHER_COLORS[key] ?? { bg: '#f5f5f5', fg: '#546e7a' };
}

export default function InventoryScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<Tab>('stock');

  // Stock state
  const [stock, setStock] = useState<StockBalance[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockRefreshing, setStockRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Ledger state
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);

  const loadStock = useCallback(async (isRefresh = false) => {
    if (isRefresh) setStockRefreshing(true);
    else setStockLoading(true);
    setStockError(null);
    try {
      const data = await fetchStockBalances();
      setStock(data);
    } catch (e: any) {
      setStockError(String(e?.message ?? e));
    } finally {
      setStockLoading(false);
      setStockRefreshing(false);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const data = await fetchStockLedger();
      setLedger(data);
      setLedgerLoaded(true);
    } catch (e: any) {
      setLedgerError(String(e?.message ?? e));
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => { loadStock(); }, [loadStock]);

  useEffect(() => {
    if (activeTab === 'ledger' && !ledgerLoaded) {
      loadLedger();
    }
  }, [activeTab, ledgerLoaded, loadLedger]);

  const filteredStock = stock.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.item_name?.toLowerCase().includes(q) ||
      s.item_code?.toLowerCase().includes(q) ||
      s.warehouse_name?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['stock', 'ledger'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'stock' ? 'Stock Balances' : 'Stock Ledger'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'stock' ? (
        <StockTab
          stock={filteredStock}
          loading={stockLoading}
          error={stockError}
          refreshing={stockRefreshing}
          search={search}
          onSearch={setSearch}
          onRefresh={() => loadStock(true)}
          onRetry={() => loadStock()}
        />
      ) : (
        <LedgerTab
          ledger={ledger}
          loading={ledgerLoading}
          error={ledgerError}
          onRetry={loadLedger}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Stock Balances Tab ─────────────────────────────────────────────────────

function StockTab({
  stock,
  loading,
  error,
  refreshing,
  search,
  onSearch,
  onRefresh,
  onRetry,
}: {
  stock: StockBalance[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  search: string;
  onSearch: (v: string) => void;
  onRefresh: () => void;
  onRetry: () => void;
}) {
  if (loading) return <LoadingView message="Loading stock balances…" />;
  if (error) return <ErrorView message={error} onRetry={onRetry} />;

  const totalValue = stock.reduce((s, i) => s + (i.total_value ?? 0), 0);

  return (
    <FlatList
      data={stock}
      keyExtractor={(item, idx) => `${item.item_id}-${item.warehouse_id ?? idx}`}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      ListHeaderComponent={
        <View>
          {/* Summary strip */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Items</Text>
              <Text style={styles.summaryValue}>{stock.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Value</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                {formatCurrency(totalValue)}
              </Text>
            </View>
          </View>
          {/* Search */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search items, warehouses…"
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={onSearch}
              clearButtonMode="while-editing"
            />
          </View>
          {stock.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No stock balances found</Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item, index }) => <StockRow item={item} index={index} />}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function StockRow({ item, index }: { item: StockBalance; index: number }) {
  const qtyColor = item.quantity > 0 ? Colors.success : item.quantity < 0 ? Colors.danger : Colors.textMuted;
  return (
    <View style={styles.stockCard}>
      <View style={styles.stockCardLeft}>
        <View style={styles.itemIndexBadge}>
          <Text style={styles.itemIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.stockInfo}>
          <Text style={styles.stockItemName} numberOfLines={1}>{item.item_name}</Text>
          <View style={styles.stockMeta}>
            {item.item_code ? (
              <Text style={styles.stockCode}>{item.item_code}</Text>
            ) : null}
            {item.warehouse_name ? (
              <Text style={styles.stockWarehouse}>· {item.warehouse_name}</Text>
            ) : null}
          </View>
          {item.category ? (
            <Text style={styles.stockCategory}>{item.category}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.stockCardRight}>
        <Text style={[styles.stockQty, { color: qtyColor }]}>
          {item.quantity.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
        </Text>
        <Text style={styles.stockUom}>{item.uom ?? 'units'}</Text>
        {item.total_value != null && item.total_value > 0 ? (
          <Text style={styles.stockValue}>{formatCurrency(item.total_value)}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Stock Ledger Tab ───────────────────────────────────────────────────────

function LedgerTab({
  ledger,
  loading,
  error,
  onRetry,
}: {
  ledger: StockLedgerEntry[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) return <LoadingView message="Loading ledger…" />;
  if (error) return <ErrorView message={error} onRetry={onRetry} />;

  if (ledger.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No ledger entries found</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={ledger}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <LedgerRow entry={item} />}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function LedgerRow({ entry }: { entry: StockLedgerEntry }) {
  const vc = voucherColors(entry.voucher_type);
  const isIn = (entry.qty_in ?? 0) > 0;
  const qty = isIn ? entry.qty_in : entry.qty_out;
  return (
    <View style={styles.ledgerCard}>
      <View style={styles.ledgerTop}>
        {entry.voucher_type ? (
          <View style={[styles.voucherBadge, { backgroundColor: vc.bg }]}>
            <Text style={[styles.voucherBadgeText, { color: vc.fg }]}>
              {entry.voucher_type.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text style={styles.ledgerVoucherNum} numberOfLines={1}>
          {entry.voucher_number ?? `#${entry.id}`}
        </Text>
        <Text style={styles.ledgerDate}>{entry.dt ? formatShortDate(entry.dt) : '—'}</Text>
      </View>
      <View style={styles.ledgerBottom}>
        <View style={styles.ledgerItemInfo}>
          <Text style={styles.ledgerItemName} numberOfLines={1}>
            {entry.item_name ?? '—'}
          </Text>
          {entry.warehouse_name ? (
            <Text style={styles.ledgerWarehouse}>{entry.warehouse_name}</Text>
          ) : null}
        </View>
        <View style={styles.ledgerQtyGroup}>
          {(entry.qty_in ?? 0) > 0 && (
            <View style={styles.qtyChip}>
              <Text style={[styles.qtyChipLabel, { color: Colors.success }]}>IN</Text>
              <Text style={[styles.qtyChipValue, { color: Colors.success }]}>
                +{entry.qty_in?.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}
          {(entry.qty_out ?? 0) > 0 && (
            <View style={styles.qtyChip}>
              <Text style={[styles.qtyChipLabel, { color: Colors.danger }]}>OUT</Text>
              <Text style={[styles.qtyChipValue, { color: Colors.danger }]}>
                -{entry.qty_out?.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}
          {entry.balance != null && (
            <View style={styles.qtyChip}>
              <Text style={styles.qtyChipLabel}>BAL</Text>
              <Text style={styles.qtyChipValue}>
                {entry.balance.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 32, color: '#fff', lineHeight: 36, fontWeight: '300' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.subtle,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: Colors.text },

  searchRow: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },

  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },

  stockCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: 8,
    alignItems: 'center',
    ...Shadow.subtle,
  },
  stockCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIndexText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  stockInfo: { flex: 1 },
  stockItemName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  stockMeta: { flexDirection: 'row', marginTop: 2, flexWrap: 'wrap' },
  stockCode: { fontSize: 11, color: Colors.textMuted },
  stockWarehouse: { fontSize: 11, color: Colors.textMuted, marginLeft: 4 },
  stockCategory: {
    fontSize: 10,
    color: Colors.primary,
    backgroundColor: Colors.primaryBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  stockCardRight: { alignItems: 'flex-end', minWidth: 80 },
  stockQty: { fontSize: 18, fontWeight: '700' },
  stockUom: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  stockValue: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },

  ledgerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: 8,
    ...Shadow.subtle,
  },
  ledgerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  voucherBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  voucherBadgeText: { fontSize: 10, fontWeight: '700' },
  ledgerVoucherNum: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  ledgerDate: { fontSize: 11, color: Colors.textMuted },
  ledgerBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ledgerItemInfo: { flex: 1, paddingRight: 8 },
  ledgerItemName: { fontSize: 13, color: Colors.text },
  ledgerWarehouse: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  ledgerQtyGroup: { flexDirection: 'row', gap: 6 },
  qtyChip: { alignItems: 'center' },
  qtyChipLabel: { fontSize: 9, fontWeight: '600', color: Colors.textMuted },
  qtyChipValue: { fontSize: 12, fontWeight: '700', color: Colors.text },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
