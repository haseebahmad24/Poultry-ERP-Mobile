import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
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
import { fetchARInvoices, ARInvoice } from '@/api/accountsReceivable';
import { fetchPartners, Partner } from '@/api/partners';
import DetailSkeleton from '@/components/DetailSkeleton';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import AgingChart, { AgingBucket } from '@/components/AgingChart';
import MonthlyBalanceChart from '@/components/MonthlyBalanceChart';
import { useCompany } from '@/context/CompanyContext';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { exportCustomerDetailPDF, exportCustomerLedgerPDF, PartnerLedgerEntry } from '@/utils/pdfExport';
import { addRecentlyViewed } from '@/utils/recentlyViewed';

type Props = NativeStackScreenProps<FinanceStackParamList, 'CustomerDetail'>;

type Tab = 'invoices' | 'payments' | 'ledger';

interface LedgerEntry {
  id: string;
  type: 'INV' | 'REC';
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

function buildLedger(invoices: ARInvoice[]): LedgerEntry[] {
  const raw: Omit<LedgerEntry, 'balance'>[] = [];
  for (const inv of invoices) {
    const invDate = inv.dt ?? inv.due_date ?? '';
    if ((inv.amount ?? 0) > 0) {
      raw.push({
        id: `inv-${inv.id}`,
        type: 'INV',
        date: invDate,
        reference: inv.invoice_number ?? `Invoice-${inv.id}`,
        debit: inv.amount ?? 0,
        credit: 0,
      });
    }
    const paid = inv.paid ?? 0;
    if (paid > 0) {
      raw.push({
        id: `rec-${inv.id}`,
        type: 'REC',
        date: inv.due_date ?? invDate,
        reference: `Receipt · ${inv.invoice_number ?? `Invoice-${inv.id}`}`,
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

const AGING_FILLS = ['#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827'];

function buildAgingBuckets(invoices: ARInvoice[]): AgingBucket[] {
  const buckets = [
    { label: 'Current', shortLabel: 'Current', amount: 0, fill: AGING_FILLS[0] },
    { label: '1-30 Days', shortLabel: '1-30d', amount: 0, fill: AGING_FILLS[1] },
    { label: '31-60 Days', shortLabel: '31-60d', amount: 0, fill: AGING_FILLS[2] },
    { label: '61-90 Days', shortLabel: '61-90d', amount: 0, fill: AGING_FILLS[3] },
    { label: '90+ Days', shortLabel: '90+d', amount: 0, fill: AGING_FILLS[4] },
  ];
  for (const inv of invoices) {
    if ((inv.status ?? '').toUpperCase() === 'PAID') continue;
    const outstanding = inv.outstanding ?? (inv.amount ?? 0) - (inv.paid ?? 0);
    if (outstanding <= 0) continue;
    const days = daysOverdue(inv.due_date, inv.status);
    if (days === 0) buckets[0].amount += outstanding;
    else if (days <= 30) buckets[1].amount += outstanding;
    else if (days <= 60) buckets[2].amount += outstanding;
    else if (days <= 90) buckets[3].amount += outstanding;
    else buckets[4].amount += outstanding;
  }
  return buckets;
}

export default function CustomerDetailScreen({ route }: Props) {
  const { customerId, customerName, outstanding, overdue } = route.params;
  const { companyId } = useCompany();
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('invoices');
  const [partner, setPartner] = useState<Partner | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const all = await fetchARInvoices(companyId);
      setInvoices(all.filter((inv) => inv.customer_id === customerId || inv.customer === customerName));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, customerId, customerName]);

  useEffect(() => { load(); }, [load]);

  // Fetch partner contact info (best-effort, does not block main view)
  useEffect(() => {
    fetchPartners(companyId).then((list) => {
      const match = list.find(
        (p) => p.id === customerId ||
          p.name?.toLowerCase() === (customerName ?? '').toLowerCase()
      );
      if (match) setPartner(match);
    }).catch(() => {});
  }, [companyId, customerId, customerName]);

  // Track in recently viewed
  useEffect(() => {
    if (!loading && !error) {
      addRecentlyViewed({
        id: `customer-${customerId}`,
        type: 'customer',
        title: customerName ?? `Customer ${customerId}`,
        subtitle: 'Customer · AR',
        entityId: customerId,
        navParams: { outstanding, overdue },
      });
    }
  }, [loading]);

  if (loading) return <SafeAreaView style={{flex:1,backgroundColor:Colors.background}} edges={['top']}><StatusBar style="dark" /><DetailSkeleton tileCount={4} listCount={5} /></SafeAreaView>;
  if (error && invoices.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  const filtered = (search.trim()
    ? invoices.filter((inv) => {
        const q = search.toLowerCase();
        return (
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.status?.toLowerCase().includes(q)
        );
      })
    : invoices
  ).slice().sort((a, b) => daysOverdue(b.due_date, b.status) - daysOverdue(a.due_date, a.status));

  const overdueCount = invoices.filter((inv) => daysOverdue(inv.due_date, inv.status) > 0).length;
  const totalAmount = invoices.reduce((s, inv) => s + (inv.amount ?? 0), 0);
  const totalPaid = invoices.reduce((s, inv) => s + (inv.paid ?? 0), 0);
  const totalOutstanding = outstanding ?? invoices.reduce((s, inv) =>
    s + (inv.outstanding ?? (inv.amount ?? 0) - (inv.paid ?? 0)), 0);

  const ledgerEntries = buildLedger(invoices);
  const paymentEntries = ledgerEntries.filter((e) => e.type === 'REC');
  const paymentCount = paymentEntries.length;
  const avgPayment = paymentCount > 0 ? totalPaid / paymentCount : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{customerName ?? `Customer ${customerId}`}</Text>
          <Text style={styles.headerSub}>Customer · Accounts Receivable</Text>
        </View>
        {invoices.length > 0 && tab !== 'payments' && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              if (tab === 'ledger') {
                exportCustomerLedgerPDF({
                  customerName: customerName ?? `Customer ${customerId}`,
                  entries: ledgerEntries as PartnerLedgerEntry[],
                  closingBalance: totalOutstanding,
                });
              } else {
                exportCustomerDetailPDF({
                  customerName: customerName ?? `Customer ${customerId}`,
                  invoices,
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
        <SummaryTile label="Total Invoiced" value={formatCurrency(totalAmount)} />
        <SummaryTile label="Received" value={formatCurrency(totalPaid)} />
      </View>

      {/* Aging breakdown — only when there are outstanding invoices */}
      {totalOutstanding > 0 && (
        <View style={styles.agingCard}>
          <Text style={styles.agingTitle}>AGING BREAKDOWN</Text>
          <AgingChart buckets={buildAgingBuckets(invoices)} barHeight={10} />
        </View>
      )}

      {/* 6-month outstanding balance trend */}
      {ledgerEntries.length > 0 && (
        <View style={styles.trendCard}>
          <Text style={styles.trendTitle}>6-MONTH OUTSTANDING TREND</Text>
          <MonthlyBalanceChart entries={ledgerEntries} />
        </View>
      )}

      {/* Contact info row — shown when partner data is available */}
      {(partner?.phone || partner?.email || partner?.address) && (
        <View style={styles.contactCard}>
          {partner.phone ? (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL(`tel:${partner.phone}`)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="phone" size={13} color={Colors.textSecondary} />
              <Text style={styles.contactText}>{partner.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {partner.email ? (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL(`mailto:${partner.email}`)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="mail" size={13} color={Colors.textSecondary} />
              <Text style={styles.contactText}>{partner.email}</Text>
            </TouchableOpacity>
          ) : null}
          {partner.address ? (
            <View style={styles.contactItem}>
              <Feather name="map-pin" size={13} color={Colors.textSecondary} />
              <Text style={[styles.contactText, { flex: 1 }]} numberOfLines={1}>{partner.address}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'invoices' && styles.tabItemActive]}
          onPress={() => setTab('invoices')}
        >
          <Text style={[styles.tabLabel, tab === 'invoices' && styles.tabLabelActive]}>
            Invoices ({invoices.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'payments' && styles.tabItemActive]}
          onPress={() => setTab('payments')}
        >
          <Text style={[styles.tabLabel, tab === 'payments' && styles.tabLabelActive]}>
            Payments ({paymentCount})
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

      {tab === 'invoices' && (
        <>
          <View style={styles.searchContainer}>
            <Feather name="search" size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search invoices…"
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
              title="Invoices"
              meta={overdueCount > 0
                ? `${filtered.length} records · ${overdueCount} overdue`
                : `${filtered.length} records`}
            />
            {filtered.length === 0 ? (
              <EmptyState
                icon="file-text"
                message={search ? 'No invoices match search' : 'No invoices found for this customer'}
              />
            ) : (
              <View style={styles.cardList}>
                {filtered.map((inv) => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    overdueDays={daysOverdue(inv.due_date, inv.status)}
                  />
                ))}
              </View>
            )}
            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </>
      )}

      {tab === 'payments' && (
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
          <View style={styles.paymentStatsRow}>
            <PaymentStatTile label="Payments" value={String(paymentCount)} />
            <PaymentStatTile label="Total Received" value={formatCurrency(totalPaid)} />
            <PaymentStatTile label="Avg Receipt" value={formatCurrency(avgPayment)} />
          </View>
          <SectionHeader title="Receipt History" meta={`${paymentCount} transaction${paymentCount !== 1 ? 's' : ''}`} />
          {paymentCount === 0 ? (
            <EmptyState icon="credit-card" message="No receipts recorded for this customer" />
          ) : (
            <View style={styles.timelineContainer}>
              {paymentEntries.map((entry, idx) => (
                <PaymentTimelineItem
                  key={entry.id}
                  entry={entry}
                  isLast={idx === paymentEntries.length - 1}
                />
              ))}
            </View>
          )}
          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
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
            <EmptyState icon="book" message="No ledger entries for this customer" />
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

function InvoiceCard({ invoice: inv, overdueDays }: { invoice: ARInvoice; overdueDays: number }) {
  const outstanding = inv.outstanding ?? (inv.amount ?? 0) - (inv.paid ?? 0);
  const isOverdue = overdueDays > 0;
  const isPaid = (inv.status ?? '').toUpperCase() === 'PAID';

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
          <Text style={styles.cardTitle}>{inv.invoice_number ?? `Invoice-${inv.id}`}</Text>
        </View>
        <View style={[styles.statusBadge, isPaid && styles.statusBadgeMuted]}>
          <Text style={[styles.statusText, isPaid && styles.statusTextMuted]}>{inv.status ?? '—'}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {inv.dt && (
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(inv.dt)}</Text>
          </View>
        )}
        {inv.due_date && (
          <View style={styles.metaItem}>
            <Feather name="clock" size={11} color={isOverdue ? Colors.text : Colors.textMuted} />
            <Text style={[styles.metaText, isOverdue && styles.metaTextOverdue]}>
              Due {formatShortDate(inv.due_date)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Total</Text>
          <Text style={styles.amtValue}>{formatCurrency(inv.amount ?? 0)}</Text>
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
  const isInvoice = entry.type === 'INV';
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
        {isInvoice ? formatCurrency(entry.debit) : '—'}
      </Text>
      <Text style={[styles.ledgerColAmt, styles.ledgerCredit]}>
        {!isInvoice ? formatCurrency(entry.credit) : '—'}
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

function PaymentStatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.paymentStatTile}>
      <Text style={styles.paymentStatValue}>{value}</Text>
      <Text style={styles.paymentStatLabel}>{label}</Text>
    </View>
  );
}

function PaymentTimelineItem({ entry, isLast }: { entry: LedgerEntry; isLast: boolean }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View style={styles.timelineDot} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <View style={styles.timelineCard}>
          <View style={styles.timelineCardRow}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.timelineDate}>
              {entry.date ? formatShortDate(entry.date) : '—'}
            </Text>
            <Text style={styles.timelineAmount}>{formatCurrency(entry.credit)}</Text>
          </View>
          <Text style={styles.timelineRef} numberOfLines={1}>{entry.reference}</Text>
        </View>
      </View>
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
  agingCard: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  agingTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  trendCard: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  trendTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  contactCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
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

  // Payment timeline styles
  paymentStatsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  paymentStatTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  paymentStatValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  paymentStatLabel: { ...Typography.label, marginTop: 2 },

  timelineContainer: { marginHorizontal: Spacing.md, paddingTop: Spacing.xs },
  timelineItem: { flexDirection: 'row' },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 6 },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.text,
    backgroundColor: Colors.surface,
  },
  timelineLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 3,
    minHeight: 16,
  },
  timelineContent: { flex: 1, paddingBottom: Spacing.sm },
  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginLeft: Spacing.xs,
    gap: 3,
  },
  timelineCardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  timelineDate: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
  timelineAmount: { fontSize: 14, fontWeight: '700', color: Colors.text },
  timelineRef: { ...Typography.label, color: Colors.textMuted },
});
