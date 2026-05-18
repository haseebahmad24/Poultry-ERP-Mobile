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
import { fetchSODetail, SalesOrder, SOItem } from '@/api/salesOrders';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import { formatCurrency, formatDate } from '@/utils/currency';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type RouteProps = RouteProp<MoreStackParamList, 'SalesOrderDetail'>;

const SO_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  OPEN:      { bg: Colors.primaryBg,   fg: Colors.primary },
  APPROVED:  { bg: Colors.successBg,   fg: Colors.success },
  CLOSED:    { bg: Colors.borderLight, fg: Colors.textSecondary },
  CANCELLED: { bg: Colors.dangerBg,    fg: Colors.danger },
  DRAFT:     { bg: Colors.warningBg,   fg: Colors.warning },
  DELIVERED: { bg: Colors.successBg,   fg: Colors.success },
};

export default function SalesOrderDetailScreen() {
  const route = useRoute<RouteProps>();
  const { id } = route.params;

  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchSODetail(id);
      setSo(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView message="Loading sales order…" />;
  if (error && !so) return <ErrorView message={error} onRetry={() => load()} />;
  if (!so) return <ErrorView message="Order not found" />;

  const statusKey = (so.status ?? '').toUpperCase();
  const statusColors = SO_STATUS_COLORS[statusKey] ?? {
    bg: Colors.borderLight,
    fg: Colors.textSecondary,
  };

  const items = so.items ?? [];

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
        {/* SO Header */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroInfo}>
              <Text style={styles.soNumber}>{so.so_number ?? `SO-${so.id}`}</Text>
              <Text style={styles.soCustomer}>{so.customer ?? 'Unknown Customer'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.fg }]}>
                {so.status ?? '—'}
              </Text>
            </View>
          </View>

          <View style={styles.heroMeta}>
            {so.dt && <MetaRow label="Order Date" value={formatDate(so.dt)} />}
            {so.delivery_date && (
              <MetaRow label="Delivery Date" value={formatDate(so.delivery_date)} />
            )}
            {so.total != null && (
              <MetaRow label="Total Amount" value={formatCurrency(so.total)} bold />
            )}
          </View>

          {so.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{so.notes}</Text>
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
              <SOLineItem
                key={item.id ?? idx}
                item={item}
                isLast={idx === items.length - 1}
              />
            ))}
            {/* Total row */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(so.total ?? items.reduce((s, i) => s + (i.amount ?? 0), 0))}
              </Text>
            </View>
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

function SOLineItem({ item, isLast }: { item: SOItem; isLast: boolean }) {
  return (
    <View style={[styles.lineItem, !isLast && styles.lineItemBorder]}>
      <View style={styles.lineItemHeader}>
        <Text style={styles.lineItemName} numberOfLines={2}>{item.item_name}</Text>
        {item.amount != null && (
          <Text style={styles.lineItemAmount}>{formatCurrency(item.amount)}</Text>
        )}
      </View>
      <View style={styles.lineItemMeta}>
        <Text style={styles.lineItemQty}>
          Qty: <Text style={styles.lineItemQtyVal}>{item.qty.toLocaleString()}</Text>
          {item.unit ? ` ${item.unit}` : ''}
        </Text>
        {item.rate != null && (
          <Text style={styles.lineItemRate}>@ {formatCurrency(item.rate)}</Text>
        )}
      </View>
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

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  heroInfo: { flex: 1 },
  soNumber: { ...Typography.h2 },
  soCustomer: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: 12, fontWeight: '700' },

  heroMeta: { gap: Spacing.xs + 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  metaValue: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  metaValueBold: { fontSize: 15, fontWeight: '700' },

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

  lineItemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  lineItemName: { flex: 1, ...Typography.h4 },
  lineItemAmount: { ...Typography.h4, color: Colors.primary },

  lineItemMeta: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  lineItemQty: { fontSize: 13, color: Colors.textSecondary },
  lineItemQtyVal: { fontWeight: '700', color: Colors.text },
  lineItemRate: { fontSize: 12, color: Colors.textMuted },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.primaryBg,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  totalValue: { fontSize: 17, fontWeight: '700', color: Colors.primary },

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
