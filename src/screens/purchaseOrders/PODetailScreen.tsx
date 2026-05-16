import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { fetchPODetail, PODetail, POLine } from '@/api/purchaseOrders';
import ErrorView from '@/components/ErrorView';
import LoadingView from '@/components/LoadingView';
import { Colors, Radius, Shadow, Spacing } from '@/theme';
import { formatCurrency, formatDate } from '@/utils/currency';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open:     { bg: '#e3f2fd', fg: '#1565c0' },
  Open:     { bg: '#e3f2fd', fg: '#1565c0' },
  approved: { bg: '#e8f5e9', fg: '#2e7d32' },
  Approved: { bg: '#e8f5e9', fg: '#2e7d32' },
  closed:   { bg: '#f5f5f5', fg: '#546e7a' },
  Closed:   { bg: '#f5f5f5', fg: '#546e7a' },
  draft:    { bg: '#fff3e0', fg: '#e65100' },
  Draft:    { bg: '#fff3e0', fg: '#e65100' },
  cancelled:{ bg: '#fce4ec', fg: '#c62828' },
};

export default function PODetailScreen({ route, navigation }: any) {
  const { id } = route.params as { id: number };

  const [po, setPo] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPODetail(id);
      setPo(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView message="Loading PO details…" />;
  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!po) return <ErrorView message="Purchase order not found" onRetry={load} />;

  const sc = STATUS_COLORS[po.status] ?? { bg: '#f5f5f5', fg: '#546e7a' };

  const totalOrdered = po.lines?.reduce((s, l) => s + (l.ordered_qty ?? 0), 0) ?? po.ordered_qty ?? 0;
  const totalReceived = po.lines?.reduce((s, l) => s + (l.received_qty ?? 0), 0) ?? po.received_qty ?? 0;
  const receivedPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {po.po_number ?? `PO #${po.id}`}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status + vendor card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeaderRow}>
            <Text style={styles.infoPoNum}>{po.po_number ?? `#${po.id}`}</Text>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.fg }]}>{po.status}</Text>
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

        {/* Receiving progress */}
        <View style={styles.progressCard}>
          <Text style={styles.sectionTitle}>Receiving Progress</Text>
          <View style={styles.progressStats}>
            <StatBox label="Ordered" value={totalOrdered.toLocaleString('en-PK', { maximumFractionDigits: 2 })} />
            <StatBox label="Received" value={totalReceived.toLocaleString('en-PK', { maximumFractionDigits: 2 })} color={Colors.success} />
            <StatBox
              label="Balance"
              value={(totalOrdered - totalReceived).toLocaleString('en-PK', { maximumFractionDigits: 2 })}
              color={totalOrdered - totalReceived > 0 ? Colors.warning : Colors.success}
            />
          </View>
          <View style={styles.bigProgressTrack}>
            <View
              style={[
                styles.bigProgressFill,
                {
                  width: `${receivedPct}%`,
                  backgroundColor:
                    receivedPct >= 100 ? Colors.success : receivedPct > 50 ? Colors.primary : Colors.warning,
                },
              ]}
            />
          </View>
          <Text style={styles.progressPctLabel}>{receivedPct}% received</Text>
        </View>

        {/* Line items */}
        {po.lines && po.lines.length > 0 ? (
          <View style={styles.linesCard}>
            <Text style={styles.sectionTitle}>Line Items ({po.lines.length})</Text>
            {po.lines.map((line, idx) => (
              <LineItem key={line.id ?? idx} line={line} isLast={idx === po.lines!.length - 1} />
            ))}
          </View>
        ) : null}

        {/* Notes */}
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

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function LineItem({ line, isLast }: { line: POLine; isLast: boolean }) {
  const pct =
    line.ordered_qty > 0
      ? Math.min(100, Math.round((line.received_qty / line.ordered_qty) * 100))
      : 0;

  return (
    <View style={[styles.lineItem, !isLast && styles.lineItemBorder]}>
      <View style={styles.lineItemHeader}>
        <Text style={styles.lineItemName} numberOfLines={1}>
          {line.item_name}
        </Text>
        {line.item_code ? (
          <Text style={styles.lineItemCode}>{line.item_code}</Text>
        ) : null}
      </View>
      <View style={styles.lineItemQtys}>
        <QtyLabel label="Ordered" value={line.ordered_qty} uom={line.uom} />
        <QtyLabel label="Received" value={line.received_qty} uom={line.uom} color={Colors.success} />
        <QtyLabel
          label="Balance"
          value={line.ordered_qty - line.received_qty}
          uom={line.uom}
          color={line.ordered_qty - line.received_qty > 0 ? Colors.warning : Colors.success}
        />
      </View>
      {/* mini progress */}
      <View style={styles.miniProgressTrack}>
        <View
          style={[
            styles.miniProgressFill,
            {
              width: `${pct}%`,
              backgroundColor: pct >= 100 ? Colors.success : Colors.primary,
            },
          ]}
        />
      </View>
      {line.unit_price != null && (
        <View style={styles.lineItemAmountRow}>
          <Text style={styles.lineItemPrice}>
            Unit: {formatCurrency(line.unit_price)}
          </Text>
          {line.total != null && (
            <Text style={styles.lineItemTotal}>{formatCurrency(line.total)}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function QtyLabel({
  label,
  value,
  uom,
  color,
}: {
  label: string;
  value: number;
  uom?: string;
  color?: string;
}) {
  return (
    <View style={styles.qtyLabel}>
      <Text style={styles.qtyLabelText}>{label}</Text>
      <Text style={[styles.qtyLabelValue, color ? { color } : {}]}>
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
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 32, color: '#fff', lineHeight: 36, fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: 12 },

  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.card,
    gap: 12,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoPoNum: { fontSize: 17, fontWeight: '700', color: Colors.text },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  infoRow: { flexDirection: 'row', gap: Spacing.md },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '500', color: Colors.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  totalLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  totalValue: { fontSize: 18, fontWeight: '700', color: Colors.primary },

  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.card,
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  progressStats: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingVertical: 8,
  },
  statLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500', marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  bigProgressTrack: {
    height: 10,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  bigProgressFill: { height: '100%', borderRadius: Radius.full },
  progressPctLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: 'right' },

  linesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.card,
  },
  lineItem: { paddingVertical: 10, gap: 6 },
  lineItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  lineItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineItemName: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  lineItemCode: { fontSize: 11, color: Colors.textMuted },
  lineItemQtys: { flexDirection: 'row', gap: 12 },
  qtyLabel: {},
  qtyLabelText: { fontSize: 9, color: Colors.textMuted, fontWeight: '500', marginBottom: 1 },
  qtyLabelValue: { fontSize: 12, fontWeight: '600', color: Colors.text },
  miniProgressTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  miniProgressFill: { height: '100%', borderRadius: Radius.full },
  lineItemAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  lineItemPrice: { fontSize: 11, color: Colors.textMuted },
  lineItemTotal: { fontSize: 12, fontWeight: '600', color: Colors.text },

  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.card,
  },
  notesText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
});
