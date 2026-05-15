import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigatorScreenParams } from '@react-navigation/native';
import { Text } from 'react-native';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import InventoryScreen from '@/screens/inventory/InventoryScreen';
import MoreNavigator from '@/navigation/MoreNavigator';
import FinanceNavigator from '@/navigation/FinanceNavigator';
import { Colors } from '@/theme';
import type { FinanceStackParamList } from '@/navigation/FinanceNavigator';
import type { MoreStackParamList } from '@/navigation/MoreNavigator';

export type AppTabParamList = {
  Dashboard: undefined;
  Inventory: undefined;
  Finance: NavigatorScreenParams<FinanceStackParamList>;
  More: NavigatorScreenParams<MoreStackParamList>;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ size }) => {
          const icons: Record<string, string> = {
            Dashboard: '📊',
            Inventory: '🏭',
            Finance: '💰',
            More: '⋯',
          };
          return (
            <Text style={{ fontSize: size - 4 }}>{icons[route.name] ?? '•'}</Text>
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      <Tab.Screen name="Finance" component={FinanceNavigator} />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}
