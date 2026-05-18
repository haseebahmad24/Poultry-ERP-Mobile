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
import { fetchSalesOrders, SalesOrder } from '@/api/salesOrders';
import LoadingView from '@/components/LoadingView';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'SalesOrders'>;

type StatusTab = 'register' | 'open' | 'approved' | 'closed';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'register', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'approved', label: 'Approved' },
  { key: 'closed', label: 'Closed' },
];

const SO_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  OPEN:      { bg: Colors.primaryBg,   fg: Colors.primary },
  APPROVED:  { bg: Colors.successBg,   fg: Colors.success },
  CLOSED:    { bg: Colors.borderLight, fg: Colors.textSecondary },
  CANCELLED: { bg: Colors.dangerBg,    fg: Colors.danger },
  DRAFT:     { bg: Colors.warningBg,   fg: Colors.warning },
  PARTIAL:   { bg: Colors.orangeBg,    fg: Colors.orange },
  DELIVERED: { bg: Colors.successBg,   fg: Colors.success },
};

export default function SalesOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<StatusTab>('register');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchSalesOrders(activeTab);
      setOrders(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView message="Loading sales orders…" />;
  if (error && orders.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales Orders</Text>
        <Text style={styles.headerSub}>{orders.length} records</Text>
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
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No sales orders found</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {orders.map((so) => (
              <SOCard
                key={so.id}
                so={so}
                onPress={() => navigation.navigate('SalesOrderDetail', { id: so.id })}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SOCard({ so, onPress }: { so: SalesOrder; onPress: () => void }) {
  const statusKey = (so.status ?? '').toUpperCase();
  const statusColors = SO_STATUS_COLORS[statusKey] ?? {
    bg: Colors.borderLight,
    fg: Colors.textSecondary,
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.soNumber}>{so.so_number ?? `SO-${so.id}`}</Text>
          <Text style={styles.soCustomer} numberOfLines={1}>
            {so.customer ?? 'Unknown Customer'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.fg }]}>
            {so.status ?? 'UNKNOWN'}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {so.dt && <Text style={styles.metaText}>📅 {formatShortDate(so.dt)}</Text>}
        {so.delivery_date && (
          <Text style={styles.metaText}>🚚 {formatShortDate(so.delivery_date)}</Text>
        )}
        {so.total != null && (
          <Text style={styles.metaAmount}>{formatCurrency(so.total)}</Text>
        )}
      </View>

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
  tabText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

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
  soNumber: { ...Typography.h4 },
  soCustomer: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  metaAmount: { fontSize: 14, fontWeight: '700', color: Colors.text, marginLeft: 'auto' },

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
