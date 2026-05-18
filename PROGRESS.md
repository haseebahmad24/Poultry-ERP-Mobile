# Mobile App Progress

## Session 3 — 2026-05-18

### Completed This Session

**Global Company Filter (extended)**
- Wired `CompanyPicker` + `useCompany()` into **Dashboard**, **Materials**, **Journal Entries**, **Partners**, and **Sales Orders** screens — all list data now filters by the globally selected company
- `TrialBalance` and `FinancialReports` now pull companies from `CompanyContext` instead of fetching independently (eliminates redundant `/api/options/companies` calls)
- Fixed `CompanyContext` to reload companies **after login** instead of failing silently on app start (root cause: provider was mounting before auth token was available)

**API Reliability**
- `src/api/client.ts` — added exponential-backoff retry (2 attempts, 500ms/1000ms delays) for network errors and HTTP 5xx/429 responses

**Navigation & UX Polish**
- `MoreMenuScreen`: removed disabled Finance items (were showing "Available in Finance tab" lock icons); replaced with tappable items that navigate directly into Finance tab's screens via `getParent()`
- `AppStack`: removed dead duplicate routes (Inventory, Materials, PurchaseOrders, PODetail) that were shadowing the real screens in the tab navigators
- Fixed Inventory tab icon bug: icon key was `InventoryTab` but route name is `Inventory` — tab was showing `•` instead of `🏭`
- `PurchaseOrder` type: added `received` and `receipt_pct` optional fields for the `progress` view response

**Documentation**
- Updated `scripts/generate-docs.js` with Session 3 changelog and updated Section 3/Section 4
- Regenerated `FEATURES.docx`

---

## Session 2 — 2026-05-15

### Completed This Session

**Phase 1 — Core Data Screens**
- **Inventory Screen** (`src/screens/inventory/InventoryScreen.tsx`)
  - Internal tab view: Stock Balances / Stock Ledger
  - Search filter, pull-to-refresh, empty states
  - API: `src/api/inventory.ts` — fetchStockBalances, fetchStockLedger

- **Materials Screen** (`src/screens/materials/MaterialsScreen.tsx`)
  - Searchable list by name, code, type, category
  - Horizontal type filter chips
  - Status badges (Active/Inactive), unit chip
  - API: `src/api/materials.ts`

- **Purchase Orders Screen** (`src/screens/purchaseOrders/`)
  - All/Open/In Progress status tabs
  - PO cards with progress bar
  - Detail screen with receipt progress + line items
  - API: `src/api/purchaseOrders.ts`

**Phase 2 — Sales & Delivery**
- **Sales Orders Screen** (`src/screens/salesOrders/`)
  - All/Open/Approved/Closed tabs
  - Detail screen with line items and total row
  - API: `src/api/salesOrders.ts`

- **GRN Screen** (`src/screens/grn/GRNScreen.tsx`)
  - Overall receipt summary card
  - Per-PO progress bars with line item preview

**Phase 3 — Finance**
- **Accounts Payable** (`src/screens/finance/AccountsPayableScreen.tsx`)
  - Summary/Bills/Vendors tabs, aging analysis bars
  - API: `src/api/accountsPayable.ts`

- **Accounts Receivable** (`src/screens/finance/AccountsReceivableScreen.tsx`)
  - Summary/Invoices/Customers tabs, aging analysis
  - API: `src/api/accountsReceivable.ts`

- **Journal Entries** (`src/screens/journalEntries/JournalEntriesScreen.tsx`)
  - Voucher type filter chips (JV, GRN, PAY, etc.)
  - Expandable cards showing journal lines
  - API: `src/api/journalEntries.ts`

**Phase 4 — Reports**
- **Trial Balance** (`src/screens/trialBalance/TrialBalanceScreen.tsx`)
  - Company selector, date picker, account table
  - Balance diff warning, hierarchical indentation
  - API: `src/api/trialBalance.ts`

**Phase 5 — Admin**
- **Business Partners** (`src/screens/partners/PartnersScreen.tsx`)
  - Customer/Vendor role filter, search
  - Avatar initials, role badges
  - API: `src/api/partners.ts`

- **Companies** (`src/screens/companies/CompaniesScreen.tsx`)
  - Company cards with status, fiscal year, contact info
  - API: `src/api/companies.ts`

**Phase 4 Remainder**
- **Financial Reports** (`src/screens/financialReports/FinancialReportsScreen.tsx`)
  - P&L tab: revenue/expense accounts, net income summary
  - Balance Sheet tab: assets/liabilities/equity, balance check
  - Company selector + date picker (shared with Trial Balance)

**Phase 6 — Polish (Full)**
- **FinanceNavigator** — Stack: AP, AR, JE, Trial Balance, Financial Reports
- **MoreNavigator** — Stack: Materials, POs, SOs, GRN, Partners, Companies
- **Dashboard Quick Actions** — All 6 tiles wired to real screens
- **CompanyContext** (`src/context/CompanyContext.tsx`) — global company selector
- **CompanyPicker** (`src/components/CompanyPicker.tsx`) — horizontal chips component
- **Inventory, AP, AR** — use global company filter from context
- **Empty states** — All screens have empty state UI with icons
- **Pull-to-refresh** — All list screens support pull-to-refresh

---

## What's Next (Session 4)

All primary roadmap items are complete. Remaining polish options:

1. **Date range filters** on Journal Entries (from/to date inputs)
2. **Search within AP/AR** (bills and invoice search)
3. **PO detail navigation** from GRN screen line items
4. **Deep-link back navigation** — ensure back button behavior is correct in all nested stacks

---

## Session 1 — 2026-05-12

### Completed

**Project Scaffolding**
- Initialized Expo 51 / React Native 0.74 project
- TypeScript with `@/` path aliases via `babel-plugin-module-resolver`
- `.gitignore` for mobile artifacts

**Design System (`src/theme/index.ts`)**
- Full color palette matching web app
- Voucher badge colors, spacing, radius, shadow, typography scales

**API Layer**
- `src/api/client.ts` — Fetch wrapper with JWT token storage via expo-secure-store
- `src/api/auth.ts` — fetchEmployees(), loginAs(id), logout()
- `src/api/dashboard.ts` — fetchDashboardData(companyId?)

**Auth Context (`src/context/AuthContext.tsx`)**
- React context with `loginAs` / `logout` actions
- Restores session from stored JWT on app start
- `useAuth()` hook

**Shared Components**
- `LoadingView` — centered spinner with optional message
- `ErrorView` — error message with retry button
- `KPICard` — metric card (label / value / subtext, optional tap handler)
- `SectionHeader` — section title + optional right-side meta text

**Login Screen** — Employee selector with card list, avatar initials, role badges

**Dashboard Screen** — KPI grid, working capital panel, quick actions, recent vouchers

**Navigation** — AuthNavigator, AppNavigator (bottom tabs), RootNavigator

---

## Screen Inventory

| Screen | Status |
|---|---|
| Login (user selector) | ✅ Done |
| Dashboard / Home | ✅ Done |
| Inventory | ✅ Done |
| Materials | ✅ Done |
| Purchase Orders + Detail | ✅ Done |
| Sales Orders + Detail | ✅ Done |
| GRN | ✅ Done |
| Accounts Payable | ✅ Done |
| Accounts Receivable | ✅ Done |
| Journal Entries | ✅ Done |
| Trial Balance | ✅ Done |
| Financial Reports (P&L, BS) | ✅ Done |
| Business Partners | ✅ Done |
| Companies | ✅ Done |
| Dashboard Quick Actions wired | ✅ Done |
| Global Company Filter (all screens) | ✅ Done |
| Pull-to-refresh (all screens) | ✅ Done |
| Empty States | ✅ Done |
| API retry logic | ✅ Done |
| MoreMenu Finance deep links | ✅ Done |
