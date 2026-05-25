import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

const prefix = Linking.createURL('/');

const linking: LinkingOptions<any> = {
  prefixes: [prefix, 'poultryerp://'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Dashboard: 'dashboard',
          Inventory: {
            screens: {
              InventoryMain: 'inventory',
              ItemLedger: 'inventory/ledger/:item_id',
            },
          },
          Finance: {
            screens: {
              FinanceMenu: 'finance',
              AccountsPayable: 'finance/ap',
              AccountsReceivable: 'finance/ar',
              JournalEntries: 'finance/journal',
              TrialBalance: 'finance/trial-balance',
              FinancialReports: 'finance/reports',
            },
          },
          More: {
            screens: {
              MoreMenu: 'more',
              Alerts: 'alerts',
              Materials: 'materials',
              PurchaseOrders: 'purchase-orders',
              SalesOrders: 'sales-orders',
              GRN: 'grn',
              Partners: 'partners',
              Companies: 'companies',
              Settings: 'settings',
              Search: 'search',
              Inbox: 'inbox',
              Bookmarks: 'bookmarks',
              Comparison: 'comparison',
            },
          },
        },
      },
    },
  },
};

export default linking;
