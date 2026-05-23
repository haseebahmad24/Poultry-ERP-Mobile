import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigatorScreenParams } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import InventoryNavigator from '@/navigation/InventoryNavigator';
import MoreNavigator from '@/navigation/MoreNavigator';
import FinanceNavigator from '@/navigation/FinanceNavigator';
import { Colors } from '@/theme';
import { useOverdue } from '@/context/OverdueContext';
import type { InventoryStackParamList } from '@/navigation/InventoryNavigator';
import type { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

export type AppTabParamList = {
  Dashboard: undefined;
  Inventory: NavigatorScreenParams<InventoryStackParamList>;
  Finance: NavigatorScreenParams<FinanceStackParamList>;
  More: NavigatorScreenParams<MoreStackParamList>;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

const TAB_ICONS: Record<string, string> = {
  Dashboard: 'home',
  Inventory: 'box',
  Finance: 'dollar-sign',
  More: 'menu',
};

const BADGE_STYLE = {
  backgroundColor: Colors.text,
  color: '#fff',
  fontSize: 10,
  minWidth: 16,
  height: 16,
  lineHeight: 16,
};

export default function AppNavigator() {
  const { totalOverdue, lowStock } = useOverdue();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ color, size }) => (
          <Feather
            name={(TAB_ICONS[route.name] ?? 'circle') as any}
            size={size - 2}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen
        name="Inventory"
        component={InventoryNavigator}
        options={{
          tabBarBadge: lowStock > 0 ? lowStock : undefined,
          tabBarBadgeStyle: BADGE_STYLE,
        }}
      />
      <Tab.Screen
        name="Finance"
        component={FinanceNavigator}
        options={{
          tabBarBadge: totalOverdue > 0 ? totalOverdue : undefined,
          tabBarBadgeStyle: BADGE_STYLE,
        }}
      />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}
