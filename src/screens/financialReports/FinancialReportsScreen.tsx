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
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { fetchTrialBalance, TrialBalanceRow } from '@/api/trialBalance';
import { useCompany } from '@/context/CompanyContext';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import { formatCurrency } from '@/utils/currency';

type ReportTab = 'pl' | 'bs';
type Company = { id: string; name: string; code: string | null };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Account type → P&L or Balance Sheet classification
function classifyRow(row: TrialBalanceRow): 'revenue' | 'expense' | 'asset' | 'liability' | 'equity' | null {
  const type = (row.account_type ?? row.account_name ?? '').toLowerCase();
  if (type.includes('revenue') || type.includes('income') || type.includes('sales')) return 'revenue';
  if (type.includes('expense') || type.includes('cost') || type.includes('cogs')) return 'expense';
  if (type.includes('asset') || type.includes('receivable') || type.includes('inventory') || type.includes('cash')) return 'asset';
  if (type.includes('liability') || type.includes('payable') || type.includes('loan')) return 'liability';
  if (type.includes('equity') || type.includes('capital') || type.includes('retained')) return 'equity';
  return null;
}

interface PLData {
  revenues: TrialBalanceRow[];
  expenses: TrialBalanceRow[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
}

interface BSData {
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

function computePL(rows: TrialBalanceRow[]): PLData {
  const revenues = rows.filter((r) => classifyRow(r) === 'revenue');
  const expenses = rows.filter((r) => classifyRow(r) === 'expense');
  const totalRevenue = revenues.reduce((s, r) => s + Math.abs(r.balance ?? r.credit - r.debit), 0);
  const totalExpense = expenses.reduce((s, r) => s + Math.abs(r.balance ?? r.debit - r.credit), 0);
  return { revenues, expenses, totalRevenue, totalExpense, netIncome: totalRevenue - totalExpense };
}

function computeBS(rows: TrialBalanceRow[]): BSData {
  const assets = rows.filter((r) => classifyRow(r) === 'asset');
  const liabilities = rows.filter((r) => classifyRow(r) === 'liability');
  const equity = rows.filter((r) => classifyRow(r) === 'equity');
  const totalAssets = assets.reduce((s, r) => s + Math.abs(r.balance ?? r.debit - r.credit), 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + Math.abs(r.balance ?? r.credit - r.debit), 0);
  const totalEquity = equity.reduce((s, r) => s + Math.abs(r.balance ?? r.credit - r.debit), 0);
  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}

export default function FinancialReportsScreen() {
  const { companies, selectedCompany: globalCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<ReportTab>('pl');
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [asOf, setAsOf] = useState(todayISO());
  const [asOfInput, setAsOfInput] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const result = await fetchTrialBalance(companyId, asOf);
      setRows(result.rows);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompany, asOf]);

  useEffect(() => { load(); }, [load]);

  const pl = computePL(rows);
  const bs = computeBS(rows);

  const handleExport = async () => {
    const line = '─'.repeat(50);
    const company = selectedCompany?.name ?? 'All Companies';

    let text = '';
    if (activeTab === 'pl') {
      text = `PROFIT & LOSS STATEMENT\nCompany: ${company}\nAs of: ${asOf}\n${line}\n`;
      text += `\nREVENUE\n`;
      pl.revenues.forEach((r) => { text += `  ${r.account_name ?? ''}\t${formatCurrency(Math.abs(r.balance ?? r.credit - r.debit))}\n`; });
      text += `Total Revenue\t${formatCurrency(pl.totalRevenue)}\n`;
      text += `\nEXPENSES\n`;
      pl.expenses.forEach((r) => { text += `  ${r.account_name ?? ''}\t${formatCurrency(Math.abs(r.balance ?? r.debit - r.credit))}\n`; });
      text += `Total Expenses\t${formatCurrency(pl.totalExpense)}\n`;
      text += `\n${line}\nNET INCOME\t${formatCurrency(pl.netIncome)}\n`;
    } else {
      text = `BALANCE SHEET\nCompany: ${company}\nAs of: ${asOf}\n${line}\n`;
      text += `\nASSETS\n`;
      bs.assets.forEach((r) => { text += `  ${r.account_name ?? ''}\t${formatCurrency(Math.abs(r.balance ?? r.debit - r.credit))}\n`; });
      text += `Total Assets\t${formatCurrency(bs.totalAssets)}\n`;
      text += `\nLIABILITIES\n`;
      bs.liabilities.forEach((r) => { text += `  ${r.account_name ?? ''}\t${formatCurrency(Math.abs(r.balance ?? r.credit - r.debit))}\n`; });
      text += `Total Liabilities\t${formatCurrency(bs.totalLiabilities)}\n`;
      text += `\nEQUITY\n`;
      bs.equity.forEach((r) => { text += `  ${r.account_name ?? ''}\t${formatCurrency(Math.abs(r.balance ?? r.credit - r.debit))}\n`; });
      text += `Total Equity\t${formatCurrency(bs.totalEquity)}\n`;
      text += `\n${line}\nTOTAL L+E\t${formatCurrency(bs.totalLiabilities + bs.totalEquity)}\n`;
    }
    await Share.share({ message: text, title: activeTab === 'pl' ? 'P&L Statement' : 'Balance Sheet' });
  };

  if (loading) return <LoadingView message="Loading financial data…" />;
  if (error && rows.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton color={Colors.primary} />
        <Text style={styles.headerTitle}>Financial Reports</Text>
        {rows.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Report tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pl' && styles.tabActive]}
          onPress={() => setActiveTab('pl')}
        >
          <Text style={[styles.tabText, activeTab === 'pl' && styles.tabTextActive]}>
            Profit & Loss
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bs' && styles.tabActive]}
          onPress={() => setActiveTab('bs')}
        >
          <Text style={[styles.tabText, activeTab === 'bs' && styles.tabTextActive]}>
            Balance Sheet
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersCard}>
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
                style={[styles.companyOption, selectedCompany?.id === c.id && styles.companyOptionActive]}
                onPress={() => { setSelectedCompany(c); setShowCompanyPicker(false); }}
              >
                <Text style={[styles.companyOptionText, selectedCompany?.id === c.id && styles.companyOptionTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>As of Date</Text>
          <TextInput
            style={styles.dateInput}
            value={asOfInput}
            onChangeText={setAsOfInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            onBlur={() => { if (/^\d{4}-\d{2}-\d{2}$/.test(asOfInput)) setAsOf(asOfInput); }}
            onSubmitEditing={() => { if (/^\d{4}-\d{2}-\d{2}$/.test(asOfInput)) setAsOf(asOfInput); }}
          />
        </View>

        <TouchableOpacity style={styles.runBtn} onPress={() => load()}>
          <Text style={styles.runBtnText}>Run Report</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
        }
      >
        {activeTab === 'pl' ? (
          <PLReport pl={pl} />
        ) : (
          <BSReport bs={bs} />
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PLReport({ pl }: { pl: PLData }) {
  return (
    <>
      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Profit & Loss Summary</Text>
        <View style={styles.summaryGrid}>
          <SummaryBlock label="Total Revenue" value={formatCurrency(pl.totalRevenue)} color={Colors.success} />
          <SummaryBlock label="Total Expenses" value={formatCurrency(pl.totalExpense)} color={Colors.danger} />
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryNetRow}>
          <Text style={styles.summaryNetLabel}>Net Income</Text>
          <Text style={[styles.summaryNetValue, { color: pl.netIncome >= 0 ? Colors.success : Colors.danger }]}>
            {formatCurrency(pl.netIncome)}
          </Text>
        </View>
      </View>

      <SectionHeader title="Revenue" meta={`${pl.revenues.length} accounts`} />
      {pl.revenues.length === 0 ? (
        <NoDataNote message="No revenue accounts found in trial balance" />
      ) : (
        <AccountTable rows={pl.revenues} totalLabel="Total Revenue" total={pl.totalRevenue} totalColor={Colors.success} />
      )}

      <SectionHeader title="Expenses" meta={`${pl.expenses.length} accounts`} />
      {pl.expenses.length === 0 ? (
        <NoDataNote message="No expense accounts found in trial balance" />
      ) : (
        <AccountTable rows={pl.expenses} totalLabel="Total Expenses" total={pl.totalExpense} totalColor={Colors.danger} />
      )}
    </>
  );
}

function BSReport({ bs }: { bs: BSData }) {
  const isBalanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 0.01;

  return (
    <>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Balance Sheet Summary</Text>
        <View style={styles.summaryGrid}>
          <SummaryBlock label="Total Assets" value={formatCurrency(bs.totalAssets)} color={Colors.primary} />
          <SummaryBlock label="Liabilities + Equity" value={formatCurrency(bs.totalLiabilities + bs.totalEquity)} color={Colors.success} />
        </View>
        {!isBalanced && (
          <View style={styles.imbalanceWarning}>
            <Text style={styles.imbalanceText}>
              ⚠️ Balance sheet is out of balance by {formatCurrency(Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)))}
            </Text>
          </View>
        )}
      </View>

      <SectionHeader title="Assets" meta={`${bs.assets.length} accounts`} />
      {bs.assets.length === 0 ? (
        <NoDataNote message="No asset accounts found in trial balance" />
      ) : (
        <AccountTable rows={bs.assets} totalLabel="Total Assets" total={bs.totalAssets} totalColor={Colors.primary} />
      )}

      <SectionHeader title="Liabilities" meta={`${bs.liabilities.length} accounts`} />
      {bs.liabilities.length === 0 ? (
        <NoDataNote message="No liability accounts found in trial balance" />
      ) : (
        <AccountTable rows={bs.liabilities} totalLabel="Total Liabilities" total={bs.totalLiabilities} totalColor={Colors.danger} />
      )}

      <SectionHeader title="Equity" meta={`${bs.equity.length} accounts`} />
      {bs.equity.length === 0 ? (
        <NoDataNote message="No equity accounts found in trial balance" />
      ) : (
        <AccountTable rows={bs.equity} totalLabel="Total Equity" total={bs.totalEquity} totalColor={Colors.success} />
      )}
    </>
  );
}

function SummaryBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryBlock}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function AccountTable({
  rows,
  totalLabel,
  total,
  totalColor,
}: {
  rows: TrialBalanceRow[];
  totalLabel: string;
  total: number;
  totalColor: string;
}) {
  return (
    <View style={styles.tableCard}>
      {rows.map((row, idx) => (
        <View key={row.account_id ?? idx} style={[styles.tableRow, idx < rows.length - 1 && styles.tableRowBorder]}>
          <Text style={styles.accountName} numberOfLines={2}>
            {row.account_code ? `${row.account_code} — ` : ''}{row.account_name}
          </Text>
          <Text style={styles.accountBalance}>
            {formatCurrency(Math.abs(row.balance ?? Math.abs(row.debit - row.credit)))}
          </Text>
        </View>
      ))}
      <View style={styles.tableTotalRow}>
        <Text style={styles.tableTotalLabel}>{totalLabel}</Text>
        <Text style={[styles.tableTotalValue, { color: totalColor }]}>{formatCurrency(total)}</Text>
      </View>
    </View>
  );
}

function NoDataNote({ message }: { message: string }) {
  return (
    <View style={styles.noDataNote}>
      <Text style={styles.noDataText}>{message}</Text>
      <Text style={styles.noDataHint}>Account types must include "revenue", "expense", "asset", "liability", or "equity" to be classified.</Text>
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
  headerTitle: { ...Typography.h2, flex: 1 },
  exportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  exportBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

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

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  summaryCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryTitle: { ...Typography.label },
  summaryGrid: { flexDirection: 'row', gap: Spacing.md },
  summaryBlock: { flex: 1 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryLabel: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { height: 1, backgroundColor: Colors.border },
  summaryNetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryNetLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  summaryNetValue: { fontSize: 18, fontWeight: '700' },

  imbalanceWarning: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  imbalanceText: { fontSize: 12, color: Colors.warning, fontWeight: '600' },

  tableCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
    marginBottom: Spacing.sm,
  },
  tableRow: { flexDirection: 'row', padding: Spacing.sm + 2, alignItems: 'center' },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  accountName: { flex: 1, fontSize: 13, color: Colors.text, paddingRight: Spacing.sm },
  accountBalance: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tableTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    backgroundColor: Colors.primaryBg,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
  },
  tableTotalLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  tableTotalValue: { fontSize: 15, fontWeight: '700' },

  noDataNote: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...Shadow.subtle,
    marginBottom: Spacing.sm,
  },
  noDataText: { fontSize: 13, color: Colors.textSecondary },
  noDataHint: { fontSize: 11, color: Colors.textMuted },
});
