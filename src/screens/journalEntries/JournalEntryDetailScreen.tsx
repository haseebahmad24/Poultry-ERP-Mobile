import React from 'react';
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import type { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import type { JournalEntry } from '@/api/journalEntries';
import BackButton from '@/components/BackButton';
import SectionHeader from '@/components/SectionHeader';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { exportJournalEntryDetailPDF } from '@/utils/pdfExport';
import { useCompany } from '@/context/CompanyContext';

type RouteType = RouteProp<FinanceStackParamList, 'JournalEntryDetail'>;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function JournalEntryDetailScreen() {
  const route = useRoute<RouteType>();
  const { entry } = route.params;
  const { selectedCompany } = useCompany();

  const vtype = entry.voucher_type ?? 'JV';
  const isDraft = (entry.status ?? '').toUpperCase() === 'DRAFT';
  const isVoid = (entry.status ?? '').toUpperCase() === 'VOID';

  const totalDebit = entry.total_debit ?? entry.lines?.reduce((s, l) => s + (l.debit ?? 0), 0) ?? 0;
  const totalCredit = entry.total_credit ?? entry.lines?.reduce((s, l) => s + (l.credit ?? 0), 0) ?? 0;

  const handleShare = async () => {
    const lineText = (entry.lines ?? [])
      .map((l) => `  ${(l.account ?? '').padEnd(30)} DR: ${l.debit ? formatCurrency(l.debit) : '—'.padStart(12)}  CR: ${l.credit ? formatCurrency(l.credit) : '—'.padStart(12)}`)
      .join('\n');
    const text = [
      `${vtype} ${entry.voucher_no ?? ''}  •  ${entry.dt ?? ''}  •  ${entry.status ?? ''}`,
      entry.narration ? `Narration: ${entry.narration}` : null,
      '',
      'JOURNAL LINES',
      '─'.repeat(55),
      lineText,
      '─'.repeat(55),
      `Total Debit: ${formatCurrency(totalDebit)}   Total Credit: ${formatCurrency(totalCredit)}`,
    ].filter((l) => l !== null).join('\n');
    await Share.share({ message: text, title: `${vtype} ${entry.voucher_no ?? ''}` });
  };

  const handleExportPDF = async () => {
    await exportJournalEntryDetailPDF(entry, selectedCompany?.name);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerTitle}>
          <View style={styles.voucherBadge}>
            <Text style={styles.voucherBadgeText}>{vtype}</Text>
          </View>
          <Text style={styles.headerVoucherNo}>{entry.voucher_no ?? `#${entry.id}`}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleExportPDF}>
          <Feather name="file-text" size={16} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
          <Feather name="share" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <View style={styles.card}>
          <InfoRow label="Voucher No." value={entry.voucher_no ?? `#${entry.id}`} />
          <InfoRow label="Type" value={vtype} />
          {entry.dt && <InfoRow label="Date" value={formatShortDate(entry.dt)} />}
          {entry.status && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[styles.statusBadge, (isDraft || isVoid) && styles.statusBadgeMuted]}>
                <Text style={styles.statusText}>{entry.status}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Narration */}
        {entry.narration ? (
          <View style={styles.narrationCard}>
            <Text style={styles.narrationLabel}>Narration</Text>
            <Text style={styles.narrationText}>{entry.narration}</Text>
          </View>
        ) : null}

        {/* Amount summary */}
        <View style={styles.amountRow}>
          <View style={[styles.amountBlock, styles.amountBlockBorder]}>
            <Text style={styles.amountLabel}>Total Debit</Text>
            <Text style={styles.amountValue}>{formatCurrency(totalDebit)}</Text>
          </View>
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Total Credit</Text>
            <Text style={styles.amountValue}>{formatCurrency(totalCredit)}</Text>
          </View>
        </View>

        {/* Journal lines */}
        <SectionHeader
          title="Journal Lines"
          meta={`${(entry.lines ?? []).length} entries`}
        />

        {entry.lines && entry.lines.length > 0 ? (
          <View style={styles.linesCard}>
            {/* Table header */}
            <View style={[styles.lineRow, styles.lineRowHeader]}>
              <Text style={[styles.lineAccount, styles.lineHeaderText]}>Account</Text>
              <Text style={[styles.lineAmt, styles.lineHeaderText]}>Debit</Text>
              <Text style={[styles.lineAmt, styles.lineHeaderText]}>Credit</Text>
            </View>

            {entry.lines.map((line, idx) => (
              <View key={line.id ?? idx} style={styles.lineRow}>
                <View style={styles.lineAccountWrap}>
                  <Text style={styles.lineAccount} numberOfLines={2}>{line.account ?? '—'}</Text>
                  {line.narration ? (
                    <Text style={styles.lineNarration} numberOfLines={1}>{line.narration}</Text>
                  ) : null}
                </View>
                <Text style={styles.lineAmt}>
                  {(line.debit ?? 0) > 0 ? formatCurrency(line.debit!) : ''}
                </Text>
                <Text style={styles.lineAmt}>
                  {(line.credit ?? 0) > 0 ? formatCurrency(line.credit!) : ''}
                </Text>
              </View>
            ))}

            {/* Total row */}
            <View style={[styles.lineRow, styles.lineTotalRow]}>
              <Text style={[styles.lineAccount, styles.lineTotalText]}>TOTAL</Text>
              <Text style={[styles.lineAmt, styles.lineTotalText]}>{formatCurrency(totalDebit)}</Text>
              <Text style={[styles.lineAmt, styles.lineTotalText]}>{formatCurrency(totalCredit)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyLines}>
            <Feather name="file-text" size={24} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No line details available</Text>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
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
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerVoucherNo: { ...Typography.h2, flex: 1 },
  voucherBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  voucherBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  iconBtn: {
    padding: 6,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.md, paddingHorizontal: Spacing.md },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  infoLabel: { ...Typography.label, width: 110 },
  infoValue: { flex: 1, fontSize: 13, fontWeight: '500', color: Colors.text },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeMuted: { opacity: 0.5 },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.text },

  narrationCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  narrationLabel: { ...Typography.label, marginBottom: 4 },
  narrationText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  amountRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  amountBlock: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  amountBlockBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  amountLabel: { ...Typography.label, marginBottom: 4 },
  amountValue: { fontSize: 16, fontWeight: '700', color: Colors.text },

  linesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginHorizontal: 0,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  lineRowHeader: {
    backgroundColor: Colors.background,
  },
  lineHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  lineAccountWrap: { flex: 1, paddingRight: Spacing.sm },
  lineAccount: { flex: 1, fontSize: 12, color: Colors.text },
  lineNarration: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  lineAmt: {
    width: 88,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    color: Colors.text,
  },
  lineTotalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.text,
    borderBottomWidth: 0,
    backgroundColor: Colors.background,
  },
  lineTotalText: { fontWeight: '700', fontSize: 12 },

  emptyLines: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
