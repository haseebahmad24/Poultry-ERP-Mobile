import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import {
  fetchARSummary,
  fetchARInvoices,
  fetchARCustomers,
  ARSummary,
  ARInvoice,
  ARCustomer,
} from '@/api/accountsReceivable';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import CompanyPicker from '@/components/CompanyPicker';
import { useCompany } from '@/context/CompanyContext';
import { formatCurrency, formatShortDate } from '@/utils/currency';

type Tab = 'summary' | 'invoices' | 'customers';

const INVOICE_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PAID:      { bg: Colors.successBg, fg: Colors.success },
  PARTIAL:   { bg: Colors.orangeBg,  fg: Colors.orange },
  UNPAID:    { bg: Colors.dangerBg,  fg: Colors.danger },
  OVERDUE:   { bg: Colors.dangerBg,  fg: Colors.danger },
  DRAFT:     { bg: Colors.warningBg, fg: Colors.warning },
};

export default function AccountsReceivableScreen() {
  const { companyId } = useCompany();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [summary, setSummary] = useState<ARSummary>({});
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [customers, setCustomers] = useState<ARCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [sum, invs, custs] = await Promise.all([
        fetchARSummary(companyId),
        fetchARInvoices(companyId),
        fetchARCustomers(companyId),
      ]);
      setSummary(sum);
      setInvoices(invs);
      setCustomers(custs);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView message="Loading accounts receivable…" />;
  if (error && !summary.total_outstanding) {
    return <ErrorView message={error} onRetry={() => load()} />;
  }

  const aging = summary.aging ?? {};
  const totalAging = (aging.current ?? 0) + (aging.days_30 ?? 0) +
    (aging.days_60 ?? 0) + (aging.days_90 ?? 0) + (aging.over_90 ?? 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Accounts Receivable</Text>
      </View>

      <CompanyPicker />

      <View style={styles.tabBar}>
        {(['summary', 'invoices', 'customers'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
        {activeTab === 'summary' && (
          <>
            <View style={styles.kpiGrid}>
              <KPICard
                label="Total Outstanding"
                value={formatCurrency(summary.total_outstanding ?? 0)}
                color={Colors.primary}
              />
              <KPICard
                label="Total Overdue"
                value={formatCurrency(summary.total_overdue ?? 0)}
                color={Colors.danger}
              />
              <KPICard
                label="Customers"
                value={String(summary.customers_count ?? customers.length)}
                color={Colors.success}
              />
              <KPICard
                label="Invoices"
                value={String(summary.invoices_count ?? invoices.length)}
                color={Colors.textSecondary}
              />
            </View>

            <SectionHeader title="Aging Analysis" />
            <View style={styles.agingCard}>
              <AgingBar label="Current" amount={aging.current ?? 0} total={totalAging} color={Colors.success} />
              <AgingBar label="1–30 days" amount={aging.days_30 ?? 0} total={totalAging} color={Colors.warning} />
              <AgingBar label="31–60 days" amount={aging.days_60 ?? 0} total={totalAging} color={Colors.orange} />
              <AgingBar label="61–90 days" amount={aging.days_90 ?? 0} total={totalAging} color={Colors.danger} />
              <AgingBar label="Over 90 days" amount={aging.over_90 ?? 0} total={totalAging} color={Colors.primaryDark} />
            </View>

            {customers.length > 0 && (
              <>
                <SectionHeader title="Top Customers" meta="By outstanding" />
                <View style={styles.miniList}>
                  {customers.slice(0, 5).map((c) => (
                    <View key={c.id} style={styles.miniRow}>
                      <Text style={styles.miniName} numberOfLines={1}>{c.name ?? `Customer ${c.id}`}</Text>
                      <Text style={[styles.miniAmount, { color: Colors.primary }]}>
                        {formatCurrency(c.outstanding ?? 0)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {activeTab === 'invoices' && (
          <>
            <SectionHeader title="Invoices" meta={`${invoices.length} records`} />
            {invoices.length === 0 ? (
              <EmptyState icon="🧾" message="No invoices found" />
            ) : (
              <View style={styles.cardList}>
                {invoices.map((inv) => (
                  <InvoiceCard key={inv.id} invoice={inv} />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'customers' && (
          <>
            <SectionHeader title="Customers" meta={`${customers.length} records`} />
            {customers.length === 0 ? (
              <EmptyState icon="👥" message="No customers found" />
            ) : (
              <View style={styles.cardList}>
                {customers.map((c) => (
                  <CustomerCard key={c.id} customer={c} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function AgingBar({ label, amount, total, color }: {
  label: string; amount: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
  return (
    <View style={styles.agingRow}>
      <Text style={styles.agingLabel}>{label}</Text>
      <View style={styles.agingBarContainer}>
        <View style={[styles.agingBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.agingAmount, { color }]}>{formatCurrency(amount)}</Text>
    </View>
  );
}

function InvoiceCard({ invoice: inv }: { invoice: ARInvoice }) {
  const statusKey = (inv.status ?? '').toUpperCase();
  const colors = INVOICE_STATUS_COLORS[statusKey] ?? { bg: Colors.borderLight, fg: Colors.textSecondary };
  const outstanding = inv.outstanding ?? (inv.amount ?? 0) - (inv.paid ?? 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{inv.invoice_number ?? `INV-${inv.id}`}</Text>
          <Text style={styles.cardSub}>{inv.customer ?? 'Unknown Customer'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusText, { color: colors.fg }]}>{inv.status ?? '—'}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {inv.dt && <Text style={styles.metaText}>📅 {formatShortDate(inv.dt)}</Text>}
        {inv.due_date && <Text style={styles.metaText}>⏰ Due {formatShortDate(inv.due_date)}</Text>}
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Total</Text>
          <Text style={styles.amtValue}>{formatCurrency(inv.amount ?? 0)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amtLabel}>Outstanding</Text>
          <Text style={[styles.amtValue, { color: outstanding > 0 ? Colors.primary : Colors.success }]}>
            {formatCurrency(outstanding)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CustomerCard({ customer: c }: { customer: ARCustomer }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{c.name ?? `Customer ${c.id}`}</Text>
        {c.invoices_count != null && (
          <Text style={styles.countBadge}>{c.invoices_count} invoices</Text>
        )}
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Outstanding</Text>
          <Text style={[styles.amtValue, { color: Colors.primary }]}>
            {formatCurrency(c.outstanding ?? 0)}
          </Text>
        </View>
        {c.overdue != null && c.overdue > 0 && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amtLabel}>Overdue</Text>
            <Text style={[styles.amtValue, { color: Colors.danger }]}>
              {formatCurrency(c.overdue)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h2 },

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

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    ...Shadow.card,
  },
  kpiValue: { fontSize: 18, fontWeight: '700' },
  kpiLabel: { ...Typography.bodySmall, color: Colors.textSecondary },

  agingCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  agingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  agingLabel: { fontSize: 12, color: Colors.textSecondary, width: 90 },
  agingBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  agingBarFill: { height: '100%', borderRadius: Radius.full },
  agingAmount: { fontSize: 12, fontWeight: '600', minWidth: 80, textAlign: 'right' },

  miniList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
  },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  miniName: { flex: 1, ...Typography.body },
  miniAmount: { fontSize: 14, fontWeight: '700' },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardInfo: { flex: 1 },
  cardTitle: { ...Typography.h4 },
  cardSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardMeta: { flexDirection: 'row', gap: Spacing.md },
  metaText: { fontSize: 12, color: Colors.textSecondary },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amtLabel: { ...Typography.label },
  amtValue: { fontSize: 15, fontWeight: '700', color: Colors.text },

  countBadge: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },

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
