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
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { fetchPartners, Partner } from '@/api/partners';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import CompanyPicker from '@/components/CompanyPicker';
import { useCompany } from '@/context/CompanyContext';
import BackButton from '@/components/BackButton';

type RoleFilter = 'all' | 'customer' | 'vendor';

export default function PartnersScreen() {
  const { companyId } = useCompany();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchPartners(companyId);
      setPartners(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const filtered = partners.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q);

    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'customer' && (p.is_customer || p.type === 'customer' || p.roles?.includes('customer'))) ||
      (roleFilter === 'vendor' && (p.is_vendor || p.type === 'vendor' || p.roles?.includes('vendor')));

    return matchesSearch && matchesRole;
  });

  if (loading) return <LoadingView message="Loading partners…" />;
  if (error && partners.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton color={Colors.primary} />
        <Text style={styles.headerTitle}>Business Partners</Text>
        <Text style={styles.headerSub}>{filtered.length} records</Text>
      </View>

      <CompanyPicker showAll />

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, code, email…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Role filter */}
      <View style={styles.filterBar}>
        {(['all', 'customer', 'vendor'] as RoleFilter[]).map((role) => (
          <TouchableOpacity
            key={role}
            style={[styles.filterChip, roleFilter === role && styles.filterChipActive]}
            onPress={() => setRoleFilter(role)}
          >
            <Text style={[styles.filterChipText, roleFilter === role && styles.filterChipTextActive]}>
              {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1) + 's'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
        }
      >
        <SectionHeader title="Partners" meta={`${filtered.length} records`} />

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={styles.emptyText}>
              {search || roleFilter !== 'all' ? 'No partners match your filter' : 'No partners found'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {filtered.map((p) => (
              <PartnerCard key={p.id} partner={p} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PartnerCard({ partner: p }: { partner: Partner }) {
  const roles: string[] = [];
  if (p.is_customer || p.type === 'customer' || p.roles?.includes('customer')) roles.push('Customer');
  if (p.is_vendor || p.type === 'vendor' || p.roles?.includes('vendor')) roles.push('Vendor');
  if (roles.length === 0 && p.type) roles.push(p.type);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {p.name?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{p.name}</Text>
          {p.code && <Text style={styles.cardCode}>{p.code}</Text>}
        </View>
        <View style={styles.rolesColumn}>
          {roles.map((role) => (
            <View
              key={role}
              style={[
                styles.roleBadge,
                role === 'Customer' && styles.roleBadgeCustomer,
                role === 'Vendor' && styles.roleBadgeVendor,
              ]}
            >
              <Text style={[
                styles.roleText,
                role === 'Customer' && styles.roleTextCustomer,
                role === 'Vendor' && styles.roleTextVendor,
              ]}>
                {role}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {(p.email || p.phone) && (
        <View style={styles.contactRow}>
          {p.email && <Text style={styles.contactText}>✉️ {p.email}</Text>}
          {p.phone && <Text style={styles.contactText}>📞 {p.phone}</Text>}
        </View>
      )}

      {p.company && (
        <Text style={styles.companyText}>🏢 {p.company}</Text>
      )}
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

  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
  },

  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.primary, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.primary },

  cardInfo: { flex: 1 },
  cardName: { ...Typography.h4 },
  cardCode: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },

  rolesColumn: { gap: 4 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderLight,
  },
  roleBadgeCustomer: { backgroundColor: Colors.successBg },
  roleBadgeVendor: { backgroundColor: Colors.primaryBg },
  roleText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  roleTextCustomer: { color: Colors.success },
  roleTextVendor: { color: Colors.primary },

  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  contactText: { fontSize: 12, color: Colors.textSecondary },
  companyText: { fontSize: 12, color: Colors.textMuted },

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
