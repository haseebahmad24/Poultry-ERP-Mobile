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
import { fetchMaterials, fetchMaterialTypes, Material, MaterialType } from '@/api/materials';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Active:   { bg: Colors.successBg,  fg: Colors.success },
  active:   { bg: Colors.successBg,  fg: Colors.success },
  ACTIVE:   { bg: Colors.successBg,  fg: Colors.success },
  Inactive: { bg: Colors.dangerBg,   fg: Colors.danger },
  inactive: { bg: Colors.dangerBg,   fg: Colors.danger },
  INACTIVE: { bg: Colors.dangerBg,   fg: Colors.danger },
  Pending:  { bg: Colors.warningBg,  fg: Colors.warning },
  Draft:    { bg: Colors.warningBg,  fg: Colors.warning },
};

export default function MaterialsScreen() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [types, setTypes] = useState<MaterialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [mats, typs] = await Promise.all([
        fetchMaterials({ typeId: selectedType ?? undefined }),
        fetchMaterialTypes(),
      ]);
      setMaterials(mats);
      setTypes(typs);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedType]);

  useEffect(() => { load(); }, [load]);

  const filtered = materials.filter((m) => {
    const q = search.toLowerCase();
    return (
      !q ||
      m.name?.toLowerCase().includes(q) ||
      m.code?.toLowerCase().includes(q) ||
      m.type?.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingView message="Loading materials…" />;
  if (error && materials.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Materials</Text>
        <Text style={styles.headerSub}>{filtered.length} items</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, code, type…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Type Filter Chips */}
      {types.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContainer}
        >
          <TouchableOpacity
            style={[styles.chip, selectedType === null && styles.chipActive]}
            onPress={() => setSelectedType(null)}
          >
            <Text style={[styles.chipText, selectedType === null && styles.chipTextActive]}>
              All Types
            </Text>
          </TouchableOpacity>
          {types.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, selectedType === t.id && styles.chipActive]}
              onPress={() => setSelectedType(selectedType === t.id ? null : t.id)}
            >
              <Text style={[styles.chipText, selectedType === t.id && styles.chipTextActive]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

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
        <SectionHeader title="Material Master" meta={`${filtered.length} records`} />

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔬</Text>
            <Text style={styles.emptyText}>
              {search ? 'No materials match your search' : 'No materials found'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {filtered.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MaterialCard({ material: m }: { material: Material }) {
  const statusColors = STATUS_COLORS[m.status ?? ''] ?? {
    bg: Colors.borderLight,
    fg: Colors.textMuted,
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={2}>{m.name}</Text>
          {m.code && <Text style={styles.cardCode}>{m.code}</Text>}
        </View>
        {m.status && (
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.fg }]}>
              {m.status}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardMeta}>
        {m.type && (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{m.type}</Text>
          </View>
        )}
        {m.category && (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{m.category}</Text>
          </View>
        )}
        {m.unit && (
          <View style={[styles.metaChip, styles.unitChip]}>
            <Text style={[styles.metaChipText, styles.unitChipText]}>{m.unit}</Text>
          </View>
        )}
      </View>

      {m.description && (
        <Text style={styles.cardDesc} numberOfLines={2}>{m.description}</Text>
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

  chipScroll: { backgroundColor: Colors.surface, maxHeight: 50 },
  chipContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
  },

  card: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.xs + 2,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardInfo: { flex: 1 },
  cardName: { ...Typography.h4 },
  cardCode: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  metaChip: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  unitChip: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primaryLight,
  },
  unitChipText: { color: Colors.primaryDark },

  cardDesc: { ...Typography.bodySmall, color: Colors.textSecondary },

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
