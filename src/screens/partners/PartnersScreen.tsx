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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchPartners, Partner } from '@/api/partners';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import CompanySelector from '@/components/CompanySelector';
import BackButton from '@/components/BackButton';
import OfflineBanner from '@/components/OfflineBanner';
import { useCompany } from '@/context/CompanyContext';
import { getCached, setCached } from '@/utils/cache';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'Partners'>;
type RoleFilter = 'all' | 'customer' | 'vendor';

export default function PartnersScreen() {
  const navigation = useNavigation<Nav>();
  const { companyId } = useCompany();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const cacheKey = `partners:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<Partner[]>(cacheKey);
      if (cached) {
        setPartners(cached.data);
        setIsStale(cached.stale);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else if (partners.length === 0) setLoading(true);
    setError(null);
    try {
      const data = await fetchPartners(companyId);
      setPartners(data);
      setIsStale(false);
      await setCached(cacheKey, data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, cacheKey]);

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
        <BackButton />
        <Text style={styles.headerTitle}>Business Partners</Text>
        <Text style={styles.headerSub}>{filtered.length} records</Text>
      </View>

      <OfflineBanner visible={!!(isStale && error)} />

      <CompanySelector showAll />

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Feather name="search" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, code, email…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.textMuted} />
        }
      >
        <SectionHeader title="Partners" meta={`${filtered.length} records`} />

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {search || roleFilter !== 'all' ? 'No partners match your filter' : 'No partners found'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {filtered.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
                onPress={() => {
                  const isVendor = !!(p.is_vendor || p.type === 'vendor' || p.roles?.includes('vendor'));
                  const isCustomer = !!(p.is_customer || p.type === 'customer' || p.roles?.includes('customer'));
                  navigation.navigate('PartnerDetail', {
                    partnerId: p.id,
                    partnerName: p.name,
                    isVendor,
                    isCustomer: isCustomer || (!isVendor && !isCustomer),
                  });
                }}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PartnerCard({ partner: p, onPress }: { partner: Partner; onPress: () => void }) {
  const roles: string[] = [];
  if (p.is_customer || p.type === 'customer' || p.roles?.includes('customer')) roles.push('Customer');
  if (p.is_vendor || p.type === 'vendor' || p.roles?.includes('vendor')) roles.push('Vendor');
  if (roles.length === 0 && p.type) roles.push(p.type);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
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
            <View key={role} style={styles.roleBadge}>
              <Text style={styles.roleText}>{role}</Text>
            </View>
          ))}
        </View>
      </View>

      {(p.email || p.phone) && (
        <View style={styles.contactRow}>
          {p.email && (
            <View style={styles.contactItem}>
              <Feather name="mail" size={11} color={Colors.textMuted} />
              <Text style={styles.contactText}>{p.email}</Text>
            </View>
          )}
          {p.phone && (
            <View style={styles.contactItem}>
              <Feather name="phone" size={11} color={Colors.textMuted} />
              <Text style={styles.contactText}>{p.phone}</Text>
            </View>
          )}
        </View>
      )}

      {p.company && (
        <View style={styles.contactItem}>
          <Feather name="briefcase" size={11} color={Colors.textMuted} />
          <Text style={styles.contactText}>{p.company}</Text>
        </View>
      )}

      <View style={styles.cardChevron}>
        <Feather name="chevron-right" size={13} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
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

  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, padding: 0 },

  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  filterChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  card: {
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceHover,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.text },

  cardInfo: { flex: 1 },
  cardName: { ...Typography.h4 },
  cardCode: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },

  rolesColumn: { gap: 4 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  roleText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },

  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contactText: { fontSize: 12, color: Colors.textSecondary },

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
  emptyText: { ...Typography.body, color: Colors.textMuted },

  cardChevron: { alignItems: 'flex-end' },
});
