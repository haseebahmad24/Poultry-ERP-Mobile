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
import { useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { fetchStockLedger, StockLedgerEntry } from '@/api/inventory';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import { useCompany } from '@/context/CompanyContext';
import { formatShortDate } from '@/utils/currency';
import type { InventoryStackParamList } from '@/navigation/InventoryNavigator';

type RouteType = RouteProp<InventoryStackParamList, 'ItemLedger'>;

const VOUCHER_COLORS: Record<string, { bg: string; fg: string }> = {
  GRN: { bg: '#e8f5e9', fg: '#2e7d32' },
  SRN: { bg: '#fce4ec', fg: '#c62828' },
  ADJ: { bg: '#fff3e0', fg: '#e65100' },
  TRN: { bg: '#e8eaf6', fg: '#283593' },
  INV: { bg: '#f3e5f5', fg: '#6a1b9a' },
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

      {/* Header */}
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
          <Text style={[styles.filterToggleText, hasDateFilter && styles.filterToggleTextActive]}>
            📅{hasDateFilter ? ' ●' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total In</Text>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>+{totalIn.toLocaleString()}</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Out</Text>
          <Text style={[styles.summaryValue, { color: Colors.danger }]}>-{totalOut.toLocaleString()}</Text>
        </View>
        {latestBalance != null && (
          <>
            <View style={styles.summarySep} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Balance</Text>
              <Text style={[styles.summaryValue, {
                color: latestBalance <= 0 ? Colors.danger : latestBalance < 100 ? Colors.warning : Colors.text,
              }]}>{latestBalance.toLocaleString()}</Text>
            </View>
          </>
        )}
      </View>

      {/* Date filter panel */}
      {showDateFilter && (
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
        <SectionHeader
          title="Movement Log"
          meta={`${entries.length} entries${hasDateFilter ? ' (filtered)' : ''}`}
        />

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
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
      {entry.warehouse_name && (
        <Text style={styles.ledgerWarehouse}>{entry.warehouse_name}</Text>
      )}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerText: { flex: 1, marginLeft: Spacing.xs },
  headerTitle: { ...Typography.h3, color: Colors.text },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  filterToggle: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.borderLight,
  },
  filterToggleActive: { backgroundColor: Colors.primaryBg },
  filterToggleText: { fontSize: 14 },
  filterToggleTextActive: { color: Colors.primary },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { ...Typography.bodySmall, color: Colors.textMuted },
  summaryValue: { ...Typography.h4, fontWeight: '700', marginTop: 2 },
  summarySep: { width: 1, height: 32, backgroundColor: Colors.border },

  datePanel: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  datePresets: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  presetChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryBg,
  },
  presetChipText: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  dateInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  dateInputWrap: { flex: 1 },
  dateLabel: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    ...Typography.body,
    color: Colors.text,
  },
  dateInputValid: { borderColor: Colors.success },
  dateInputInvalid: { borderColor: Colors.danger },
  clearBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerBg,
  },
  clearBtnText: { ...Typography.bodySmall, color: Colors.danger, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  cardList: { gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.subtle,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  voucherBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  voucherBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  ledgerVoucherNo: { flex: 1, ...Typography.body, color: Colors.text, fontWeight: '600' },
  ledgerDate: { ...Typography.bodySmall, color: Colors.textMuted },
  ledgerWarehouse: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.xs },
  ledgerQtys: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  qtyPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyPillLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  qtyPillValue: { ...Typography.body, fontWeight: '700', color: Colors.text },
  qtyUnit: { ...Typography.bodySmall, color: Colors.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.sm },
  emptyLink: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
});
