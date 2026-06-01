import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchJournalEntries, JournalEntry } from '@/api/journalEntries';
import { fetchTrialBalance, TrialBalanceRow } from '@/api/trialBalance';
import type { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import SectionHeader from '@/components/SectionHeader';
import CompanySelector from '@/components/CompanySelector';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';
import { useCompany } from '@/context/CompanyContext';
import BackButton from '@/components/BackButton';
import OfflineBanner from '@/components/OfflineBanner';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import { exportJournalEntriesPDF } from '@/utils/pdfExport';
import { exportJournalEntriesCSV } from '@/utils/csvExport';

type RouteType = RouteProp<FinanceStackParamList, 'JournalEntries'>;
type NavProp = NativeStackNavigationProp<FinanceStackParamList>;

const VOUCHER_TYPES = ['All', 'JV', 'GRN', 'PAY', 'REC', 'INV', 'SO', 'PO', 'DN'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function JournalEntriesScreen() {
  const { companyId, selectedCompany } = useCompany();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });
  const [isStale, setIsStale] = useState(false);

  // Account filter — can be set via route params or picker
  const [pickedAccount, setPickedAccount] = useState<string | undefined>(route.params?.account);
  const [pickedAccountName, setPickedAccountName] = useState<string | undefined>(route.params?.accountName);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const validFrom = DATE_RE.test(dateRange.from) ? dateRange.from : undefined;
  const validTo = DATE_RE.test(dateRange.to) ? dateRange.to : undefined;

  const cacheKey = `journal-entries:${companyId ?? 'all'}:${selectedType}:${pickedAccount ?? ''}`;
  const useCache = !validFrom && !validTo;

  const load = useCallback(async (isRefresh = false) => {
    let hadCachedData = false;
    if (isRefresh) {
      setRefreshing(true);
    } else if (useCache) {
      const cached = await getCached<JournalEntry[]>(cacheKey);
      if (cached) {
        hadCachedData = true;
        setEntries(cached.data);
        setIsStale(cached.stale);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchJournalEntries({
        companyId,
        type: selectedType !== 'All' ? selectedType : undefined,
        from: validFrom,
        to: validTo,
        account: pickedAccount,
      });
      setEntries(data);
      setIsStale(false);
      if (useCache) {
        await setCached(cacheKey, data);
      }
    } catch (e: any) {
      if (hadCachedData) {
        setIsStale(true);
      } else {
        setError(String(e?.message ?? e));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedType, companyId, cacheKey, useCache, validFrom, validTo, pickedAccount]);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      e.voucher_no?.toLowerCase().includes(q) ||
      e.narration?.toLowerCase().includes(q) ||
      e.voucher_type?.toLowerCase().includes(q)
    );
  });

  const handleExportPDF = async () => {
    await exportJournalEntriesPDF({
      entries: filtered,
      companyName: selectedCompany?.name ?? 'All Companies',
      type: selectedType,
      from: validFrom,
      to: validTo,
    });
  };

  const handleExportCSV = async () => {
    await exportJournalEntriesCSV({
      entries: filtered,
      companyName: selectedCompany?.name ?? 'All Companies',
      type: selectedType,
      from: validFrom,
      to: validTo,
    });
  };

  if (error && entries.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {pickedAccountName ? `JEs — ${pickedAccountName}` : 'Journal Entries'}
        </Text>
        {!loading && <Text style={styles.headerSub}>{filtered.length}</Text>}
        {!loading && filtered.length > 0 && (
          <>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
              <Feather name="file-text" size={13} color={Colors.text} />
              <Text style={styles.exportBtnText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
              <Feather name="grid" size={13} color={Colors.textSecondary} />
              <Text style={styles.exportBtnText}>CSV</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {pickedAccount ? (
        <View style={styles.accountFilterBanner}>
          <Feather name="filter" size={12} color={Colors.textMuted} />
          <Text style={styles.accountFilterText} numberOfLines={1}>
            Account: <Text style={styles.accountFilterName}>{pickedAccountName ?? pickedAccount}</Text>
          </Text>
          <TouchableOpacity
            style={styles.accountFilterEdit}
            onPress={() => setShowAccountPicker(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="edit-2" size={11} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.accountFilterClear}
            onPress={() => { setPickedAccount(undefined); setPickedAccountName(undefined); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.accountFilterBannerEmpty}
          onPress={() => setShowAccountPicker(true)}
        >
          <Feather name="filter" size={12} color={Colors.textMuted} />
          <Text style={styles.accountFilterEmptyText}>Filter by account…</Text>
        </TouchableOpacity>
      )}

      <CompanySelector showAll />
      <OfflineBanner visible={!!(isStale && !refreshing)} />
      {loading ? (
        <ListScreenSkeleton count={6} showTabs={false} showSearch />
      ) : (
        <>
          <DateRangeBar value={dateRange} onChange={setDateRange} />

          <View style={styles.searchContainer}>
            <Feather name="search" size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search voucher, narration…"
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContainer}
          >
            {VOUCHER_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, selectedType === t && styles.chipActive]}
                onPress={() => setSelectedType(t)}
              >
                <Text style={[styles.chipText, selectedType === t && styles.chipTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
            <SectionHeader title="Vouchers" meta={`${filtered.length} records`} />

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="book-open" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No journal entries found</Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {filtered.map((entry) => (
                  <JECard
                    key={entry.id}
                    entry={entry}
                    onPress={() => navigation.navigate('JournalEntryDetail', { entry })}
                  />
                ))}
              </View>
            )}

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </>
      )}
      <AccountPickerModal
        visible={showAccountPicker}
        companyId={companyId}
        onSelect={(code, name) => {
          setPickedAccount(code);
          setPickedAccountName(name);
          setShowAccountPicker(false);
        }}
        onClose={() => setShowAccountPicker(false)}
      />
    </SafeAreaView>
  );
}

function AccountPickerModal({
  visible,
  companyId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  companyId?: string | number;
  onSelect: (code: string, name: string) => void;
  onClose: () => void;
}) {
  const [accounts, setAccounts] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSearch('');
    fetchTrialBalance(companyId)
      .then((result) => {
        setAccounts(result.rows.filter((r) => !r.is_group && r.account_code));
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, [visible, companyId]);

  const filtered = search.trim()
    ? accounts.filter((a) => {
        const q = search.toLowerCase();
        return (
          a.account_code?.toLowerCase().includes(q) ||
          a.account_name?.toLowerCase().includes(q)
        );
      })
    : accounts;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalRoot} edges={['top']}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filter by Account</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalSearch}>
          <Feather name="search" size={14} color={Colors.textMuted} />
          <TextInput
            style={styles.modalSearchInput}
            placeholder="Search account name or code…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {loading ? (
          <View style={styles.modalLoading}>
            <ActivityIndicator color={Colors.textMuted} />
            <Text style={styles.modalLoadingText}>Loading accounts…</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.account_code ?? item.account_name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.accountRow}
                onPress={() => onSelect(item.account_code!, `${item.account_code} — ${item.account_name}`)}
              >
                <Text style={styles.accountCode}>{item.account_code}</Text>
                <Text style={styles.accountName} numberOfLines={1}>{item.account_name}</Text>
                <Feather name="chevron-right" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <Feather name="inbox" size={28} color={Colors.textMuted} />
                <Text style={styles.modalEmptyText}>
                  {search ? 'No accounts match search' : 'No accounts found'}
                </Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function JECard({
  entry,
  onPress,
}: {
  entry: JournalEntry;
  onPress: () => void;
}) {
  const vtype = entry.voucher_type ?? 'JV';
  const statusKey = (entry.status ?? '').toUpperCase();
  const isDraft = statusKey === 'DRAFT';
  const isVoid = statusKey === 'VOID';
  const hasLines = (entry.lines?.length ?? 0) > 0;
  const longNarration = (entry.narration?.length ?? 0) > 80;
  const [narrationExpanded, setNarrationExpanded] = useState(false);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.voucherBadge}>
          <Text style={styles.voucherBadgeText}>{vtype}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.voucherNo}>{entry.voucher_no ?? `#${entry.id}`}</Text>
          {entry.narration && (
            <TouchableOpacity
              activeOpacity={longNarration ? 0.7 : 1}
              onPress={longNarration ? (e) => { e.stopPropagation(); setNarrationExpanded((v) => !v); } : undefined}
            >
              <Text
                style={[styles.narration, longNarration && styles.narrationExpandable]}
                numberOfLines={narrationExpanded ? undefined : 1}
              >
                {entry.narration}
              </Text>
              {longNarration && (
                <View style={styles.narrationToggle}>
                  <Feather
                    name={narrationExpanded ? 'chevron-up' : 'chevron-down'}
                    size={11}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.narrationToggleText}>
                    {narrationExpanded ? 'less' : 'more'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.cardRight}>
          {entry.dt && <Text style={styles.dateText}>{formatShortDate(entry.dt)}</Text>}
          {entry.status && (
            <View style={[styles.statusBadge, (isDraft || isVoid) && styles.statusBadgeMuted]}>
              <Text style={[styles.statusText, (isDraft || isVoid) && styles.statusTextMuted]}>
                {entry.status}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Debit</Text>
          <Text style={styles.amtValue}>{formatCurrency(entry.total_debit ?? 0)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amtLabel}>Credit</Text>
          <Text style={styles.amtValue}>{formatCurrency(entry.total_credit ?? 0)}</Text>
        </View>
        <View style={styles.cardFooter}>
          {hasLines && (
            <Text style={styles.linesHint}>{entry.lines!.length} lines</Text>
          )}
          <Feather name="chevron-right" size={14} color={Colors.textMuted} />
        </View>
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
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2, flex: 1 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  exportBtnText: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary },

  accountFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  accountFilterBannerEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  accountFilterEmptyText: { fontSize: 12, color: Colors.textMuted, flex: 1 },
  accountFilterText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  accountFilterName: { fontWeight: '600', color: Colors.text },
  accountFilterEdit: { padding: 2 },
  accountFilterClear: { padding: 2 },

  // Account picker modal
  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalTitle: { ...Typography.h3 },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: Colors.text },
  modalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  modalLoadingText: { ...Typography.bodySmall, color: Colors.textMuted },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  accountCode: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    width: 60,
  },
  accountName: { flex: 1, fontSize: 14, color: Colors.text },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginLeft: Spacing.md,
  },
  modalEmpty: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalEmptyText: { ...Typography.body, color: Colors.textMuted },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: '#ffffff', fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  voucherBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  voucherBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  cardInfo: { flex: 1 },
  voucherNo: { ...Typography.h4 },
  narration: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  narrationExpandable: { color: Colors.text },
  narrationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  narrationToggleText: { fontSize: 10, color: Colors.textMuted },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  dateText: { ...Typography.bodySmall, color: Colors.textMuted },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeMuted: { opacity: 0.5 },
  statusText: { fontSize: 10, fontWeight: '700', color: Colors.text },
  statusTextMuted: { color: Colors.textSecondary },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  amtLabel: { ...Typography.label },
  amtValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardFooter: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  linesHint: { fontSize: 11, color: Colors.textMuted },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
