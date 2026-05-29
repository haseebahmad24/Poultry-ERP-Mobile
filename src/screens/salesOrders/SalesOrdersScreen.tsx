import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { fetchSalesOrders, SalesOrder } from '@/api/salesOrders';
import ErrorView from '@/components/ErrorView';
import ListScreenSkeleton from '@/components/ListScreenSkeleton';
import SectionHeader from '@/components/SectionHeader';
import CompanySelector from '@/components/CompanySelector';
import { useCompany } from '@/context/CompanyContext';
import BackButton from '@/components/BackButton';
import OfflineBanner from '@/components/OfflineBanner';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { getCached, setCached } from '@/utils/cache';
import { exportSOListPDF } from '@/utils/pdfExport';
import { MoreStackParamList } from '@/navigation/MoreNavigator';
import DateRangeBar, { DateRangeValue } from '@/components/DateRangeBar';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'SalesOrders'>;

type DeliveryUrgency = 'overdue' | 'today' | 'urgent' | 'soon' | null;
interface DeliveryStatus { label: string; urgency: DeliveryUrgency }

function getDeliveryStatus(deliveryDate: string | undefined, status: string | undefined): DeliveryStatus | null {
  const s = (status ?? '').toUpperCase();
  if (!deliveryDate || ['CLOSED', 'CANCELLED', 'DELIVERED', 'COMPLETE'].includes(s)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deliveryDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, urgency: 'overdue' };
  if (days === 0) return { label: 'Due today', urgency: 'today' };
  if (days <= 3) return { label: `Due in ${days}d`, urgency: 'urgent' };
  if (days <= 7) return { label: `Due in ${days}d`, urgency: 'soon' };
  return null;
}

type StatusTab = 'register' | 'open' | 'approved' | 'closed';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'register', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'approved', label: 'Approved' },
  { key: 'closed', label: 'Closed' },
];

export default function SalesOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const { companyId } = useCompany();
  const [activeTab, setActiveTab] = useState<StatusTab>('register');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });

  const cacheKey = `sales-orders:${activeTab}:${companyId ?? 'all'}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = await getCached<SalesOrder[]>(cacheKey);
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
      const data = await fetchSalesOrders(activeTab, { companyId });
      setOrders(data);
      setIsStale(false);
      await setCached(cacheKey, data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, companyId, cacheKey]);

  useEffect(() => { load(); }, [load]);

  if (error && orders.length === 0) return <ErrorView message={error} onRetry={() => load()} />;

  const filtered = orders.filter((so) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesSearch =
        so.so_number?.toLowerCase().includes(q) ||
        so.customer?.toLowerCase().includes(q) ||
        so.status?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (dateRange.from && so.dt && so.dt < dateRange.from) return false;
    if (dateRange.to && so.dt && so.dt > dateRange.to) return false;
    return true;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const tabLabel = STATUS_TABS.find((t) => t.key === activeTab)?.label ?? 'All';
      await exportSOListPDF({ orders: filtered, tabLabel });
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Sales Orders</Text>
        {!loading && <Text style={styles.headerSub}>{filtered.length} records</Text>}
        {!loading && filtered.length > 0 && (
          exporting ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : (
            <TouchableOpacity
              onPress={handleExport}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="file-text" size={18} color={Colors.text} />
            </TouchableOpacity>
          )
        )}
      </View>

      <OfflineBanner visible={!!(isStale && error)} />
      <CompanySelector showAll />

      {loading ? (
        <ListScreenSkeleton count={6} showTabs showSearch />
      ) : (
        <>
          <View style={styles.searchContainer}>
            <Feather name="search" size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search SO number, customer…"
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

          <DateRangeBar value={dateRange} onChange={setDateRange} />

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
                <Feather name="package" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {search ? 'No orders match search' : 'No sales orders found'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {filtered.map((so) => (
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
        </>
      )}
    </SafeAreaView>
  );
}

function SOCard({ so, onPress }: { so: SalesOrder; onPress: () => void }) {
  const isClosed = ['CLOSED', 'CANCELLED'].includes((so.status ?? '').toUpperCase());
  const delivery = getDeliveryStatus(so.delivery_date, so.status);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.soNumber}>{so.so_number ?? `SO-${so.id}`}</Text>
          <Text style={styles.soCustomer} numberOfLines={1}>
            {so.customer ?? 'Unknown Customer'}
          </Text>
        </View>
        <View style={[styles.statusBadge, isClosed && styles.statusBadgeMuted]}>
          <Text style={[styles.statusText, isClosed && styles.statusTextMuted]}>
            {so.status ?? 'UNKNOWN'}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {so.dt && (
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(so.dt)}</Text>
          </View>
        )}
        {so.delivery_date && (
          <View style={styles.metaItem}>
            <Feather name="truck" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatShortDate(so.delivery_date)}</Text>
          </View>
        )}
        {so.total != null && (
          <Text style={styles.metaAmount}>{formatCurrency(so.total)}</Text>
        )}
      </View>

      {delivery && (
        <View style={[styles.deliveryChip, delivery.urgency === 'overdue' && styles.deliveryChipOverdue]}>
          <Feather
            name={delivery.urgency === 'overdue' ? 'alert-circle' : 'clock'}
            size={11}
            color={Colors.text}
          />
          <Text style={styles.deliveryChipText}>{delivery.label}</Text>
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
  tabText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
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
  soNumber: { ...Typography.h4 },
  soCustomer: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

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

  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
  },
  deliveryChipOverdue: {
    borderColor: Colors.text,
    backgroundColor: Colors.borderLight,
  },
  deliveryChipText: { fontSize: 11, fontWeight: '600', color: Colors.text },

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
