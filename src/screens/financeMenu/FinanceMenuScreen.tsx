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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import { useOverdue } from '@/context/OverdueContext';

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
    icon: 'credit-card',
    label: 'Accounts Payable',
    subtitle: 'Vendor bills, aging analysis, and balances',
    screen: 'AccountsPayable',
    available: true,
  },
  {
    icon: 'dollar-sign',
    label: 'Accounts Receivable',
    subtitle: 'Customer invoices, aging analysis, and balances',
    screen: 'AccountsReceivable',
    available: true,
  },
  {
    icon: 'book-open',
    label: 'Journal Entries',
    subtitle: 'Voucher list filtered by type or account',
    screen: 'JournalEntries',
    available: true,
  },
  {
    icon: 'bar-chart-2',
    label: 'Trial Balance',
    subtitle: 'Account balances as of selected date',
    screen: 'TrialBalance',
    available: true,
  },
  {
    icon: 'pie-chart',
    label: 'Financial Reports',
    subtitle: 'P&L and Balance Sheet computed from trial balance',
    screen: 'FinancialReports',
    available: true,
  },
];

export default function FinanceMenuScreen() {
  const navigation = useNavigation<Nav>();
  const { apOverdue, arOverdue } = useOverdue();

  const alertCounts: Record<string, number> = {
    'Accounts Payable': apOverdue,
    'Accounts Receivable': arOverdue,
  };

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
          {MENU_ITEMS.map((item, idx) => {
            const alertCount = alertCounts[item.label] ?? 0;
            return (
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
                <View style={styles.menuIconWrap}>
                  <Feather
                    name={item.icon as any}
                    size={18}
                    color={item.available ? Colors.text : Colors.textMuted}
                  />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={[styles.menuLabel, !item.available && styles.menuLabelDisabled]}>
                    {item.label}
                  </Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                {alertCount > 0 && (
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertBadgeText}>{alertCount}</Text>
                  </View>
                )}
                {item.available ? (
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                ) : (
                  <Feather name="lock" size={14} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            );
          })}
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
  headerTitle: { ...Typography.h2 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },

  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
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
  menuItemDisabled: { opacity: 0.45 },
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
  menuLabelDisabled: { color: Colors.textSecondary },
  menuSubtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  alertBadge: {
    backgroundColor: Colors.text,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 6,
  },
  alertBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
