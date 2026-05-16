import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppNavigator from './AppNavigator';
import InventoryScreen from '@/screens/inventory/InventoryScreen';
import MaterialsScreen from '@/screens/materials/MaterialsScreen';
import PurchaseOrdersScreen from '@/screens/purchaseOrders/PurchaseOrdersScreen';
import PODetailScreen from '@/screens/purchaseOrders/PODetailScreen';

export type AppStackParamList = {
  Tabs: undefined;
  Inventory: undefined;
  Materials: undefined;
  PurchaseOrders: undefined;
  PODetail: { id: number };
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={AppNavigator} />
      <Stack.Screen name="Inventory" component={InventoryScreen} />
      <Stack.Screen name="Materials" component={MaterialsScreen} />
      <Stack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
      <Stack.Screen name="PODetail" component={PODetailScreen} />
    </Stack.Navigator>
  );
}
