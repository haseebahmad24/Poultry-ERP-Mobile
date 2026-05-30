import React, { useCallback, useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import CompanySelector from '@/components/CompanySelector';
import SectionHeader from '@/components/SectionHeader';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import AgingChart, { AgingBucket } from '@/components/AgingChart';
import { useCompany } from '@/context/CompanyContext';
import {
  fetchAPSummary,
  fetchAPVendors,
  APSummary,
  APVendor,
} from '@/api/accountsPayable';
import {
  fetchARSummary,
  fetchARCustomers,
  ARSummary,
  ARCustomer,
} from '@/api/accountsReceivable';
import { getCached, setCached } from '@/utils/cache';
import { formatCurrency } from '@/utils/currency';
import { exportFinancialAnalyticsPDF } from '@/utils/pdfExport';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

// Grayscale fills: lightest (current) → darkest (most overdue)
const AGING_FILLS = ['#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827'];

interface FinancialData {
  apSummary: APSummary;
  arSummary: ARSummary;
  topVendors: APVendor[];
  topCustomers: ARCustomer[];
}

function buildAgingBuckets(
  aging: APSummary['aging'] | ARSummary['aging'] | undefined,
): AgingBucket[] {
  return [
    {
      label: 'Current',
      shortLabel: 'Current',
      amount: aging?.current ?? 0,
      fill: AGING_FILLS[0],
    },
    {
      label: '1-30 Days',
      shortLabel: '1-30d',
      amount: aging?.days_30 ?? 0,
      fill: AGING_FILLS[1],
    },
    {
      label: '31-60 Days',
      shortLabel: '31-60d',
      amount: aging?.days_60 ?? 0,
      fill: AGING_FILLS[2],
    },
    {
      label: '61-90 Days',
      shortLabel: '61-90d',
      amount: aging?.days_90 ?? 0,
      fill: AGING_FILLS[3],
    },
    {
      label: '90+ Days',
      shortLabel: '90+d',
      amount: aging?.over_90 ?? 0,
      fill: AGING_FILLS[4],
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <View style={tileStyles.tile}>
      <Text style={tileStyles.label}>{label}</Text>
      <Text style={[tileStyles.value, danger && tileStyles.danger]}>{value}</Text>
      {sub != null && <Text style={tileStyles.sub}>{sub}</Text>}
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    minHeight: 72,
    justifyContent: 'center',
  },
  label: { ...Typography.label, color: Colors.textMuted, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '700', color: Colors.text },
  danger: { color: Colors.text },
  sub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
});

function NetPositionCard({
  arTotal,
  apTotal,
}: {
  arTotal: number;
  apTotal: number;
}) {
  const net = arTotal - apTotal;
  const isPositive = net >= 0;

  return (
    <View style={netStyles.card}>
      <View style={netStyles.row}>
        <View style={netStyles.col}>
          <Text style={netStyles.colLabel}>RECEIVABLE (AR)</Text>
          <Text style={netStyles.colAmount}>{formatCurrency(arTotal)}</Text>
        </View>
        <View style={netStyles.minus}>
          <Text style={netStyles.op}>-</Text>
        </View>
        <View style={netStyles.col}>
          <Text style={netStyles.colLabel}>PAYABLE (AP)</Text>
          <Text style={netStyles.colAmount}>{formatCurrency(apTotal)}</Text>
        </View>
        <View style={netStyles.equals}>
          <Text style={netStyles.op}>=</Text>
        </View>
        <View style={[netStyles.col, netStyles.netCol]}>
          <Text style={netStyles.colLabel}>NET POSITION</Text>
          <Text style={[netStyles.netAmount, isPositive ? netStyles.positive : netStyles.negative]}>
            {isPositive ? '+' : ''}{formatCurrency(net)}
          </Text>
        </View>
      </View>
      <Text style={netStyles.hint}>
        {isPositive
          ? 'You are owed more than you owe'
          : 'You owe more than you are owed'}
      </Text>
    </View>
  );
}

const netStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  col: {
    flex: 2,
    alignItems: 'center',
  },
  netCol: {
    flex: 2.5,
  },
  minus: { flex: 0.5, alignItems: 'center' },
  equals: { flex: 0.5, alignItems: 'center' },
  op: { fontSize: 18, fontWeight: '700', color: Colors.textMuted },
  colLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 3,
  },
  colAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  netAmount: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  positive: { color: Colors.text },
  negative: { color: Colors.text },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

function PartnerRankList({
  label,
  items,
  maxAmount,
}: {
  label: string;
  items: { name: string; outstanding: number; count: number }[];
  maxAmount: number;
}) {
  if (items.length === 0) return null;

  return (
    <View style={rankStyles.card}>
      {items.map((item, idx) => {
        const barWidth = maxAmount > 0 ? (item.outstanding / maxAmount) * 100 : 0;
        return (
          <View
            key={item.name}
            style={[rankStyles.row, idx < items.length - 1 && rankStyles.rowBorder]}
          >
            <Text style={rankStyles.rank}>{idx + 1}</Text>
            <View style={rankStyles.info}>
              <View style={rankStyles.topLine}>
                <Text style={rankStyles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={rankStyles.amount}>{formatCurrency(item.outstanding)}</Text>
              </View>
              <View style={rankStyles.barTrack}>
                <View style={[rankStyles.barFill, { width: `${barWidth}%` }]} />
              </View>
              <Text style={rankStyles.sub}>{item.count} {label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const rankStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rank: {
    width: 20,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  info: { flex: 1, gap: 5 },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  name: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  amount: { fontSize: 13, fontWeight: '700', color: Colors.text },
  barTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
  },
  sub: { ...Typography.bodySmall, color: Colors.textMuted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FinancialAnalyticsScreen() {
  const navigation = useNavigation<Nav>();
  const { companyId, selectedCompany } = useCompany();

  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const cacheKey = `financial-analytics:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<FinancialData>(cacheKey);
      if (cached) {
        setData(cached.data);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [apSummary, arSummary, topVendors, topCustomers] = await Promise.all([
        fetchAPSummary(companyId),
        fetchARSummary(companyId),
        fetchAPVendors(companyId),
        fetchARCustomers(companyId),
      ]);
      const fresh: FinancialData = { apSummary, arSummary, topVendors, topCustomers };
      setData(fresh);
      setError(null);
      await setCached(cacheKey, fresh);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, cacheKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportFinancialAnalyticsPDF(data, selectedCompany?.name);
    } finally {
      setExporting(false);
    }
  };

  // ── Render ──

  const renderContent = () => {
    if (!data) return null;
    const { apSummary, arSummary, topVendors, topCustomers } = data;

    const apTotal = apSummary.total_outstanding ?? 0;
    const arTotal = arSummary.total_outstanding ?? 0;
    const apOverdue = apSummary.total_overdue ?? 0;
    const arOverdue = arSummary.total_overdue ?? 0;

    const apBuckets = buildAgingBuckets(apSummary.aging);
    const arBuckets = buildAgingBuckets(arSummary.aging);

    const top5Vendors = [...topVendors]
      .sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0))
      .slice(0, 5);
    const top5Customers = [...topCustomers]
      .sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0))
      .slice(0, 5);

    const maxVendorAmt = top5Vendors[0]?.outstanding ?? 1;
    const maxCustomerAmt = top5Customers[0]?.outstanding ?? 1;

    return (
      <>
        {/* Net Position */}
        <NetPositionCard arTotal={arTotal} apTotal={apTotal} />

        {/* ── AP Section ── */}
        <SectionHeader
          title="Accounts Payable"
          meta={`${apSummary.vendors_count ?? 0} vendors · ${apSummary.bills_count ?? 0} bills`}
        />
        <View style={styles.tileRow}>
          <SummaryTile
            label="Total Outstanding"
            value={formatCurrency(apTotal)}
            sub="across all vendors"
          />
          <SummaryTile
            label="Overdue"
            value={formatCurrency(apOverdue)}
            danger={apOverdue > 0}
            sub={apOverdue > 0 ? 'past due date' : 'none overdue'}
          />
        </View>

        {/* AP Aging */}
        <View style={styles.agingCard}>
          <Text style={styles.agingTitle}>AP Aging Breakdown</Text>
          <AgingChart buckets={apBuckets} barHeight={14} />
        </View>

        {/* Top Vendors */}
        {top5Vendors.length > 0 && (
          <>
            <SectionHeader
              title="Top Vendors by Outstanding"
              meta={`top ${top5Vendors.length}`}
            />
            <PartnerRankList
              label="bills"
              items={top5Vendors.map((v) => ({
                name: v.name ?? `Vendor #${v.id}`,
                outstanding: v.outstanding ?? 0,
                count: v.bills_count ?? 0,
              }))}
              maxAmount={maxVendorAmt}
            />
          </>
        )}

        {/* ── AR Section ── */}
        <SectionHeader
          title="Accounts Receivable"
          meta={`${arSummary.customers_count ?? 0} customers · ${arSummary.invoices_count ?? 0} invoices`}
        />
        <View style={styles.tileRow}>
          <SummaryTile
            label="Total Outstanding"
            value={formatCurrency(arTotal)}
            sub="across all customers"
          />
          <SummaryTile
            label="Overdue"
            value={formatCurrency(arOverdue)}
            danger={arOverdue > 0}
            sub={arOverdue > 0 ? 'past due date' : 'none overdue'}
          />
        </View>

        {/* AR Aging */}
        <View style={styles.agingCard}>
          <Text style={styles.agingTitle}>AR Aging Breakdown</Text>
          <AgingChart buckets={arBuckets} barHeight={14} />
        </View>

        {/* Top Customers */}
        {top5Customers.length > 0 && (
          <>
            <SectionHeader
              title="Top Customers by Outstanding"
              meta={`top ${top5Customers.length}`}
            />
            <PartnerRankList
              label="invoices"
              items={top5Customers.map((c) => ({
                name: c.name ?? `Customer #${c.id}`,
                outstanding: c.outstanding ?? 0,
                count: c.invoices_count ?? 0,
              }))}
              maxAmount={maxCustomerAmt}
            />
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Financial Analytics</Text>
          <Text style={styles.headerSub}>AP · AR · Net Position</Text>
        </View>
        {data && (
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <Feather name={exporting ? 'loader' : 'download'} size={16} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <CompanySelector />

      {loading ? (
        <ListScreenSkeleton rows={6} />
      ) : error ? (
        <ErrorView message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.text}
            />
          }
        >
          {renderContent()}
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
  headerText: { flex: 1 },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },
  exportBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.md },

  tileRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },

  agingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  agingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
