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
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>;

interface MenuItem {
  icon: string;
  label: string;
  subtitle: string;
  screen: keyof MoreStackParamList | null;
  available: boolean;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Operations',
    items: [
      {
        icon: '🔬',
        label: 'Materials',
        subtitle: 'Material master list with types and status',
        screen: 'Materials',
        available: true,
      },
      {
        icon: '🛒',
        label: 'Purchase Orders',
        subtitle: 'PO list with status and receipt progress',
        screen: 'PurchaseOrders',
        available: true,
      },
      {
        icon: '📦',
        label: 'Sales Orders',
        subtitle: 'Sales order list and details',
        screen: 'SalesOrders',
        available: true,
      },
      {
        icon: '🚚',
        label: 'Goods Receipt',
        subtitle: 'PO receipt progress and GRN details',
        screen: 'GRN',
        available: true,
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        icon: '💸',
        label: 'Accounts Payable',
        subtitle: 'Vendor bills and aging summary',
        screen: null,
        available: false,
      },
      {
        icon: '💰',
        label: 'Accounts Receivable',
        subtitle: 'Customer invoices and aging summary',
        screen: null,
        available: false,
      },
      {
        icon: '📒',
        label: 'Journal Entries',
        subtitle: 'Voucher list with type filters',
        screen: null,
        available: false,
      },
      {
        icon: '⚖️',
        label: 'Trial Balance',
        subtitle: 'Account balances as of date',
        screen: null,
        available: false,
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      {
        icon: '🤝',
        label: 'Business Partners',
        subtitle: 'Customers and vendors list',
        screen: null,
        available: false,
      },
      {
        icon: '🏢',
        label: 'Companies',
        subtitle: 'Company profiles and settings',
        screen: null,
        available: false,
      },
    ],
  },
];

export default function MoreMenuScreen() {
  const navigation = useNavigation<Nav>();

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
        {MENU_SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    idx < section.items.length - 1 && styles.menuItemBorder,
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
                  <Text style={styles.menuChevron}>
                    {item.available ? '›' : '🔒'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

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
  scrollContent: { paddingTop: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.xs },

  sectionTitle: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
    paddingHorizontal: 2,
  },

  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.card,
    marginBottom: Spacing.sm,
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
  menuItemDisabled: { opacity: 0.5 },

  menuIcon: { fontSize: 24 },
  menuInfo: { flex: 1 },
  menuLabel: { ...Typography.h4 },
  menuLabelDisabled: { color: Colors.textSecondary },
  menuSubtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  menuChevron: { fontSize: 20, color: Colors.textMuted },
});
