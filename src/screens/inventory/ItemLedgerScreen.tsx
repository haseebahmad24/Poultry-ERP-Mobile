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
import { useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchStockLedger, StockLedgerEntry } from '@/api/inventory';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import { useCompany } from '@/context/CompanyContext';
import { formatShortDate } from '@/utils/currency';
import type { InventoryStackParamList } from '@/navigation/InventoryNavigator';

type RouteType = RouteProp<InventoryStackParamList, 'ItemLedger'>;

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
  d.setDate(0);
  const to = d.toISOString().slice(0, 10);
  d.setDate(1);
  const from = d.toISOString().slice(0, 10);
  return { from, to };
}
function thisWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export default function ItemLedgerScreen() {
  const route = useRoute<RouteType>();
  const { item_id, item_name, item_code } = route.params;
  const { companyId } = useCompany();

  const [entries, setEntries] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDateFilter, setShowDateFilter] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchStockLedger({
        companyId,
        itemId: item_id,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setEntries(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, item_id, fromDate, toDate]);

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

  const totalIn = entries.reduce((s, e) => s + (e.qty_in ?? 0), 0);
  const totalOut = entries.reduce((s, e) => s + (e.qty_out ?? 0), 0);
  const latestBalance = entries.length > 0 ? entries[entries.length - 1].balance ?? null : null;

  if (loading) return <LoadingView message="Loading item ledger…" />;
  if (error && entries.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{item_name}</Text>
          {item_code && <Text style={styles.headerSub}>{item_code}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, hasDateFilter && styles.filterToggleActive]}
          onPress={() => setShowDateFilter((v) => !v)}
        >
          <Feather
            name="calendar"
            size={14}
            color={hasDateFilter ? '#ffffff' : Colors.textSecondary}
          />
        </TouchableOpacity>
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

      {showDateFilter && (
        <View style={styles.datePanel}>
          <View style={styles.datePresets}>
            {([
              { label: 'Today', preset: 'today' },
              { label: 'This Week', preset: 'week' },
              { label: 'This Month', preset: 'month' },
              { label: 'Last Month', preset: 'lastMonth' },
            ] as const).map(({ label, preset }) => {
              const isActive =
                (preset === 'today' && fromDate === todayISO() && toDate === todayISO()) ||
                (preset === 'week' && fromDate === thisWeekStart() && toDate === todayISO()) ||
                (preset === 'month' && fromDate === monthStartISO() && toDate === todayISO()) ||
                (preset === 'lastMonth' && fromDate === lastMonthRange().from && toDate === lastMonthRange().to);
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetChip, isActive && styles.presetChipActive]}
                  onPress={() => applyPreset(preset)}
                >
                  <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.dateInputRow}>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateLabel}>From</Text>
              <TextInput
                style={styles.dateInput}
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
                style={styles.dateInput}
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
              <TouchableOpacity onPress={clearDates}>
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
  headerTitle: { ...Typography.h3, color: Colors.text },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  filterToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterToggleActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },

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
  summaryValue: { ...Typography.h4, fontWeight: '700', marginTop: 2, color: Colors.text },
  summaryValueMuted: { color: Colors.textSecondary },
  summarySep: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: Colors.border },

  datePanel: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  datePresets: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  presetChipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  presetChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  presetChipTextActive: { color: '#ffffff', fontWeight: '600' },
  dateInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  dateInputWrap: { flex: 1 },
  dateLabel: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: 4 },
  dateInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    ...Typography.body,
    color: Colors.text,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  clearBtnText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },

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

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { ...Typography.body, color: Colors.textMuted },
  emptyLink: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
});
