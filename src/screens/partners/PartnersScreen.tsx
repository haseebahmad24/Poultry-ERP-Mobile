import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import SectionHeader from '@/components/SectionHeader';
import CompanySelector from '@/components/CompanySelector';
import BackButton from '@/components/BackButton';
import OfflineBanner from '@/components/OfflineBanner';
import { useCompany } from '@/context/CompanyContext';
import { getCached, setCached } from '@/utils/cache';
import { exportPartnersListPDF } from '@/utils/pdfExport';
import { getNote, saveNote } from '@/utils/partnerNotes';
import { exportPartnerNotesCSV } from '@/utils/csvExport';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'Partners'>;
type RoleFilter = 'all' | 'customer' | 'vendor';

export default function PartnersScreen() {
  const navigation = useNavigation<Nav>();
  const { companyId, selectedCompany } = useCompany();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [exporting, setExporting] = useState(false);
  const [exportingNotes, setExportingNotes] = useState(false);
  const [partnerNotesMap, setPartnerNotesMap] = useState<Record<number, string>>({});
  const [noteModal, setNoteModal] = useState<{ id: number; name: string; noteType: 'vendor' | 'customer' } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [showNotesOnly, setShowNotesOnly] = useState(false);

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

  // Load notes for all partners (to show dot indicators)
  useEffect(() => {
    if (partners.length === 0) return;
    async function loadAllNotes() {
      const entries = await Promise.all(
        partners.map(async (p) => {
          const noteType = (p.is_vendor || p.type === 'vendor' || p.roles?.includes('vendor')) ? 'vendor' : 'customer';
          const note = await getNote(noteType, p.id);
          return [p.id, note] as [number, string];
        })
      );
      const map: Record<number, string> = {};
      for (const [id, note] of entries) {
        if (note) map[id] = note;
      }
      setPartnerNotesMap(map);
    }
    loadAllNotes();
  }, [partners]);

  const openNoteModal = async (p: Partner) => {
    const noteType = (p.is_vendor || p.type === 'vendor' || p.roles?.includes('vendor')) ? 'vendor' : 'customer';
    const existing = await getNote(noteType, p.id);
    setNoteText(existing);
    setNoteModal({ id: p.id, name: p.name ?? `Partner ${p.id}`, noteType });
  };

  const savePartnerNote = async () => {
    if (!noteModal) return;
    setNoteSaving(true);
    await saveNote(noteModal.noteType, noteModal.id, noteText);
    setPartnerNotesMap((prev) => ({
      ...prev,
      ...(noteText.trim() ? { [noteModal.id]: noteText } : Object.fromEntries(
        Object.entries(prev).filter(([k]) => Number(k) !== noteModal.id)
      )),
    }));
    setNoteSaving(false);
    setNoteModal(null);
  };

  const notesPartnersCount = partners.filter((p) => !!partnerNotesMap[p.id]).length;

  const filtered = partners.filter((p) => {
    const q = search.toLowerCase();
    const noteContent = (partnerNotesMap[p.id] ?? '').toLowerCase();
    const matchesSearch = !q ||
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      noteContent.includes(q);

    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'customer' && (p.is_customer || p.type === 'customer' || p.roles?.includes('customer'))) ||
      (roleFilter === 'vendor' && (p.is_vendor || p.type === 'vendor' || p.roles?.includes('vendor')));

    const matchesNotesFilter = !showNotesOnly || !!partnerNotesMap[p.id];

    return matchesSearch && matchesRole && matchesNotesFilter;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const roleLabel = roleFilter !== 'all' ? (roleFilter === 'customer' ? 'Customers' : 'Vendors') : undefined;
      const filterLabel = [roleLabel, search ? `"${search}"` : null].filter(Boolean).join(' · ') || undefined;
      await exportPartnersListPDF({
        partners: filtered,
        companyName: selectedCompany?.name ?? 'All Companies',
        filterLabel,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportNotes = async () => {
    setExportingNotes(true);
    try {
      const noteEntries = partners
        .filter((p) => !!partnerNotesMap[p.id])
        .map((p) => {
          const isVendor = !!(p.is_vendor || p.type === 'vendor' || p.roles?.includes('vendor'));
          const isCustomer = !!(p.is_customer || p.type === 'customer' || p.roles?.includes('customer'));
          const role = isVendor && isCustomer ? 'Vendor / Customer' : isVendor ? 'Vendor' : 'Customer';
          return { id: p.id, name: p.name ?? '', code: p.code, role, note: partnerNotesMap[p.id] };
        });
      await exportPartnerNotesCSV({ notes: noteEntries, companyName: selectedCompany?.name });
    } finally {
      setExportingNotes(false);
    }
  };

  if (error && partners.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Business Partners</Text>
        {!loading && <Text style={styles.headerSub}>{filtered.length} records</Text>}
        {!loading && notesPartnersCount > 0 && (
          exportingNotes ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : (
            <TouchableOpacity
              onPress={handleExportNotes}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerNotesCsvBtn}
            >
              <Feather name="download" size={13} color={Colors.textSecondary} />
              <Text style={styles.headerNotesCsvText}>Notes</Text>
            </TouchableOpacity>
          )
        )}
        {!loading && filtered.length > 0 && (
          exporting ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : (
            <TouchableOpacity
              onPress={handleExport}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="file-text" size={18} color={Colors.text} />
            </TouchableOpacity>
          )
        )}
      </View>

      <OfflineBanner visible={!!(isStale && error)} />
      <CompanySelector showAll />

      {loading ? (
        <ListScreenSkeleton count={7} showTabs={false} showSearch />
      ) : (
        <>
          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
              <Feather name="search" size={15} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, code, email, notes…"
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
            {notesPartnersCount > 0 && (
              <TouchableOpacity
                style={[styles.filterChip, showNotesOnly && styles.filterChipActive]}
                onPress={() => setShowNotesOnly((v) => !v)}
              >
                <Feather name="edit-3" size={11} color={showNotesOnly ? Colors.surface : Colors.textSecondary} />
                <Text style={[styles.filterChipText, showNotesOnly && styles.filterChipTextActive]}>
                  {` Notes (${notesPartnersCount})`}
                </Text>
              </TouchableOpacity>
            )}
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
            <SectionHeader title="Partners" meta={`${filtered.length} records${showNotesOnly ? ' · has notes' : ''}`} />

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="users" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {search || roleFilter !== 'all' || showNotesOnly ? 'No partners match your filter' : 'No partners found'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {filtered.map((p) => (
                  <PartnerCard
                    key={p.id}
                    partner={p}
                    hasNote={!!partnerNotesMap[p.id]}
                    onNotePress={() => openNoteModal(p)}
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
        </>
      )}

      {/* Partner Notes Modal */}
      <Modal
        visible={!!noteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setNoteModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle} numberOfLines={1}>
                Notes — {noteModal?.name}
              </Text>
              <Text style={styles.modalSubtitle}>Stored locally on this device</Text>
            </View>
            <TextInput
              style={styles.modalInput}
              multiline
              placeholder="Add notes…"
              placeholderTextColor={Colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNoteModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, noteSaving && styles.modalSaveBtnDisabled]}
                onPress={savePartnerNote}
                disabled={noteSaving}
              >
                <Feather name="save" size={14} color={noteSaving ? Colors.textMuted : Colors.surface} />
                <Text style={[styles.modalSaveText, noteSaving && styles.modalSaveTextDisabled]}>
                  {noteSaving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function PartnerCard({ partner: p, onPress, hasNote, onNotePress }: {
  partner: Partner;
  onPress: () => void;
  hasNote?: boolean;
  onNotePress?: () => void;
}) {
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
            <TouchableOpacity
              style={styles.contactItem}
              onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`mailto:${p.email}`); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="mail" size={11} color={Colors.textMuted} />
              <Text style={styles.contactTextTappable}>{p.email}</Text>
            </TouchableOpacity>
          )}
          {p.phone && (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`tel:${p.phone}`); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="phone" size={11} color={Colors.textMuted} />
              <Text style={styles.contactTextTappable}>{p.phone}</Text>
            </TouchableOpacity>
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
        {onNotePress && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onNotePress(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.noteBtn}
          >
            <Feather name="edit-3" size={13} color={hasNote ? Colors.text : Colors.textMuted} />
            {hasNote && <View style={styles.noteDot} />}
          </TouchableOpacity>
        )}
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
  headerNotesCsvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  headerNotesCsvText: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary },

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
  filterChipTextActive: { color: Colors.surface, fontWeight: '600' },

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
    borderRadius: Radius.full,
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
  contactTextTappable: { fontSize: 12, color: Colors.textSecondary, textDecorationLine: 'underline' },

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

  cardChevron: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.sm },
  noteBtn: { position: 'relative', padding: 2 },
  noteDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 5,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.text,
  },

  // Notes modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  modalTitle: { ...Typography.h3, textAlign: 'center' },
  modalSubtitle: { fontSize: 11, color: Colors.textMuted },
  modalInput: {
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.text,
    minHeight: 120,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  modalSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSaveBtnDisabled: { backgroundColor: Colors.surfaceHover },
  modalSaveText: { fontSize: 14, fontWeight: '600', color: Colors.surface },
  modalSaveTextDisabled: { color: Colors.textMuted },
});
