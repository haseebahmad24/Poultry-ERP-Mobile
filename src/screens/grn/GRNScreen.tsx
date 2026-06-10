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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import { exportGRNPDF } from '@/utils/pdfExport';
import { useCompany } from '@/context/CompanyContext';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import OfflineBanner from '@/components/OfflineBanner';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import { getCached, setCached } from '@/utils/cache';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

type GRNNavProp = NativeStackNavigationProp<MoreStackParamList, 'GRN'>;

export default function GRNScreen() {
  const navigation = useNavigation<GRNNavProp>();
  const { selectedCompany } = useCompany();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<PurchaseOrder[]>('grn:progress');
      if (cached) {
        setOrders(cached.data);
        setStale(cached.stale);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrders('progress');
      setOrders(data);
      setStale(false);
      await setCached('grn:progress', data);
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

  const handleExportPDF = async () => {
    await exportGRNPDF({
      companyName: selectedCompany?.name ?? 'All Companies',
      orders,
    });
  };

  if (error && orders.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Goods Receipt</Text>
        {!loading && <Text style={styles.headerSub}>{orders.length} POs</Text>}
        {!loading && orders.length > 0 && (
          <TouchableOpacity style={styles.pdfBtn} onPress={handleExportPDF}>
            <Feather name="file-text" size={18} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <OfflineBanner visible={!!(stale && error)} />

      {loading ? <ListScreenSkeleton count={5} showTabs={false} showSearch={false} /> : <ScrollView
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
        {orders.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Overall Receipt Progress</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{orders.length}</Text>
                <Text style={styles.summaryLabel}>Purchase Orders</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryValue}>{Math.round(overallPct)}%</Text>
                <Text style={styles.summaryLabel}>Received</Text>
              </View>
            </View>
            <View style={styles.overallProgressBar}>
              <View style={[styles.overallProgressFill, { width: `${overallPct}%` as any }]} />
            </View>
          </View>
        )}

        <SectionHeader title="Receipt Status by PO" meta={`${orders.length} records`} />

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="truck" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No goods receipt data found</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {orders.map((po) => (
              <GRNCard
                key={po.id}
                po={po}
                onPress={() => navigation.navigate('PurchaseOrderDetail', { id: po.id })}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>}
    </SafeAreaView>
  );
}

function GRNCard({ po, onPress }: { po: PurchaseOrder; onPress: () => void }) {
  const received = po.received ?? 0;
  const total = po.total ?? 0;
  const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  const isComplete = pct >= 100;
  const isPartial = pct > 0 && !isComplete;

  const statusLabel = isComplete ? 'COMPLETE' : isPartial ? 'PARTIAL' : ((po.status ?? '').toUpperCase() || 'OPEN');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.poNumber}>{po.po_number ?? `PO-${po.id}`}</Text>
          <Text style={styles.poVendor} numberOfLines={1}>
            {po.vendor ?? 'Unknown Vendor'}
          </Text>
        </View>
        <View style={[styles.statusBadge, isComplete && styles.statusBadgeComplete]}>
          <Text style={[styles.statusText, isComplete && styles.statusTextComplete]}>{statusLabel}</Text>
        </View>
      </View>

      {po.dt && (
        <View style={styles.metaRow}>
          <Feather name="calendar" size={12} color={Colors.textMuted} />
          <Text style={styles.cardDate}>PO Date: {formatShortDate(po.dt)}</Text>
        </View>
      )}

      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Receipt Progress</Text>
          <Text style={[styles.progressPct, isComplete && styles.progressPctComplete]}>
            {Math.round(pct)}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={styles.progressDetail}>
          {formatCurrency(received)} of {formatCurrency(total)} received
        </Text>
      </View>

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
                <Text style={[styles.itemPct, itemPct >= 100 && styles.itemPctComplete]}>
                  {Math.round(itemPct)}%
                </Text>
              </View>
            );
          })}
          {po.items.length > 3 && (
            <Text style={styles.moreItems}>+{po.items.length - 3} more items — tap to view all</Text>
          )}
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>View PO detail</Text>
        <Feather name="chevron-right" size={14} color={Colors.textMuted} />
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
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, flex: 1 },
  pdfBtn: { padding: 4 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  summaryCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  summaryTitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryRow: { flexDirection: 'row', gap: Spacing.xl },
  summaryBlock: { gap: 2 },
  summaryValue: { fontSize: 28, fontWeight: '700', color: Colors.text },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary },
  overallProgressBar: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
  },

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
  cardInfo: { flex: 1 },
  poNumber: { ...Typography.h4 },
  poVendor: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeComplete: { backgroundColor: Colors.text, borderColor: Colors.text },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  statusTextComplete: { color: Colors.surface },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { ...Typography.bodySmall, color: Colors.textSecondary },

  progressSection: { gap: 4 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  progressPct: { ...Typography.bodySmall, fontWeight: '700', color: Colors.textSecondary },
  progressPctComplete: { color: Colors.text },
  progressBar: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.text,
  },
  progressDetail: { ...Typography.bodySmall, color: Colors.textMuted },

  itemsPreview: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  itemsLabel: { ...Typography.label, marginBottom: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemName: { flex: 1, fontSize: 12, color: Colors.text },
  itemQty: { fontSize: 12, color: Colors.textSecondary },
  itemPct: { fontSize: 11, fontWeight: '600', minWidth: 32, textAlign: 'right', color: Colors.textMuted },
  itemPctComplete: { color: Colors.text, fontWeight: '700' },
  moreItems: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  cardFooterText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
