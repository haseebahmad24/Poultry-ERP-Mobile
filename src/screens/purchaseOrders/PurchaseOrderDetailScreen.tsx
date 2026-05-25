import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchPODetail, PurchaseOrder, POItem } from '@/api/purchaseOrders';
import BackButton from '@/components/BackButton';
import BookmarkButton from '@/components/BookmarkButton';
import DetailSkeleton from '@/components/DetailSkeleton';
import ErrorView from '@/components/ErrorView';
import OfflineBanner from '@/components/OfflineBanner';
import SectionHeader from '@/components/SectionHeader';
import { getCached, setCached } from '@/utils/cache';
import { formatCurrency, formatDate } from '@/utils/currency';
import { exportPODetailPDF } from '@/utils/pdfExport';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type RouteProps = RouteProp<MoreStackParamList, 'PurchaseOrderDetail'>;

const MUTED_STATUSES = new Set(['closed', 'cancelled']);

export default function PurchaseOrderDetailScreen() {
  const route = useRoute<RouteProps>();
  const { id } = route.params;

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const cacheKey = `po-detail:${id}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<PurchaseOrder>(cacheKey);
      if (cached) {
        setPo(cached.data);
        setStale(cached.stale);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      setRefreshing(false);
    }
  }, [id, cacheKey]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}><BackButton /><Text style={styles.headerTitle}>Purchase Order</Text></View>
      <DetailSkeleton tileCount={4} listCount={5} />
    </SafeAreaView>
  );
  if (error && !po) return <ErrorView message={error} onRetry={() => load()} />;
  if (!po) return <ErrorView message="Order not found" />;

  const statusKey = (po.status ?? '').toLowerCase();
  const isMuted = MUTED_STATUSES.has(statusKey);

  const items = po.items ?? [];
  const totalOrdered = items.reduce((s, i) => s + (i.qty_ordered ?? 0), 0);
  const totalReceived = items.reduce((s, i) => s + (i.qty_received ?? 0), 0);
  const progressPct = totalOrdered > 0
    ? Math.min((totalReceived / totalOrdered) * 100, 100)
    : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle} numberOfLines={1}>Purchase Order</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => exportPODetailPDF(po)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="file-text" size={18} color={Colors.text} />
        </TouchableOpacity>
        <BookmarkButton
          type="po"
          entityId={po.id}
          title={po.po_number ?? `PO-${po.id}`}
          subtitle={po.vendor}
          meta={po.total != null ? formatCurrency(po.total) : undefined}
        />
      </View>

      <OfflineBanner visible={!!(stale && error)} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.textMuted}
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroInfo}>
              <Text style={styles.poNumber}>{po.po_number ?? `PO-${po.id}`}</Text>
              <Text style={styles.poVendor}>{po.vendor ?? 'Unknown Vendor'}</Text>
            </View>
            <View style={[styles.statusBadge, isMuted && styles.statusBadgeMuted]}>
              <Text style={styles.statusText}>{po.status ?? '—'}</Text>
            </View>
          </View>

          <View style={styles.heroMeta}>
            {po.dt && <MetaRow label="Order Date" value={formatDate(po.dt)} />}
            {po.delivery_date && <MetaRow label="Delivery Date" value={formatDate(po.delivery_date)} />}
            {po.total != null && <MetaRow label="Total Amount" value={formatCurrency(po.total)} bold />}
          </View>

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
        {item.rate != null && <Text style={styles.lineItemRate}>Rate: {formatCurrency(item.rate)}</Text>}
        {item.unit && <Text style={styles.lineItemUnit}>{item.unit}</Text>}
      </View>

      <View style={styles.lineItemQtys}>
        <View style={styles.qtyBlock}>
          <Text style={styles.qtyLabel}>Ordered</Text>
          <Text style={styles.qtyValue}>{ordered.toLocaleString()}</Text>
        </View>
        <View style={styles.qtyBlock}>
          <Text style={styles.qtyLabel}>Received</Text>
          <Text style={[styles.qtyValue, isComplete && styles.qtyValueComplete]}>
            {received.toLocaleString()}
          </Text>
        </View>
        <View style={styles.qtyBlock}>
          <Text style={styles.qtyLabel}>Pending</Text>
          <Text style={[styles.qtyValue, (ordered - received) === 0 && styles.qtyValueComplete]}>
            {(ordered - received).toLocaleString()}
          </Text>
        </View>
      </View>

      {ordered > 0 && (
        <View style={styles.itemProgressBar}>
          <View style={[styles.itemProgressFill, { width: `${itemPct}%` as any }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, ...Typography.h2 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  heroCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing.md,
  },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  heroInfo: { flex: 1 },
  poNumber: { ...Typography.h2 },
  poVendor: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeMuted: { opacity: 0.5 },
  statusText: { fontSize: 12, fontWeight: '700', color: Colors.text },

  heroMeta: { gap: Spacing.xs + 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  metaValue: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  metaValueBold: { fontSize: 15, fontWeight: '700' },

  progressSection: { gap: Spacing.xs },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  progressPct: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.text, borderRadius: Radius.full },
  progressDetail: { ...Typography.bodySmall, color: Colors.textMuted },

  notesBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 4,
  },
  notesLabel: { ...Typography.label },
  notesText: { ...Typography.bodySmall, color: Colors.textSecondary },

  itemsList: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  lineItem: { padding: Spacing.md, gap: Spacing.xs + 2 },
  lineItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },

  lineItemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  lineItemName: { flex: 1, ...Typography.h4 },
  lineItemAmount: { ...Typography.h4, color: Colors.text },

  lineItemMeta: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  lineItemRate: { ...Typography.bodySmall, color: Colors.textSecondary },
  lineItemUnit: { ...Typography.label },

  lineItemQtys: { flexDirection: 'row', gap: Spacing.md },
  qtyBlock: { gap: 2 },
  qtyLabel: { ...Typography.label },
  qtyValue: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  qtyValueComplete: { color: Colors.text },

  itemProgressBar: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  itemProgressFill: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.text },

  emptyItems: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyItemsText: { ...Typography.body, color: Colors.textMuted },
});
