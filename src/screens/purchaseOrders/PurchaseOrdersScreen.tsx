import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import ErrorView from '@/components/ErrorView';
import LoadingView from '@/components/LoadingView';
import { Colors, Radius, Shadow, Spacing } from '@/theme';
import { formatCurrency, formatShortDate } from '@/utils/currency';

const STATUS_TABS = ['All', 'Open', 'Approved', 'Closed', 'Draft'];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open:     { bg: '#e3f2fd', fg: '#1565c0' },
  Open:     { bg: '#e3f2fd', fg: '#1565c0' },
  OPEN:     { bg: '#e3f2fd', fg: '#1565c0' },
  approved: { bg: '#e8f5e9', fg: '#2e7d32' },
  Approved: { bg: '#e8f5e9', fg: '#2e7d32' },
  APPROVED: { bg: '#e8f5e9', fg: '#2e7d32' },
  closed:   { bg: '#f5f5f5', fg: '#546e7a' },
  Closed:   { bg: '#f5f5f5', fg: '#546e7a' },
  CLOSED:   { bg: '#f5f5f5', fg: '#546e7a' },
  draft:    { bg: '#fff3e0', fg: '#e65100' },
  Draft:    { bg: '#fff3e0', fg: '#e65100' },
  DRAFT:    { bg: '#fff3e0', fg: '#e65100' },
  cancelled:{ bg: '#fce4ec', fg: '#c62828' },
  Cancelled:{ bg: '#fce4ec', fg: '#c62828' },
  partial:  { bg: '#f3e5f5', fg: '#6a1b9a' },
  Partial:  { bg: '#f3e5f5', fg: '#6a1b9a' },
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#f5f5f5', fg: '#546e7a' };
}

export default function PurchaseOrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('All');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrders({ view: 'all' });
      setOrders(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (activeTab === 'All') return orders;
    return orders.filter(
      (o) => o.status?.toLowerCase() === activeTab.toLowerCase()
    );
  }, [orders, activeTab]);

  // Count per status
  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { All: orders.length };
    for (const o of orders) {
      const s = o.status?.toLowerCase() ?? '';
      STATUS_TABS.slice(1).forEach((tab) => {
        if (s === tab.toLowerCase()) {
          counts[tab] = (counts[tab] ?? 0) + 1;
        }
      });
    }
    return counts;
  }, [orders]);

  if (loading) return <LoadingView message="Loading purchase orders…" />;
  if (error) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Purchase Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScrollView}
        contentContainerStyle={styles.tabScrollContent}
      >
        {STATUS_TABS.map((tab) => {
          const count = countByStatus[tab] ?? 0;
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.statusTab, isActive && styles.statusTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.statusTabText, isActive && styles.statusTabTextActive]}>
                {tab}
              </Text>
              {count > 0 && (
                <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                  <Text style={[styles.countBadgeText, isActive && styles.countBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* PO List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'All'
                ? 'No purchase orders found'
                : `No ${activeTab.toLowerCase()} purchase orders`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <POCard
            po={item}
            onPress={() => navigation.navigate('PODetail', { id: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function POCard({ po, onPress }: { po: PurchaseOrder; onPress: () => void }) {
  const sc = getStatusColor(po.status);
  const receivedPct =
    po.ordered_qty && po.ordered_qty > 0
      ? Math.min(100, Math.round(((po.received_qty ?? 0) / po.ordered_qty) * 100))
      : null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      {/* Row 1: PO number + status */}
      <View style={styles.cardHeader}>
        <View style={styles.poNumberRow}>
          <View style={styles.poBadge}>
            <Text style={styles.poBadgeText}>PO</Text>
          </View>
          <Text style={styles.poNumber} numberOfLines={1}>
            {po.po_number ?? `#${po.id}`}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusBadgeText, { color: sc.fg }]}>{po.status}</Text>
        </View>
      </View>

      {/* Row 2: Vendor + date */}
      <View style={styles.cardMeta}>
        <Text style={styles.vendorName} numberOfLines={1}>
          {po.vendor_name ?? 'Unknown Vendor'}
        </Text>
        <Text style={styles.poDate}>{po.dt ? formatShortDate(po.dt) : '—'}</Text>
      </View>

      {/* Row 3: Amount + progress */}
      <View style={styles.cardFooter}>
        <Text style={styles.poAmount}>{formatCurrency(po.total_amount ?? 0)}</Text>
        {po.company_name ? (
          <Text style={styles.poCompany}>{po.company_name}</Text>
        ) : null}
      </View>

      {/* Progress bar */}
      {receivedPct != null && (
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Received</Text>
            <Text style={styles.progressPct}>{receivedPct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${receivedPct}%`,
                  backgroundColor:
                    receivedPct >= 100
                      ? Colors.success
                      : receivedPct > 50
                      ? Colors.primary
                      : Colors.warning,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Chevron */}
      <View style={styles.chevron}>
        <Text style={styles.chevronText}>›</Text>
      </View>
    </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  tabScrollView: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    maxHeight: 52,
  },
  tabScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  statusTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    gap: 5,
  },
  statusTabActive: { backgroundColor: Colors.primary },
  statusTabText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  statusTabTextActive: { color: '#fff' },
  countBadge: {
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  countBadgeTextActive: { color: '#fff' },

  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: 10,
    ...Shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  poNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  poBadge: {
    backgroundColor: Colors.voucherPO.bg,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  poBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.voucherPO.fg },
  poNumber: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  vendorName: { fontSize: 13, color: Colors.textSecondary, flex: 1, paddingRight: 8 },
  poDate: { fontSize: 12, color: Colors.textMuted },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  poAmount: { fontSize: 15, fontWeight: '700', color: Colors.text },
  poCompany: { fontSize: 11, color: Colors.textMuted },

  progressSection: { marginTop: 10 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: { fontSize: 11, color: Colors.textMuted },
  progressPct: { fontSize: 11, fontWeight: '600', color: Colors.text },
  progressTrack: {
    height: 5,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: Radius.full },

  chevron: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
  },
  chevronText: { fontSize: 20, color: Colors.textMuted },

  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
