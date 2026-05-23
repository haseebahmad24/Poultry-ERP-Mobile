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
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchCompanies, CompanyDetail } from '@/api/companies';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import OfflineBanner from '@/components/OfflineBanner';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import { getCached, setCached } from '@/utils/cache';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function CompaniesScreen() {
  const [companies, setCompanies] = useState<CompanyDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<CompanyDetail[]>('companies:all');
      if (cached) {
        setCompanies(cached.data);
        setStale(cached.stale);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
      setStale(false);
      await setCached('companies:all', data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && companies.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  const q = search.toLowerCase().trim();
  const filtered = companies.filter((c) => {
    if (statusFilter === 'active' && c.is_active === false) return false;
    if (statusFilter === 'inactive' && c.is_active !== false) return false;
    if (!q) return true;
    return (
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.currency?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const activeCount = companies.filter((c) => c.is_active !== false).length;
  const inactiveCount = companies.filter((c) => c.is_active === false).length;

  const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: `All (${companies.length})` },
    { key: 'active', label: `Active (${activeCount})` },
    { key: 'inactive', label: `Inactive (${inactiveCount})` },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Companies</Text>
        {!loading && <Text style={styles.headerSub}>{filtered.length} of {companies.length}</Text>}
      </View>

      <OfflineBanner visible={!!(stale && error)} />

      {loading ? (
        <ListScreenSkeleton count={5} showTabs={false} showSearch />
      ) : (
      <>
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Feather name="search" size={14} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, code, currency…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        {STATUS_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.chip, statusFilter === chip.key && styles.chipActive]}
            onPress={() => setStatusFilter(chip.key)}
          >
            <Text style={[styles.chipText, statusFilter === chip.key && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.textMuted} />
        }
      >
        <SectionHeader title="Company List" meta={`${filtered.length} records`} />

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="briefcase" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {q || statusFilter !== 'all' ? 'No companies match your filter' : 'No companies found'}
            </Text>
            {(q || statusFilter !== 'all') && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => { setSearch(''); setStatusFilter('all'); }}
              >
                <Text style={styles.clearBtnText}>Clear filter</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.cardList}>
            {filtered.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      </>
      )}
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
        <View style={[styles.statusBadge, !isActive && styles.statusBadgeInactive]}>
          <Text style={styles.statusText}>{isActive ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        {c.currency && <DetailItem label="Currency" value={c.currency} />}
        {c.fiscal_year_start && c.fiscal_year_end && (
          <DetailItem label="Fiscal Year" value={`${c.fiscal_year_start} – ${c.fiscal_year_end}`} />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  searchRow: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 0,
  },

  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 0,
  },

  card: {
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHover,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircleInactive: { opacity: 0.5 },
  logoText: { fontSize: 20, fontWeight: '700', color: Colors.text },
  logoTextInactive: { color: Colors.textMuted },

  cardInfo: { flex: 1 },
  companyName: { ...Typography.h3 },
  companyCode: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeInactive: { opacity: 0.5 },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.text },

  detailsGrid: {
    gap: Spacing.xs + 2,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  detailItem: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  detailLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, width: 90 },
  detailValue: { flex: 1, fontSize: 13, color: Colors.text },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  clearBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  clearBtnText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
});
