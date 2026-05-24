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
import PartnersScreen from '@/screens/partners/PartnersScreen';
import PartnerDetailScreen from '@/screens/partners/PartnerDetailScreen';
import CompaniesScreen from '@/screens/companies/CompaniesScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import AlertsScreen from '@/screens/alerts/AlertsScreen';
import SearchScreen from '@/screens/search/SearchScreen';
import MaterialDetailScreen from '@/screens/materials/MaterialDetailScreen';

export type MoreStackParamList = {
  MoreMenu: undefined;
  Search: undefined;
  Materials: undefined;
  MaterialDetail: {
    materialId: number;
    materialName: string;
    materialCode?: string;
    materialType?: string;
    materialUnit?: string;
    materialCategory?: string;
    materialStatus?: string;
    materialDescription?: string;
  };
  PurchaseOrders: undefined;
  PurchaseOrderDetail: { id: number };
  SalesOrders: undefined;
  SalesOrderDetail: { id: number };
  GRN: undefined;
  Partners: undefined;
  PartnerDetail: {
    partnerId: number;
    partnerName: string;
    isVendor: boolean;
    isCustomer: boolean;
  };
  Companies: undefined;
  Settings: undefined;
  Alerts: undefined;
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
        name="Search"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Materials"
        component={MaterialsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MaterialDetail"
        component={MaterialDetailScreen}
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
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SalesOrders"
        component={SalesOrdersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SalesOrderDetail"
        component={SalesOrderDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GRN"
        component={GRNScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Partners"
        component={PartnersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PartnerDetail"
        component={PartnerDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Companies"
        component={CompaniesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
