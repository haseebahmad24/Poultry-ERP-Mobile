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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import DetailSkeleton from '@/components/DetailSkeleton';
import ErrorView from '@/components/ErrorView';
import SectionHeader from '@/components/SectionHeader';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import { fetchSalesOrders, SalesOrder } from '@/api/salesOrders';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type Props = NativeStackScreenProps<MoreStackParamList, 'PartnerDetail'>;

type Tab = 'orders' | 'sales';

export default function PartnerDetailScreen({ route, navigation }: Props) {
  const { partnerId, partnerName, isVendor, isCustomer } = route.params;

  const defaultTab: Tab = isVendor ? 'orders' : 'sales';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [sos, setSOs] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const fetches: Promise<void>[] = [];
      if (isVendor) {
        fetches.push(
          fetchPurchaseOrders('all').then((all) => {
            const filtered = all.filter(
              (po) =>
                po.vendor_id === partnerId ||
                po.vendor?.toLowerCase() === partnerName.toLowerCase()
            );
            setPOs(filtered);
          })
        );
      }
      if (isCustomer) {
        fetches.push(
          fetchSalesOrders('register').then((all) => {
            const filtered = all.filter(
              (so) =>
                so.customer_id === partnerId ||
                so.customer?.toLowerCase() === partnerName.toLowerCase()
            );
            setSOs(filtered);
          })
        );
      }
      await Promise.all(fetches);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [partnerId, partnerName, isVendor, isCustomer]);

  useEffect(() => { load(); }, [load]);

  const roles: string[] = [];
  if (isVendor) roles.push('Vendor');
  if (isCustomer) roles.push('Customer');

  const poTotal = pos.reduce((s, po) => s + (po.total ?? 0), 0);
  const soTotal = sos.reduce((s, so) => s + (so.total ?? 0), 0);

  const showTabs = isVendor && isCustomer;

  if (loading) return <SafeAreaView style={{flex:1,backgroundColor:'#fafafa'}} edges={['top']}><StatusBar style="dark" /><DetailSkeleton tileCount={4} listCount={5} /></SafeAreaView>;
  if (error && pos.length === 0 && sos.length === 0)
    return <ErrorView message={error} onRetry={() => load()} />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{partnerName}</Text>
          <Text style={styles.headerSub}>{roles.join(' · ')}</Text>
        </View>
      </View>

      {/* Summary tiles */}
      <View style={styles.summaryRow}>
        {isVendor && (
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{formatCurrency(poTotal)}</Text>
            <Text style={styles.summaryLabel}>Total POs</Text>
            <Text style={styles.summaryCount}>{pos.length} orders</Text>
          </View>
        )}
        {isCustomer && (
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{formatCurrency(soTotal)}</Text>
            <Text style={styles.summaryLabel}>Total SOs</Text>
            <Text style={styles.summaryCount}>{sos.length} orders</Text>
          </View>
        )}
      </View>

      {/* Tab bar — only when both roles */}
      {showTabs && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
            onPress={() => setActiveTab('orders')}
          >
            <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
              Purchase Orders ({pos.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'sales' && styles.tabActive]}
            onPress={() => setActiveTab('sales')}
          >
            <Text style={[styles.tabText, activeTab === 'sales' && styles.tabTextActive]}>
              Sales Orders ({sos.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.textMuted} />
        }
      >
        {/* Purchase Orders */}
        {isVendor && (!showTabs || activeTab === 'orders') && (
          <>
            <SectionHeader
              title="Purchase Orders"
              meta={`${pos.length} total · ${formatCurrency(poTotal)}`}
            />
            {pos.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="shopping-cart" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No purchase orders found</Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {pos.map((po) => (
                  <TouchableOpacity
                    key={po.id}
                    style={styles.card}
                    onPress={() => navigation.navigate('PurchaseOrderDetail', { id: po.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardInfo}>
                        <Text style={styles.orderNumber}>{po.po_number ?? `PO-${po.id}`}</Text>
                        {po.dt && (
                          <View style={styles.metaItem}>
                            <Feather name="calendar" size={11} color={Colors.textMuted} />
                            <Text style={styles.metaText}>{formatShortDate(po.dt)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardRight}>
                        <Text style={styles.amount}>{formatCurrency(po.total ?? 0)}</Text>
                        <POStatusBadge status={po.status} />
                      </View>
                    </View>
                    <View style={styles.cardFooter}>
                      <Feather name="chevron-right" size={13} color={Colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* Sales Orders */}
        {isCustomer && (!showTabs || activeTab === 'sales') && (
          <>
            <SectionHeader
              title="Sales Orders"
              meta={`${sos.length} total · ${formatCurrency(soTotal)}`}
            />
            {sos.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="package" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No sales orders found</Text>
              </View>
            ) : (
              <View style={styles.cardList}>
                {sos.map((so) => (
                  <TouchableOpacity
                    key={so.id}
                    style={styles.card}
                    onPress={() => navigation.navigate('SalesOrderDetail', { id: so.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardInfo}>
                        <Text style={styles.orderNumber}>{so.so_number ?? `SO-${so.id}`}</Text>
                        {so.dt && (
                          <View style={styles.metaItem}>
                            <Feather name="calendar" size={11} color={Colors.textMuted} />
                            <Text style={styles.metaText}>{formatShortDate(so.dt)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardRight}>
                        <Text style={styles.amount}>{formatCurrency(so.total ?? 0)}</Text>
                        <POStatusBadge status={so.status} />
                      </View>
                    </View>
                    <View style={styles.cardFooter}>
                      <Feather name="chevron-right" size={13} color={Colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function POStatusBadge({ status }: { status?: string }) {
  const MUTED = ['CLOSED', 'CANCELLED', 'REJECTED'];
  const isMuted = MUTED.includes((status ?? '').toUpperCase());
  return (
    <View style={[styles.statusBadge, isMuted && { opacity: 0.5 }]}>
      <Text style={styles.statusText}>{status ?? 'UNKNOWN'}</Text>
    </View>
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
  headerInfo: { flex: 1 },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  summaryValue: { ...Typography.h2, fontSize: 20 },
  summaryLabel: { ...Typography.label, marginTop: 2 },
  summaryCount: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardInfo: { flex: 1, gap: 4 },
  orderNumber: { ...Typography.h4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardFooter: { alignItems: 'flex-end' },

  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statusText: { fontSize: 10, fontWeight: '700', color: Colors.text },

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
