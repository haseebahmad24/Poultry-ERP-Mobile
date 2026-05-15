import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import { formatCurrency, formatShortDate } from '@/utils/currency';

export default function GRNScreen() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrders('progress');
      setOrders(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalReceived = orders.reduce((s, o) => s + (o.received ?? 0), 0);
  const totalOrdered = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const overallPct = totalOrdered > 0
    ? Math.min((totalReceived / totalOrdered) * 100, 100)
    : 0;

  if (loading) return <LoadingView message="Loading goods receipts…" />;
  if (error && orders.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Goods Receipt</Text>
        <Text style={styles.headerSub}>{orders.length} POs</Text>
      </View>

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
        {/* Overall Summary */}
        {orders.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Overall Receipt Progress</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{orders.length}</Text>
                <Text style={styles.summaryLabel}>Purchase Orders</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  {Math.round(overallPct)}%
                </Text>
                <Text style={styles.summaryLabel}>Received</Text>
              </View>
            </View>
            <View style={styles.overallProgressBar}>
              <View
                style={[styles.overallProgressFill, { width: `${overallPct}%` as any }]}
              />
            </View>
          </View>
        )}

        <SectionHeader title="Receipt Status by PO" meta={`${orders.length} records`} />

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚚</Text>
            <Text style={styles.emptyText}>No goods receipt data found</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {orders.map((po) => (
              <GRNCard key={po.id} po={po} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function GRNCard({ po }: { po: PurchaseOrder }) {
  const received = po.received ?? 0;
  const total = po.total ?? 0;
  const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  const isComplete = pct >= 100;
  const statusKey = (po.status ?? '').toUpperCase();

  const statusColors =
    isComplete
      ? { bg: Colors.successBg, fg: Colors.success }
      : pct > 0
      ? { bg: Colors.orangeBg, fg: Colors.orange }
      : { bg: Colors.primaryBg, fg: Colors.primary };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.poNumber}>{po.po_number ?? `PO-${po.id}`}</Text>
          <Text style={styles.poVendor} numberOfLines={1}>
            {po.vendor ?? 'Unknown Vendor'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.fg }]}>
            {isComplete ? 'COMPLETE' : pct > 0 ? 'PARTIAL' : statusKey || 'OPEN'}
          </Text>
        </View>
      </View>

      {po.dt && (
        <Text style={styles.cardDate}>PO Date: {formatShortDate(po.dt)}</Text>
      )}

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Receipt Progress</Text>
          <Text style={[styles.progressPct, { color: isComplete ? Colors.success : Colors.primary }]}>
            {Math.round(pct)}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[
            styles.progressFill,
            { width: `${pct}%` as any, backgroundColor: isComplete ? Colors.success : Colors.primaryLight }
          ]} />
        </View>
        <Text style={styles.progressDetail}>
          {formatCurrency(received)} of {formatCurrency(total)} received
        </Text>
      </View>

      {/* Items summary if available */}
      {po.items && po.items.length > 0 && (
        <View style={styles.itemsPreview}>
          <Text style={styles.itemsLabel}>{po.items.length} line items</Text>
          {po.items.slice(0, 3).map((item, idx) => {
            const itemReceived = item.qty_received ?? 0;
            const itemOrdered = item.qty_ordered ?? 0;
            const itemPct = itemOrdered > 0
              ? Math.min((itemReceived / itemOrdered) * 100, 100)
              : 0;
            return (
              <View key={item.id ?? idx} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>{item.item_name}</Text>
                <Text style={styles.itemQty}>
                  {itemReceived}/{itemOrdered} {item.unit ?? ''}
                </Text>
                <Text style={[
                  styles.itemPct,
                  { color: itemPct >= 100 ? Colors.success : Colors.textMuted }
                ]}>
                  {Math.round(itemPct)}%
                </Text>
              </View>
            );
          })}
          {po.items.length > 3 && (
            <Text style={styles.moreItems}>+{po.items.length - 3} more items</Text>
          )}
        </View>
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

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  summaryCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  summaryRow: { flexDirection: 'row', gap: Spacing.xl },
  summaryBlock: { gap: 2 },
  summaryValue: { fontSize: 28, fontWeight: '700', color: '#fff' },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  overallProgressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: Radius.full,
  },

  cardList: { marginHorizontal: Spacing.md, gap: Spacing.sm },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardInfo: { flex: 1 },
  poNumber: { ...Typography.h4 },
  poVendor: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardDate: { ...Typography.bodySmall, color: Colors.textSecondary },

  progressSection: { gap: 4 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  progressPct: { ...Typography.bodySmall, fontWeight: '700' },
  progressBar: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  progressDetail: { ...Typography.bodySmall, color: Colors.textMuted },

  itemsPreview: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  itemsLabel: { ...Typography.label, marginBottom: 2 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemName: { flex: 1, fontSize: 12, color: Colors.text },
  itemQty: { fontSize: 12, color: Colors.textSecondary },
  itemPct: { fontSize: 11, fontWeight: '700', minWidth: 32, textAlign: 'right' },
  moreItems: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

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
