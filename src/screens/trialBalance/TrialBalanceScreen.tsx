import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchTrialBalance, TrialBalanceRow, TrialBalanceResult } from '@/api/trialBalance';
import { useCompany } from '@/context/CompanyContext';
import BackButton from '@/components/BackButton';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import CompanySelector from '@/components/CompanySelector';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';
import { formatCurrency } from '@/utils/currency';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TrialBalanceScreen() {
  const { companyId, selectedCompany: ctxCompany } = useCompany();
  const [result, setResult] = useState<TrialBalanceResult>({ rows: [] });
  const [asOf, setAsOf] = useState(todayISO());
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: todayISO(), to: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchTrialBalance(companyId, asOf);
      setResult(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, asOf]);

  useEffect(() => { load(); }, [load]);

  const handleDateChange = (v: DateRangeValue) => {
    setDateRange(v);
    setAsOf(v.from || todayISO());
  };

  const filteredRows = result.rows.filter((r) =>
    !search ||
    r.account_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.account_code?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDebit = result.total_debit ?? filteredRows.reduce((s, r) => s + (r.debit ?? 0), 0);
  const totalCredit = result.total_credit ?? filteredRows.reduce((s, r) => s + (r.credit ?? 0), 0);

  const handleExport = async () => {
    const colW = 30;
    const amtW = 16;
    const line = '-'.repeat(colW + amtW * 2 + 4);
    const pad = (s: string, w: number) => s.length >= w ? s.slice(0, w - 1) + '…' : s.padEnd(w);
    const padL = (s: string, w: number) => s.padStart(w);

    const header = `Trial Balance\nCompany: ${ctxCompany?.name ?? 'All'}\nAs of: ${asOf}\n${line}`;
    const col = `${pad('Account', colW)}  ${padL('Debit', amtW)}  ${padL('Credit', amtW)}`;
    const rows = filteredRows.map((r) => {
      const indent = '  '.repeat(r.level ?? 0);
      const name = indent + (r.account_code ? `${r.account_code} ${r.account_name ?? ''}` : (r.account_name ?? ''));
      const dr = r.debit ? formatCurrency(r.debit) : '';
      const cr = r.credit ? formatCurrency(r.credit) : '';
      return `${pad(name, colW)}  ${padL(dr, amtW)}  ${padL(cr, amtW)}`;
    });
    const totals = `${line}\n${pad('TOTAL', colW)}  ${padL(formatCurrency(totalDebit), amtW)}  ${padL(formatCurrency(totalCredit), amtW)}`;
    const balanced = Math.abs(totalDebit - totalCredit) < 0.01
      ? 'Balanced'
      : `Out of balance by ${formatCurrency(Math.abs(totalDebit - totalCredit))}`;

    const text = [header, col, line, ...rows, totals, balanced].join('\n');
    await Share.share({ message: text, title: 'Trial Balance' });
  };

  if (loading) return <LoadingView message="Loading trial balance…" />;
  if (error && result.rows.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  const isOutOfBalance = Math.abs(totalDebit - totalCredit) > 0.01;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Trial Balance</Text>
        <Text style={styles.headerSub}>{filteredRows.length} accounts</Text>
        {result.rows.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Feather name="share" size={13} color={Colors.text} />
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      <CompanySelector showAll />
      <DateRangeBar mode="single" value={dateRange} onChange={handleDateChange} />

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Feather name="search" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search accounts…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.textMuted} />
        }
      >
        <View style={styles.totalsCard}>
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Total Debit</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalDebit)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={[styles.totalBlock, { alignItems: 'flex-end' }]}>
            <Text style={styles.totalLabel}>Total Credit</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalCredit)}</Text>
          </View>
        </View>

        {isOutOfBalance && (
          <View style={styles.diffWarning}>
            <Feather name="alert-circle" size={14} color={Colors.textSecondary} />
            <Text style={styles.diffText}>
              Out of balance by {formatCurrency(Math.abs(totalDebit - totalCredit))}
            </Text>
          </View>
        )}

        <SectionHeader
          title="Account Balances"
          meta={`${filteredRows.length} accounts`}
        />

        {filteredRows.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="scale" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No accounts found</Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.colAccount, styles.tableHeaderText]}>Account</Text>
              <Text style={[styles.colAmount, styles.tableHeaderText]}>Debit</Text>
              <Text style={[styles.colAmount, styles.tableHeaderText]}>Credit</Text>
            </View>

            {filteredRows.map((row, idx) => (
              <TBRow
                key={row.account_id ?? idx}
                row={row}
                isLast={idx === filteredRows.length - 1}
              />
            ))}

            <View style={[styles.tableRow, styles.tableTotalRow]}>
              <Text style={[styles.colAccount, styles.tableTotalText]}>TOTAL</Text>
              <Text style={[styles.colAmount, styles.tableTotalText]}>
                {formatCurrency(totalDebit)}
              </Text>
              <Text style={[styles.colAmount, styles.tableTotalText, isOutOfBalance && styles.outOfBalance]}>
                {formatCurrency(totalCredit)}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TBRow({ row, isLast }: { row: TrialBalanceRow; isLast: boolean }) {
  const isGroup = row.is_group;
  const indent = (row.level ?? 0) * 12;

  return (
    <View style={[
      styles.tableRow,
      !isLast && styles.tableRowBorder,
      isGroup && styles.tableRowGroup,
    ]}>
      <View style={[styles.colAccount, { paddingLeft: indent }]}>
        <Text
          style={[styles.accountName, isGroup && styles.accountNameGroup]}
          numberOfLines={2}
        >
          {row.account_code ? `${row.account_code} — ` : ''}{row.account_name}
        </Text>
        {row.account_type && !isGroup && (
          <Text style={styles.accountType}>{row.account_type}</Text>
        )}
      </View>
      <Text style={[styles.colAmount, !row.debit && styles.colAmountMuted]}>
        {row.debit > 0 ? formatCurrency(row.debit) : '—'}
      </Text>
      <Text style={[styles.colAmount, !row.credit && styles.colAmountMuted]}>
        {row.credit > 0 ? formatCurrency(row.credit) : '—'}
      </Text>
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
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  exportBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text },

  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  totalsCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  totalBlock: { flex: 1 },
  totalDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: Colors.border },
  totalLabel: { ...Typography.label, marginBottom: 4 },
  totalValue: { fontSize: 16, fontWeight: '700', color: Colors.text },

  diffWarning: {
    marginHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceHover,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  diffText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', flex: 1 },

  tableCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tableRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  tableRowGroup: { backgroundColor: Colors.surfaceHover },
  tableHeaderRow: {
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  tableTotalRow: {
    backgroundColor: Colors.surfaceHover,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  tableTotalText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  outOfBalance: { fontWeight: '700' },

  colAccount: { flex: 2, paddingRight: Spacing.xs },
  colAmount: { flex: 1, fontSize: 12, fontWeight: '500', color: Colors.text, textAlign: 'right' },
  colAmountMuted: { color: Colors.textMuted },

  accountName: { fontSize: 12, color: Colors.text },
  accountNameGroup: { fontWeight: '700', fontSize: 13 },
  accountType: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
