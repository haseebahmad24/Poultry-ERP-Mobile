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
import {
  fetchStockBalances,
  fetchStockLedger,
  fetchWarehouses,
  StockBalance,
  StockLedgerEntry,
  Warehouse,
} from '@/api/inventory';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import CompanyPicker from '@/components/CompanyPicker';
import { useCompany } from '@/context/CompanyContext';
import { formatShortDate } from '@/utils/currency';

type Tab = 'stock' | 'ledger' | 'warehouses';

const VOUCHER_COLORS: Record<string, { bg: string; fg: string }> = {
  GRN:  { bg: '#e8f5e9', fg: '#2e7d32' },
  SRN:  { bg: '#fce4ec', fg: '#c62828' },
  ADJ:  { bg: '#fff3e0', fg: '#e65100' },
  TRN:  { bg: '#e8eaf6', fg: '#283593' },
  INV:  { bg: '#f3e5f5', fg: '#6a1b9a' },
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function lastMonthRange(): { from: string; to: string } {
  const d = new Date();
  d.setDate(0); // last day of prev month
  const to = d.toISOString().slice(0, 10);
  d.setDate(1); // first day of prev month
  const from = d.toISOString().slice(0, 10);
  return { from, to };
}

function thisWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export default function InventoryScreen() {
  const { companyId } = useCompany();
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [stockData, setStockData] = useState<StockBalance[]>([]);
  const [ledgerData, setLedgerData] = useState<StockLedgerEntry[]>([]);
  const [warehouseData, setWarehouseData] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Ledger date filter
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadStock = useCallback(async () => {
    const data = await fetchStockBalances(companyId);
    setStockData(data);
  }, [companyId]);

  const loadLedger = useCallback(async () => {
    const data = await fetchStockLedger({ companyId, from: fromDate || undefined, to: toDate || undefined });
    setLedgerData(data);
  }, [companyId, fromDate, toDate]);

  const loadWarehouses = useCallback(async () => {
    const data = await fetchWarehouses(companyId);
    setWarehouseData(data);
  }, [companyId]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStock(), loadLedger(), loadWarehouses()]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadStock, loadLedger, loadWarehouses]);

  useEffect(() => { load(); }, [load]);

  const applyDates = () => {
    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(fromInput) ? fromInput : '';
    const validTo = /^\d{4}-\d{2}-\d{2}$/.test(toInput) ? toInput : '';
    setFromDate(validFrom);
    setToDate(validTo);
  };

  const clearDates = () => {
    setFromInput('');
    setToInput('');
    setFromDate('');
    setToDate('');
  };

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'lastMonth') => {
    let from = '';
    let to = todayISO();
    if (preset === 'today') {
      from = todayISO();
    } else if (preset === 'week') {
      from = thisWeekStart();
    } else if (preset === 'month') {
      from = monthStartISO();
    } else {
      const r = lastMonthRange();
      from = r.from;
      to = r.to;
    }
    setFromInput(from);
    setToInput(to);
    setFromDate(from);
    setToDate(to);
  };

  const hasDateFilter = !!(fromDate || toDate);

  const filteredStock = stockData.filter((s) =>
    !search || s.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.warehouse_name?.toLowerCase().includes(search.toLowerCase())
  );

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

  if (loading) return <LoadingView message="Loading inventory…" />;
  if (error && stockData.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <Text style={styles.headerSub}>{tabMeta[activeTab]}</Text>
        {activeTab === 'ledger' && (
          <TouchableOpacity
            style={[styles.filterToggle, hasDateFilter && styles.filterToggleActive]}
            onPress={() => setShowDateFilter((v) => !v)}
          >
            <Text style={[styles.filterToggleText, hasDateFilter && styles.filterToggleTextActive]}>
              📅{hasDateFilter ? ' ●' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Company picker */}
      <CompanyPicker />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['stock', 'ledger', 'warehouses'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'stock' ? 'Stock Balances' : tab === 'ledger' ? 'Ledger' : 'Warehouses'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ledger date filter panel */}
      {activeTab === 'ledger' && showDateFilter && (
        <View style={styles.datePanel}>
          <View style={styles.datePresets}>
            {([
              { label: 'Today', preset: 'today' },
              { label: 'This Week', preset: 'week' },
              { label: 'This Month', preset: 'month' },
              { label: 'Last Month', preset: 'lastMonth' },
            ] as const).map(({ label, preset }) => (
              <TouchableOpacity
                key={preset}
                style={styles.presetChip}
                onPress={() => applyPreset(preset)}
              >
                <Text style={styles.presetChipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dateInputRow}>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateLabel}>From</Text>
              <TextInput
                style={[
                  styles.dateInput,
                  fromInput && (/^\d{4}-\d{2}-\d{2}$/.test(fromInput) ? styles.dateInputValid : styles.dateInputInvalid),
                ]}
                value={fromInput}
                onChangeText={setFromInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={applyDates}
                onBlur={applyDates}
              />
            </View>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateLabel}>To</Text>
              <TextInput
                style={[
                  styles.dateInput,
                  toInput && (/^\d{4}-\d{2}-\d{2}$/.test(toInput) ? styles.dateInputValid : styles.dateInputInvalid),
                ]}
                value={toInput}
                onChangeText={setToInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={applyDates}
                onBlur={applyDates}
              />
            </View>
            {hasDateFilter && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearDates}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'stock' ? 'Search items or warehouses…' :
            activeTab === 'ledger' ? 'Search items or warehouses…' :
            'Search warehouses…'
          }
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
        {activeTab === 'stock' && (
          <>
            <SectionHeader title="Current Stock" meta={`${filteredStock.length} records`} />
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
        )}

        {activeTab === 'ledger' && (
          <>
            <SectionHeader
              title="Movement Log"
              meta={`${filteredLedger.length} entries${hasDateFilter ? ' (filtered)' : ''}`}
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
    </SafeAreaView>
  );
}

function StockCard({ item }: { item: StockBalance }) {
  const qty = item.qty ?? 0;
  const qtyColor = qty <= 0 ? Colors.danger : qty < 100 ? Colors.warning : Colors.success;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.item_name}</Text>
          {item.item_code && <Text style={styles.cardCode}>{item.item_code}</Text>}
          {item.warehouse_name && <Text style={styles.cardSub}>{item.warehouse_name}</Text>}
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.qtyValue, { color: qtyColor }]}>{qty.toLocaleString()}</Text>
          {item.unit && <Text style={styles.qtyUnit}>{item.unit}</Text>}
        </View>
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
          <Text style={[styles.voucherBadgeText, { color: colors.fg }]}>{vtype || 'TXN'}</Text>
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
            <Text style={[styles.qtyPillLabel, { color: Colors.success }]}>IN</Text>
            <Text style={[styles.qtyPillValue, { color: Colors.success }]}>+{qtyIn.toLocaleString()}</Text>
          </View>
        )}
        {qtyOut !== 0 && (
          <View style={styles.qtyPill}>
            <Text style={[styles.qtyPillLabel, { color: Colors.danger }]}>OUT</Text>
            <Text style={[styles.qtyPillValue, { color: Colors.danger }]}>-{qtyOut.toLocaleString()}</Text>
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
  const statusColor = isActive ? Colors.success : Colors.textMuted;
  const statusLabel = isActive ? 'Active' : 'Inactive';

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <View style={styles.whNameRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{wh.name}</Text>
            <View style={[styles.statusPill, { backgroundColor: isActive ? '#e8f5e9' : '#f5f5f5' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
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
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, flex: 1 },
  filterToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterToggleActive: {
    backgroundColor: '#e3f2fd',
    borderColor: Colors.primary,
  },
  filterToggleText: { fontSize: 14, color: Colors.textSecondary },
  filterToggleTextActive: { color: Colors.primary },

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
  tabText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  datePanel: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  datePresets: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  presetChipText: { fontSize: 12, fontWeight: '500', color: Colors.primary },
  dateInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-end',
  },
  dateInputWrap: { flex: 1 },
  dateLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 3 },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  dateInputValid: { borderColor: Colors.success },
  dateInputInvalid: { borderColor: Colors.danger },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.danger + '18',
    borderWidth: 1,
    borderColor: Colors.danger + '40',
  },
  clearBtnText: { fontSize: 12, fontWeight: '500', color: Colors.danger },

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

  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardLeft: { flex: 1, gap: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardTitle: { ...Typography.h4 },
  cardCode: { ...Typography.bodySmall, color: Colors.textMuted },
  cardSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  qtyValue: { fontSize: 20, fontWeight: '700' },
  qtyUnit: { ...Typography.label, marginTop: 2, color: Colors.textMuted },

  ledgerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  voucherBadge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
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

  // Warehouse card
  whNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusPillText: { fontSize: 10, fontWeight: '600' },
  whAddress: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  whStats: {
    alignItems: 'flex-end',
    gap: 8,
  },
  whStat: { alignItems: 'flex-end' },
  whStatValue: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  whStatLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },

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
