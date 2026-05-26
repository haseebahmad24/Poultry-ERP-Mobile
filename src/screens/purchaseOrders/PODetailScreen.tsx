import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { fetchPODetail, PODetail, POLine } from '@/api/purchaseOrders';
import ErrorView from '@/components/ErrorView';
import DetailSkeleton from '@/components/DetailSkeleton';
import OfflineBanner from '@/components/OfflineBanner';
import BackButton from '@/components/BackButton';
import { getCached, setCached } from '@/utils/cache';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { formatCurrency, formatDate } from '@/utils/currency';

const MUTED_STATUSES = new Set(['closed', 'cancelled']);

export default function PODetailScreen({ route, navigation }: any) {
  const { id } = route.params as { id: number };

  const [po, setPo] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const cacheKey = `po-detail:${id}`;

  const load = useCallback(async () => {
    const cached = await getCached<PODetail>(cacheKey);
    if (cached) {
      setPo(cached.data);
      setStale(cached.stale);
      setLoading(false);
      if (!cached.stale) return;
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchPODetail(id);
      setPo(data);
      setStale(false);
      await setCached(cacheKey, data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [id, cacheKey]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SafeAreaView style={{flex:1,backgroundColor:Colors.background}} edges={['top']}><StatusBar style="dark" /><DetailSkeleton tileCount={4} listCount={5} /></SafeAreaView>;
  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!po) return <ErrorView message="Purchase order not found" onRetry={load} />;

  const statusKey = (po.status ?? '').toLowerCase();
  const isMuted = MUTED_STATUSES.has(statusKey);

  const totalOrdered = po.lines?.reduce((s, l) => s + (l.ordered_qty ?? 0), 0) ?? po.ordered_qty ?? 0;
  const totalReceived = po.lines?.reduce((s, l) => s + (l.received_qty ?? 0), 0) ?? po.received_qty ?? 0;
  const receivedPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {po.po_number ?? `PO #${po.id}`}
        </Text>
      </View>

      <OfflineBanner visible={!!(stale && error)} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoHeaderRow}>
            <Text style={styles.infoPoNum}>{po.po_number ?? `#${po.id}`}</Text>
            <View style={[styles.statusBadge, isMuted && styles.statusBadgeMuted]}>
              <Text style={styles.statusText}>{po.status ?? '—'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Vendor</Text>
              <Text style={styles.infoValue}>{po.vendor_name ?? '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{po.dt ? formatDate(po.dt) : '—'}</Text>
            </View>
          </View>

          {po.company_name ? (
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Company</Text>
                <Text style={styles.infoValue}>{po.company_name}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatCurrency(po.total_amount ?? 0)}</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.sectionTitle}>Receiving Progress</Text>
          <View style={styles.progressStats}>
            <StatBox label="Ordered" value={totalOrdered.toLocaleString('en-PK', { maximumFractionDigits: 2 })} />
            <StatBox label="Received" value={totalReceived.toLocaleString('en-PK', { maximumFractionDigits: 2 })} />
            <StatBox label="Balance" value={(totalOrdered - totalReceived).toLocaleString('en-PK', { maximumFractionDigits: 2 })} />
          </View>
          <View style={styles.bigProgressTrack}>
            <View style={[styles.bigProgressFill, { width: `${receivedPct}%` as any }]} />
          </View>
          <Text style={styles.progressPctLabel}>{receivedPct}% received</Text>
        </View>

        {po.lines && po.lines.length > 0 ? (
          <View style={styles.linesCard}>
            <Text style={styles.sectionTitle}>Line Items ({po.lines.length})</Text>
            {po.lines.map((line, idx) => (
              <LineItem key={line.id ?? idx} line={line} isLast={idx === po.lines!.length - 1} />
            ))}
          </View>
        ) : null}

        {po.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{po.notes}</Text>
          </View>
        ) : null}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function LineItem({ line, isLast }: { line: POLine; isLast: boolean }) {
  const pct =
    line.ordered_qty > 0
      ? Math.min(100, Math.round((line.received_qty / line.ordered_qty) * 100))
      : 0;
  const isComplete = pct >= 100;

  return (
    <View style={[styles.lineItem, !isLast && styles.lineItemBorder]}>
      <View style={styles.lineItemHeader}>
        <Text style={styles.lineItemName} numberOfLines={1}>{line.item_name}</Text>
        {line.item_code ? <Text style={styles.lineItemCode}>{line.item_code}</Text> : null}
      </View>
      <View style={styles.lineItemQtys}>
        <QtyLabel label="Ordered" value={line.ordered_qty} uom={line.uom} />
        <QtyLabel label="Received" value={line.received_qty} uom={line.uom} />
        <QtyLabel label="Balance" value={line.ordered_qty - line.received_qty} uom={line.uom} />
      </View>
      <View style={styles.miniProgressTrack}>
        <View style={[styles.miniProgressFill, { width: `${pct}%` as any }, isComplete && styles.miniProgressFillComplete]} />
      </View>
      {line.unit_price != null && (
        <View style={styles.lineItemAmountRow}>
          <Text style={styles.lineItemPrice}>Unit: {formatCurrency(line.unit_price)}</Text>
          {line.total != null && <Text style={styles.lineItemTotal}>{formatCurrency(line.total)}</Text>}
        </View>
      )}
    </View>
  );
}

function QtyLabel({ label, value, uom }: { label: string; value: number; uom?: string }) {
  return (
    <View style={styles.qtyLabel}>
      <Text style={styles.qtyLabelText}>{label}</Text>
      <Text style={styles.qtyLabelValue}>
        {value.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
        {uom ? ` ${uom}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  headerTitle: { flex: 1, ...Typography.h2 },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: 12 },

  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 12,
  },
  infoHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoPoNum: { fontSize: 17, fontWeight: '700', color: Colors.text },
  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeMuted: { opacity: 0.5 },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  infoRow: { flexDirection: 'row', gap: Spacing.md },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '500', color: Colors.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  totalLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  totalValue: { fontSize: 18, fontWeight: '700', color: Colors.text },

  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  progressStats: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: 8,
  },
  statLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500', marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  bigProgressTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  bigProgressFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  progressPctLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: 'right' },

  linesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  lineItem: { paddingVertical: 10, gap: 6 },
  lineItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  lineItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineItemName: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  lineItemCode: { fontSize: 11, color: Colors.textMuted },
  lineItemQtys: { flexDirection: 'row', gap: 12 },
  qtyLabel: {},
  qtyLabelText: { fontSize: 9, color: Colors.textMuted, fontWeight: '500', marginBottom: 1 },
  qtyLabelValue: { fontSize: 12, fontWeight: '600', color: Colors.text },
  miniProgressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  miniProgressFill: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.textSecondary },
  miniProgressFillComplete: { backgroundColor: Colors.text },
  lineItemAmountRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  lineItemPrice: { fontSize: 11, color: Colors.textMuted },
  lineItemTotal: { fontSize: 12, fontWeight: '600', color: Colors.text },

  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  notesText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
});
