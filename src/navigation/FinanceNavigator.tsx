import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '@/theme';
import FinanceMenuScreen from '@/screens/financeMenu/FinanceMenuScreen';
import AccountsPayableScreen from '@/screens/finance/AccountsPayableScreen';
import AccountsReceivableScreen from '@/screens/finance/AccountsReceivableScreen';
import JournalEntriesScreen from '@/screens/journalEntries/JournalEntriesScreen';

export type FinanceStackParamList = {
  FinanceMenu: undefined;
  AccountsPayable: undefined;
  AccountsReceivable: undefined;
  JournalEntries: undefined;
};

const Stack = createNativeStackNavigator<FinanceStackParamList>();

export default function FinanceNavigator() {
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
        name="FinanceMenu"
        component={FinanceMenuScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AccountsPayable"
        component={AccountsPayableScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AccountsReceivable"
        component={AccountsReceivableScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="JournalEntries"
        component={JournalEntriesScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
