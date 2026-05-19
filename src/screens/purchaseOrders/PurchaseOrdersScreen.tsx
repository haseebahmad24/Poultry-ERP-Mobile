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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'PurchaseOrders'>;

type StatusTab = 'all' | 'open' | 'progress';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'progress', label: 'In Progress' },
];

const PO_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  OPEN:      { bg: Colors.primaryBg,  fg: Colors.primary },
  APPROVED:  { bg: Colors.successBg,  fg: Colors.success },
  CLOSED:    { bg: Colors.borderLight, fg: Colors.textSecondary },
  CANCELLED: { bg: Colors.dangerBg,   fg: Colors.danger },
  DRAFT:     { bg: Colors.warningBg,  fg: Colors.warning },
  PARTIAL:   { bg: Colors.orangeBg,   fg: Colors.orange },
};

export default function PurchaseOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrders(activeTab === 'progress' ? 'progress' : activeTab === 'open' ? 'open' : 'all');
      setOrders(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView message="Loading purchase orders…" />;
  if (error && orders.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton color={Colors.primary} />
        <Text style={styles.headerTitle}>Purchase Orders</Text>
        <Text style={styles.headerSub}>{orders.length} records</Text>
      </View>

      {/* Status Tab Bar */}
      <View style={styles.tabBar}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
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
        <SectionHeader title="Orders" meta={`${orders.length} total`} />

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyText}>No purchase orders found</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {orders.map((po) => (
              <POCard
                key={po.id}
                po={po}
                onPress={() => navigation.navigate('PurchaseOrderDetail', { id: po.id })}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function POCard({ po, onPress }: { po: PurchaseOrder; onPress: () => void }) {
  const statusKey = (po.status ?? '').toUpperCase();
  const statusColors = PO_STATUS_COLORS[statusKey] ?? {
    bg: Colors.borderLight,
    fg: Colors.textSecondary,
  };

  const total = po.total ?? 0;
  const received = po.received ?? 0;
  const progressPct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  const showProgress = received > 0 || (po.status ?? '').toUpperCase() === 'PARTIAL';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.poNumber}>{po.po_number ?? `PO-${po.id}`}</Text>
          <Text style={styles.poVendor} numberOfLines={1}>{po.vendor ?? 'Unknown Vendor'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.fg }]}>
            {po.status ?? 'UNKNOWN'}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {po.dt && (
          <Text style={styles.metaText}>📅 {formatShortDate(po.dt)}</Text>
        )}
        {po.delivery_date && (
          <Text style={styles.metaText}>🚚 {formatShortDate(po.delivery_date)}</Text>
        )}
        <Text style={styles.metaAmount}>{formatCurrency(total)}</Text>
      </View>

      {showProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progressPct)}% received</Text>
        </View>
      )}

      <Text style={styles.tapHint}>Tap for details →</Text>
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

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  cardList: {
    marginHorizontal: Spacing.md,
    gap: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardInfo: { flex: 1 },
  poNumber: { ...Typography.h4 },
  poVendor: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  metaAmount: { fontSize: 14, fontWeight: '700', color: Colors.text, marginLeft: 'auto' },

  progressContainer: { gap: 4 },
  progressBar: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: Radius.full,
  },
  progressText: { fontSize: 10, color: Colors.textMuted, textAlign: 'right' },

  tapHint: { fontSize: 11, color: Colors.textMuted, textAlign: 'right' },

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
