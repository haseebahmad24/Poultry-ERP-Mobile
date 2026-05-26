import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Share,
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

type RouteType = RouteProp<FinanceStackParamList, 'JournalEntries'>;
type NavProp = NativeStackNavigationProp<FinanceStackParamList>;

const VOUCHER_TYPES = ['All', 'JV', 'GRN', 'PAY', 'REC', 'INV', 'SO', 'PO', 'DN'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function JournalEntriesScreen() {
  const { companyId, selectedCompany } = useCompany();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const accountFilter = route.params?.account;
  const accountFilterName = route.params?.accountName;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });
  const [isStale, setIsStale] = useState(false);

  const validFrom = DATE_RE.test(dateRange.from) ? dateRange.from : undefined;
  const validTo = DATE_RE.test(dateRange.to) ? dateRange.to : undefined;

  const cacheKey = `journal-entries:${companyId ?? 'all'}:${selectedType}:${accountFilter ?? ''}`;
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
        account: accountFilter,
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
  }, [selectedType, companyId, cacheKey, useCache, validFrom, validTo, accountFilter]);

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

  const handleExport = async () => {
    const line = '─'.repeat(55);
    const header = `JOURNAL ENTRIES\nType: ${selectedType}${validFrom ? `  From: ${validFrom}` : ''}${validTo ? `  To: ${validTo}` : ''}\n${line}`;
    const rows = filtered.map((e) => {
      const lines = (e.lines ?? []).map((l) =>
        `    ${(l.account ?? '').padEnd(28)}  DR: ${l.debit ? formatCurrency(l.debit) : '—'.padStart(12)}  CR: ${l.credit ? formatCurrency(l.credit) : '—'.padStart(12)}`
      ).join('\n');
      return `${e.voucher_type ?? ''} ${e.voucher_no ?? ''}  ${e.dt ?? ''}  ${e.status ?? ''}\n  ${e.narration ?? ''}\n${lines}`;
    });
    const text = [header, ...rows].join(`\n${line}\n`);
    await Share.share({ message: text, title: 'Journal Entries' });
  };

  if (error && entries.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {accountFilterName ? `JEs — ${accountFilterName}` : 'Journal Entries'}
        </Text>
        {!loading && <Text style={styles.headerSub}>{filtered.length}</Text>}
        {!loading && filtered.length > 0 && (
          <>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
              <Feather name="file-text" size={13} color={Colors.text} />
              <Text style={styles.exportBtnText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
              <Feather name="share" size={13} color={Colors.textSecondary} />
              <Text style={styles.exportBtnText}>Share</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {accountFilterName && (
        <View style={styles.accountFilterBanner}>
          <Feather name="filter" size={12} color={Colors.textMuted} />
          <Text style={styles.accountFilterText}>
            Account: <Text style={styles.accountFilterName}>{accountFilterName}</Text>
          </Text>
        </View>
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
    </SafeAreaView>
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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.voucherBadge}>
          <Text style={styles.voucherBadgeText}>{vtype}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.voucherNo}>{entry.voucher_no ?? `#${entry.id}`}</Text>
          {entry.narration && (
            <Text style={styles.narration} numberOfLines={1}>
              {entry.narration}
            </Text>
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
  accountFilterText: { fontSize: 12, color: Colors.textSecondary },
  accountFilterName: { fontWeight: '600', color: Colors.text },

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
