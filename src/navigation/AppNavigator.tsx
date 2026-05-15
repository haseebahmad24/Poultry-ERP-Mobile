import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import InventoryScreen from '@/screens/inventory/InventoryScreen';
import MoreNavigator from '@/navigation/MoreNavigator';
import { Colors } from '@/theme';

export type AppTabParamList = {
  Dashboard: undefined;
  Inventory: undefined;
  Finance: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

function PlaceholderScreen({ route }: any) {
  return (
    <Text style={{ flex: 1, textAlign: 'center', marginTop: 80, color: Colors.textSecondary }}>
      {route.name} — Coming soon
    </Text>
  );
}

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
        tabBarIcon: ({ color, size }) => {
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
      <Tab.Screen name="Finance" component={PlaceholderScreen} />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}
