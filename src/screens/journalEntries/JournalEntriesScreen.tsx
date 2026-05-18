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
import { fetchJournalEntries, JournalEntry } from '@/api/journalEntries';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import CompanyPicker from '@/components/CompanyPicker';
import { useCompany } from '@/context/CompanyContext';
import { formatCurrency, formatShortDate } from '@/utils/currency';

const VOUCHER_TYPES = ['All', 'JV', 'GRN', 'PAY', 'REC', 'INV', 'SO', 'PO', 'DN'];

const VOUCHER_COLORS: Record<string, { bg: string; fg: string }> = {
  JV:  { bg: '#e8eaf6', fg: '#283593' },
  GRN: { bg: '#e8f5e9', fg: '#2e7d32' },
  DN:  { bg: '#fff3e0', fg: '#e65100' },
  PAY: { bg: '#e3f2fd', fg: '#1565c0' },
  REC: { bg: '#f3e5f5', fg: '#6a1b9a' },
  INV: { bg: '#fce4ec', fg: '#c62828' },
  SO:  { bg: '#e0f7fa', fg: '#00695c' },
  PO:  { bg: '#f1f8e9', fg: '#558b2f' },
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  POSTED: { bg: Colors.successBg, fg: Colors.success },
  DRAFT:  { bg: Colors.warningBg, fg: Colors.warning },
  VOID:   { bg: Colors.dangerBg,  fg: Colors.danger },
};

export default function JournalEntriesScreen() {
  const { companyId } = useCompany();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchJournalEntries({
        companyId,
        type: selectedType !== 'All' ? selectedType : undefined,
      });
      setEntries(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedType, companyId]);

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

  if (loading) return <LoadingView message="Loading journal entries…" />;
  if (error && entries.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Journal Entries</Text>
        <Text style={styles.headerSub}>{filtered.length} entries</Text>
      </View>

      <CompanyPicker showAll />

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search voucher, narration…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Type Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {VOUCHER_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.chip,
              selectedType === t && styles.chipActive,
              t !== 'All' && VOUCHER_COLORS[t] && selectedType === t
                ? { backgroundColor: VOUCHER_COLORS[t].bg, borderColor: VOUCHER_COLORS[t].fg }
                : null,
            ]}
            onPress={() => setSelectedType(t)}
          >
            <Text style={[
              styles.chipText,
              selectedType === t && styles.chipTextActive,
              t !== 'All' && VOUCHER_COLORS[t] && selectedType === t
                ? { color: VOUCHER_COLORS[t].fg }
                : null,
            ]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
        <SectionHeader title="Vouchers" meta={`${filtered.length} records`} />

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📒</Text>
            <Text style={styles.emptyText}>No journal entries found</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {filtered.map((entry) => (
              <JECard
                key={entry.id}
                entry={entry}
                isExpanded={expanded === entry.id}
                onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function JECard({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: JournalEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const vtype = entry.voucher_type ?? 'JV';
  const colors = VOUCHER_COLORS[vtype] ?? { bg: Colors.borderLight, fg: Colors.textSecondary };
  const statusKey = (entry.status ?? '').toUpperCase();
  const statusColors = STATUS_COLORS[statusKey] ?? { bg: Colors.borderLight, fg: Colors.textMuted };

  return (
    <TouchableOpacity style={styles.card} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={[styles.voucherBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.voucherBadgeText, { color: colors.fg }]}>{vtype}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.voucherNo}>{entry.voucher_no ?? `#${entry.id}`}</Text>
          {entry.narration && (
            <Text style={styles.narration} numberOfLines={isExpanded ? undefined : 1}>
              {entry.narration}
            </Text>
          )}
        </View>
        <View style={styles.cardRight}>
          {entry.dt && <Text style={styles.dateText}>{formatShortDate(entry.dt)}</Text>}
          {entry.status && (
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.fg }]}>{entry.status}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amtLabel}>Debit</Text>
          <Text style={[styles.amtValue, { color: Colors.primary }]}>
            {formatCurrency(entry.total_debit ?? 0)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amtLabel}>Credit</Text>
          <Text style={[styles.amtValue, { color: Colors.success }]}>
            {formatCurrency(entry.total_credit ?? 0)}
          </Text>
        </View>
        <Text style={styles.expandHint}>{isExpanded ? '▲' : '▼'}</Text>
      </View>

      {/* Expanded: show lines */}
      {isExpanded && entry.lines && entry.lines.length > 0 && (
        <View style={styles.linesContainer}>
          <Text style={styles.linesTitle}>Journal Lines</Text>
          {entry.lines.map((line, idx) => (
            <View key={line.id ?? idx} style={styles.lineRow}>
              <Text style={styles.lineAccount} numberOfLines={1}>{line.account ?? '—'}</Text>
              <Text style={[styles.lineDebit, { color: Colors.primary }]}>
                {(line.debit ?? 0) > 0 ? formatCurrency(line.debit!) : ''}
              </Text>
              <Text style={[styles.lineCredit, { color: Colors.success }]}>
                {(line.credit ?? 0) > 0 ? formatCurrency(line.credit!) : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
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
  chipActive: { backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },

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

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  voucherBadge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  voucherBadgeText: { fontSize: 11, fontWeight: '700' },
  cardInfo: { flex: 1 },
  voucherNo: { ...Typography.h4 },
  narration: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  dateText: { ...Typography.bodySmall, color: Colors.textMuted },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '700' },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  amtLabel: { ...Typography.label },
  amtValue: { fontSize: 14, fontWeight: '700' },
  expandHint: { marginLeft: 'auto', color: Colors.textMuted, fontSize: 12 },

  linesContainer: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  linesTitle: { ...Typography.label, marginBottom: 4 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lineAccount: { flex: 1, fontSize: 12, color: Colors.text },
  lineDebit: { fontSize: 12, fontWeight: '600', minWidth: 80, textAlign: 'right' },
  lineCredit: { fontSize: 12, fontWeight: '600', minWidth: 80, textAlign: 'right' },

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
