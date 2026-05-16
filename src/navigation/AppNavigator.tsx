import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import InventoryScreen from '@/screens/inventory/InventoryScreen';
import { Colors } from '@/theme';

export type AppTabParamList = {
  Dashboard: undefined;
  InventoryTab: undefined;
  Finance: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

function PlaceholderScreen({ route }: any) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
        {route.name} — Coming soon
      </Text>
    </View>
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
            InventoryTab: '🏭',
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
      <Tab.Screen
        name="InventoryTab"
        component={InventoryScreen}
        options={{ tabBarLabel: 'Inventory' }}
      />
      <Tab.Screen name="Finance" component={PlaceholderScreen} />
      <Tab.Screen name="More" component={PlaceholderScreen} />
    </Tab.Navigator>
  );
}
