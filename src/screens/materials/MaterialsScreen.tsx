import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { fetchMaterials, fetchMaterialTypes, Material, MaterialType } from '@/api/materials';
import ErrorView from '@/components/ErrorView';
import LoadingView from '@/components/LoadingView';
import { Colors, Radius, Shadow, Spacing } from '@/theme';

const STATUS_FILTERS = ['All', 'Active', 'Inactive'];

export default function MaterialsScreen({ navigation }: any) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [types, setTypes] = useState<MaterialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [mats, tps] = await Promise.all([fetchMaterials(), fetchMaterialTypes()]);
      setMaterials(mats);
      setTypes(tps);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return materials.filter((m) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        m.name?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q) ||
        m.type_name?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q);

      const matchesType = selectedTypeId == null || m.type_id === selectedTypeId;

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && (m.status === 'active' || m.status === 'Active' || m.status === '1' || m.status == null)) ||
        (statusFilter === 'Inactive' && (m.status === 'inactive' || m.status === 'Inactive' || m.status === '0'));

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [materials, search, selectedTypeId, statusFilter]);

  if (loading) return <LoadingView message="Loading materials…" />;
  if (error) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Materials</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Search */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, code, type…"
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Status filter */}
            <View style={styles.filterRow}>
              {STATUS_FILTERS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                  onPress={() => setStatusFilter(s)}
                >
                  <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Type filter horizontal scroll */}
            {types.length > 0 && (
              <View>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typeFilterRow}
                  data={[{ id: null as any, name: 'All Types' }, ...types]}
                  keyExtractor={(item) => String(item.id ?? 'all')}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.typeChip,
                        (item.id == null ? selectedTypeId == null : selectedTypeId === item.id) &&
                          styles.typeChipActive,
                      ]}
                      onPress={() => setSelectedTypeId(item.id ?? null)}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          (item.id == null ? selectedTypeId == null : selectedTypeId === item.id) &&
                            styles.typeChipTextActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Count */}
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {filtered.length} material{filtered.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🧪</Text>
                <Text style={styles.emptyText}>No materials match your filters</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => <MaterialRow material={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function MaterialRow({ material }: { material: Material }) {
  const isActive =
    material.status == null ||
    material.status === 'active' ||
    material.status === 'Active' ||
    material.status === '1';

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🧪</Text>
        </View>
        <View style={styles.matInfo}>
          <Text style={styles.matName} numberOfLines={1}>{material.name}</Text>
          <View style={styles.matMeta}>
            {material.code ? (
              <Text style={styles.matCode}>{material.code}</Text>
            ) : null}
            {material.unit ? (
              <Text style={styles.matUnit}> · {material.unit}</Text>
            ) : null}
          </View>
          {material.type_name ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{material.type_name}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.success : Colors.textMuted }]} />
        <Text style={[styles.statusText, { color: isActive ? Colors.success : Colors.textMuted }]}>
          {isActive ? 'Active' : 'Inactive'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 32, color: '#fff', lineHeight: 36, fontWeight: '300' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  searchRow: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff' },

  typeFilterRow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  typeChipText: { fontSize: 12, color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.primary, fontWeight: '600' },

  countRow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 4,
  },
  countText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },

  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: 8,
    alignItems: 'center',
    ...Shadow.subtle,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { fontSize: 18 },
  matInfo: { flex: 1 },
  matName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  matMeta: { flexDirection: 'row', marginTop: 2 },
  matCode: { fontSize: 11, color: Colors.textMuted },
  matUnit: { fontSize: 11, color: Colors.textMuted },
  typeBadge: {
    backgroundColor: Colors.primaryBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  typeBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.primary },

  cardRight: { alignItems: 'center', gap: 3 },
  statusDot: { width: 7, height: 7, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '500' },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
