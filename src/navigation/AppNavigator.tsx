import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigatorScreenParams, useNavigation, CommonActions } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import InventoryNavigator from '@/navigation/InventoryNavigator';
import MoreNavigator from '@/navigation/MoreNavigator';
import FinanceNavigator from '@/navigation/FinanceNavigator';
import BiometricLockOverlay from '@/components/BiometricLockOverlay';
import { Colors } from '@/theme';
import { useOverdue } from '@/context/OverdueContext';
import { useAuth } from '@/context/AuthContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { getBiometricEnabled } from '@/utils/settings';
import {
  getNotificationsEnabled,
  scheduleOverdueReminder,
} from '@/utils/notifications';
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
  const { totalOverdue, apOverdue, arOverdue, lowStock } = useOverdue();
  const { logout } = useAuth();
  const navigation = useNavigation();
  const handleSessionExpired = useCallback(() => { logout(); }, [logout]);
  useSessionTimeout(handleSessionExpired);

  const [biometricLocked, setBiometricLocked] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        const enabled = await getBiometricEnabled();
        if (enabled) setBiometricLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getNotificationsEnabled().then((enabled) => {
      if (!enabled) return;
      scheduleOverdueReminder({ apOverdue, arOverdue, lowStock });
    });
  }, [apOverdue, arOverdue, lowStock]);

  // Navigate to Alerts screen when user taps the overdue notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'overdue') {
        navigation.dispatch(
          CommonActions.navigate({ name: 'More', params: { screen: 'Alerts' } })
        );
      }
    });
    return () => sub.remove();
  }, [navigation]);

  return (
    <View style={{ flex: 1 }}>
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

      {biometricLocked && (
        <BiometricLockOverlay onUnlock={() => setBiometricLocked(false)} />
      )}
    </View>
  );
}
