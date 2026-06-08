import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MoreStackParamList } from '@/navigation/MoreNavigator';
import type { AppTabParamList } from '@/navigation/AppNavigator';
import type { InventoryStackParamList } from '@/navigation/InventoryNavigator';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { fetchPurchaseOrders, PurchaseOrder } from '@/api/purchaseOrders';
import { fetchSalesOrders, SalesOrder } from '@/api/salesOrders';
import { fetchMaterials, Material } from '@/api/materials';
import { fetchPartners, Partner } from '@/api/partners';
import { fetchStockBalances, StockBalance } from '@/api/inventory';
import { fetchAPBills, APBill } from '@/api/accountsPayable';
import { fetchARInvoices, ARInvoice } from '@/api/accountsReceivable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCached, setCached } from '@/utils/cache';
import { formatCurrency } from '@/utils/currency';

const SEARCH_HISTORY_KEY = 'search:recent';
const MAX_HISTORY = 8;

async function loadSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveSearchHistory(term: string, existing: string[]): Promise<string[]> {
  const deduped = existing.filter((t) => t.toLowerCase() !== term.toLowerCase());
  const updated = [term, ...deduped].slice(0, MAX_HISTORY);
  try {
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // non-fatal
  }
  return updated;
}

async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // non-fatal
  }
}

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type TabNav = BottomTabNavigationProp<AppTabParamList>;

type ResultType = 'po' | 'so' | 'material' | 'partner' | 'stock' | 'bill' | 'invoice';

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  badge?: string;
  rawId: number;
  partnerMeta?: {
    partnerName: string;
    isVendor: boolean;
    isCustomer: boolean;
  };
  stockMeta?: {
    item_id?: number;
    item_name: string;
    item_code?: string;
  };
  materialMeta?: {
    code?: string;
    type?: string;
    unit?: string;
    category?: string;
    status?: string;
    description?: string;
  };
  billMeta?: {
    vendorId?: number;
    vendorName?: string;
    outstanding?: number;
  };
  invoiceMeta?: {
    customerId?: number;
    customerName?: string;
    outstanding?: number;
  };
}

interface SectionData {
  key: ResultType;
  label: string;
  icon: string;
  count: number;
  items: SearchResult[];
}

const TYPE_ICONS: Record<ResultType, string> = {
  po: 'shopping-cart',
  so: 'package',
  material: 'layers',
  partner: 'users',
  stock: 'box',
  bill: 'file-text',
  invoice: 'file-text',
};

const TYPE_LABELS: Record<ResultType, string> = {
  po: 'Purchase Orders',
  so: 'Sales Orders',
  material: 'Materials',
  partner: 'Business Partners',
  stock: 'Stock Balances',
  bill: 'AP Bills',
  invoice: 'AR Invoices',
};

function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(q));
}

function poToResult(po: PurchaseOrder): SearchResult {
  return {
    type: 'po',
    id: `po-${po.id}`,
    rawId: po.id,
    title: po.po_number ?? `PO #${po.id}`,
    subtitle: po.vendor ?? 'Unknown vendor',
    meta: po.total != null ? formatCurrency(po.total) : undefined,
    badge: po.status,
  };
}

function soToResult(so: SalesOrder): SearchResult {
  return {
    type: 'so',
    id: `so-${so.id}`,
    rawId: so.id,
    title: so.so_number ?? `SO #${so.id}`,
    subtitle: so.customer ?? 'Unknown customer',
    meta: so.total != null ? formatCurrency(so.total) : undefined,
    badge: so.status,
  };
}

function materialToResult(mat: Material): SearchResult {
  return {
    type: 'material',
    id: `mat-${mat.id}`,
    rawId: mat.id,
    title: mat.name,
    subtitle: [mat.type, mat.code].filter(Boolean).join(' · ') || 'Material',
    badge: mat.status,
    materialMeta: {
      code: mat.code,
      type: mat.type,
      unit: mat.unit,
      category: mat.category,
      status: mat.status,
      description: mat.description,
    },
  };
}

function partnerToResult(p: Partner): SearchResult {
  const roles = [p.is_customer && 'Customer', p.is_vendor && 'Vendor']
    .filter(Boolean)
    .join(' / ');
  return {
    type: 'partner',
    id: `partner-${p.id}`,
    rawId: p.id,
    title: p.name,
    subtitle: [roles || p.type, p.email].filter(Boolean).join(' · ') || 'Partner',
    partnerMeta: {
      partnerName: p.name,
      isVendor: !!p.is_vendor,
      isCustomer: !!p.is_customer,
    },
  };
}

function stockToResult(s: StockBalance, idx: number): SearchResult {
  return {
    type: 'stock',
    id: `stock-${s.item_id ?? idx}-${s.warehouse_id ?? 0}`,
    rawId: s.item_id ?? idx,
    title: s.item_name,
    subtitle: s.warehouse_name ?? 'All warehouses',
    meta: `${s.qty}${s.unit ? ` ${s.unit}` : ''}`,
    stockMeta: {
      item_id: s.item_id,
      item_name: s.item_name,
      item_code: s.item_code,
    },
  };
}

function billToResult(b: APBill): SearchResult {
  const outstanding = b.outstanding ?? b.amount ?? 0;
  return {
    type: 'bill',
    id: `bill-${b.id}`,
    rawId: b.id,
    title: b.bill_number ?? `Bill #${b.id}`,
    subtitle: b.vendor ?? 'Unknown vendor',
    meta: formatCurrency(outstanding),
    badge: b.status,
    billMeta: {
      vendorId: b.vendor_id,
      vendorName: b.vendor,
      outstanding,
    },
  };
}

function invoiceToResult(inv: ARInvoice): SearchResult {
  const outstanding = inv.outstanding ?? inv.amount ?? 0;
  return {
    type: 'invoice',
    id: `invoice-${inv.id}`,
    rawId: inv.id,
    title: inv.invoice_number ?? `Invoice #${inv.id}`,
    subtitle: inv.customer ?? 'Unknown customer',
    meta: formatCurrency(outstanding),
    badge: inv.status,
    invoiceMeta: {
      customerId: inv.customer_id,
      customerName: inv.customer,
      outstanding,
    },
  };
}

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [allPOs, setAllPOs] = useState<PurchaseOrder[]>([]);
  const [allSOs, setAllSOs] = useState<SalesOrder[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [allStock, setAllStock] = useState<StockBalance[]>([]);
  const [allBills, setAllBills] = useState<APBill[]>([]);
  const [allInvoices, setAllInvoices] = useState<ARInvoice[]>([]);

  // Load all data sources (cache-first). AP/AR bills/invoices reuse the AP/AR screen cache keys.
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cachedPOs, cachedSOs, cachedMats, cachedPartners, cachedStock, cachedAP, cachedAR] = await Promise.all([
        getCached<PurchaseOrder[]>('search:pos'),
        getCached<SalesOrder[]>('search:sos'),
        getCached<Material[]>('search:materials'),
        getCached<Partner[]>('search:partners'),
        getCached<StockBalance[]>('search:stock'),
        getCached<{ bills: APBill[] }>('ap:all'),
        getCached<{ invoices: ARInvoice[] }>('ar:all'),
      ]);

      if (cachedPOs) setAllPOs(cachedPOs.data);
      if (cachedSOs) setAllSOs(cachedSOs.data);
      if (cachedMats) setAllMaterials(cachedMats.data);
      if (cachedPartners) setAllPartners(cachedPartners.data);
      if (cachedStock) setAllStock(cachedStock.data);
      if (cachedAP?.data.bills) setAllBills(cachedAP.data.bills);
      if (cachedAR?.data.invoices) setAllInvoices(cachedAR.data.invoices);

      const needsRefresh =
        !cachedPOs || cachedPOs.stale ||
        !cachedSOs || cachedSOs.stale ||
        !cachedMats || cachedMats.stale ||
        !cachedPartners || cachedPartners.stale ||
        !cachedStock || cachedStock.stale;

      const needsBillsRefresh = !cachedAP || cachedAP.stale;
      const needsInvoicesRefresh = !cachedAR || cachedAR.stale;

      if (needsRefresh) {
        const [pos, sos, mats, parts, stock] = await Promise.all([
          fetchPurchaseOrders('all').catch(() => [] as PurchaseOrder[]),
          fetchSalesOrders('register').catch(() => [] as SalesOrder[]),
          fetchMaterials().catch(() => [] as Material[]),
          fetchPartners().catch(() => [] as Partner[]),
          fetchStockBalances().catch(() => [] as StockBalance[]),
        ]);
        setAllPOs(pos);
        setAllSOs(sos);
        setAllMaterials(mats);
        setAllPartners(parts);
        setAllStock(stock);
        await Promise.all([
          setCached('search:pos', pos),
          setCached('search:sos', sos),
          setCached('search:materials', mats),
          setCached('search:partners', parts),
          setCached('search:stock', stock),
        ]);
      }

      if (needsBillsRefresh) {
        fetchAPBills().then((bills) => {
          setAllBills(bills);
        }).catch(() => {});
      }

      if (needsInvoicesRefresh) {
        fetchARInvoices().then((invoices) => {
          setAllInvoices(invoices);
        }).catch(() => {});
      }
    } catch {
      // ignore — show whatever was loaded from cache
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    loadData();
    loadSearchHistory().then(setRecentSearches);
  }, [loadData]);

  const q = query.trim();
  const hasQuery = q.length >= 2;

  const sections: SectionData[] = React.useMemo(() => {
    if (!hasQuery) return [];

    const poResults = allPOs
      .filter((po) => matches(q, po.po_number, po.vendor, String(po.id)))
      .slice(0, 10)
      .map(poToResult);

    const soResults = allSOs
      .filter((so) => matches(q, so.so_number, so.customer, String(so.id)))
      .slice(0, 10)
      .map(soToResult);

    const matResults = allMaterials
      .filter((m) => matches(q, m.name, m.code, m.type, m.category))
      .slice(0, 10)
      .map(materialToResult);

    const partnerResults = allPartners
      .filter((p) => matches(q, p.name, p.code, p.email, p.phone))
      .slice(0, 10)
      .map(partnerToResult);

    const stockResults = allStock
      .filter((s) => matches(q, s.item_name, s.item_code, s.warehouse_name))
      .slice(0, 10)
      .map((s, i) => stockToResult(s, i));

    const billResults = allBills
      .filter((b) => matches(q, b.bill_number, b.vendor, String(b.id)))
      .slice(0, 10)
      .map(billToResult);

    const invoiceResults = allInvoices
      .filter((inv) => matches(q, inv.invoice_number, inv.customer, String(inv.id)))
      .slice(0, 10)
      .map(invoiceToResult);

    return ([
      { key: 'po' as ResultType, label: TYPE_LABELS.po, icon: TYPE_ICONS.po, count: poResults.length, items: poResults },
      { key: 'so' as ResultType, label: TYPE_LABELS.so, icon: TYPE_ICONS.so, count: soResults.length, items: soResults },
      { key: 'bill' as ResultType, label: TYPE_LABELS.bill, icon: TYPE_ICONS.bill, count: billResults.length, items: billResults },
      { key: 'invoice' as ResultType, label: TYPE_LABELS.invoice, icon: TYPE_ICONS.invoice, count: invoiceResults.length, items: invoiceResults },
      { key: 'stock' as ResultType, label: TYPE_LABELS.stock, icon: TYPE_ICONS.stock, count: stockResults.length, items: stockResults },
      { key: 'material' as ResultType, label: TYPE_LABELS.material, icon: TYPE_ICONS.material, count: matResults.length, items: matResults },
      { key: 'partner' as ResultType, label: TYPE_LABELS.partner, icon: TYPE_ICONS.partner, count: partnerResults.length, items: partnerResults },
    ] as SectionData[]).filter((s) => s.count > 0);
  }, [q, hasQuery, allPOs, allSOs, allMaterials, allPartners, allStock, allBills, allInvoices]);

  const totalResults = sections.reduce((acc, s) => acc + s.count, 0);

  const commitSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) return;
    const updated = await saveSearchHistory(term.trim(), recentSearches);
    setRecentSearches(updated);
  }, [recentSearches]);

  function handleResultPress(result: SearchResult) {
    commitSearch(q);
    switch (result.type) {
      case 'po':
        navigation.navigate('PurchaseOrderDetail', { id: result.rawId });
        break;
      case 'so':
        navigation.navigate('SalesOrderDetail', { id: result.rawId });
        break;
      case 'material':
        if (result.materialMeta) {
          navigation.navigate('MaterialDetail', {
            materialId: result.rawId,
            materialName: result.title,
            materialCode: result.materialMeta.code,
            materialType: result.materialMeta.type,
            materialUnit: result.materialMeta.unit,
            materialCategory: result.materialMeta.category,
            materialStatus: result.materialMeta.status,
            materialDescription: result.materialMeta.description,
          });
        } else {
          navigation.navigate('Materials');
        }
        break;
      case 'partner':
        if (result.partnerMeta) {
          navigation.navigate('PartnerDetail', {
            partnerId: result.rawId,
            partnerName: result.partnerMeta.partnerName,
            isVendor: result.partnerMeta.isVendor,
            isCustomer: result.partnerMeta.isCustomer,
          });
        }
        break;
      case 'bill': {
        const tabNav = navigation.getParent<TabNav>();
        if (result.billMeta?.vendorId != null) {
          tabNav?.navigate('Finance', {
            screen: 'VendorDetail',
            params: {
              vendorId: result.billMeta.vendorId,
              vendorName: result.billMeta.vendorName ?? result.subtitle,
              outstanding: result.billMeta.outstanding,
            },
          } as any);
        } else {
          tabNav?.navigate('Finance', { screen: 'AccountsPayable' } as any);
        }
        break;
      }
      case 'invoice': {
        const tabNav = navigation.getParent<TabNav>();
        if (result.invoiceMeta?.customerId != null) {
          tabNav?.navigate('Finance', {
            screen: 'CustomerDetail',
            params: {
              customerId: result.invoiceMeta.customerId,
              customerName: result.invoiceMeta.customerName ?? result.subtitle,
              outstanding: result.invoiceMeta.outstanding,
            },
          } as any);
        } else {
          tabNav?.navigate('Finance', { screen: 'AccountsReceivable' } as any);
        }
        break;
      }
      case 'stock': {
        // Cross-tab navigation: switch to Inventory tab then open ItemLedger
        const tabNav = navigation.getParent<TabNav>();
        if (result.stockMeta?.item_id != null) {
          tabNav?.navigate('Inventory', {
            screen: 'ItemLedger',
            params: {
              item_id: result.stockMeta.item_id,
              item_name: result.stockMeta.item_name,
              item_code: result.stockMeta.item_code,
            },
          } as any);
        } else {
          tabNav?.navigate('Inventory');
        }
        break;
      }
    }
  }

  // Flatten sections into a list with section headers
  type ListItem =
    | { kind: 'header'; section: SectionData }
    | { kind: 'result'; result: SearchResult };

  const listData: ListItem[] = React.useMemo(() => {
    const items: ListItem[] = [];
    for (const section of sections) {
      items.push({ kind: 'header', section });
      for (const result of section.items) {
        items.push({ kind: 'result', result });
      }
    }
    return items;
  }, [sections]);

  function renderItem({ item }: { item: ListItem }) {
    if (item.kind === 'header') {
      const { section } = item;
      return (
        <View style={styles.sectionHeader}>
          <Feather name={section.icon as any} size={13} color={Colors.textSecondary} />
          <Text style={styles.sectionLabel}>{section.label}</Text>
          <Text style={styles.sectionCount}>{section.count}</Text>
        </View>
      );
    }

    const { result } = item;
    return (
      <TouchableOpacity
        style={styles.resultRow}
        onPress={() => handleResultPress(result)}
        activeOpacity={0.7}
      >
        <View style={styles.resultIconWrap}>
          <Feather name={TYPE_ICONS[result.type] as any} size={15} color={Colors.textSecondary} />
        </View>
        <View style={styles.resultBody}>
          <Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text>
          <Text style={styles.resultSub} numberOfLines={1}>{result.subtitle}</Text>
        </View>
        <View style={styles.resultRight}>
          {result.meta != null && (
            <Text style={styles.resultMeta}>{result.meta}</Text>
          )}
          {result.badge != null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{result.badge.toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header with back + search input */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Feather name="search" size={15} color={Colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search POs, SOs, bills, invoices, materials…"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            onSubmitEditing={() => commitSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={Colors.text} />
          <Text style={styles.stateText}>Loading data…</Text>
        </View>
      ) : !hasQuery ? (
        recentSearches.length > 0 ? (
          <View style={styles.historyContainer}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent</Text>
              <TouchableOpacity
                onPress={async () => {
                  await clearSearchHistory();
                  setRecentSearches([]);
                }}
                hitSlop={8}
              >
                <Text style={styles.historyClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {recentSearches.map((term) => (
              <TouchableOpacity
                key={term}
                style={styles.historyRow}
                onPress={() => setQuery(term)}
                activeOpacity={0.7}
              >
                <Feather name="clock" size={14} color={Colors.textMuted} />
                <Text style={styles.historyTerm} numberOfLines={1}>{term}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const filtered = recentSearches.filter((t) => t !== term);
                    setRecentSearches(filtered);
                    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
                  }}
                  hitSlop={8}
                >
                  <Feather name="x" size={13} color={Colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            <View style={styles.historyHint}>
              <Feather name="search" size={13} color={Colors.border} />
              <Text style={styles.historyHintText}>Type at least 2 characters to search</Text>
            </View>
          </View>
        ) : (
          <View style={styles.centerState}>
            <Feather name="search" size={36} color={Colors.border} />
            <Text style={styles.stateTitle}>Search everything</Text>
            <Text style={styles.stateText}>
              Type at least 2 characters to search across purchase orders, sales orders, AP bills, AR invoices, stock, materials, and partners.
            </Text>
          </View>
        )
      ) : totalResults === 0 ? (
        <View style={styles.centerState}>
          <Feather name="inbox" size={36} color={Colors.border} />
          <Text style={styles.stateTitle}>No results</Text>
          <Text style={styles.stateText}>Nothing matched "{q}". Try a different keyword.</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) =>
            item.kind === 'header' ? `hdr-${item.section.key}` : item.result.id
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <Text style={styles.resultsSummary}>
              {totalResults} result{totalResults !== 1 ? 's' : ''} for "{q}"
            </Text>
          }
        />
      )}
    </SafeAreaView>
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
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceHover,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  stateTitle: { ...Typography.h4, marginTop: Spacing.sm },
  stateText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  listContent: { paddingBottom: Spacing.xxl },

  resultsSummary: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.md,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  sectionLabel: {
    ...Typography.label,
    flex: 1,
    textTransform: 'uppercase',
  },
  sectionCount: {
    ...Typography.label,
    color: Colors.textMuted,
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  resultIconWrap: {
    width: 30,
    height: 30,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHover,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBody: { flex: 1 },
  resultTitle: { ...Typography.h4, fontSize: 14 },
  resultSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },

  resultRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  resultMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  badge: {
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.4,
  },

  historyContainer: {
    paddingTop: Spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  historyClearText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  historyTerm: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  historyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  historyHintText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
