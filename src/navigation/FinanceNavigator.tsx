import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '@/theme';
import FinanceMenuScreen from '@/screens/financeMenu/FinanceMenuScreen';
import AccountsPayableScreen from '@/screens/finance/AccountsPayableScreen';
import AccountsReceivableScreen from '@/screens/finance/AccountsReceivableScreen';
import VendorDetailScreen from '@/screens/finance/VendorDetailScreen';
import CustomerDetailScreen from '@/screens/finance/CustomerDetailScreen';
import CashFlowScreen from '@/screens/finance/CashFlowScreen';
import JournalEntriesScreen from '@/screens/journalEntries/JournalEntriesScreen';
import JournalEntryDetailScreen from '@/screens/journalEntries/JournalEntryDetailScreen';
import TrialBalanceScreen from '@/screens/trialBalance/TrialBalanceScreen';
import FinancialReportsScreen from '@/screens/financialReports/FinancialReportsScreen';
import type { JournalEntry } from '@/api/journalEntries';

export type FinanceStackParamList = {
  FinanceMenu: undefined;
  AccountsPayable: undefined;
  AccountsReceivable: undefined;
  VendorDetail: { vendorId: number; vendorName: string; outstanding?: number; overdue?: number };
  CustomerDetail: { customerId: number; customerName: string; outstanding?: number; overdue?: number };
  CashFlow: undefined;
  JournalEntries: { account?: string; accountName?: string } | undefined;
  JournalEntryDetail: { entry: JournalEntry };
  TrialBalance: undefined;
  FinancialReports: undefined;
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
        name="VendorDetail"
        component={VendorDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerDetail"
        component={CustomerDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CashFlow"
        component={CashFlowScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="JournalEntries"
        component={JournalEntriesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="JournalEntryDetail"
        component={JournalEntryDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TrialBalance"
        component={TrialBalanceScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FinancialReports"
        component={FinancialReportsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
