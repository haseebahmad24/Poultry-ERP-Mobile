import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '@/theme';
import InventoryScreen from '@/screens/inventory/InventoryScreen';
import ItemLedgerScreen from '@/screens/inventory/ItemLedgerScreen';

export type InventoryStackParamList = {
  InventoryMain: undefined;
  ItemLedger: { item_id: number; item_name: string; item_code?: string };
};

const Stack = createNativeStackNavigator<InventoryStackParamList>();

export default function InventoryNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="InventoryMain"
        component={InventoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ItemLedger"
        component={ItemLedgerScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
