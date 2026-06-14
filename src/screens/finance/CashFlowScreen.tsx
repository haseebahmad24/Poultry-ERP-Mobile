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
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchAPBills, APBill } from '@/api/accountsPayable';
import { fetchARInvoices, ARInvoice } from '@/api/accountsReceivable';
import { useCompany } from '@/context/CompanyContext';
import { getCached, setCached } from '@/utils/cache';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { exportCashFlowPDF } from '@/utils/pdfExport';
import CompanySelector from '@/components/CompanySelector';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import OfflineBanner from '@/components/OfflineBanner';
import ErrorView from '@/components/ErrorView';

type Period = 'overdue' | 'this_week' | 'next_week' | 'week_3' | 'week_4' | 'later' | 'undated';

const PERIOD_LABELS: Record<Period, string> = {
  overdue: 'Overdue',
  this_week: 'Due This Week',
  next_week: 'Due Next Week',
  week_3: 'Due in 2–3 Weeks',
  week_4: 'Due in 3–4 Weeks',
  later: 'Due in 30+ Days',
  undated: 'No Due Date',
};

const PERIOD_ORDER: Period[] = [
  'overdue',
  'this_week',
  'next_week',
  'week_3',
  'week_4',
  'later',
  'undated',
];

function getPeriod(dueDateStr?: string): Period {
  if (!dueDateStr) return 'undated';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  if (due < today) return 'overdue';
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff <= 7) return 'this_week';
  if (diff <= 14) return 'next_week';
  if (diff <= 21) return 'week_3';
  if (diff <= 28) return 'week_4';
  return 'later';
}

interface PeriodData {
  bills: APBill[];
  invoices: ARInvoice[];
  totalOut: number;
  totalIn: number;
  net: number;
}

export default function CashFlowScreen() {
  const { companyId, selectedCompany } = useCompany();
  const [bills, setBills] = useState<APBill[]>([]);
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [exporting, setExporting] = useState(false);

  const cacheKey = `cash-flow:${companyId ?? 'all'}`;

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) {
        const cached = await getCached<{ bills: APBill[]; invoices: ARInvoice[] }>(cacheKey);
        if (cached) {
          setBills(cached.data.bills);
          setInvoices(cached.data.invoices);
          setStale(cached.stale);
          setLoading(false);
          if (!cached.stale) return;
        }
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [billsData, invoicesData] = await Promise.all([
          fetchAPBills(companyId),
          fetchARInvoices(companyId),
        ]);
        setBills(billsData);
        setInvoices(invoicesData);
        setStale(false);
        await setCached(cacheKey, { bills: billsData, invoices: invoicesData });
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, cacheKey],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportCashFlowPDF({
        bills,
        invoices,
        companyName: selectedCompany?.name ?? 'All Companies',
      });
    } finally {
      setExporting(false);
    }
  };

  const outstandingBills = bills.filter(
    (b) =>
      (b.outstanding ?? 0) > 0 &&
      b.status?.toLowerCase() !== 'paid' &&
      b.status?.toLowerCase() !== 'cancelled',
  );
  const outstandingInvoices = invoices.filter(
    (i) =>
      (i.outstanding ?? 0) > 0 &&
      i.status?.toLowerCase() !== 'paid' &&
      i.status?.toLowerCase() !== 'cancelled',
  );

  const periodMap = Object.fromEntries(
    PERIOD_ORDER.map((p) => [
      p,
      { bills: [] as APBill[], invoices: [] as ARInvoice[], totalOut: 0, totalIn: 0, net: 0 },
    ]),
  ) as Record<Period, PeriodData>;

  for (const bill of outstandingBills) {
    const p = getPeriod(bill.due_date);
    periodMap[p].bills.push(bill);
    periodMap[p].totalOut += bill.outstanding ?? 0;
  }
  for (const inv of outstandingInvoices) {
    const p = getPeriod(inv.due_date);
    periodMap[p].invoices.push(inv);
    periodMap[p].totalIn += inv.outstanding ?? 0;
  }
  for (const p of PERIOD_ORDER) {
    periodMap[p].net = periodMap[p].totalIn - periodMap[p].totalOut;
  }

  const totalOut = outstandingBills.reduce((s, b) => s + (b.outstanding ?? 0), 0);
  const totalIn = outstandingInvoices.reduce((s, i) => s + (i.outstanding ?? 0), 0);
  const netPosition = totalIn - totalOut;

  const activePeriods = PERIOD_ORDER.filter(
    (p) => periodMap[p].bills.length > 0 || periodMap[p].invoices.length > 0,
  );

  if (error && bills.length === 0 && invoices.length === 0) {
    return <ErrorView message={error} onRetry={() => load()} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Cash Flow</Text>
          <Text style={styles.headerSub}>Upcoming payments & collections</Text>
        </View>
        {!loading && (bills.length > 0 || invoices.length > 0) && (
          exporting ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : (
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
              <Feather name="file-text" size={13} color={Colors.text} />
              <Text style={styles.exportBtnText}>PDF</Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <CompanySelector />
      <OfflineBanner visible={!!(stale && error)} />

      {loading ? (
        <ListScreenSkeleton count={6} showTabs={false} showSearch={false} />
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
          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{formatCurrency(totalOut)}</Text>
              <Text style={styles.summaryLabel}>Total Payable</Text>
              <Text style={styles.summaryHint}>{outstandingBills.length} outstanding bills</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{formatCurrency(totalIn)}</Text>
              <Text style={styles.summaryLabel}>Total Receivable</Text>
              <Text style={styles.summaryHint}>
                {outstandingInvoices.length} outstanding invoices
              </Text>
            </View>
          </View>

          <View style={[styles.netCard, netPosition < 0 && styles.netCardNegative]}>
            <View style={styles.netCardLeft}>
              <Text style={styles.netLabel}>Net Cash Position</Text>
              <Text style={styles.netHint}>
                {netPosition >= 0
                  ? 'Collections exceed payments outstanding'
                  : 'Payments exceed collections outstanding'}
              </Text>
            </View>
            <Text style={[styles.netValue, netPosition < 0 && styles.netValueNegative]}>
              {netPosition >= 0 ? '+' : ''}
              {formatCurrency(netPosition)}
            </Text>
          </View>

          {activePeriods.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptyText}>No outstanding bills or invoices</Text>
            </View>
          ) : (
            activePeriods.map((period) => {
              const data = periodMap[period];
              const isOverdue = period === 'overdue';
              return (
                <View key={period} style={styles.periodSection}>
                  <SectionHeader
                    title={PERIOD_LABELS[period]}
                    meta={`In ${formatCurrency(data.totalIn)} · Out ${formatCurrency(data.totalOut)}`}
                  />

                  {data.bills.length > 0 && (
                    <View style={[styles.flowGroup, isOverdue && styles.flowGroupOverdue]}>
                      <View style={styles.flowGroupHeader}>
                        <Feather name="arrow-up-right" size={12} color={Colors.textMuted} />
                        <Text style={styles.flowGroupLabel}>
                          TO PAY · {data.bills.length} bill{data.bills.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {data.bills.map((bill) => (
                        <View key={bill.id} style={styles.flowItem}>
                          <View style={styles.flowItemLeft}>
                            <Text style={styles.flowItemParty} numberOfLines={1}>
                              {bill.vendor ?? '—'}
                            </Text>
                            <Text style={styles.flowItemRef}>
                              {bill.bill_number ?? `Bill-${bill.id}`}
                            </Text>
                          </View>
                          <View style={styles.flowItemRight}>
                            <Text style={styles.flowItemAmount}>
                              {formatCurrency(bill.outstanding ?? 0)}
                            </Text>
                            {bill.due_date && (
                              <Text style={[styles.flowItemDate, isOverdue && styles.flowItemDateOverdue]}>
                                {isOverdue ? 'Due ' : ''}{formatShortDate(bill.due_date)}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {data.invoices.length > 0 && (
                    <View style={styles.flowGroup}>
                      <View style={styles.flowGroupHeader}>
                        <Feather name="arrow-down-left" size={12} color={Colors.textMuted} />
                        <Text style={styles.flowGroupLabel}>
                          TO COLLECT · {data.invoices.length} invoice
                          {data.invoices.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {data.invoices.map((inv) => (
                        <View key={inv.id} style={styles.flowItem}>
                          <View style={styles.flowItemLeft}>
                            <Text style={styles.flowItemParty} numberOfLines={1}>
                              {inv.customer ?? '—'}
                            </Text>
                            <Text style={styles.flowItemRef}>
                              {inv.invoice_number ?? `Inv-${inv.id}`}
                            </Text>
                          </View>
                          <View style={styles.flowItemRight}>
                            <Text style={styles.flowItemAmount}>
                              {formatCurrency(inv.outstanding ?? 0)}
                            </Text>
                            {inv.due_date && (
                              <Text style={[styles.flowItemDate, isOverdue && styles.flowItemDateOverdue]}>
                                {isOverdue ? 'Due ' : ''}{formatShortDate(inv.due_date)}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.periodNet}>
                    <Text style={styles.periodNetLabel}>Period Net</Text>
                    <Text
                      style={[
                        styles.periodNetValue,
                        data.net < 0 && styles.periodNetNegative,
                      ]}
                    >
                      {data.net >= 0 ? '+' : ''}
                      {formatCurrency(data.net)}
                    </Text>
                  </View>
                </View>
              );
            })
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
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerText: { flex: 1 },
  headerTitle: { ...Typography.h3 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  exportBtnText: { fontSize: 11, fontWeight: '600', color: Colors.text },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md },

  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 2,
  },
  summaryValue: { ...Typography.h3, fontWeight: '700' },
  summaryLabel: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textSecondary },
  summaryHint: { fontSize: 11, color: Colors.textMuted },

  netCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  netCardNegative: {
    borderColor: Colors.text,
    backgroundColor: Colors.surfaceHover,
  },
  netCardLeft: { flex: 1 },
  netLabel: { ...Typography.h4 },
  netHint: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  netValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  netValueNegative: { color: Colors.text },

  emptyState: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: { ...Typography.h4 },
  emptyText: { ...Typography.body, color: Colors.textMuted },

  periodSection: { gap: Spacing.xs },

  flowGroup: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginHorizontal: 0,
  },
  flowGroupOverdue: {
    borderColor: Colors.text,
  },
  flowGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  flowGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },

  flowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  flowItemLeft: { flex: 1 },
  flowItemParty: { ...Typography.body, fontWeight: '600', color: Colors.text },
  flowItemRef: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },
  flowItemRight: { alignItems: 'flex-end' },
  flowItemAmount: { ...Typography.body, fontWeight: '700', color: Colors.text },
  flowItemDate: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  flowItemDateOverdue: { fontWeight: '600' },

  periodNet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  periodNetLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  periodNetValue: { ...Typography.body, fontWeight: '700', color: Colors.text },
  periodNetNegative: { color: Colors.text },
});
