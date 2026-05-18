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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { MoreStackParamList } from '@/navigation/MoreNavigator';
import type { AppTabParamList } from '@/navigation/AppNavigator';
import type { FinanceStackParamList } from '@/navigation/FinanceNavigator';

type MoreNav = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>;
type TabNav = BottomTabNavigationProp<AppTabParamList>;

const OPERATIONS_ITEMS: {
  icon: string;
  label: string;
  subtitle: string;
  screen: keyof MoreStackParamList;
}[] = [
  {
    icon: '🔬',
    label: 'Materials',
    subtitle: 'Material master list with types and status',
    screen: 'Materials',
  },
  {
    icon: '🛒',
    label: 'Purchase Orders',
    subtitle: 'PO list with status and receipt progress',
    screen: 'PurchaseOrders',
  },
  {
    icon: '📦',
    label: 'Sales Orders',
    subtitle: 'Sales order list and details',
    screen: 'SalesOrders',
  },
  {
    icon: '🚚',
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
    icon: '💸',
    label: 'Accounts Payable',
    subtitle: 'Vendor bills, aging analysis, and balances',
    screen: 'AccountsPayable',
  },
  {
    icon: '💰',
    label: 'Accounts Receivable',
    subtitle: 'Customer invoices, aging analysis, and balances',
    screen: 'AccountsReceivable',
  },
  {
    icon: '📒',
    label: 'Journal Entries',
    subtitle: 'Voucher list filtered by type or account',
    screen: 'JournalEntries',
  },
  {
    icon: '⚖️',
    label: 'Trial Balance',
    subtitle: 'Account balances as of selected date',
    screen: 'TrialBalance',
  },
  {
    icon: '📊',
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
    icon: '🤝',
    label: 'Business Partners',
    subtitle: 'Customers and vendors with role badges',
    screen: 'Partners',
  },
  {
    icon: '🏢',
    label: 'Companies',
    subtitle: 'Company profiles and fiscal settings',
    screen: 'Companies',
  },
];

export default function MoreMenuScreen() {
  const moreNav = useNavigation<MoreNav>();
  const tabNav = moreNav.getParent<TabNav>();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSub}>All modules</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Operations */}
        <Text style={styles.sectionTitle}>OPERATIONS</Text>
        <View style={styles.sectionCard}>
          {OPERATIONS_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, idx < OPERATIONS_ITEMS.length - 1 && styles.menuItemBorder]}
              onPress={() => moreNav.navigate(item.screen as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuInfo}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Finance — navigates into Finance tab stack */}
        <Text style={styles.sectionTitle}>FINANCE</Text>
        <View style={styles.sectionCard}>
          {FINANCE_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, idx < FINANCE_ITEMS.length - 1 && styles.menuItemBorder]}
              onPress={() =>
                tabNav?.navigate('Finance', { screen: item.screen })
              }
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuInfo}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Admin */}
        <Text style={styles.sectionTitle}>ADMIN</Text>
        <View style={styles.sectionCard}>
          {ADMIN_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, idx < ADMIN_ITEMS.length - 1 && styles.menuItemBorder]}
              onPress={() => moreNav.navigate(item.screen as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuInfo}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.md, paddingHorizontal: Spacing.md },

  sectionTitle: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },

  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
    marginBottom: Spacing.xs,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },

  menuIcon: { fontSize: 24 },
  menuInfo: { flex: 1 },
  menuLabel: { ...Typography.h4 },
  menuSubtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  menuChevron: { fontSize: 20, color: Colors.textMuted },
});
