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
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { fetchStockBalances, fetchStockLedger, StockBalance, StockLedgerEntry } from '@/api/inventory';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import CompanyPicker from '@/components/CompanyPicker';
import { useCompany } from '@/context/CompanyContext';
import { formatShortDate } from '@/utils/currency';

type Tab = 'stock' | 'ledger';

const VOUCHER_COLORS: Record<string, { bg: string; fg: string }> = {
  GRN:  { bg: '#e8f5e9', fg: '#2e7d32' },
  SRN:  { bg: '#fce4ec', fg: '#c62828' },
  ADJ:  { bg: '#fff3e0', fg: '#e65100' },
  TRN:  { bg: '#e8eaf6', fg: '#283593' },
  INV:  { bg: '#f3e5f5', fg: '#6a1b9a' },
};

export default function InventoryScreen() {
  const { companyId } = useCompany();
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [stockData, setStockData] = useState<StockBalance[]>([]);
  const [ledgerData, setLedgerData] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadStock = useCallback(async () => {
    const data = await fetchStockBalances(companyId);
    setStockData(data);
  }, [companyId]);

  const loadLedger = useCallback(async () => {
    const data = await fetchStockLedger({ companyId });
    setLedgerData(data);
  }, [companyId]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStock(), loadLedger()]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadStock, loadLedger]);

  useEffect(() => { load(); }, [load]);

  const filteredStock = stockData.filter((s) =>
    !search || s.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.warehouse_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLedger = ledgerData.filter((e) =>
    !search || e.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.warehouse_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingView message="Loading inventory…" />;
  if (error && stockData.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <Text style={styles.headerSub}>
          {activeTab === 'stock' ? `${stockData.length} items` : `${ledgerData.length} entries`}
        </Text>
      </View>

      {/* Company picker */}
      <CompanyPicker />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stock' && styles.tabActive]}
          onPress={() => setActiveTab('stock')}
        >
          <Text style={[styles.tabText, activeTab === 'stock' && styles.tabTextActive]}>
            Stock Balances
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ledger' && styles.tabActive]}
          onPress={() => setActiveTab('ledger')}
        >
          <Text style={[styles.tabText, activeTab === 'ledger' && styles.tabTextActive]}>
            Stock Ledger
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items or warehouses…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
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
        {activeTab === 'stock' ? (
          <>
            <SectionHeader
              title="Current Stock"
              meta={`${filteredStock.length} records`}
            />
            {filteredStock.length === 0 ? (
              <EmptyState message="No stock balances found" />
            ) : (
              <View style={styles.cardList}>
                {filteredStock.map((item, idx) => (
                  <StockCard key={`${item.item_id ?? item.item_name}-${idx}`} item={item} />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <SectionHeader
              title="Movement Log"
              meta={`${filteredLedger.length} entries`}
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
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StockCard({ item }: { item: StockBalance }) {
  const qty = item.qty ?? 0;
  const qtyColor = qty <= 0 ? Colors.danger : qty < 100 ? Colors.warning : Colors.success;

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.item_name}</Text>
        {item.item_code && (
          <Text style={styles.cardCode}>{item.item_code}</Text>
        )}
        {item.warehouse_name && (
          <Text style={styles.cardSub}>{item.warehouse_name}</Text>
        )}
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.qtyValue, { color: qtyColor }]}>
          {qty.toLocaleString()}
        </Text>
        {item.unit && <Text style={styles.qtyUnit}>{item.unit}</Text>}
      </View>
    </View>
  );
}

function LedgerCard({ entry }: { entry: StockLedgerEntry }) {
  const vtype = entry.voucher_type ?? '';
  const colors = VOUCHER_COLORS[vtype] ?? { bg: Colors.borderLight, fg: Colors.textSecondary };
  const qtyIn = entry.qty_in ?? 0;
  const qtyOut = entry.qty_out ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.ledgerHeader}>
        <View style={[styles.voucherBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.voucherBadgeText, { color: colors.fg }]}>
            {vtype || 'TXN'}
          </Text>
        </View>
        <Text style={styles.ledgerVoucherNo} numberOfLines={1}>
          {entry.voucher_no ?? '—'}
        </Text>
        <Text style={styles.ledgerDate}>{formatShortDate(entry.dt)}</Text>
      </View>
      <View style={styles.ledgerBody}>
        <Text style={styles.ledgerItem} numberOfLines={1}>{entry.item_name ?? '—'}</Text>
        {entry.warehouse_name && (
          <Text style={styles.ledgerWarehouse}>{entry.warehouse_name}</Text>
        )}
      </View>
      <View style={styles.ledgerQtys}>
        {qtyIn !== 0 && (
          <View style={styles.qtyPill}>
            <Text style={[styles.qtyPillLabel, { color: Colors.success }]}>IN</Text>
            <Text style={[styles.qtyPillValue, { color: Colors.success }]}>
              +{qtyIn.toLocaleString()}
            </Text>
          </View>
        )}
        {qtyOut !== 0 && (
          <View style={styles.qtyPill}>
            <Text style={[styles.qtyPillLabel, { color: Colors.danger }]}>OUT</Text>
            <Text style={[styles.qtyPillValue, { color: Colors.danger }]}>
              -{qtyOut.toLocaleString()}
            </Text>
          </View>
        )}
        {entry.balance != null && (
          <View style={styles.qtyPill}>
            <Text style={styles.qtyPillLabel}>BAL</Text>
            <Text style={styles.qtyPillValue}>
              {entry.balance.toLocaleString()}
            </Text>
          </View>
        )}
        {entry.unit && <Text style={styles.qtyUnit}>{entry.unit}</Text>}
      </View>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📦</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
    ...Shadow.card,
  },

  card: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.xs,
  },

  cardLeft: { flex: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardTitle: { ...Typography.h4 },
  cardCode: { ...Typography.bodySmall, color: Colors.textMuted },
  cardSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  qtyValue: { fontSize: 20, fontWeight: '700' },
  qtyUnit: { ...Typography.label, marginTop: 2 },

  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  voucherBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  voucherBadgeText: { fontSize: 10, fontWeight: '700' },
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

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.subtle,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
