import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { fetchMaterials, fetchMaterialTypes, Material, MaterialType } from '@/api/materials';
import ErrorView from '@/components/ErrorView';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import SectionHeader from '@/components/SectionHeader';
import CompanySelector from '@/components/CompanySelector';
import BackButton from '@/components/BackButton';
import OfflineBanner from '@/components/OfflineBanner';
import { useCompany } from '@/context/CompanyContext';
import { getCached, setCached } from '@/utils/cache';
import { exportMaterialsListPDF } from '@/utils/pdfExport';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

export default function MaterialsScreen() {
  const navigation = useNavigation<Nav>();
  const { companyId, selectedCompany } = useCompany();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [types, setTypes] = useState<MaterialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [sort, setSort] = useState<'name' | 'code' | 'type'>('name');
  const [exporting, setExporting] = useState(false);

  const cacheKey = `materials:${companyId ?? 'all'}:${selectedType ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<{ materials: Material[]; types: MaterialType[] }>(cacheKey);
      if (cached) {
        setMaterials(cached.data.materials);
        setTypes(cached.data.types);
        setStale(cached.stale);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [mats, typs] = await Promise.all([
        fetchMaterials({ companyId, typeId: selectedType ?? undefined }),
        fetchMaterialTypes(),
      ]);
      setMaterials(mats);
      setTypes(typs);
      setStale(false);
      await setCached(cacheKey, { materials: mats, types: typs });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedType, companyId, cacheKey]);

  useEffect(() => { load(); }, [load]);

  const filtered = materials
    .filter((m) => {
      const q = search.toLowerCase();
      return (
        !q ||
        m.name?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q) ||
        m.type?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sort === 'code') return (a.code ?? '').localeCompare(b.code ?? '');
      if (sort === 'type') return (a.type ?? '').localeCompare(b.type ?? '') || (a.name ?? '').localeCompare(b.name ?? '');
      return (a.name ?? '').localeCompare(b.name ?? '');
    });

  const handleExport = async () => {
    setExporting(true);
    try {
      const typeLabel = types.find((t) => t.id === selectedType)?.name;
      const filterLabel = [typeLabel, search ? `"${search}"` : null].filter(Boolean).join(' · ') || undefined;
      await exportMaterialsListPDF({
        materials: filtered,
        companyName: selectedCompany?.name ?? 'All Companies',
        filterLabel,
      });
    } finally {
      setExporting(false);
    }
  };

  if (error && materials.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Materials</Text>
        {!loading && <Text style={styles.headerSub}>{filtered.length} items</Text>}
        {!loading && filtered.length > 0 && (
          <>
            <TouchableOpacity
              onPress={() => setSort((s) => s === 'name' ? 'code' : s === 'code' ? 'type' : 'name')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.sortBtn}
            >
              <Feather name="sliders" size={15} color={Colors.textSecondary} />
              <Text style={styles.sortBtnText}>
                {sort === 'name' ? 'A–Z' : sort === 'code' ? 'Code' : 'Type'}
              </Text>
            </TouchableOpacity>
            {exporting ? (
              <ActivityIndicator size="small" color={Colors.textMuted} />
            ) : (
              <TouchableOpacity
                onPress={handleExport}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="file-text" size={18} color={Colors.text} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <CompanySelector showAll />
      <OfflineBanner visible={!!(stale && error)} />

      {loading ? (
        <ListScreenSkeleton count={7} showTabs={false} showSearch />
      ) : (
        <>
          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
              <Feather name="search" size={15} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, code, type…"
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={Colors.textMuted}
              />
            }
          >
            <SectionHeader title="Material Master" meta={`${filtered.length} records`} />

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="grid" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {search ? 'No materials match your search' : 'No materials found'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {filtered.map((m) => (
                  <MaterialCard key={m.id} material={m} onPress={() =>
                    navigation.navigate('MaterialDetail', {
                      materialId: m.id,
                      materialName: m.name,
                      materialCode: m.code,
                      materialType: m.type,
                      materialUnit: m.unit,
                      materialCategory: m.category,
                      materialStatus: m.status,
                      materialDescription: m.description,
                    })
                  } />
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

function MaterialCard({ material: m, onPress }: { material: Material; onPress: () => void }) {
  const statusKey = (m.status ?? '').toLowerCase();
  const isMuted = statusKey === 'inactive';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={2}>{m.name}</Text>
          {m.code && <Text style={styles.cardCode}>{m.code}</Text>}
        </View>
        {m.status && (
          <View style={[styles.statusBadge, isMuted && styles.statusBadgeMuted]}>
            <Text style={styles.statusText}>{m.status}</Text>
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
            <Text style={styles.metaChipText}>{m.unit}</Text>
          </View>
        )}
      </View>

      {m.description && (
        <Text style={styles.cardDesc} numberOfLines={2}>{m.description}</Text>
      )}

      <View style={styles.cardChevron}>
        <Feather name="chevron-right" size={14} color={Colors.textMuted} />
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
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  sortBtnText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

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

  chipScroll: { backgroundColor: Colors.surface, maxHeight: 50 },
  chipContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.surface, fontWeight: '600' },

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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.xs + 2,
  },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardInfo: { flex: 1 },
  cardName: { ...Typography.h4 },
  cardCode: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeMuted: { opacity: 0.5 },
  statusText: { fontSize: 11, fontWeight: '600', color: Colors.text },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  metaChip: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  metaChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  unitChip: { backgroundColor: Colors.surfaceHover },

  cardDesc: { ...Typography.bodySmall, color: Colors.textSecondary },

  cardChevron: { alignItems: 'flex-end', marginTop: -2 },

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
});
