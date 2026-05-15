import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { fetchCompanies, CompanyDetail } from '@/api/companies';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';

export default function CompaniesScreen() {
  const [companies, setCompanies] = useState<CompanyDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView message="Loading companies…" />;
  if (error && companies.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Companies</Text>
        <Text style={styles.headerSub}>{companies.length} companies</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
        }
      >
        <SectionHeader title="Company List" meta={`${companies.length} records`} />

        {companies.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏢</Text>
            <Text style={styles.emptyText}>No companies found</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CompanyCard({ company: c }: { company: CompanyDetail }) {
  const initial = c.name?.charAt(0).toUpperCase() ?? '?';
  const isActive = c.is_active !== false;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.logoCircle, !isActive && styles.logoCircleInactive]}>
          <Text style={[styles.logoText, !isActive && styles.logoTextInactive]}>{initial}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.companyName}>{c.name}</Text>
          {c.code && <Text style={styles.companyCode}>{c.code}</Text>}
        </View>
        <View style={[
          styles.statusBadge,
          isActive ? styles.statusActive : styles.statusInactive,
        ]}>
          <Text style={[
            styles.statusText,
            isActive ? styles.statusTextActive : styles.statusTextInactive,
          ]}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        {c.currency && (
          <DetailItem label="Currency" value={c.currency} />
        )}
        {c.fiscal_year_start && c.fiscal_year_end && (
          <DetailItem
            label="Fiscal Year"
            value={`${c.fiscal_year_start} – ${c.fiscal_year_end}`}
          />
        )}
        {c.phone && <DetailItem label="Phone" value={c.phone} />}
        {c.email && <DetailItem label="Email" value={c.email} />}
        {c.address && <DetailItem label="Address" value={c.address} />}
      </View>
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircleInactive: { backgroundColor: Colors.borderLight },
  logoText: { fontSize: 20, fontWeight: '700', color: Colors.primary },
  logoTextInactive: { color: Colors.textMuted },

  cardInfo: { flex: 1 },
  companyName: { ...Typography.h3 },
  companyCode: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  statusActive: { backgroundColor: Colors.successBg },
  statusInactive: { backgroundColor: Colors.dangerBg },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextActive: { color: Colors.success },
  statusTextInactive: { color: Colors.danger },

  detailsGrid: {
    gap: Spacing.xs + 2,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  detailItem: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  detailLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, width: 90 },
  detailValue: { flex: 1, fontSize: 13, color: Colors.text },

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
