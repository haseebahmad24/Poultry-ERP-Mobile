import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { loadJEPresets, saveJEPreset, deleteJEPreset, JEPreset } from '@/utils/jePresets';

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
  const [chartMonthFilter, setChartMonthFilter] = useState<string | null>(null);

  // Reset chart drill-down whenever the main search/type/date/account filters change
  useEffect(() => { setChartMonthFilter(null); }, [search, selectedType, dateRange.from, dateRange.to, pickedAccount]);

  // Account filter — can be set via route params or picker
  const [pickedAccount, setPickedAccount] = useState<string | undefined>(route.params?.account);
  const [pickedAccountName, setPickedAccountName] = useState<string | undefined>(route.params?.accountName);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const [presets, setPresets] = useState<JEPreset[]>([]);
  const [showPresetsModal, setShowPresetsModal] = useState(false);

  useEffect(() => {
    loadJEPresets(companyId).then(setPresets);
  }, [companyId]);

  const handleSavePreset = useCallback(async (name: string) => {
    const newPreset: JEPreset = {
      id: Date.now().toString(),
      name,
      search,
      selectedType,
      from: validFrom ?? '',
      to: validTo ?? '',
      pickedAccount,
      pickedAccountName,
    };
    const updated = await saveJEPreset(companyId, newPreset);
    setPresets(updated);
  }, [companyId, search, selectedType, validFrom, validTo, pickedAccount, pickedAccountName]);

  const handleDeletePreset = useCallback(async (id: string) => {
    const updated = await deleteJEPreset(companyId, id);
    setPresets(updated);
  }, [companyId]);

  const handleApplyPreset = useCallback((preset: JEPreset) => {
    setSearch(preset.search);
    setSelectedType(preset.selectedType);
    setDateRange({ from: preset.from, to: preset.to });
    setPickedAccount(preset.pickedAccount);
    setPickedAccountName(preset.pickedAccountName);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const handleImportPreset = useCallback(async (preset: JEPreset) => {
    const updated = await saveJEPreset(companyId, preset);
    setPresets(updated);
    Alert.alert('Imported', `"${preset.name}" has been added to your presets.`);
  }, [companyId]);

  const handleSelectAccount = useCallback((account: string) => {
    navigation.navigate('AccountStatement', { accountCode: account, accountName: account });
  }, [navigation]);

  const handleSelectType = useCallback((type: string) => {
    setSelectedType(type);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

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
    if (!search.trim()) return true;
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const lineAccounts = (e.lines ?? []).map((l) => l.account ?? '').join(' ');
    const haystack = [e.voucher_no ?? '', e.narration ?? '', e.voucher_type ?? '', lineAccounts].join(' ').toLowerCase();
    return words.every((w) => haystack.includes(w));
  });

  const filteredDebit = filtered.reduce((s, e) => s + (e.total_debit ?? 0), 0);
  const filteredCredit = filtered.reduce((s, e) => s + (e.total_credit ?? 0), 0);

  const chartFiltered = React.useMemo(() => {
    if (!chartMonthFilter) return filtered;
    return filtered.filter((e) => {
      if (!e.dt) return false;
      const d = new Date(e.dt);
      if (isNaN(d.getTime())) return false;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return ym === chartMonthFilter;
    });
  }, [filtered, chartMonthFilter]);

  const typeAmountSummary = React.useMemo(() => {
    const map = new Map<string, { count: number; debit: number }>();
    for (const e of chartFiltered) {
      const t = e.voucher_type ?? 'JV';
      const existing = map.get(t);
      if (existing) {
        existing.count += 1;
        existing.debit += e.total_debit ?? 0;
      } else {
        map.set(t, { count: 1, debit: e.total_debit ?? 0 });
      }
    }
    return Array.from(map.entries())
      .map(([type, { count, debit }]) => ({ type, count, debit }))
      .sort((a, b) => b.debit - a.debit);
  }, [chartFiltered]);

  // Running balance — only computed when an account filter is active
  const filteredWithBalance = React.useMemo<Array<{ entry: JournalEntry; runningBalance: number }>>(() => {
    if (!pickedAccount) return chartFiltered.map((entry) => ({ entry, runningBalance: 0 }));
    // Sort chronologically so running balance accumulates oldest → newest
    const sorted = [...chartFiltered].sort((a, b) => (a.dt ?? '').localeCompare(b.dt ?? ''));
    let running = 0;
    return sorted.map((entry) => {
      running += (entry.total_debit ?? 0) - (entry.total_credit ?? 0);
      return { entry, runningBalance: running };
    });
  }, [chartFiltered, pickedAccount]);

  // First index where the running balance changes sign (crosses zero)
  const zeroCrossingIdx = React.useMemo(() => {
    if (!pickedAccount || filteredWithBalance.length < 2) return -1;
    for (let i = 1; i < filteredWithBalance.length; i++) {
      const prev = filteredWithBalance[i - 1].runningBalance;
      const curr = filteredWithBalance[i].runningBalance;
      if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) return i;
    }
    return -1;
  }, [filteredWithBalance, pickedAccount]);

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
        <TouchableOpacity
          style={[styles.exportBtn, presets.length > 0 && styles.exportBtnBookmark]}
          onPress={() => setShowPresetsModal(true)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Feather name="bookmark" size={13} color={presets.length > 0 ? Colors.text : Colors.textMuted} />
          {presets.length > 0 && <Text style={styles.exportBtnText}>{presets.length}</Text>}
        </TouchableOpacity>
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
              placeholder="Search by voucher, narration, type, account…"
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

          {filtered.length > 0 && (
            <View style={styles.statsStrip}>
              <Text style={styles.statsStripCount}>{filtered.length}</Text>
              <Text style={styles.statsStripLabel}>vouchers</Text>
              <View style={styles.statsStripDivider} />
              <Text style={styles.statsStripKey}>Dr</Text>
              <Text style={styles.statsStripVal}>{fmtCompactJE(filteredDebit)}</Text>
              <View style={styles.statsStripDivider} />
              <Text style={styles.statsStripKey}>Cr</Text>
              <Text style={styles.statsStripVal}>{fmtCompactJE(filteredCredit)}</Text>
              {filteredDebit > 0 && filteredCredit > 0 && (
                <View style={styles.statsStripCheck}>
                  <Feather
                    name={Math.abs(filteredDebit - filteredCredit) < 0.01 ? 'check-circle' : 'alert-circle'}
                    size={12}
                    color={Math.abs(filteredDebit - filteredCredit) < 0.01 ? Colors.textMuted : Colors.textSecondary}
                  />
                </View>
              )}
            </View>
          )}

          <ScrollView
            ref={scrollRef}
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
            <JESummaryCard
              entries={filtered}
              onSelectAccount={handleSelectAccount}
              onSelectType={handleSelectType}
            />

            <MonthlyVoucherChart
              entries={filtered}
              selectedMonth={chartMonthFilter}
              onMonthSelect={setChartMonthFilter}
            />

            {typeAmountSummary.length > 1 && (
              <>
                <SectionHeader title="By Type" meta={`${typeAmountSummary.length} types · tap to filter`} />
                <VoucherTypeBar summary={typeAmountSummary} onSelectType={handleSelectType} />
              </>
            )}

            <SectionHeader title="Vouchers" meta={`${chartFiltered.length} record${chartFiltered.length !== 1 ? 's' : ''}`} />
            {chartMonthFilter != null && (
              <View style={styles.monthDrillChip}>
                <Feather name="calendar" size={10} color={Colors.textSecondary} />
                <Text style={styles.monthDrillText}>
                  {MV_MONTH_NAMES[parseInt(chartMonthFilter.split('-')[1], 10) - 1]} {chartMonthFilter.split('-')[0]}
                </Text>
                <TouchableOpacity
                  onPress={() => setChartMonthFilter(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={11} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            {filteredWithBalance.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="book-open" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No journal entries found</Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {filteredWithBalance.map(({ entry, runningBalance }, idx) => (
                  <React.Fragment key={entry.id}>
                    {idx === zeroCrossingIdx && (
                      <View style={styles.zeroCrossMarker}>
                        <View style={styles.zeroCrossLine} />
                        <Feather name="shuffle" size={11} color={Colors.textMuted} />
                        <Text style={styles.zeroCrossText}>balance crosses zero</Text>
                        <View style={styles.zeroCrossLine} />
                      </View>
                    )}
                    <JECard
                      entry={entry}
                      runningBalance={pickedAccount ? runningBalance : undefined}
                      onPress={() => navigation.navigate('JournalEntryDetail', { entry })}
                    />
                  </React.Fragment>
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
        onViewLedger={(code, name) => {
          setShowAccountPicker(false);
          navigation.navigate('AccountStatement', { accountCode: code, accountName: name });
        }}
        onClose={() => setShowAccountPicker(false)}
      />
      <PresetsModal
        visible={showPresetsModal}
        presets={presets}
        currentSearch={search}
        currentType={selectedType}
        currentFrom={validFrom ?? ''}
        currentTo={validTo ?? ''}
        currentAccount={pickedAccount}
        currentAccountName={pickedAccountName}
        onApply={(preset) => { handleApplyPreset(preset); setShowPresetsModal(false); }}
        onDelete={handleDeletePreset}
        onSave={handleSavePreset}
        onImport={handleImportPreset}
        onClose={() => setShowPresetsModal(false)}
      />
    </SafeAreaView>
  );
}

function AccountPickerModal({
  visible,
  companyId,
  onSelect,
  onViewLedger,
  onClose,
}: {
  visible: boolean;
  companyId?: string | number;
  onSelect: (code: string, name: string) => void;
  onViewLedger?: (code: string, name: string) => void;
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
          <View>
            <Text style={styles.modalTitle}>Select Account</Text>
            {onViewLedger && (
              <Text style={styles.modalSubtitle}>tap to filter JEs · book icon for ledger</Text>
            )}
          </View>
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
              <View style={styles.accountRow}>
                <TouchableOpacity
                  style={styles.accountRowMain}
                  onPress={() => onSelect(item.account_code!, `${item.account_code} — ${item.account_name}`)}
                >
                  <Text style={styles.accountCode}>{item.account_code}</Text>
                  <Text style={styles.accountName} numberOfLines={1}>{item.account_name}</Text>
                  <Feather name="filter" size={13} color={Colors.textMuted} />
                </TouchableOpacity>
                {onViewLedger && (
                  <TouchableOpacity
                    style={styles.accountRowLedgerBtn}
                    onPress={() => onViewLedger(item.account_code!, `${item.account_code} — ${item.account_name}`)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Feather name="book-open" size={15} color={Colors.text} />
                  </TouchableOpacity>
                )}
              </View>
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

// ─── Monthly Voucher Chart ────────────────────────────────────────────────────

const MV_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getLast6MonthsJE(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

function MonthlyVoucherChart({
  entries,
  selectedMonth,
  onMonthSelect,
}: {
  entries: JournalEntry[];
  selectedMonth: string | null;
  onMonthSelect: (ym: string | null) => void;
}) {
  const [mode, setMode] = React.useState<'count' | 'value'>('count');

  const months = React.useMemo(() => getLast6MonthsJE(), []);

  const monthData = React.useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const ym of months) map.set(ym, { count: 0, value: 0 });
    for (const e of entries) {
      if (!e.dt) continue;
      const d = new Date(e.dt);
      if (isNaN(d.getTime())) continue;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = map.get(ym);
      if (bucket) {
        bucket.count += 1;
        bucket.value += e.total_debit ?? 0;
      }
    }
    return months.map((ym) => {
      const monthIdx = parseInt(ym.split('-')[1], 10) - 1;
      const d = map.get(ym) ?? { count: 0, value: 0 };
      return { ym, label: MV_MONTH_NAMES[monthIdx] ?? ym, ...d };
    });
  }, [entries, months]);

  const maxVal = React.useMemo(() => {
    const vals = monthData.map((m) => mode === 'count' ? m.count : m.value);
    return Math.max(...vals, 1);
  }, [monthData, mode]);

  if (!monthData.some((m) => m.count > 0)) return null;

  const CHART_H = 56;

  return (
    <View style={mvStyles.card}>
      <View style={mvStyles.header}>
        <Text style={mvStyles.title}>Monthly Activity</Text>
        <View style={mvStyles.modeToggle}>
          {(['count', 'value'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[mvStyles.modePill, mode === m && mvStyles.modePillActive]}
              onPress={() => { setMode(m); onMonthSelect(null); }}
            >
              <Text style={[mvStyles.modePillText, mode === m && mvStyles.modePillTextActive]}>
                {m === 'count' ? '#' : '$'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={mvStyles.chart}>
        {monthData.map((m) => {
          const val = mode === 'count' ? m.count : m.value;
          const barH = Math.max(2, Math.round((val / maxVal) * CHART_H));
          const isSelected = selectedMonth === m.ym;
          return (
            <TouchableOpacity
              key={m.ym}
              style={mvStyles.col}
              onPress={() => onMonthSelect(isSelected ? null : m.ym)}
              activeOpacity={0.7}
            >
              <View style={[mvStyles.barTrack, { height: CHART_H }]}>
                <View
                  style={[
                    mvStyles.bar,
                    { height: barH },
                    isSelected && mvStyles.barSelected,
                    !isSelected && selectedMonth != null && mvStyles.barDim,
                  ]}
                />
              </View>
              <Text style={[mvStyles.monthLabel, isSelected && mvStyles.monthLabelBold]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedMonth != null ? (() => {
        const m = monthData.find((x) => x.ym === selectedMonth);
        if (!m) return null;
        return (
          <View style={mvStyles.snapRow}>
            <Text style={mvStyles.snapPeriod}>{m.label} {m.ym.split('-')[0]}</Text>
            <View style={mvStyles.snapDivider} />
            <View style={mvStyles.snapCell}>
              <Text style={mvStyles.snapVal}>{m.count}</Text>
              <Text style={mvStyles.snapKey}>vouchers</Text>
            </View>
            <View style={mvStyles.snapDivider} />
            <View style={mvStyles.snapCell}>
              <Text style={mvStyles.snapVal}>{fmtCompactJE(m.value)}</Text>
              <Text style={mvStyles.snapKey}>debit</Text>
            </View>
            <TouchableOpacity
              style={mvStyles.snapClear}
              onPress={() => onMonthSelect(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={12} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })() : (
        <Text style={mvStyles.hint}>tap a month to inspect</Text>
      )}
    </View>
  );
}

const mvStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  title: { flex: 1, ...Typography.h4 },
  modeToggle: { flexDirection: 'row', gap: 4 },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  modePillActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  modePillText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  modePillTextActive: { color: Colors.surface },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  col: { flex: 1, alignItems: 'center' },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  bar: { width: '100%', backgroundColor: Colors.textSecondary, borderRadius: Radius.sm },
  barSelected: { backgroundColor: Colors.text },
  barDim: { opacity: 0.35 },
  monthLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  monthLabelBold: { fontWeight: '700', color: Colors.text },
  hint: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.sm },
  snapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  snapPeriod: { fontSize: 11, fontWeight: '700', color: Colors.text },
  snapDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: Colors.borderLight },
  snapCell: { alignItems: 'center' },
  snapVal: { fontSize: 13, fontWeight: '700', color: Colors.text },
  snapKey: { fontSize: 10, color: Colors.textMuted },
  snapClear: { marginLeft: 'auto' as any },
});

// ─── JE Summary Card ──────────────────────────────────────────────────────────

function fmtCompactJE(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(Math.round(val));
}

interface AccountActivity {
  account: string;
  debit: number;
  credit: number;
  total: number;
}

function buildAccountActivity(entries: JournalEntry[]): AccountActivity[] {
  const map = new Map<string, AccountActivity>();
  for (const e of entries) {
    for (const line of (e.lines ?? [])) {
      if (!line.account) continue;
      const dr = line.debit ?? 0;
      const cr = line.credit ?? 0;
      const existing = map.get(line.account);
      if (existing) {
        existing.debit += dr;
        existing.credit += cr;
        existing.total += dr + cr;
      } else {
        map.set(line.account, { account: line.account, debit: dr, credit: cr, total: dr + cr });
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function AccountActivityList({
  entries,
  onSelectAccount,
}: {
  entries: JournalEntry[];
  onSelectAccount?: (account: string) => void;
}) {
  const items = buildAccountActivity(entries);
  if (items.length === 0) return null;

  const maxTotal = items[0]?.total ?? 1;

  return (
    <View style={acctStyles.container}>
      <View style={acctStyles.header}>
        <Text style={acctStyles.headerLabel}>TOP ACCOUNTS</Text>
        <View style={acctStyles.legendRow}>
          <View style={[acctStyles.dot, acctStyles.dotDr]} />
          <Text style={acctStyles.legendLabel}>Dr</Text>
          <View style={[acctStyles.dot, acctStyles.dotCr]} />
          <Text style={acctStyles.legendLabel}>Cr</Text>
          {onSelectAccount && (
            <Text style={acctStyles.tapHint}>tap for ledger</Text>
          )}
        </View>
      </View>
      {items.map((item) => {
        const drPct = maxTotal > 0 ? (item.debit / maxTotal) * 100 : 0;
        const crPct = maxTotal > 0 ? (item.credit / maxTotal) * 100 : 0;
        const rowContent = (
          <>
            <Text style={acctStyles.accountName} numberOfLines={1}>{item.account}</Text>
            <View style={acctStyles.barsCol}>
              <View style={acctStyles.barTrack}>
                <View style={[acctStyles.barFillDr, { width: `${drPct}%` as any }]} />
              </View>
              <View style={acctStyles.barTrack}>
                <View style={[acctStyles.barFillCr, { width: `${crPct}%` as any }]} />
              </View>
            </View>
            <Text style={acctStyles.amount}>{fmtCompactJE(item.total)}</Text>
            {onSelectAccount && (
              <Feather name="chevron-right" size={10} color={Colors.textMuted} />
            )}
          </>
        );
        if (onSelectAccount) {
          return (
            <TouchableOpacity
              key={item.account}
              style={acctStyles.row}
              onPress={() => onSelectAccount(item.account)}
              activeOpacity={0.6}
              hitSlop={{ top: 4, bottom: 4 }}
            >
              {rowContent}
            </TouchableOpacity>
          );
        }
        return (
          <View key={item.account} style={acctStyles.row}>
            {rowContent}
          </View>
        );
      })}
    </View>
  );
}

const acctStyles = StyleSheet.create({
  container: { marginTop: Spacing.sm, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: Radius.full },
  dotDr: { backgroundColor: Colors.text },
  dotCr: { backgroundColor: Colors.textMuted },
  legendLabel: { fontSize: 10, color: Colors.textMuted, marginRight: 4 },
  tapHint: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', marginLeft: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  accountName: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary, width: 110 },
  barsCol: { flex: 1, gap: 2 },
  barTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFillDr: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  barFillCr: { height: '100%', backgroundColor: Colors.textMuted, borderRadius: Radius.full },
  amount: { fontSize: 11, fontWeight: '700', color: Colors.text, width: 38, textAlign: 'right' },
});

interface MonthBucket {
  label: string;   // e.g. "Jan"
  debit: number;
  credit: number;
}

function buildMonthBuckets(entries: JournalEntry[]): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      label: d.toLocaleString('default', { month: 'short' }),
      debit: 0,
      credit: 0,
    });
    // attach key as a temporary property for filling
    (buckets[buckets.length - 1] as any)._key = key;
  }
  for (const e of entries) {
    if (!e.dt) continue;
    const key = e.dt.slice(0, 7);
    const bucket = buckets.find((b) => (b as any)._key === key);
    if (!bucket) continue;
    bucket.debit += e.total_debit ?? 0;
    bucket.credit += e.total_credit ?? 0;
  }
  return buckets;
}

function DrCrFlowChart({ entries }: { entries: JournalEntry[] }) {
  const buckets = buildMonthBuckets(entries);
  const hasData = buckets.some((b) => b.debit > 0 || b.credit > 0);
  if (!hasData) return null;

  const maxVal = Math.max(...buckets.map((b) => Math.max(b.debit, b.credit)), 1);
  const BAR_HEIGHT = 48;

  return (
    <View style={flowStyles.container}>
      <View style={flowStyles.legendRow}>
        <View style={flowStyles.legendItem}>
          <View style={[flowStyles.legendDot, flowStyles.drDot]} />
          <Text style={flowStyles.legendLabel}>Dr</Text>
        </View>
        <View style={flowStyles.legendItem}>
          <View style={[flowStyles.legendDot, flowStyles.crDot]} />
          <Text style={flowStyles.legendLabel}>Cr</Text>
        </View>
      </View>
      <View style={flowStyles.chartRow}>
        {buckets.map((b) => {
          const drH = Math.round((b.debit / maxVal) * BAR_HEIGHT);
          const crH = Math.round((b.credit / maxVal) * BAR_HEIGHT);
          return (
            <View key={(b as any)._key} style={flowStyles.column}>
              <View style={[flowStyles.chartArea, { height: BAR_HEIGHT }]}>
                <View style={flowStyles.barGroup}>
                  <View style={[flowStyles.bar, flowStyles.drBar, { height: Math.max(drH, 2) }]} />
                  <View style={[flowStyles.bar, flowStyles.crBar, { height: Math.max(crH, 2) }]} />
                </View>
              </View>
              <Text style={flowStyles.monthLabel}>{b.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const flowStyles = StyleSheet.create({
  container: { marginTop: Spacing.sm },
  legendRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: Radius.full },
  drDot: { backgroundColor: Colors.text },
  crDot: { backgroundColor: Colors.textMuted },
  legendLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  column: { flex: 1, alignItems: 'center', gap: 3 },
  chartArea: { justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  barGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, width: '100%', justifyContent: 'center' },
  bar: { width: '42%', borderRadius: Radius.sm, minHeight: 2 },
  drBar: { backgroundColor: Colors.text },
  crBar: { backgroundColor: Colors.textMuted },
  monthLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
});

function JESummaryCard({
  entries,
  onSelectAccount,
  onSelectType,
}: {
  entries: JournalEntry[];
  onSelectAccount?: (account: string) => void;
  onSelectType?: (type: string) => void;
}) {
  if (entries.length === 0) return null;

  const totalDebit = entries.reduce((s, e) => s + (e.total_debit ?? 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.total_credit ?? 0), 0);

  const typeMap = new Map<string, { count: number; amount: number }>();
  for (const e of entries) {
    const t = e.voucher_type ?? 'JV';
    const existing = typeMap.get(t);
    if (existing) {
      existing.count++;
      existing.amount += e.total_debit ?? 0;
    } else {
      typeMap.set(t, { count: 1, amount: e.total_debit ?? 0 });
    }
  }

  const byType = [...typeMap.entries()]
    .map(([type, stats]) => ({ type, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const maxCount = byType[0]?.count ?? 1;

  return (
    <View style={summaryStyles.card}>
      <View style={summaryStyles.statsRow}>
        <Text style={summaryStyles.totalLabel}>{entries.length} vouchers</Text>
        <View style={summaryStyles.amtsRow}>
          <Text style={summaryStyles.amtLabel}>Dr</Text>
          <Text style={summaryStyles.amtValue}>{fmtCompactJE(totalDebit)}</Text>
          <Text style={[summaryStyles.amtLabel, { marginLeft: Spacing.sm }]}>Cr</Text>
          <Text style={summaryStyles.amtValue}>{fmtCompactJE(totalCredit)}</Text>
        </View>
      </View>
      {byType.length > 1 && (
        <View style={summaryStyles.typeGrid}>
          {byType.map((t) => {
            const rowInner = (
              <>
                <Text style={summaryStyles.typeBadge}>{t.type}</Text>
                <View style={summaryStyles.barTrack}>
                  <View
                    style={[summaryStyles.barFill, { width: `${(t.count / maxCount) * 100}%` as any }]}
                  />
                </View>
                <Text style={summaryStyles.typeCount}>{t.count}</Text>
                {onSelectType && (
                  <Feather name="chevron-right" size={10} color={Colors.textMuted} />
                )}
              </>
            );
            if (onSelectType) {
              return (
                <TouchableOpacity
                  key={t.type}
                  style={summaryStyles.typeRow}
                  onPress={() => onSelectType(t.type)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 4, bottom: 4 }}
                >
                  {rowInner}
                </TouchableOpacity>
              );
            }
            return (
              <View key={t.type} style={summaryStyles.typeRow}>
                {rowInner}
              </View>
            );
          })}
        </View>
      )}
      <DrCrFlowChart entries={entries} />
      <AccountActivityList entries={entries} onSelectAccount={onSelectAccount} />
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  amtsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amtLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  amtValue: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  typeGrid: { gap: 5 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typeBadge: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, width: 32 },
  barTrack: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    backgroundColor: Colors.textSecondary,
    borderRadius: Radius.full,
  },
  typeCount: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, width: 28, textAlign: 'right' },
});

// ─── JE Card ──────────────────────────────────────────────────────────────────

const JE_LINES_PREVIEW = 4;

function JECard({
  entry,
  runningBalance,
  onPress,
}: {
  entry: JournalEntry;
  runningBalance?: number;
  onPress: () => void;
}) {
  const vtype = entry.voucher_type ?? 'JV';
  const statusKey = (entry.status ?? '').toUpperCase();
  const isDraft = statusKey === 'DRAFT';
  const isVoid = statusKey === 'VOID';
  const lines = entry.lines ?? [];
  const hasLines = lines.length > 0;
  const longNarration = (entry.narration?.length ?? 0) > 80;
  const [narrationExpanded, setNarrationExpanded] = useState(false);
  const [linesExpanded, setLinesExpanded] = useState(false);

  const previewLines = linesExpanded ? lines.slice(0, JE_LINES_PREVIEW) : [];
  const hiddenCount = lines.length - JE_LINES_PREVIEW;

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
        {runningBalance !== undefined ? (
          <View style={styles.runningBalanceCol}>
            <Text style={styles.amtLabel}>Balance</Text>
            <Text style={[styles.runningBalanceVal, runningBalance < 0 && styles.runningBalanceNeg]}>
              {runningBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(runningBalance))}
            </Text>
          </View>
        ) : (
          <View style={styles.cardFooter}>
            {hasLines && (
              <TouchableOpacity
                style={styles.linesToggleBtn}
                onPress={(e) => { e.stopPropagation(); setLinesExpanded((v) => !v); }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather
                  name={linesExpanded ? 'chevron-up' : 'list'}
                  size={11}
                  color={linesExpanded ? Colors.textSecondary : Colors.textMuted}
                />
                <Text style={[styles.linesHint, linesExpanded && styles.linesHintActive]}>
                  {lines.length} lines
                </Text>
              </TouchableOpacity>
            )}
            <Feather name="chevron-right" size={14} color={Colors.textMuted} />
          </View>
        )}
      </View>
      {runningBalance !== undefined && (
        <View style={styles.runningBalanceFooter}>
          {hasLines && (
            <TouchableOpacity
              style={styles.linesToggleBtn}
              onPress={(e) => { e.stopPropagation(); setLinesExpanded((v) => !v); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather
                name={linesExpanded ? 'chevron-up' : 'list'}
                size={11}
                color={linesExpanded ? Colors.textSecondary : Colors.textMuted}
              />
              <Text style={[styles.linesHint, linesExpanded && styles.linesHintActive]}>
                {lines.length} lines
              </Text>
            </TouchableOpacity>
          )}
          <Feather name="chevron-right" size={14} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
        </View>
      )}

      {/* Inline line items preview */}
      {linesExpanded && previewLines.length > 0 && (
        <View style={styles.linesPreview}>
          <View style={styles.linesPreviewHeader}>
            <Text style={styles.linesPreviewCol}>Account</Text>
            <Text style={styles.linesPreviewAmtCol}>Dr</Text>
            <Text style={styles.linesPreviewAmtCol}>Cr</Text>
          </View>
          {previewLines.map((line, i) => (
            <View key={i} style={styles.linesPreviewRow}>
              <Text style={styles.linesPreviewAccount} numberOfLines={1}>
                {line.account ?? '—'}
              </Text>
              <Text style={[styles.linesPreviewAmt, (line.debit ?? 0) > 0 && styles.linesPreviewDr]}>
                {(line.debit ?? 0) > 0 ? fmtCompactJE(line.debit!) : ''}
              </Text>
              <Text style={[styles.linesPreviewAmt, (line.credit ?? 0) > 0 && styles.linesPreviewCr]}>
                {(line.credit ?? 0) > 0 ? fmtCompactJE(line.credit!) : ''}
              </Text>
            </View>
          ))}
          {hiddenCount > 0 && (
            <Text style={styles.linesPreviewMore}>+{hiddenCount} more — tap card for full detail</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function PresetsModal({
  visible,
  presets,
  currentSearch,
  currentType,
  currentFrom,
  currentTo,
  currentAccount,
  currentAccountName,
  onApply,
  onDelete,
  onSave,
  onImport,
  onClose,
}: {
  visible: boolean;
  presets: JEPreset[];
  currentSearch: string;
  currentType: string;
  currentFrom: string;
  currentTo: string;
  currentAccount?: string;
  currentAccountName?: string;
  onApply: (preset: JEPreset) => void;
  onDelete: (id: string) => void;
  onSave: (name: string) => void;
  onImport: (preset: JEPreset) => void;
  onClose: () => void;
}) {
  const [saveName, setSaveName] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const hasFilter = !!(
    currentSearch.trim() ||
    currentType !== 'All' ||
    currentFrom ||
    currentTo ||
    currentAccount
  );

  const filterSummary = (preset: JEPreset) => {
    const parts: string[] = [];
    if (preset.selectedType !== 'All') parts.push(preset.selectedType);
    if (preset.search) parts.push(`"${preset.search}"`);
    if (preset.pickedAccount) parts.push(`@${preset.pickedAccountName ?? preset.pickedAccount}`);
    if (preset.from) parts.push(`from ${preset.from}`);
    if (preset.to) parts.push(`to ${preset.to}`);
    return parts.join(' · ') || 'No filters';
  };

  const handleSharePreset = async (preset: JEPreset) => {
    const exportable = { name: preset.name, search: preset.search, selectedType: preset.selectedType, from: preset.from, to: preset.to, pickedAccount: preset.pickedAccount, pickedAccountName: preset.pickedAccountName };
    await Share.share({ message: JSON.stringify(exportable, null, 2), title: `JE Preset: ${preset.name}` });
  };

  const handleImport = () => {
    setImportError('');
    let parsed: any;
    try {
      parsed = JSON.parse(importText.trim());
    } catch {
      setImportError('Invalid JSON — paste the exported preset text exactly.');
      return;
    }
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) {
      setImportError('Preset must have a "name" field.');
      return;
    }
    const imported: JEPreset = {
      id: Date.now().toString(),
      name: parsed.name.trim(),
      search: typeof parsed.search === 'string' ? parsed.search : '',
      selectedType: typeof parsed.selectedType === 'string' ? parsed.selectedType : 'All',
      from: typeof parsed.from === 'string' ? parsed.from : '',
      to: typeof parsed.to === 'string' ? parsed.to : '',
      pickedAccount: typeof parsed.pickedAccount === 'string' ? parsed.pickedAccount : undefined,
      pickedAccountName: typeof parsed.pickedAccountName === 'string' ? parsed.pickedAccountName : undefined,
    };
    onImport(imported);
    setImportText('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={psStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={psStyles.sheet}>
        <View style={psStyles.handle} />
        <View style={psStyles.sheetHeader}>
          <Text style={psStyles.sheetTitle}>Search Presets</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {hasFilter && (
          <View style={psStyles.saveSection}>
            <Text style={psStyles.saveSectionLabel}>SAVE CURRENT SEARCH</Text>
            <View style={psStyles.saveRow}>
              <TextInput
                style={psStyles.saveInput}
                placeholder="Name this search…"
                placeholderTextColor={Colors.textMuted}
                value={saveName}
                onChangeText={setSaveName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (saveName.trim()) { onSave(saveName.trim()); setSaveName(''); }
                }}
              />
              <TouchableOpacity
                style={[psStyles.saveBtn, !saveName.trim() && psStyles.saveBtnDisabled]}
                onPress={() => {
                  if (!saveName.trim()) return;
                  onSave(saveName.trim());
                  setSaveName('');
                }}
                disabled={!saveName.trim()}
              >
                <Text style={psStyles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView style={psStyles.listScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {presets.length === 0 ? (
            <View style={psStyles.emptyState}>
              <Feather name="bookmark" size={28} color={Colors.textMuted} />
              <Text style={psStyles.emptyText}>No saved presets</Text>
              <Text style={psStyles.emptyHint}>
                {hasFilter ? 'Enter a name above to save the current search' : 'Set filters then save them for quick access'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={psStyles.listLabel}>SAVED PRESETS</Text>
              {presets.map((preset) => (
                <View key={preset.id} style={psStyles.presetRow}>
                  <TouchableOpacity style={psStyles.presetMain} onPress={() => onApply(preset)}>
                    <Text style={psStyles.presetName} numberOfLines={1}>{preset.name}</Text>
                    <Text style={psStyles.presetSummary} numberOfLines={1}>{filterSummary(preset)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={psStyles.presetDelete}
                    onPress={() => handleSharePreset(preset)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="share" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={psStyles.presetDelete}
                    onPress={() => onDelete(preset.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* Import section */}
          <View style={psStyles.importSection}>
            <Text style={psStyles.listLabel}>IMPORT PRESET</Text>
            <View style={psStyles.importRow}>
              <TextInput
                style={[psStyles.saveInput, psStyles.importInput]}
                placeholder='Paste exported JSON here…'
                placeholderTextColor={Colors.textMuted}
                value={importText}
                onChangeText={(t) => { setImportText(t); setImportError(''); }}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {importError ? (
              <Text style={psStyles.importError}>{importError}</Text>
            ) : null}
            <TouchableOpacity
              style={[psStyles.saveBtn, !importText.trim() && psStyles.saveBtnDisabled, psStyles.importBtn]}
              onPress={handleImport}
              disabled={!importText.trim()}
            >
              <Text style={psStyles.saveBtnText}>Import</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const psStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '72%',
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sheetTitle: { ...Typography.h3 },
  saveSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.xs,
  },
  saveSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  saveRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  saveInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  saveBtn: {
    backgroundColor: Colors.text,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: Colors.surface },
  listScroll: { flex: 1 },
  listLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  presetMain: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    gap: 3,
  },
  presetName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  presetSummary: { fontSize: 11, color: Colors.textMuted },
  presetDelete: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importSection: {
    paddingHorizontal: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.sm,
  },
  importRow: { marginTop: Spacing.xs },
  importInput: { height: 72, textAlignVertical: 'top', paddingTop: Spacing.xs + 2, fontFamily: 'monospace', fontSize: 12 },
  importBtn: { alignSelf: 'flex-end', marginTop: Spacing.xs },
  importError: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
  emptyHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});

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
  exportBtnBookmark: { borderColor: Colors.border },

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
  modalSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
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
    backgroundColor: Colors.surface,
  },
  accountRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  accountRowLedgerBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
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
  chipTextActive: { color: Colors.surface, fontWeight: '700' },

  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  statsStripCount: { fontSize: 13, fontWeight: '700', color: Colors.text },
  statsStripLabel: { fontSize: 11, color: Colors.textMuted, marginRight: 2 },
  statsStripDivider: { width: StyleSheet.hairlineWidth, height: 12, backgroundColor: Colors.border },
  statsStripKey: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  statsStripVal: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  statsStripCheck: { marginLeft: 'auto' as any },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  monthDrillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
  },
  monthDrillText: { fontSize: 11, fontWeight: '600', color: Colors.text },

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
  linesHintActive: { color: Colors.textSecondary },
  linesToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linesPreview: {
    marginTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.xs,
    gap: 2,
  },
  linesPreviewHeader: {
    flexDirection: 'row',
    paddingBottom: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    marginBottom: 2,
  },
  linesPreviewCol: { flex: 1, fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  linesPreviewAmtCol: { width: 52, fontSize: 10, color: Colors.textMuted, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.4 },
  linesPreviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  linesPreviewAccount: { flex: 1, fontSize: 11, color: Colors.textSecondary },
  linesPreviewAmt: { width: 52, fontSize: 11, textAlign: 'right', color: Colors.textMuted },
  linesPreviewDr: { color: Colors.text, fontWeight: '600' },
  linesPreviewCr: { color: Colors.textSecondary, fontWeight: '600' },
  linesPreviewMore: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingTop: 3 },
  runningBalanceCol: { marginLeft: 'auto', alignItems: 'flex-end' },
  runningBalanceVal: { fontSize: 13, fontWeight: '700', color: Colors.text },
  runningBalanceNeg: { color: Colors.textSecondary },
  runningBalanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    paddingTop: 4,
  },

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

  zeroCrossMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginVertical: 2,
  },
  zeroCrossLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  zeroCrossText: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },

  typeBreakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  typeBreakdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  typeBreakdownLabel: { fontSize: 10, fontWeight: '700', color: Colors.text },
  typeBreakdownAmt: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  typeBreakdownCount: { fontSize: 10, color: Colors.textMuted },
});

// ─── Voucher Type Distribution Bar ───────────────────────────────────────────

const VTB_FILLS = [
  '#0a0a0a', '#374151', '#6b7280', '#9ca3af',
  '#c4c4c4', '#d1d5db', '#e5e7eb', '#f3f4f6',
] as const;

const VTB_TEXT = [
  '#ffffff', '#ffffff', '#ffffff', '#0a0a0a',
  '#0a0a0a', '#0a0a0a', '#0a0a0a', '#0a0a0a',
] as const;

function VoucherTypeBar({
  summary,
  onSelectType,
}: {
  summary: Array<{ type: string; count: number; debit: number }>;
  onSelectType?: (type: string) => void;
}) {
  const totalDebit = summary.reduce((s, item) => s + item.debit, 0);
  if (totalDebit === 0 || summary.length === 0) return null;

  return (
    <View style={vtbStyles.container}>
      <View style={vtbStyles.bar}>
        {summary.map((item, i) => {
          const flex = totalDebit > 0 ? item.debit / totalDebit : 0;
          const fill = VTB_FILLS[i % VTB_FILLS.length];
          const pct = Math.round(flex * 100);
          if (flex < 0.01) return null;
          return (
            <TouchableOpacity
              key={item.type}
              style={[vtbStyles.segment, { flex, backgroundColor: fill }]}
              onPress={() => onSelectType?.(item.type)}
              activeOpacity={0.75}
            >
              {pct >= 10 && (
                <Text style={[vtbStyles.segmentLabel, { color: VTB_TEXT[i % VTB_TEXT.length] }]}>
                  {item.type}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={vtbStyles.legend}>
        {summary.map((item, i) => {
          const flex = totalDebit > 0 ? item.debit / totalDebit : 0;
          const fill = VTB_FILLS[i % VTB_FILLS.length];
          const pct = Math.round(flex * 100);
          return (
            <TouchableOpacity
              key={item.type}
              style={vtbStyles.legendItem}
              onPress={() => onSelectType?.(item.type)}
              activeOpacity={0.7}
            >
              <View style={[vtbStyles.legendDot, { backgroundColor: fill }]} />
              <Text style={vtbStyles.legendType}>{item.type}</Text>
              <Text style={vtbStyles.legendPct}>{pct}%</Text>
              <Text style={vtbStyles.legendCount}>{item.count}×</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const vtbStyles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    paddingBottom: Spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    height: 28,
    overflow: 'hidden',
  },
  segment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentLabel: { fontSize: 10, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  legendDot: { width: 8, height: 8, borderRadius: Radius.full },
  legendType: { fontSize: 11, fontWeight: '700', color: Colors.text },
  legendPct: { fontSize: 10, color: Colors.textSecondary },
  legendCount: { fontSize: 10, color: Colors.textMuted },
});
