import React from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { MoreStackParamList } from '@/navigation/MoreNavigator';
import type { AppTabParamList } from '@/navigation/AppNavigator';
import type { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import { useOverdue } from '@/context/OverdueContext';

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
];

const FINANCE_ITEMS: {
  icon: string;
  label: string;
  subtitle: string;
  screen: keyof FinanceStackParamList;
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
}: {
  icon: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  hasBorder: boolean;
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
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function MoreMenuScreen() {
  const moreNav = useNavigation<MoreNav>();
  const tabNav = moreNav.getParent<TabNav>();
  const { totalAlerts, apOverdue, arOverdue, lowStock } = useOverdue();

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
        <Text style={styles.searchShortcutText}>Search POs, SOs, materials, partners…</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Alerts banner — always shown, prominent when alerts exist */}
        <TouchableOpacity
          style={[styles.alertBanner, totalAlerts > 0 && styles.alertBannerActive]}
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
              {totalAlerts > 0 ? `${totalAlerts} Active Alert${totalAlerts !== 1 ? 's' : ''}` : 'Alerts'}
            </Text>
            {totalAlerts > 0 ? (
              <Text style={styles.alertBannerSub}>
                {[
                  apOverdue > 0 && `${apOverdue} overdue bill${apOverdue !== 1 ? 's' : ''}`,
                  arOverdue > 0 && `${arOverdue} overdue invoice${arOverdue !== 1 ? 's' : ''}`,
                  lowStock > 0 && `${lowStock} low-stock item${lowStock !== 1 ? 's' : ''}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : (
              <Text style={styles.alertBannerSub}>Overdue bills, invoices, and low stock</Text>
            )}
          </View>
          <Feather name="chevron-right" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

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

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  alertBannerActive: {
    borderColor: Colors.text,
  },
  alertBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
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
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  alertBannerBody: { flex: 1 },
  alertBannerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  alertBannerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

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
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  menuInfo: { flex: 1 },
  menuLabel: { ...Typography.h4 },
  menuSubtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
});
