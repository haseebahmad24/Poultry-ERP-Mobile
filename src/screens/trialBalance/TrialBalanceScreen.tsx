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
import { fetchTrialBalance, TrialBalanceRow, TrialBalanceResult } from '@/api/trialBalance';
import { useCompany } from '@/context/CompanyContext';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import { formatCurrency } from '@/utils/currency';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TrialBalanceScreen() {
  const { companies, selectedCompany: globalCompany } = useCompany();
  const [result, setResult] = useState<TrialBalanceResult>({ rows: [] });
  const [selectedCompany, setSelectedCompany] = useState<typeof globalCompany>(null);
  const [asOf, setAsOf] = useState(todayISO());
  const [asOfInput, setAsOfInput] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);

  // Seed local selection from global context when companies load
  useEffect(() => {
    if (!selectedCompany && globalCompany) setSelectedCompany(globalCompany);
  }, [globalCompany, selectedCompany]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const companyId = selectedCompany ? Number(selectedCompany.id) : undefined;
      const data = await fetchTrialBalance(companyId, asOf);
      setResult(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompany, asOf]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = result.rows.filter((r) =>
    !search ||
    r.account_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.account_code?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDebit = result.total_debit ?? filteredRows.reduce((s, r) => s + (r.debit ?? 0), 0);
  const totalCredit = result.total_credit ?? filteredRows.reduce((s, r) => s + (r.credit ?? 0), 0);

  if (loading) return <LoadingView message="Loading trial balance…" />;
  if (error && result.rows.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trial Balance</Text>
        <Text style={styles.headerSub}>{filteredRows.length} accounts</Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersCard}>
        {/* Company selector */}
        {companies.length > 0 && (
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Company</Text>
            <TouchableOpacity
              style={styles.filterSelector}
              onPress={() => setShowCompanyPicker(!showCompanyPicker)}
            >
              <Text style={styles.filterSelectorText} numberOfLines={1}>
                {selectedCompany?.name ?? 'Select company'}
              </Text>
              <Text style={styles.filterSelectorChevron}>▾</Text>
            </TouchableOpacity>
          </View>
        )}

        {showCompanyPicker && (
          <View style={styles.companyPicker}>
            {companies.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.companyOption,
                  selectedCompany?.id === c.id && styles.companyOptionActive,
                ]}
                onPress={() => {
                  setSelectedCompany(c);
                  setShowCompanyPicker(false);
                }}
              >
                <Text style={[
                  styles.companyOptionText,
                  selectedCompany?.id === c.id && styles.companyOptionTextActive,
                ]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* As-of date */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>As of Date</Text>
          <TextInput
            style={styles.dateInput}
            value={asOfInput}
            onChangeText={setAsOfInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            onBlur={() => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(asOfInput)) {
                setAsOf(asOfInput);
              }
            }}
            onSubmitEditing={() => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(asOfInput)) {
                setAsOf(asOfInput);
              }
            }}
          />
        </View>

        <TouchableOpacity style={styles.runBtn} onPress={() => load()}>
          <Text style={styles.runBtnText}>Run Report</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search accounts…"
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
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
        }
      >
        {/* Totals row */}
        <View style={styles.totalsCard}>
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Total Debit</Text>
            <Text style={[styles.totalValue, { color: Colors.primary }]}>
              {formatCurrency(totalDebit)}
            </Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={[styles.totalBlock, { alignItems: 'flex-end' }]}>
            <Text style={styles.totalLabel}>Total Credit</Text>
            <Text style={[styles.totalValue, { color: Colors.success }]}>
              {formatCurrency(totalCredit)}
            </Text>
          </View>
        </View>

        {/* Difference warning */}
        {Math.abs(totalDebit - totalCredit) > 0.01 && (
          <View style={styles.diffWarning}>
            <Text style={styles.diffText}>
              ⚠️ Out of balance by {formatCurrency(Math.abs(totalDebit - totalCredit))}
            </Text>
          </View>
        )}

        <SectionHeader
          title="Account Balances"
          meta={`${filteredRows.length} accounts`}
        />

        {filteredRows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⚖️</Text>
            <Text style={styles.emptyText}>No accounts found</Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            {/* Header row */}
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

            {/* Totals footer */}
            <View style={[styles.tableRow, styles.tableTotalRow]}>
              <Text style={[styles.colAccount, styles.tableTotalText]}>TOTAL</Text>
              <Text style={[styles.colAmount, styles.tableTotalText, { color: Colors.primary }]}>
                {formatCurrency(totalDebit)}
              </Text>
              <Text style={[styles.colAmount, styles.tableTotalText, { color: Colors.success }]}>
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
      <Text style={[styles.colAmount, row.debit > 0 && { color: Colors.primary }]}>
        {row.debit > 0 ? formatCurrency(row.debit) : '—'}
      </Text>
      <Text style={[styles.colAmount, row.credit > 0 && { color: Colors.success }]}>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  filtersCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  filterLabel: { fontSize: 13, color: Colors.textSecondary, width: 80 },
  filterSelector: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSelectorText: { flex: 1, fontSize: 13, color: Colors.text },
  filterSelectorChevron: { color: Colors.textMuted, fontSize: 14 },

  companyPicker: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  companyOption: { padding: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  companyOptionActive: { backgroundColor: Colors.primaryBg },
  companyOptionText: { fontSize: 13, color: Colors.text },
  companyOptionTextActive: { color: Colors.primary, fontWeight: '700' },

  dateInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 13,
    color: Colors.text,
  },

  runBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  runBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

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

  totalsCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    ...Shadow.card,
    marginBottom: Spacing.sm,
  },
  totalBlock: { flex: 1 },
  totalDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  totalLabel: { ...Typography.label, marginBottom: 4 },
  totalValue: { fontSize: 16, fontWeight: '700' },

  diffWarning: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  diffText: { fontSize: 13, color: Colors.danger, fontWeight: '600' },

  tableCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
  },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tableRowGroup: { backgroundColor: Colors.background },
  tableHeaderRow: { backgroundColor: Colors.primaryBg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  tableTotalRow: { backgroundColor: Colors.primaryBg, borderTopWidth: 2, borderTopColor: Colors.border },
  tableTotalText: { fontSize: 13, fontWeight: '700' },

  colAccount: { flex: 2, paddingRight: Spacing.xs },
  colAmount: { flex: 1, fontSize: 12, fontWeight: '500', color: Colors.text, textAlign: 'right' },

  accountName: { fontSize: 12, color: Colors.text },
  accountNameGroup: { fontWeight: '700', fontSize: 13 },
  accountType: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

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
