import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import DetailSkeleton from '@/components/DetailSkeleton';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';
import { fetchStockBalances, fetchStockLedger, StockBalance, StockLedgerEntry } from '@/api/inventory';
import { formatShortDate } from '@/utils/currency';
import { useCompany } from '@/context/CompanyContext';
import { getCached, setCached } from '@/utils/cache';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

type Props = NativeStackScreenProps<MoreStackParamList, 'MaterialDetail'>;

function VoucherBadge({ type }: { type?: string }) {
  const label = type?.toUpperCase().slice(0, 5) ?? '—';
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

export default function MaterialDetailScreen({ route }: Props) {
  const { materialId, materialName, materialCode, materialType, materialUnit, materialCategory, materialStatus, materialDescription } = route.params;
  const { companyId } = useCompany();

  const [stock, setStock] = useState<StockBalance[]>([]);
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });

  const cacheKey = `material-detail:${materialId}:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh && !dateRange.from && !dateRange.to) {
      const cached = await getCached<{ stock: StockBalance[]; ledger: StockLedgerEntry[] }>(cacheKey);
      if (cached) {
        setStock(cached.data.stock);
        setLedger(cached.data.ledger);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [allStock, allLedger] = await Promise.all([
        fetchStockBalances(companyId),
        fetchStockLedger({
          companyId,
          itemId: materialId,
          from: dateRange.from || undefined,
          to: dateRange.to || undefined,
        }),
      ]);
      const itemStock = allStock.filter(
        (s) => s.item_id === materialId || s.item_name?.toLowerCase() === materialName.toLowerCase()
      );
      setStock(itemStock);
      setLedger(allLedger.slice(0, 50));
      if (!dateRange.from && !dateRange.to) {
        await setCached(cacheKey, { stock: itemStock, ledger: allLedger.slice(0, 50) });
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [materialId, materialName, companyId, cacheKey, dateRange.from, dateRange.to]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <StatusBar style="dark" />
        <DetailSkeleton tileCount={4} listCount={6} />
      </SafeAreaView>
    );
  }

  if (error && stock.length === 0 && ledger.length === 0) {
    return <ErrorView message={error} onRetry={() => load()} />;
  }

  const totalQty = stock.reduce((s, b) => s + (Number(b.qty) || 0), 0);
  const warehouseCount = stock.length;
  const totalIn = ledger.reduce((s, e) => s + (Number(e.qty_in) || 0), 0);
  const totalOut = ledger.reduce((s, e) => s + (Number(e.qty_out) || 0), 0);
  const unit = stock[0]?.unit ?? materialUnit ?? '';

  const formatQty = (n: number) => {
    if (n === 0) return '0';
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('en-PK', { maximumFractionDigits: 2 });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={2}>{materialName}</Text>
          {materialCode ? (
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>{materialCode}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Meta row */}
      <View style={styles.metaRow}>
        {materialType ? (
          <View style={styles.metaChip}>
            <Feather name="tag" size={11} color={Colors.textSecondary} />
            <Text style={styles.metaChipText}>{materialType}</Text>
          </View>
        ) : null}
        {materialCategory ? (
          <View style={styles.metaChip}>
            <Feather name="folder" size={11} color={Colors.textSecondary} />
            <Text style={styles.metaChipText}>{materialCategory}</Text>
          </View>
        ) : null}
        {unit ? (
          <View style={styles.metaChip}>
            <Feather name="box" size={11} color={Colors.textSecondary} />
            <Text style={styles.metaChipText}>{unit}</Text>
          </View>
        ) : null}
        {materialStatus ? (
          <View style={[styles.metaChip, materialStatus.toLowerCase() !== 'active' && styles.metaChipInactive]}>
            <Text style={[styles.metaChipText, materialStatus.toLowerCase() !== 'active' && styles.metaChipTextInactive]}>
              {materialStatus}
            </Text>
          </View>
        ) : null}
      </View>

      {materialDescription ? (
        <View style={styles.descRow}>
          <Text style={styles.descText} numberOfLines={3}>{materialDescription}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* Summary tiles */}
        <View style={styles.tileRow}>
          <SummaryTile
            label="Total Stock"
            value={formatQty(totalQty)}
            sub={unit || 'units'}
          />
          <SummaryTile
            label="Warehouses"
            value={String(warehouseCount)}
            sub={warehouseCount === 1 ? 'location' : 'locations'}
          />
        </View>
        <View style={[styles.tileRow, styles.tileRowGap]}>
          <SummaryTile
            label="Total In"
            value={formatQty(totalIn)}
            sub="received"
          />
          <SummaryTile
            label="Total Out"
            value={formatQty(totalOut)}
            sub="issued"
          />
        </View>

        {/* Stock by warehouse */}
        <SectionHeader
          title="Stock by Warehouse"
          meta={warehouseCount > 0 ? `${warehouseCount} location${warehouseCount !== 1 ? 's' : ''}` : undefined}
        />
        {stock.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="inbox" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No stock found for this material</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {stock.map((s, idx) => {
              const qty = Number(s.qty) || 0;
              const isLow = qty > 0 && qty < 100;
              const isOut = qty <= 0;
              return (
                <View key={idx} style={[styles.warehouseCard, isOut && styles.warehouseCardOut]}>
                  <View style={styles.warehouseInfo}>
                    <Text style={styles.warehouseName}>{s.warehouse_name ?? 'Unknown Warehouse'}</Text>
                    {isOut && <Text style={styles.warehouseAlert}>Out of stock</Text>}
                    {isLow && !isOut && <Text style={styles.warehouseLow}>Low stock</Text>}
                  </View>
                  <View style={styles.warehouseRight}>
                    <Text style={[styles.warehouseQty, isOut && styles.warehouseQtyOut]}>
                      {formatQty(qty)}
                    </Text>
                    <Text style={styles.warehouseUnit}>{s.unit ?? unit ?? ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Transactions date filter */}
        <SectionHeader
          title="Transactions"
          meta={ledger.length > 0 ? `${ledger.length} entries` : undefined}
        />
        <DateRangeBar value={dateRange} onChange={setDateRange} />
        {ledger.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="list" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {dateRange.from || dateRange.to ? 'No transactions in this date range' : 'No transactions found'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {ledger.map((e, idx) => {
              const qtyIn = Number(e.qty_in) || 0;
              const qtyOut = Number(e.qty_out) || 0;
              const balance = Number(e.balance);
              const isIn = qtyIn > 0;
              return (
                <View key={e.id ?? idx} style={styles.ledgerCard}>
                  <View style={styles.ledgerLeft}>
                    <VoucherBadge type={e.voucher_type} />
                  </View>
                  <View style={styles.ledgerInfo}>
                    <Text style={styles.ledgerVoucher}>{e.voucher_no ?? e.voucher_type ?? '—'}</Text>
                    <Text style={styles.ledgerMeta}>
                      {formatShortDate(e.dt)}{e.warehouse_name ? ` · ${e.warehouse_name}` : ''}
                    </Text>
                  </View>
                  <View style={styles.ledgerRight}>
                    <Text style={[styles.ledgerQty, isIn ? styles.ledgerQtyIn : styles.ledgerQtyOut]}>
                      {isIn ? `+${formatQty(qtyIn)}` : `-${formatQty(qtyOut)}`}
                    </Text>
                    {!isNaN(balance) && (
                      <Text style={styles.ledgerBalance}>bal {formatQty(balance)}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  headerInfo: { flex: 1 },
  headerTitle: { ...Typography.h3 },
  codeBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceHover,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  codeBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.5 },

  descRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  descText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  metaChipInactive: { opacity: 0.6 },
  metaChipText: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary },
  metaChipTextInactive: { color: Colors.textMuted },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.md },

  tileRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  tileRowGap: { marginTop: Spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  tileLabel: { fontSize: 11, fontWeight: '500', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  tileValue: { fontSize: 22, fontWeight: '700', color: Colors.text, marginTop: 4 },
  tileSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  cardList: { paddingHorizontal: Spacing.md, gap: Spacing.sm },

  warehouseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  warehouseCardOut: { borderLeftWidth: 3, borderLeftColor: Colors.text },
  warehouseInfo: { flex: 1 },
  warehouseName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  warehouseAlert: { fontSize: 11, color: Colors.text, fontWeight: '600', marginTop: 2 },
  warehouseLow: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
  warehouseRight: { alignItems: 'flex-end' },
  warehouseQty: { fontSize: 18, fontWeight: '700', color: Colors.text },
  warehouseQtyOut: { color: Colors.textMuted },
  warehouseUnit: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  ledgerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  ledgerLeft: {},
  ledgerInfo: { flex: 1 },
  ledgerVoucher: { fontSize: 13, fontWeight: '600', color: Colors.text },
  ledgerMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  ledgerRight: { alignItems: 'flex-end' },
  ledgerQty: { fontSize: 14, fontWeight: '700' },
  ledgerQtyIn: { color: Colors.text },
  ledgerQtyOut: { color: Colors.textSecondary },
  ledgerBalance: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  badge: {
    backgroundColor: Colors.surfaceHover,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.text },

  emptyBox: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
