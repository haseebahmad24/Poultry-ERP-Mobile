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
import { useNavigation } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { useCompany } from '@/context/CompanyContext';
import { fetchDashboardData, type Company, type KPIs } from '@/api/dashboard';
import { formatCurrency } from '@/utils/currency';
import { exportComparisonPDF } from '@/utils/pdfExport';

interface CompanySnapshot {
  company: Company;
  kpis: KPIs;
  loading: boolean;
  error: boolean;
}

interface MetricDef {
  key: keyof KPIs;
  label: string;
  format: (v: number) => string;
  higherIsBetter?: boolean;
}

const METRICS: MetricDef[] = [
  {
    key: 'revenue',
    label: 'Revenue (MTD)',
    format: formatCurrency,
    higherIsBetter: true,
  },
  {
    key: 'expenses',
    label: 'Expenses (MTD)',
    format: formatCurrency,
    higherIsBetter: false,
  },
  {
    key: 'cash',
    label: 'Cash Balance',
    format: formatCurrency,
    higherIsBetter: true,
  },
  {
    key: 'totalAR',
    label: 'Accounts Receivable',
    format: formatCurrency,
    higherIsBetter: true,
  },
  {
    key: 'totalAP',
    label: 'Accounts Payable',
    format: formatCurrency,
    higherIsBetter: false,
  },
  {
    key: 'vouchersMonth',
    label: 'Vouchers (MTD)',
    format: (v) => v.toLocaleString(),
    higherIsBetter: true,
  },
];

function netIncome(kpis: KPIs): number {
  return kpis.revenue - kpis.expenses;
}

function MetricSection({
  metric,
  snapshots,
}: {
  metric: MetricDef;
  snapshots: CompanySnapshot[];
}) {
  const loaded = snapshots.filter((s) => !s.loading && !s.error);
  if (loaded.length === 0) return null;

  const values = loaded.map((s) => ({
    name: s.company.name,
    value: s.kpis[metric.key] as number,
  }));
  const maxVal = Math.max(...values.map((v) => Math.abs(v.value)), 1);

  // Sort: best performers first
  const sorted = [...values].sort((a, b) =>
    metric.higherIsBetter ? b.value - a.value : a.value - b.value
  );

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{metric.label}</Text>
      {sorted.map((item, idx) => {
        const pct = Math.abs(item.value) / maxVal;
        const isTop = idx === 0;
        return (
          <View key={item.name} style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <Text style={styles.rankNum}>{idx + 1}</Text>
              <View style={styles.metricInfo}>
                <Text style={styles.companyName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(2, pct * 100)}%` as any }, isTop && styles.barFillTop]} />
                </View>
              </View>
            </View>
            <Text style={[styles.metricValue, isTop && styles.metricValueTop]}>
              {metric.format(item.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function NetIncomeSection({ snapshots }: { snapshots: CompanySnapshot[] }) {
  const loaded = snapshots.filter((s) => !s.loading && !s.error);
  if (loaded.length === 0) return null;

  const values = loaded.map((s) => ({
    name: s.company.name,
    value: netIncome(s.kpis),
  }));
  const maxAbsVal = Math.max(...values.map((v) => Math.abs(v.value)), 1);
  const sorted = [...values].sort((a, b) => b.value - a.value);

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>Net Income (MTD)</Text>
      {sorted.map((item, idx) => {
        const pct = Math.abs(item.value) / maxAbsVal;
        const isTop = idx === 0;
        const isNeg = item.value < 0;
        return (
          <View key={item.name} style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <Text style={styles.rankNum}>{idx + 1}</Text>
              <View style={styles.metricInfo}>
                <Text style={styles.companyName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(2, pct * 100)}%` as any },
                      isTop && !isNeg && styles.barFillTop,
                      isNeg && styles.barFillNeg,
                    ]}
                  />
                </View>
              </View>
            </View>
            <Text style={[styles.metricValue, isTop && !isNeg && styles.metricValueTop]}>
              {formatCurrency(item.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function WorkingCapitalSection({ snapshots }: { snapshots: CompanySnapshot[] }) {
  const loaded = snapshots.filter((s) => !s.loading && !s.error);
  if (loaded.length === 0) return null;

  const values = loaded.map((s) => ({
    name: s.company.name,
    value: s.kpis.totalAR - s.kpis.totalAP,
  }));
  const maxAbsVal = Math.max(...values.map((v) => Math.abs(v.value)), 1);
  const sorted = [...values].sort((a, b) => b.value - a.value);

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>Working Capital (AR − AP)</Text>
      {sorted.map((item, idx) => {
        const pct = Math.abs(item.value) / maxAbsVal;
        const isTop = idx === 0;
        const isNeg = item.value < 0;
        return (
          <View key={item.name} style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <Text style={styles.rankNum}>{idx + 1}</Text>
              <View style={styles.metricInfo}>
                <Text style={styles.companyName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(2, pct * 100)}%` as any },
                      isTop && !isNeg && styles.barFillTop,
                      isNeg && styles.barFillNeg,
                    ]}
                  />
                </View>
              </View>
            </View>
            <Text style={[styles.metricValue, isTop && !isNeg && styles.metricValueTop]}>
              {formatCurrency(item.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SummaryRow({ snapshots }: { snapshots: CompanySnapshot[] }) {
  const loaded = snapshots.filter((s) => !s.loading && !s.error);
  const loading = snapshots.filter((s) => s.loading).length;
  const failed = snapshots.filter((s) => s.error).length;

  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryTile}>
        <Text style={styles.summaryValue}>{snapshots.length}</Text>
        <Text style={styles.summaryLabel}>Companies</Text>
      </View>
      <View style={styles.summaryTile}>
        <Text style={styles.summaryValue}>{loaded.length}</Text>
        <Text style={styles.summaryLabel}>Loaded</Text>
      </View>
      {loading > 0 && (
        <View style={styles.summaryTile}>
          <Text style={styles.summaryValue}>{loading}</Text>
          <Text style={styles.summaryLabel}>Loading</Text>
        </View>
      )}
      {failed > 0 && (
        <View style={styles.summaryTile}>
          <Text style={styles.summaryValue}>{failed}</Text>
          <Text style={styles.summaryLabel}>Failed</Text>
        </View>
      )}
    </View>
  );
}

export default function ComparisonScreen() {
  const navigation = useNavigation();
  const { companies } = useCompany();
  const [snapshots, setSnapshots] = useState<CompanySnapshot[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const initSnapshots = useCallback((force = false) => {
    const initial: CompanySnapshot[] = companies.map((c) => ({
      company: c,
      kpis: {
        revenue: 0,
        expenses: 0,
        cash: 0,
        vouchersMonth: 0,
        vouchersToday: 0,
        totalAR: 0,
        totalAP: 0,
      },
      loading: true,
      error: false,
    }));
    if (!force) setSnapshots(initial);

    companies.forEach((company) => {
      fetchDashboardData(company.id)
        .then((data) => {
          setSnapshots((prev) =>
            prev.map((s) =>
              s.company.id === company.id
                ? { ...s, kpis: data.kpis, loading: false, error: false }
                : s
            )
          );
        })
        .catch(() => {
          setSnapshots((prev) =>
            prev.map((s) =>
              s.company.id === company.id
                ? { ...s, loading: false, error: true }
                : s
            )
          );
        });
    });

    return initial;
  }, [companies]);

  useEffect(() => {
    const initial = initSnapshots();
    setSnapshots(initial);
  }, [initSnapshots]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const refreshed: CompanySnapshot[] = companies.map((c) => ({
      company: c,
      kpis: snapshots.find((s) => s.company.id === c.id)?.kpis ?? {
        revenue: 0, expenses: 0, cash: 0, vouchersMonth: 0, vouchersToday: 0, totalAR: 0, totalAP: 0,
      },
      loading: true,
      error: false,
    }));
    setSnapshots(refreshed);

    await Promise.all(
      companies.map((company) =>
        fetchDashboardData(company.id)
          .then((data) => {
            setSnapshots((prev) =>
              prev.map((s) =>
                s.company.id === company.id
                  ? { ...s, kpis: data.kpis, loading: false, error: false }
                  : s
              )
            );
          })
          .catch(() => {
            setSnapshots((prev) =>
              prev.map((s) =>
                s.company.id === company.id
                  ? { ...s, loading: false, error: true }
                  : s
              )
            );
          })
      )
    );
    setRefreshing(false);
  }, [companies, snapshots]);

  const allLoading = snapshots.length > 0 && snapshots.every((s) => s.loading);
  const hasLoaded = snapshots.some((s) => !s.loading && !s.error);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportComparisonPDF(snapshots);
    } finally {
      setExporting(false);
    }
  }, [snapshots]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Company Comparison</Text>
          <Text style={styles.headerSub}>Side-by-side KPI ranking</Text>
        </View>
        {allLoading && (
          <ActivityIndicator size="small" color={Colors.textMuted} />
        )}
        {!allLoading && hasLoaded && (
          exporting ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : (
            <TouchableOpacity
              onPress={handleExport}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.exportBtn}
            >
              <Feather name="file-text" size={18} color={Colors.text} />
            </TouchableOpacity>
          )
        )}
      </View>

      {companies.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="briefcase" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No companies found</Text>
          <Text style={styles.emptyText}>Add companies to your account to compare KPIs.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.textMuted}
            />
          }
        >
          {/* Company chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {snapshots.map((s) => (
              <View key={s.company.id} style={[styles.companyChip, s.loading && styles.companyChipLoading]}>
                {s.loading ? (
                  <ActivityIndicator size="small" color={Colors.textMuted} />
                ) : s.error ? (
                  <Feather name="alert-circle" size={12} color={Colors.textMuted} />
                ) : (
                  <View style={styles.companyDot} />
                )}
                <Text style={styles.companyChipText} numberOfLines={1}>{s.company.name}</Text>
              </View>
            ))}
          </ScrollView>

          <SummaryRow snapshots={snapshots} />

          <NetIncomeSection snapshots={snapshots} />
          {METRICS.map((m) => (
            <MetricSection key={m.key} metric={m} snapshots={snapshots} />
          ))}
          <WorkingCapitalSection snapshots={snapshots} />

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
  backBtn: { padding: 2 },
  exportBtn: { padding: 2 },
  headerText: { flex: 1 },
  headerTitle: { ...Typography.h3 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md },

  chipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  companyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  companyChipLoading: { opacity: 0.6 },
  companyDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.text,
  },
  companyChipText: { fontSize: 12, fontWeight: '600', color: Colors.text, maxWidth: 130 },

  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: { ...Typography.h1 },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rankNum: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    width: 16,
    textAlign: 'center',
  },
  metricLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricInfo: { flex: 1, gap: 4 },
  companyName: { fontSize: 13, fontWeight: '600', color: Colors.text },

  barTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.textSecondary,
    borderRadius: Radius.full,
  },
  barFillTop: { backgroundColor: Colors.text },
  barFillNeg: { backgroundColor: Colors.textMuted },

  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    minWidth: 90,
    textAlign: 'right',
  },
  metricValueTop: { color: Colors.text, fontWeight: '700' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyTitle: { ...Typography.h4, color: Colors.textSecondary },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
