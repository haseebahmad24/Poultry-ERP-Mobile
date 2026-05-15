import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '@/theme';
import MoreMenuScreen from '@/screens/more/MoreMenuScreen';
import MaterialsScreen from '@/screens/materials/MaterialsScreen';
import PurchaseOrdersScreen from '@/screens/purchaseOrders/PurchaseOrdersScreen';
import PurchaseOrderDetailScreen from '@/screens/purchaseOrders/PurchaseOrderDetailScreen';
import SalesOrdersScreen from '@/screens/salesOrders/SalesOrdersScreen';
import SalesOrderDetailScreen from '@/screens/salesOrders/SalesOrderDetailScreen';
import GRNScreen from '@/screens/grn/GRNScreen';

export type MoreStackParamList = {
  MoreMenu: undefined;
  Materials: undefined;
  PurchaseOrders: undefined;
  PurchaseOrderDetail: { id: number };
  SalesOrders: undefined;
  SalesOrderDetail: { id: number };
  GRN: undefined;
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

export default function MoreNavigator() {
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
        name="MoreMenu"
        component={MoreMenuScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Materials"
        component={MaterialsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PurchaseOrders"
        component={PurchaseOrdersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PurchaseOrderDetail"
        component={PurchaseOrderDetailScreen}
        options={{ title: 'PO Detail' }}
      />
      <Stack.Screen
        name="SalesOrders"
        component={SalesOrdersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SalesOrderDetail"
        component={SalesOrderDetailScreen}
        options={{ title: 'SO Detail' }}
      />
      <Stack.Screen
        name="GRN"
        component={GRNScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
