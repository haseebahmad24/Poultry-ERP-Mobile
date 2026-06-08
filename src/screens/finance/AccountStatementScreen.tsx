import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import type { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import { fetchJournalEntries, JournalEntry } from '@/api/journalEntries';
import BackButton from '@/components/BackButton';
import SectionHeader from '@/components/SectionHeader';
import ErrorView from '@/components/ErrorView';
import DetailSkeleton from '@/components/DetailSkeleton';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import { exportAccountStatementPDF } from '@/utils/pdfExport';
import { useCompany } from '@/context/CompanyContext';

type RouteType = RouteProp<FinanceStackParamList, 'AccountStatement'>;

export type AccountStatementLine = {
  date: string;
  voucherType: string;
  voucherNo: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

// Determine if an account is debit-normal (balance increases with debits)
function isDebitNormal(accountCode: string): boolean {
  const code = String(accountCode ?? '').trim();
  // 1xx = Assets, 5xx = Expenses → debit-normal
  // 2xx = Liabilities, 3xx = Equity, 4xx = Revenue → credit-normal
  return code.startsWith('1') || code.startsWith('5');
}

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  JV: 'JV',
  GRN: 'GRN',
  PAY: 'PAY',
  REC: 'REC',
  INV: 'INV',
  BILL: 'BILL',
  ADJ: 'ADJ',
};

export default function AccountStatementScreen() {
  const route = useRoute<RouteType>();
  const { accountCode = '', accountName = '', accountType } = route.params ?? {};
  const { companyId, selectedCompany } = useCompany();

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: startOfMonthISO(),
    to: todayISO(),
  });
  const [lines, setLines] = useState<AccountStatementLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const cacheKey = `account-statement:${companyId ?? 'all'}:${accountCode}:${dateRange.from}:${dateRange.to}`;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      const cached = await getCached<AccountStatementLine[]>(cacheKey);
      if (cached) {
        setLines(cached.data);
        setLoading(false);
        if (!cached.stale) return;
      } else {
        setLoading(true);
      }
    }
    setError(null);
    try {
      const entries = await fetchJournalEntries({
        companyId,
        account: accountCode,
        from: dateRange.from || undefined,
        to: dateRange.to || undefined,
      });

      const debitNormal = isDebitNormal(accountCode);
      const rawLines: AccountStatementLine[] = [];

      for (const entry of entries) {
        for (const line of entry.lines ?? []) {
          const lineAccount = String(line.account ?? '');
          if (!lineAccount.includes(accountCode) && lineAccount !== accountCode) continue;

          rawLines.push({
            date: entry.dt ?? '',
            voucherType: entry.voucher_type ?? 'JV',
            voucherNo: entry.voucher_no ?? String(entry.id ?? ''),
            narration: line.narration ?? entry.narration ?? '',
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            balance: 0, // computed below
          });
        }
      }

      // Sort by date ascending, then compute running balance
      rawLines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      let balance = 0;
      for (const ln of rawLines) {
        if (debitNormal) {
          balance += ln.debit - ln.credit;
        } else {
          balance += ln.credit - ln.debit;
        }
        ln.balance = balance;
      }

      setLines(rawLines);
      // Only cache when both dates are set (specific range)
      if (dateRange.from && dateRange.to) {
        await setCached(cacheKey, rawLines);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, accountCode, dateRange, cacheKey]);

  useEffect(() => { load(); }, [load]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportAccountStatementPDF({
        accountCode,
        accountName,
        accountType,
        companyName: selectedCompany?.name ?? 'All Companies',
        from: dateRange.from,
        to: dateRange.to,
        lines,
      });
    } finally {
      setExporting(false);
    }
  };

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const closingBalance = lines.length > 0 ? lines[lines.length - 1].balance : 0;

  if (error && lines.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>Account Statement</Text>
          {accountType && <Text style={styles.headerSub}>{accountType}</Text>}
        </View>
        {!loading && lines.length > 0 && (
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color={Colors.text} />
              : <Feather name="file-text" size={13} color={Colors.text} />}
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Account info card */}
      <View style={styles.accountCard}>
        <Text style={styles.accountCode}>{accountCode}</Text>
        <Text style={styles.accountName} numberOfLines={2}>{accountName}</Text>
      </View>

      <DateRangeBar value={dateRange} onChange={setDateRange} />

      {loading ? (
        <DetailSkeleton tileCount={3} listCount={6} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.textMuted}
            />
          }
        >
          {/* Summary tiles */}
          <View style={styles.tilesRow}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Total Debits</Text>
              <Text style={styles.tileValue}>{formatCurrency(totalDebit)}</Text>
            </View>
            <View style={styles.tileDivider} />
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Total Credits</Text>
              <Text style={styles.tileValue}>{formatCurrency(totalCredit)}</Text>
            </View>
            <View style={styles.tileDivider} />
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Closing Balance</Text>
              <Text style={[styles.tileValue, closingBalance < 0 && styles.negative]}>
                {formatCurrency(Math.abs(closingBalance))}
                {closingBalance < 0 && ' Cr'}
              </Text>
            </View>
          </View>

          <SectionHeader
            title="Transactions"
            meta={`${lines.length} entries`}
          />

          {lines.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="file-text" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No transactions found</Text>
              <Text style={styles.emptySubText}>Try adjusting the date range</Text>
            </View>
          ) : (
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colDate, styles.headerText]}>Date</Text>
                <Text style={[styles.colVoucher, styles.headerText]}>Voucher</Text>
                <Text style={[styles.colAmount, styles.headerText]}>Debit</Text>
                <Text style={[styles.colAmount, styles.headerText]}>Credit</Text>
                <Text style={[styles.colBalance, styles.headerText]}>Balance</Text>
              </View>

              {lines.map((line, idx) => (
                <View
                  key={idx}
                  style={[styles.tableRow, idx < lines.length - 1 && styles.tableRowBorder]}
                >
                  <View style={styles.colDate}>
                    <Text style={styles.dateText}>{formatShortDate(line.date)}</Text>
                  </View>
                  <View style={styles.colVoucher}>
                    <View style={styles.voucherBadge}>
                      <Text style={styles.voucherType}>
                        {VOUCHER_TYPE_LABELS[line.voucherType] ?? line.voucherType}
                      </Text>
                    </View>
                    <Text style={styles.voucherNo} numberOfLines={1}>{line.voucherNo}</Text>
                    {line.narration ? (
                      <Text style={styles.narration} numberOfLines={1}>{line.narration}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.colAmount, styles.amountText]}>
                    {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                  </Text>
                  <Text style={[styles.colAmount, styles.amountText]}>
                    {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                  </Text>
                  <Text style={[styles.colBalance, styles.balanceText, line.balance < 0 && styles.negative]}>
                    {formatCurrency(Math.abs(line.balance))}
                    {line.balance < 0 ? '\nCr' : ''}
                  </Text>
                </View>
              ))}

              {/* Totals row */}
              <View style={styles.totalsRow}>
                <Text style={[styles.colDate, styles.totalsText]}>Total</Text>
                <View style={styles.colVoucher} />
                <Text style={[styles.colAmount, styles.totalsText]}>
                  {formatCurrency(totalDebit)}
                </Text>
                <Text style={[styles.colAmount, styles.totalsText]}>
                  {formatCurrency(totalCredit)}
                </Text>
                <Text style={[styles.colBalance, styles.totalsText, closingBalance < 0 && styles.negative]}>
                  {formatCurrency(Math.abs(closingBalance))}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
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
  headerCenter: { flex: 1 },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.label, color: Colors.textMuted, marginTop: 1 },
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

  accountCard: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  accountCode: { ...Typography.label, color: Colors.textMuted, marginBottom: 2 },
  accountName: { ...Typography.body, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  tilesRow: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tile: { flex: 1, alignItems: 'center' },
  tileDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: Colors.border,
  },
  tileLabel: { ...Typography.label, color: Colors.textMuted, marginBottom: 4, textAlign: 'center' },
  tileValue: { fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  negative: { color: Colors.textSecondary },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted, marginTop: Spacing.sm },
  emptySubText: { ...Typography.bodySmall, color: Colors.textMuted },

  tableCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tableRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceHover,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  totalsText: { fontSize: 12, fontWeight: '700', color: Colors.text, textAlign: 'right' },

  colDate: { width: 46 },
  colVoucher: { flex: 1, paddingRight: Spacing.xs },
  colAmount: { width: 66, textAlign: 'right' },
  colBalance: { width: 66, textAlign: 'right' },

  dateText: { fontSize: 10, color: Colors.textSecondary },
  voucherBadge: {
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  voucherType: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  voucherNo: { fontSize: 11, color: Colors.text, fontWeight: '500' },
  narration: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  amountText: { fontSize: 11, color: Colors.text },
  balanceText: { fontSize: 11, color: Colors.text, fontWeight: '600' },
});
