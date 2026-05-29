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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import { fetchAPBills, APBill } from '@/api/accountsPayable';
import DetailSkeleton from '@/components/DetailSkeleton';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import { useCompany } from '@/context/CompanyContext';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { exportVendorDetailPDF, exportVendorLedgerPDF, PartnerLedgerEntry } from '@/utils/pdfExport';

type Props = NativeStackScreenProps<FinanceStackParamList, 'VendorDetail'>;

type Tab = 'bills' | 'ledger';

interface LedgerEntry {
  id: string;
  type: 'BILL' | 'PMT';
  date: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

function daysOverdue(dueDate: string | undefined, status: string | undefined): number {
  if (!dueDate) return 0;
  if ((status ?? '').toUpperCase() === 'PAID') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

function buildLedger(bills: APBill[]): LedgerEntry[] {
  const raw: Omit<LedgerEntry, 'balance'>[] = [];
  for (const bill of bills) {
    const billDate = bill.dt ?? bill.due_date ?? '';
    if ((bill.amount ?? 0) > 0) {
      raw.push({
        id: `bill-${bill.id}`,
        type: 'BILL',
        date: billDate,
        reference: bill.bill_number ?? `Bill-${bill.id}`,
        debit: bill.amount ?? 0,
        credit: 0,
      });
    }
    const paid = bill.paid ?? 0;
    if (paid > 0) {
      raw.push({
        id: `pmt-${bill.id}`,
        type: 'PMT',
        date: bill.due_date ?? billDate,
        reference: `Payment · ${bill.bill_number ?? `Bill-${bill.id}`}`,
        debit: 0,
        credit: paid,
      });
    }
  }
  raw.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
  let running = 0;
  return raw.map((entry) => {
    running = running + entry.debit - entry.credit;
    return { ...entry, balance: running };
  });
}

export default function VendorDetailScreen({ route }: Props) {
  const { vendorId, vendorName, outstanding, overdue } = route.params;
  const { companyId } = useCompany();
  const [bills, setBills] = useState<APBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('bills');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const all = await fetchAPBills(companyId);
      setBills(all.filter((b) => b.vendor_id === vendorId || b.vendor === vendorName));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, vendorId, vendorName]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SafeAreaView style={{flex:1,backgroundColor:Colors.background}} edges={['top']}><StatusBar style="dark" /><DetailSkeleton tileCount={4} listCount={5} /></SafeAreaView>;
  if (error && bills.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  const filtered = (search.trim()
    ? bills.filter((b) => {
        const q = search.toLowerCase();
        return (
          b.bill_number?.toLowerCase().includes(q) ||
          b.status?.toLowerCase().includes(q)
        );
      })
    : bills
  ).slice().sort((a, b) => daysOverdue(b.due_date, b.status) - daysOverdue(a.due_date, a.status));

  const overdueCount = bills.filter((b) => daysOverdue(b.due_date, b.status) > 0).length;
  const totalAmount = bills.reduce((s, b) => s + (b.amount ?? 0), 0);
  const totalPaid = bills.reduce((s, b) => s + (b.paid ?? 0), 0);
  const totalOutstanding = outstanding ?? bills.reduce((s, b) =>
    s + (b.outstanding ?? (b.amount ?? 0) - (b.paid ?? 0)), 0);

  const ledgerEntries = buildLedger(bills);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{vendorName ?? `Vendor ${vendorId}`}</Text>
          <Text style={styles.headerSub}>Vendor · Accounts Payable</Text>
        </View>
        {bills.length > 0 && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              if (tab === 'ledger') {
                exportVendorLedgerPDF({
                  vendorName: vendorName ?? `Vendor ${vendorId}`,
                  entries: ledgerEntries as PartnerLedgerEntry[],
                  closingBalance: totalOutstanding,
                });
              } else {
                exportVendorDetailPDF({
                  vendorName: vendorName ?? `Vendor ${vendorId}`,
                  bills,
                  totalOutstanding,
                  overdue: overdue ?? 0,
                });
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="file-text" size={18} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.summaryRow}>
        <SummaryTile label="Outstanding" value={formatCurrency(totalOutstanding)} />
        {(overdue ?? 0) > 0 && (
          <SummaryTile label="Overdue" value={formatCurrency(overdue ?? 0)} highlight />
        )}
        <SummaryTile label="Total Billed" value={formatCurrency(totalAmount)} />
        <SummaryTile label="Paid" value={formatCurrency(totalPaid)} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'bills' && styles.tabItemActive]}
          onPress={() => setTab('bills')}
        >
          <Text style={[styles.tabLabel, tab === 'bills' && styles.tabLabelActive]}>
            Bills ({bills.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'ledger' && styles.tabItemActive]}
          onPress={() => setTab('ledger')}
        >
          <Text style={[styles.tabLabel, tab === 'ledger' && styles.tabLabelActive]}>
            Ledger ({ledgerEntries.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'bills' && (
        <>
          <View style={styles.searchContainer}>
            <Feather name="search" size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search bills…"
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
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
              title="Bills"
              meta={overdueCount > 0
                ? `${filtered.length} records · ${overdueCount} overdue`
                : `${filtered.length} records`}
            />
            {filtered.length === 0 ? (
              <EmptyState
                icon="file-text"
                message={search ? 'No bills match search' : 'No bills found for this vendor'}
              />
            ) : (
              <View style={styles.cardList}>
                {filtered.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    overdueDays={daysOverdue(bill.due_date, bill.status)}
                  />
                ))}
              </View>
            )}
            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </>
      )}

      {tab === 'ledger' && (
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
            title="Running Ledger"
            meta={`${ledgerEntries.length} entries · Balance: ${formatCurrency(totalOutstanding)}`}
          />
          {ledgerEntries.length === 0 ? (
            <EmptyState icon="book" message="No ledger entries for this vendor" />
          ) : (
            <View style={styles.ledgerCard}>
              <LedgerHeader />
              {ledgerEntries.map((entry, idx) => (
                <LedgerRow
                  key={entry.id}
                  entry={entry}
                  isLast={idx === ledgerEntries.length - 1}
                />
              ))}
              <LedgerTotals
                totalDebit={ledgerEntries.reduce((s, e) => s + e.debit, 0)}
                totalCredit={ledgerEntries.reduce((s, e) => s + e.credit, 0)}
                closingBalance={ledgerEntries[ledgerEntries.length - 1]?.balance ?? 0}
              />
            </View>
          )}
          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SummaryTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.summaryTile, highlight && styles.summaryTileHighlight]}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function BillCard({ bill, overdueDays }: { bill: APBill; overdueDays: number }) {
  const outstanding = bill.outstanding ?? (bill.amount ?? 0) - (bill.paid ?? 0);
  const isOverdue = overdueDays > 0;
  const isPaid = (bill.status ?? '').toUpperCase() === 'PAID';

  return (
    <View style={styles.card}>
      {isOverdue && (
        <View style={styles.overdueBanner}>
          <Feather name="alert-circle" size={12} color={Colors.text} />
          <Text style={styles.overdueBannerText}>
            {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
          </Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{bill.bill_number ?? `Bill-${bill.id}`}</Text>
        </View>
        <View style={[styles.statusBadge, isPaid && styles.statusBadgeMuted]}>
          <Text style={[styles.statusText, isPaid && styles.statusTextMuted]}>{bill.status ?? '—'}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {bill.dt && (
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(bill.dt)}</Text>
          </View>
        )}
        {bill.due_date && (
          <View style={styles.metaItem}>
            <Feather name="clock" size={11} color={isOverdue ? Colors.text : Colors.textMuted} />
            <Text style={[styles.metaText, isOverdue && styles.metaTextOverdue]}>
              Due {formatShortDate(bill.due_date)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Total</Text>
          <Text style={styles.amtValue}>{formatCurrency(bill.amount ?? 0)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amtLabel}>Outstanding</Text>
          <Text style={[styles.amtValue, outstanding <= 0 && styles.amtValueMuted]}>
            {formatCurrency(outstanding)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function LedgerHeader() {
  return (
    <View style={styles.ledgerHeaderRow}>
      <Text style={[styles.ledgerColDate, styles.ledgerHeaderText]}>Date</Text>
      <Text style={[styles.ledgerColRef, styles.ledgerHeaderText]}>Reference</Text>
      <Text style={[styles.ledgerColAmt, styles.ledgerHeaderText]}>Debit</Text>
      <Text style={[styles.ledgerColAmt, styles.ledgerHeaderText]}>Credit</Text>
      <Text style={[styles.ledgerColBal, styles.ledgerHeaderText]}>Balance</Text>
    </View>
  );
}

function LedgerRow({ entry, isLast }: { entry: LedgerEntry; isLast: boolean }) {
  const isBill = entry.type === 'BILL';
  return (
    <View style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}>
      <View style={styles.ledgerColDate}>
        <Text style={styles.ledgerTypeChip}>{entry.type}</Text>
        <Text style={styles.ledgerDate}>{entry.date ? formatShortDate(entry.date) : '—'}</Text>
      </View>
      <Text style={[styles.ledgerColRef, styles.ledgerRef]} numberOfLines={2}>
        {entry.reference}
      </Text>
      <Text style={[styles.ledgerColAmt, styles.ledgerDebit]}>
        {isBill ? formatCurrency(entry.debit) : '—'}
      </Text>
      <Text style={[styles.ledgerColAmt, styles.ledgerCredit]}>
        {!isBill ? formatCurrency(entry.credit) : '—'}
      </Text>
      <Text style={[styles.ledgerColBal, styles.ledgerBalance]}>
        {formatCurrency(Math.abs(entry.balance))}
        {entry.balance < 0 ? ' Cr' : ''}
      </Text>
    </View>
  );
}

function LedgerTotals({ totalDebit, totalCredit, closingBalance }: {
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}) {
  return (
    <View style={styles.ledgerTotalsRow}>
      <Text style={[styles.ledgerColDate, styles.ledgerTotalLabel]}>Totals</Text>
      <View style={styles.ledgerColRef} />
      <Text style={[styles.ledgerColAmt, styles.ledgerTotalAmt]}>
        {formatCurrency(totalDebit)}
      </Text>
      <Text style={[styles.ledgerColAmt, styles.ledgerTotalAmt]}>
        {formatCurrency(totalCredit)}
      </Text>
      <Text style={[styles.ledgerColBal, styles.ledgerTotalBalance]}>
        {formatCurrency(Math.abs(closingBalance))}
      </Text>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Feather name={icon as any} size={32} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{message}</Text>
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
  headerText: { flex: 1 },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 1 },
  headerBtn: { padding: 4 },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  summaryTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  summaryTileHighlight: { backgroundColor: Colors.surfaceHover },
  summaryValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  summaryLabel: { ...Typography.label, marginTop: 2 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: Colors.text },
  tabLabel: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  tabLabelActive: { color: Colors.text, fontWeight: '700' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.xs },
  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardInfo: { flex: 1 },
  cardTitle: { ...Typography.h4 },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeMuted: { opacity: 0.5 },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  statusTextMuted: { color: Colors.textSecondary },

  cardMeta: { flexDirection: 'row', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  metaTextOverdue: { color: Colors.text, fontWeight: '700' },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amtLabel: { ...Typography.label },
  amtValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  amtValueMuted: { color: Colors.textMuted },

  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceHover,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  overdueBannerText: { fontSize: 12, fontWeight: '700', color: Colors.text },

  // Ledger table styles
  ledgerCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  ledgerHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  ledgerRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'flex-start',
  },
  ledgerRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  ledgerColDate: { width: 58 },
  ledgerColRef: { flex: 1, paddingHorizontal: 4 },
  ledgerColAmt: { width: 68, textAlign: 'right' },
  ledgerColBal: { width: 68, textAlign: 'right' },

  ledgerTypeChip: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginBottom: 2,
    overflow: 'hidden',
  },
  ledgerDate: { fontSize: 11, color: Colors.textSecondary },
  ledgerRef: { fontSize: 12, color: Colors.text },
  ledgerDebit: { fontSize: 11, color: Colors.text, fontWeight: '600', textAlign: 'right' },
  ledgerCredit: { fontSize: 11, color: Colors.textSecondary, textAlign: 'right' },
  ledgerBalance: { fontSize: 11, fontWeight: '700', color: Colors.text, textAlign: 'right' },

  ledgerTotalsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceHover,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  ledgerTotalLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  ledgerTotalAmt: { fontSize: 11, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  ledgerTotalBalance: { fontSize: 12, fontWeight: '800', color: Colors.text, textAlign: 'right' },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
