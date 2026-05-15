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
import { RouteProp, useRoute } from '@react-navigation/native';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { fetchPODetail, PurchaseOrder, POItem } from '@/api/purchaseOrders';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import { formatCurrency, formatDate } from '@/utils/currency';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type RouteProps = RouteProp<MoreStackParamList, 'PurchaseOrderDetail'>;

const PO_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  OPEN:      { bg: Colors.primaryBg,   fg: Colors.primary },
  APPROVED:  { bg: Colors.successBg,   fg: Colors.success },
  CLOSED:    { bg: Colors.borderLight, fg: Colors.textSecondary },
  CANCELLED: { bg: Colors.dangerBg,    fg: Colors.danger },
  DRAFT:     { bg: Colors.warningBg,   fg: Colors.warning },
  PARTIAL:   { bg: Colors.orangeBg,    fg: Colors.orange },
};

export default function PurchaseOrderDetailScreen() {
  const route = useRoute<RouteProps>();
  const { id } = route.params;

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchPODetail(id);
      setPo(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView message="Loading purchase order…" />;
  if (error && !po) return <ErrorView message={error} onRetry={() => load()} />;
  if (!po) return <ErrorView message="Order not found" />;

  const statusKey = (po.status ?? '').toUpperCase();
  const statusColors = PO_STATUS_COLORS[statusKey] ?? {
    bg: Colors.borderLight,
    fg: Colors.textSecondary,
  };

  const items = po.items ?? [];
  const totalOrdered = items.reduce((s, i) => s + (i.qty_ordered ?? 0), 0);
  const totalReceived = items.reduce((s, i) => s + (i.qty_received ?? 0), 0);
  const progressPct = totalOrdered > 0
    ? Math.min((totalReceived / totalOrdered) * 100, 100)
    : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

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
        {/* PO Header Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroInfo}>
              <Text style={styles.poNumber}>{po.po_number ?? `PO-${po.id}`}</Text>
              <Text style={styles.poVendor}>{po.vendor ?? 'Unknown Vendor'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.fg }]}>
                {po.status ?? '—'}
              </Text>
            </View>
          </View>

          <View style={styles.heroMeta}>
            {po.dt && (
              <MetaRow label="Order Date" value={formatDate(po.dt)} />
            )}
            {po.delivery_date && (
              <MetaRow label="Delivery Date" value={formatDate(po.delivery_date)} />
            )}
            {po.total != null && (
              <MetaRow label="Total Amount" value={formatCurrency(po.total)} bold />
            )}
          </View>

          {/* Progress Bar */}
          {items.length > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Receipt Progress</Text>
                <Text style={styles.progressPct}>{Math.round(progressPct)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
              <Text style={styles.progressDetail}>
                {totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()} units received
              </Text>
            </View>
          )}

          {po.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{po.notes}</Text>
            </View>
          )}
        </View>

        {/* Line Items */}
        <SectionHeader title="Line Items" meta={`${items.length} items`} />

        {items.length === 0 ? (
          <View style={styles.emptyItems}>
            <Text style={styles.emptyItemsText}>No line items</Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item, idx) => (
              <LineItemRow key={item.id ?? idx} item={item} isLast={idx === items.length - 1} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, bold && styles.metaValueBold]}>{value}</Text>
    </View>
  );
}

function LineItemRow({ item, isLast }: { item: POItem; isLast: boolean }) {
  const received = item.qty_received ?? 0;
  const ordered = item.qty_ordered ?? 0;
  const itemPct = ordered > 0 ? Math.min((received / ordered) * 100, 100) : 0;
  const isComplete = itemPct >= 100;

  return (
    <View style={[styles.lineItem, !isLast && styles.lineItemBorder]}>
      <View style={styles.lineItemHeader}>
        <Text style={styles.lineItemName} numberOfLines={2}>{item.item_name}</Text>
        {item.amount != null && (
          <Text style={styles.lineItemAmount}>{formatCurrency(item.amount)}</Text>
        )}
      </View>

      <View style={styles.lineItemMeta}>
        {item.rate != null && (
          <Text style={styles.lineItemRate}>Rate: {formatCurrency(item.rate)}</Text>
        )}
        {item.unit && <Text style={styles.lineItemUnit}>{item.unit}</Text>}
      </View>

      <View style={styles.lineItemQtys}>
        <View style={styles.qtyBlock}>
          <Text style={styles.qtyLabel}>Ordered</Text>
          <Text style={styles.qtyValue}>{ordered.toLocaleString()}</Text>
        </View>
        <View style={styles.qtyBlock}>
          <Text style={styles.qtyLabel}>Received</Text>
          <Text style={[styles.qtyValue, { color: isComplete ? Colors.success : Colors.warning }]}>
            {received.toLocaleString()}
          </Text>
        </View>
        <View style={styles.qtyBlock}>
          <Text style={styles.qtyLabel}>Pending</Text>
          <Text style={[styles.qtyValue, { color: ordered - received > 0 ? Colors.danger : Colors.success }]}>
            {(ordered - received).toLocaleString()}
          </Text>
        </View>
      </View>

      {ordered > 0 && (
        <View style={styles.itemProgressBar}>
          <View style={[styles.itemProgressFill, { width: `${itemPct}%` as any,
            backgroundColor: isComplete ? Colors.success : Colors.primaryLight }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  heroCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
    gap: Spacing.md,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  heroInfo: { flex: 1 },
  poNumber: { ...Typography.h2 },
  poVendor: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: 12, fontWeight: '700' },

  heroMeta: { gap: Spacing.xs + 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  metaValue: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  metaValueBold: { fontSize: 15, fontWeight: '700' },

  progressSection: { gap: Spacing.xs },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  progressPct: { ...Typography.bodySmall, fontWeight: '700', color: Colors.primary },
  progressBar: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: Radius.full,
  },
  progressDetail: { ...Typography.bodySmall, color: Colors.textMuted },

  notesBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: 4,
  },
  notesLabel: { ...Typography.label },
  notesText: { ...Typography.bodySmall, color: Colors.textSecondary },

  itemsList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    ...Shadow.card,
  },

  lineItem: { padding: Spacing.md, gap: Spacing.xs + 2 },
  lineItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },

  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  lineItemName: { flex: 1, ...Typography.h4 },
  lineItemAmount: { ...Typography.h4, color: Colors.primary },

  lineItemMeta: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  lineItemRate: { ...Typography.bodySmall, color: Colors.textSecondary },
  lineItemUnit: { ...Typography.label },

  lineItemQtys: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  qtyBlock: { gap: 2 },
  qtyLabel: { ...Typography.label },
  qtyValue: { fontSize: 15, fontWeight: '700', color: Colors.text },

  itemProgressBar: {
    height: 3,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  itemProgressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  emptyItems: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadow.subtle,
  },
  emptyItemsText: { ...Typography.body, color: Colors.textMuted },
});
