import React, { useCallback, useEffect, useState } from 'react';
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
  const latestBalance = entries.length > 0 ? entries[entries.length - 1].balance ?? null : null;

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

        {entries.length === 0 ? (
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
            {entries.map((entry, idx) => (
              <LedgerCard key={`${entry.id ?? idx}`} entry={entry} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
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
  qtyPillValue: { ...Typography.body, fontWeight: '700', color: Colors.text },
  qtyUnit: { ...Typography.bodySmall, color: Colors.textMuted },

  pdfBtn: { padding: 4 },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { ...Typography.body, color: Colors.textMuted },
  emptyLink: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
});
