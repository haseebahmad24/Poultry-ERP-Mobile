import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import SectionHeader from '@/components/SectionHeader';
import BackButton from '@/components/BackButton';
import OfflineBanner from '@/components/OfflineBanner';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'PurchaseOrders'>;

type StatusTab = 'all' | 'open' | 'progress';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'progress', label: 'In Progress' },
];

export default function PurchaseOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const cacheKey = `purchase-orders:${activeTab}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<PurchaseOrder[]>(cacheKey);
      if (cached) {
        setOrders(cached.data);
        setIsStale(cached.stale);
        setLoading(false);
        if (!cached.stale) return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else if (orders.length === 0) setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrders(
        activeTab === 'progress' ? 'progress' : activeTab === 'open' ? 'open' : 'all'
      );
      setOrders(data);
      setIsStale(false);
      await setCached(cacheKey, data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, cacheKey]);

  useEffect(() => { load(); }, [load]);

  if (error && orders.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  const filtered = search.trim()
    ? orders.filter((po) => {
        const q = search.toLowerCase();
        return (
          po.po_number?.toLowerCase().includes(q) ||
          po.vendor?.toLowerCase().includes(q) ||
          po.status?.toLowerCase().includes(q)
        );
      })
    : orders;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Purchase Orders</Text>
        {!loading && <Text style={styles.headerSub}>{filtered.length} records</Text>}
      </View>

      <OfflineBanner visible={!!(isStale && error)} />

      {loading ? (
        <ListScreenSkeleton count={6} showTabs showSearch />
      ) : (
        <>
          <View style={styles.searchContainer}>
            <Feather name="search" size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search PO number, vendor…"
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

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
            <SectionHeader title="Orders" meta={`${filtered.length} total`} />

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="shopping-cart" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {search ? 'No orders match search' : 'No purchase orders found'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {filtered.map((po) => (
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
        </>
      )}
    </SafeAreaView>
  );
}

function POCard({ po, onPress }: { po: PurchaseOrder; onPress: () => void }) {
  const total = po.total ?? 0;
  const received = po.received ?? 0;
  const progressPct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  const showProgress = received > 0 || (po.status ?? '').toUpperCase() === 'PARTIAL';
  const isClosed = ['CLOSED', 'CANCELLED'].includes((po.status ?? '').toUpperCase());

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.poNumber}>{po.po_number ?? `PO-${po.id}`}</Text>
          <Text style={styles.poVendor} numberOfLines={1}>{po.vendor ?? 'Unknown Vendor'}</Text>
        </View>
        <View style={[styles.statusBadge, isClosed && styles.statusBadgeMuted]}>
          <Text style={[styles.statusText, isClosed && styles.statusTextMuted]}>
            {po.status ?? 'UNKNOWN'}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {po.dt && (
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(po.dt)}</Text>
          </View>
        )}
        {po.delivery_date && (
          <View style={styles.metaItem}>
            <Feather name="truck" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(po.delivery_date)}</Text>
          </View>
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

      <View style={styles.cardFooter}>
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
  headerTitle: { ...Typography.h2, flex: 1 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.text },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.text, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusBadgeMuted: { opacity: 0.5 },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  statusTextMuted: { color: Colors.textSecondary },

  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  metaAmount: { fontSize: 14, fontWeight: '700', color: Colors.text, marginLeft: 'auto' },

  progressContainer: { gap: 4 },
  progressBar: {
    height: 3,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
  },
  progressText: { fontSize: 10, color: Colors.textMuted, textAlign: 'right' },

  cardFooter: { alignItems: 'flex-end' },

  emptyState: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted },
});
