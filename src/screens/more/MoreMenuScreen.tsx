import React, { useCallback, useState } from 'react';
import {
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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { MoreStackParamList } from '@/navigation/MoreNavigator';
import type { AppTabParamList } from '@/navigation/AppNavigator';
import type { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import { useOverdue } from '@/context/OverdueContext';
import { getUnreadCount } from '@/utils/notificationLog';

type MoreNav = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>;
type TabNav = BottomTabNavigationProp<AppTabParamList>;

const OPERATIONS_ITEMS: {
  icon: string;
  label: string;
  subtitle: string;
  screen: keyof MoreStackParamList;
}[] = [
  {
    icon: 'layers',
    label: 'Materials',
    subtitle: 'Material master list with types and status',
    screen: 'Materials',
  },
  {
    icon: 'shopping-cart',
    label: 'Purchase Orders',
    subtitle: 'PO list with status and receipt progress',
    screen: 'PurchaseOrders',
  },
  {
    icon: 'package',
    label: 'Sales Orders',
    subtitle: 'Sales order list and details',
    screen: 'SalesOrders',
  },
  {
    icon: 'truck',
    label: 'Goods Receipt',
    subtitle: 'PO receipt progress and GRN details',
    screen: 'GRN',
  },
  {
    icon: 'calendar',
    label: 'Delivery Calendar',
    subtitle: 'Monthly view of scheduled PO and SO deliveries',
    screen: 'DeliveryCalendar',
  },
];

type ParamlessFinanceScreen = 'AccountsPayable' | 'AccountsReceivable' | 'CashFlow' | 'JournalEntries' | 'TrialBalance' | 'FinancialReports' | 'FinanceMenu';

const FINANCE_ITEMS: {
  icon: string;
  label: string;
  subtitle: string;
  screen: ParamlessFinanceScreen;
}[] = [
  {
    icon: 'credit-card',
    label: 'Accounts Payable',
    subtitle: 'Vendor bills, aging analysis, and balances',
    screen: 'AccountsPayable',
  },
  {
    icon: 'dollar-sign',
    label: 'Accounts Receivable',
    subtitle: 'Customer invoices, aging analysis, and balances',
    screen: 'AccountsReceivable',
  },
  {
    icon: 'book-open',
    label: 'Journal Entries',
    subtitle: 'Voucher list filtered by type or account',
    screen: 'JournalEntries',
  },
  {
    icon: 'bar-chart-2',
    label: 'Trial Balance',
    subtitle: 'Account balances as of selected date',
    screen: 'TrialBalance',
  },
  {
    icon: 'pie-chart',
    label: 'Financial Reports',
    subtitle: 'P&L and Balance Sheet',
    screen: 'FinancialReports',
  },
];

const ANALYTICS_ITEMS: {
  icon: string;
  label: string;
  subtitle: string;
  screen: keyof MoreStackParamList;
}[] = [
  {
    icon: 'trending-up',
    label: 'Procurement Analytics',
    subtitle: 'PO/SO trends, top vendors, top customers',
    screen: 'ProcurementAnalytics',
  },
  {
    icon: 'activity',
    label: 'Stock Health',
    subtitle: 'Stock levels, low-stock alerts, warehouse breakdown',
    screen: 'StockHealth',
  },
  {
    icon: 'sliders',
    label: 'Financial Analytics',
    subtitle: 'AP/AR aging, net position, top payables & receivables',
    screen: 'FinancialAnalytics',
  },
  {
    icon: 'bar-chart',
    label: 'Company Comparison',
    subtitle: 'Side-by-side KPI ranking across all companies',
    screen: 'Comparison',
  },
];

const ADMIN_ITEMS: {
  icon: string;
  label: string;
  subtitle: string;
  screen: keyof MoreStackParamList;
}[] = [
  {
    icon: 'users',
    label: 'Business Partners',
    subtitle: 'Customers and vendors with role badges',
    screen: 'Partners',
  },
  {
    icon: 'briefcase',
    label: 'Companies',
    subtitle: 'Company profiles and fiscal settings',
    screen: 'Companies',
  },
  {
    icon: 'bookmark',
    label: 'Bookmarks',
    subtitle: 'Saved POs, SOs, partners, and materials',
    screen: 'Bookmarks',
  },
  {
    icon: 'settings',
    label: 'Settings',
    subtitle: 'Low-stock threshold, cache, and preferences',
    screen: 'Settings',
  },
];

function MenuRow({
  icon,
  label,
  subtitle,
  onPress,
  hasBorder,
  badge,
}: {
  icon: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  hasBorder: boolean;
  badge?: number;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, hasBorder && styles.menuItemBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuIconWrap}>
        <Feather name={icon as any} size={18} color={Colors.text} />
      </View>
      <View style={styles.menuInfo}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      {badge != null && badge > 0 && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function MoreMenuScreen() {
  const moreNav = useNavigation<MoreNav>();
  const tabNav = moreNav.getParent<TabNav>();
  const { totalAlerts, apOverdue, arOverdue, lowStock } = useOverdue();
  const [inboxUnread, setInboxUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    getUnreadCount().then(setInboxUnread);
  }, []));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>More</Text>
          <Text style={styles.headerSub}>All modules</Text>
        </View>
      </View>

      {/* Search shortcut — tapping opens the full search screen */}
      <TouchableOpacity
        style={styles.searchShortcut}
        activeOpacity={0.7}
        onPress={() => moreNav.navigate('Search')}
      >
        <Feather name="search" size={15} color={Colors.textMuted} />
        <Text style={styles.searchShortcutText}>Search POs, SOs, stock, materials, partners…</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Alerts + Inbox row — side by side at top */}
        <View style={styles.bannerRow}>
          {/* Alerts banner */}
          <TouchableOpacity
            style={[styles.alertBanner, styles.alertBannerFlex, totalAlerts > 0 && styles.alertBannerActive]}
            activeOpacity={0.7}
            onPress={() => moreNav.navigate('Alerts')}
          >
            <View style={styles.alertBannerIcon}>
              <Feather name="bell" size={18} color={Colors.text} />
              {totalAlerts > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{totalAlerts > 99 ? '99+' : totalAlerts}</Text>
                </View>
              )}
            </View>
            <View style={styles.alertBannerBody}>
              <Text style={styles.alertBannerTitle}>
                {totalAlerts > 0 ? `${totalAlerts} Alert${totalAlerts !== 1 ? 's' : ''}` : 'Alerts'}
              </Text>
              {totalAlerts > 0 ? (
                <Text style={styles.alertBannerSub} numberOfLines={1}>
                  {[
                    apOverdue > 0 && `${apOverdue} AP`,
                    arOverdue > 0 && `${arOverdue} AR`,
                    lowStock > 0 && `${lowStock} stock`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : (
                <Text style={styles.alertBannerSub}>Overdue + low stock</Text>
              )}
            </View>
            <Feather name="chevron-right" size={14} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Inbox banner */}
          <TouchableOpacity
            style={[styles.alertBanner, styles.inboxBanner, inboxUnread > 0 && styles.alertBannerActive]}
            activeOpacity={0.7}
            onPress={() => moreNav.navigate('Inbox')}
          >
            <View style={styles.alertBannerIcon}>
              <Feather name="inbox" size={18} color={Colors.text} />
              {inboxUnread > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{inboxUnread > 99 ? '99+' : inboxUnread}</Text>
                </View>
              )}
            </View>
            <View style={styles.alertBannerBody}>
              <Text style={styles.alertBannerTitle}>Inbox</Text>
              <Text style={styles.alertBannerSub}>
                {inboxUnread > 0 ? `${inboxUnread} unread` : 'History'}
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>OPERATIONS</Text>
        <View style={styles.sectionCard}>
          {OPERATIONS_ITEMS.map((item, idx) => (
            <MenuRow
              key={item.label}
              icon={item.icon}
              label={item.label}
              subtitle={item.subtitle}
              onPress={() => moreNav.navigate(item.screen as any)}
              hasBorder={idx < OPERATIONS_ITEMS.length - 1}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>FINANCE</Text>
        <View style={styles.sectionCard}>
          {FINANCE_ITEMS.map((item, idx) => (
            <MenuRow
              key={item.label}
              icon={item.icon}
              label={item.label}
              subtitle={item.subtitle}
              onPress={() => tabNav?.navigate('Finance', { screen: item.screen })}
              hasBorder={idx < FINANCE_ITEMS.length - 1}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>ANALYTICS</Text>
        <View style={styles.sectionCard}>
          {ANALYTICS_ITEMS.map((item, idx) => (
            <MenuRow
              key={item.label}
              icon={item.icon}
              label={item.label}
              subtitle={item.subtitle}
              onPress={() => moreNav.navigate(item.screen as any)}
              hasBorder={idx < ANALYTICS_ITEMS.length - 1}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>ADMIN</Text>
        <View style={styles.sectionCard}>
          {ADMIN_ITEMS.map((item, idx) => (
            <MenuRow
              key={item.label}
              icon={item.icon}
              label={item.label}
              subtitle={item.subtitle}
              onPress={() => moreNav.navigate(item.screen as any)}
              hasBorder={idx < ADMIN_ITEMS.length - 1}
            />
          ))}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
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
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  headerTextBlock: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  searchShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
  },
  searchShortcutText: { fontSize: 13, color: Colors.textMuted },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.md, paddingHorizontal: Spacing.md },

  bannerRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  alertBannerFlex: { flex: 1.4 },
  inboxBanner: { flex: 1 },
  alertBannerActive: {
    borderColor: Colors.text,
  },
  alertBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: Colors.surface, fontSize: 10, fontWeight: '700' },
  alertBannerBody: { flex: 1 },
  alertBannerTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  alertBannerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  sectionTitle: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },

  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHover,
  },
  menuInfo: { flex: 1 },
  menuLabel: { ...Typography.h4 },
  menuSubtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },

  menuBadge: {
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  menuBadgeText: { color: Colors.surface, fontSize: 10, fontWeight: '700' },
});
