import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchTrialBalance, TrialBalanceRow, TrialBalanceResult } from '@/api/trialBalance';
import { useCompany } from '@/context/CompanyContext';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import OfflineBanner from '@/components/OfflineBanner';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import CompanySelector from '@/components/CompanySelector';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';
import { formatCurrency } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import { exportPLPDF, exportBSPDF } from '@/utils/pdfExport';

type ReportTab = 'pl' | 'bs';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  const { companyId, selectedCompany: ctxCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<ReportTab>('pl');
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [asOf, setAsOf] = useState(todayISO());
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: todayISO(), to: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    const cacheKey = `trial-balance:${companyId ?? 'all'}:${asOf}`;
    if (!isRefresh) {
      const cached = await getCached<TrialBalanceResult>(cacheKey);
      if (cached) {
        setRows(cached.data.rows);
        setIsStale(cached.stale);
        setLoading(false);
        if (!cached.stale) return;
      } else {
        setLoading(true);
      }
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const result = await fetchTrialBalance(companyId, asOf);
      setRows(result.rows);
      setIsStale(false);
      await setCached(cacheKey, result);
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

  const pl = computePL(rows);
  const bs = computeBS(rows);

  const handleExportPDF = async () => {
    const company = ctxCompany?.name ?? 'All Companies';
    if (activeTab === 'pl') {
      await exportPLPDF({ pl, companyName: company, asOf });
    } else {
      await exportBSPDF({ bs, companyName: company, asOf });
    }
  };

  const handleExport = async () => {
    const line = '─'.repeat(50);
    const company = ctxCompany?.name ?? 'All Companies';

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

  if (error && rows.length === 0 && !isStale) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Financial Reports</Text>
        {!loading && rows.length > 0 && (
          <>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
              <Feather name="file-text" size={13} color={Colors.text} />
              <Text style={styles.exportBtnText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
              <Feather name="share" size={13} color={Colors.text} />
              <Text style={styles.exportBtnText}>Share</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

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

      <CompanySelector showAll />
      {!loading && <DateRangeBar mode="single" value={dateRange} onChange={handleDateChange} />}
      <OfflineBanner visible={!!(isStale && error)} />

      {loading ? <ListScreenSkeleton count={8} showTabs={false} showSearch={false} showBadge={false} /> : <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.textMuted} />
        }
      >
        {activeTab === 'pl' ? (
          <PLReport pl={pl} />
        ) : (
          <BSReport bs={bs} />
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>}
    </SafeAreaView>
  );
}

function PLReport({ pl }: { pl: PLData }) {
  return (
    <>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Profit & Loss Summary</Text>
        <View style={styles.summaryGrid}>
          <SummaryBlock label="Total Revenue" value={formatCurrency(pl.totalRevenue)} />
          <SummaryBlock label="Total Expenses" value={formatCurrency(pl.totalExpense)} />
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryNetRow}>
          <Text style={styles.summaryNetLabel}>Net Income</Text>
          <Text style={[styles.summaryNetValue, pl.netIncome < 0 && styles.summaryNetValueMuted]}>
            {formatCurrency(pl.netIncome)}
          </Text>
        </View>
      </View>

      <SectionHeader title="Revenue" meta={`${pl.revenues.length} accounts`} />
      {pl.revenues.length === 0 ? (
        <NoDataNote message="No revenue accounts found in trial balance" />
      ) : (
        <AccountTable rows={pl.revenues} totalLabel="Total Revenue" total={pl.totalRevenue} />
      )}

      <SectionHeader title="Expenses" meta={`${pl.expenses.length} accounts`} />
      {pl.expenses.length === 0 ? (
        <NoDataNote message="No expense accounts found in trial balance" />
      ) : (
        <AccountTable rows={pl.expenses} totalLabel="Total Expenses" total={pl.totalExpense} />
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
          <SummaryBlock label="Total Assets" value={formatCurrency(bs.totalAssets)} />
          <SummaryBlock label="Liabilities + Equity" value={formatCurrency(bs.totalLiabilities + bs.totalEquity)} />
        </View>
        {!isBalanced && (
          <View style={styles.imbalanceWarning}>
            <Feather name="alert-circle" size={13} color={Colors.textSecondary} />
            <Text style={styles.imbalanceText}>
              Out of balance by {formatCurrency(Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)))}
            </Text>
          </View>
        )}
      </View>

      <SectionHeader title="Assets" meta={`${bs.assets.length} accounts`} />
      {bs.assets.length === 0 ? (
        <NoDataNote message="No asset accounts found in trial balance" />
      ) : (
        <AccountTable rows={bs.assets} totalLabel="Total Assets" total={bs.totalAssets} />
      )}

      <SectionHeader title="Liabilities" meta={`${bs.liabilities.length} accounts`} />
      {bs.liabilities.length === 0 ? (
        <NoDataNote message="No liability accounts found in trial balance" />
      ) : (
        <AccountTable rows={bs.liabilities} totalLabel="Total Liabilities" total={bs.totalLiabilities} />
      )}

      <SectionHeader title="Equity" meta={`${bs.equity.length} accounts`} />
      {bs.equity.length === 0 ? (
        <NoDataNote message="No equity accounts found in trial balance" />
      ) : (
        <AccountTable rows={bs.equity} totalLabel="Total Equity" total={bs.totalEquity} />
      )}
    </>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function AccountTable({
  rows,
  totalLabel,
  total,
}: {
  rows: TrialBalanceRow[];
  totalLabel: string;
  total: number;
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
        <Text style={styles.tableTotalValue}>{formatCurrency(total)}</Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2, flex: 1 },
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

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.text },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.text, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  summaryCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryTitle: { ...Typography.label },
  summaryGrid: { flexDirection: 'row', gap: Spacing.md },
  summaryBlock: { flex: 1 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: Colors.text },
  summaryLabel: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  summaryNetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryNetLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  summaryNetValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  summaryNetValueMuted: { color: Colors.textSecondary },

  imbalanceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceHover,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  imbalanceText: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  tableCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  tableRow: { flexDirection: 'row', padding: Spacing.sm + 2, alignItems: 'center' },
  tableRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  accountName: { flex: 1, fontSize: 13, color: Colors.text, paddingRight: Spacing.sm },
  accountBalance: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tableTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    backgroundColor: Colors.surfaceHover,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  tableTotalLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  tableTotalValue: { fontSize: 15, fontWeight: '700', color: Colors.text },

  noDataNote: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  noDataText: { fontSize: 13, color: Colors.textSecondary },
  noDataHint: { fontSize: 11, color: Colors.textMuted },
});
