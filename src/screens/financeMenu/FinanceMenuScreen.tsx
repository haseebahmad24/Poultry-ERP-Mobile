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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { FinanceStackParamList } from '@/navigation/FinanceNavigator';

type Nav = NativeStackNavigationProp<FinanceStackParamList, 'FinanceMenu'>;

interface MenuItem {
  icon: string;
  label: string;
  subtitle: string;
  screen: keyof FinanceStackParamList | null;
  available: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: '💸',
    label: 'Accounts Payable',
    subtitle: 'Vendor bills, aging analysis, and balances',
    screen: 'AccountsPayable',
    available: true,
  },
  {
    icon: '💰',
    label: 'Accounts Receivable',
    subtitle: 'Customer invoices, aging analysis, and balances',
    screen: 'AccountsReceivable',
    available: true,
  },
  {
    icon: '📒',
    label: 'Journal Entries',
    subtitle: 'Voucher list filtered by type or account',
    screen: 'JournalEntries',
    available: true,
  },
  {
    icon: '⚖️',
    label: 'Trial Balance',
    subtitle: 'Account balances as of selected date',
    screen: 'TrialBalance',
    available: true,
  },
  {
    icon: '📊',
    label: 'Financial Reports',
    subtitle: 'P&L and Balance Sheet views',
    screen: null,
    available: false,
  },
];

export default function FinanceMenuScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
        <Text style={styles.headerSub}>Financial modules</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionCard}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                idx < MENU_ITEMS.length - 1 && styles.menuItemBorder,
                !item.available && styles.menuItemDisabled,
              ]}
              onPress={() => {
                if (item.available && item.screen) {
                  navigation.navigate(item.screen as any);
                }
              }}
              activeOpacity={item.available ? 0.7 : 1}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuInfo}>
                <Text style={[styles.menuLabel, !item.available && styles.menuLabelDisabled]}>
                  {item.label}
                </Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuChevron}>{item.available ? '›' : '🔒'}</Text>
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
  scrollContent: { padding: Spacing.md },

  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  menuItemDisabled: { opacity: 0.5 },

  menuIcon: { fontSize: 24 },
  menuInfo: { flex: 1 },
  menuLabel: { ...Typography.h4 },
  menuLabelDisabled: { color: Colors.textSecondary },
  menuSubtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  menuChevron: { fontSize: 20, color: Colors.textMuted },
});
