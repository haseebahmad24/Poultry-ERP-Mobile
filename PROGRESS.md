# Mobile App Progress

## Session 7 — 2026-05-20

### Completed This Session

**Vendor Detail Screen** (`src/screens/finance/VendorDetailScreen.tsx`)
- Tappable vendor cards and top-vendor mini-list rows in `AccountsPayableScreen` → navigate to `VendorDetailScreen`
- Chevron-right affordance on all tappable vendor rows
- `VendorDetailScreen`: shows full bill history for a single vendor
  - Header: vendor name + "Vendor · Accounts Payable" subtitle
  - Summary tiles: Outstanding, Overdue (highlighted when > 0), Total Billed, Bill count
  - Bill list sorted overdue-first; each overdue bill has alert banner with days count
  - Search bar to filter by bill number or status
  - Pull-to-refresh, loading and empty states

**Customer Detail Screen** (`src/screens/finance/CustomerDetailScreen.tsx`)
- Tappable customer cards and top-customer mini-list rows in `AccountsReceivableScreen` → navigate to `CustomerDetailScreen`
- `CustomerDetailScreen`: same pattern as Vendor Detail but for AR invoices
  - Summary tiles: Outstanding, Overdue, Total Billed, Invoice count
  - Invoice list sorted overdue-first with overdue alert banners
  - Search by invoice number or status, pull-to-refresh

**FinanceNavigator updates**
- Added `VendorDetail` and `CustomerDetail` routes with typed params (`vendorId`, `vendorName`, `outstanding`, `overdue`)

**Extended Offline Caching**
- `AccountsPayableScreen`: caches summary/bills/vendors bundle per company (24h TTL); OfflineBanner on stale+error
- `AccountsReceivableScreen`: caches summary/invoices/customers bundle per company
- `MaterialsScreen`: caches materials+types per company+typeFilter combo

---

## Session 6 — 2026-05-19

### Completed This Session

**Inventory Item Detail Screen**
- New `InventoryNavigator` (stack) wraps `InventoryScreen` + `ItemLedgerScreen`
- `StockCard` is now tappable when `item_id` is present — navigates to `ItemLedgerScreen`
- `ItemLedgerScreen`: shows full movement log for a single item
  - Summary bar: Total In / Total Out / Current Balance with color coding
  - Date filter panel with quick presets (Today, This Week, This Month, Last Month)
  - Pull-to-refresh support
  - Empty state with optional clear-filter CTA
- `AppNavigator` updated: `Inventory` tab now uses `InventoryNavigator` instead of bare screen

**AP/AR Overdue Due-Date Alerts**
- `daysOverdue()` helper: computes calendar days past `due_date` (0 for paid or future)
- Bills/Invoices sorted overdue-first (most overdue at top of list)
- Bills/Invoices tab shows red dot badge with overdue count
- `SectionHeader` meta shows "N records · M overdue" when applicable
- Overdue cards have red left border + amber "⚠ X days overdue" banner
- Due date text turns red when overdue
- Applied to both `AccountsPayableScreen` and `AccountsReceivableScreen`

**Offline Data Caching**
- Installed `@react-native-async-storage/async-storage`
- `src/utils/cache.ts`: `getCached` / `setCached` with 24h TTL and version key
- `src/components/OfflineBanner.tsx`: amber "showing cached data" banner component
- `DashboardScreen`: serves cached KPIs/vouchers instantly on mount, fetches fresh in background; shows `OfflineBanner` if network fails and cached data exists
- `InventoryScreen`: caches stock balances per company; populates UI from cache immediately then refreshes silently

---

## Session 5 — 2026-05-19

### Completed This Session

**Inventory Screen — Warehouses Tab**
- Added 3rd "Warehouses" tab using `?view=warehouses` API endpoint
- Warehouse cards: name, code, type, address, active/inactive status pill
- Optional item count and total qty stats on each card
- New `Warehouse` interface and `fetchWarehouses()` in `src/api/inventory.ts`

**Inventory Screen — Stock Ledger Date Filter**
- Collapsible date filter panel on the Ledger tab (📅 toggle button in header)
- `From` and `To` text inputs with green/red validation feedback
- Quick presets: Today, This Week, This Month, Last Month
- Active filter indicator (●) on the toggle button when dates are applied
- Clear button to reset; dates passed to API as `?from=&to=` params

**Inventory Screen — Low Stock Filter**
- Filter chips on Stock Balances tab: All | Low Stock | Out of Stock
- Live counts in chip labels (e.g. "Low Stock (12)")
- Low stock threshold: qty < 100; Out of stock: qty ≤ 0
- Color coding: warning amber for low, danger red for out-of-stock chips

**Trial Balance — Export/Share**
- Export button in header (visible when data is loaded)
- Uses React Native `Share` API to share formatted columnar text
- Format: fixed-width Account | Debit | Credit with totals row + balanced status

**Financial Reports — Export/Share**
- Export button shares P&L or Balance Sheet depending on active tab
- P&L: revenue/expense lines with totals + net income
- Balance Sheet: asset/liability/equity lines with totals

**Journal Entries — Export/Share**
- Export button shares currently filtered JE list as formatted text
- Includes voucher type/number/date/status, narration, and line items
- Only visible when there are filtered entries

---

## Session 4 — 2026-05-19

### Completed This Session

**Date Range Filtering — Journal Entries**
- Added collapsible date filter panel (📅 button in header toggles it)
- Text inputs for `from` and `to` dates (YYYY-MM-DD format) with green/red validation feedback
- **Quick date presets**: Today, This Week, This Month, Last Month — one tap to set the range
- Active filter indicator (●) shown on the toggle button when dates are set
- Clear button to reset dates
- Dates are passed to the API (`from`, `to` params) for server-side filtering

**Search in Accounts Payable & Accounts Receivable**
- **AP Bills tab**: search by bill number, vendor name, or status
- **AP Vendors tab**: search by vendor name
- **AR Invoices tab**: search by invoice number, customer name, or status
- **AR Customers tab**: search by customer name
- All searches update the record count in the section header

**Search in Purchase Orders & Sales Orders**
- **Purchase Orders**: search bar filters by PO number, vendor name, or status
- **Sales Orders**: search bar filters by SO number, customer name, or status
- Search clears to show all records, empty state shows appropriate message

**GRN → PO Detail Navigation**
- GRN cards are now tappable — tap opens the full PO detail screen
- "Tap to view PO detail →" affordance shown on each card
- More items line updated to "...tap to view all"

**Back Button Polish — All Non-Root Screens**
- Added `BackButton` component to all screens accessible from MoreMenu and FinanceMenu:
  - Materials, Purchase Orders, Sales Orders, GRN, Partners, Companies
  - Accounts Payable, Accounts Receivable, Journal Entries, Trial Balance, Financial Reports
- All three screens missing `flexDirection: 'row'` in header (AP, AR, Financial Reports) were fixed
- `BackButton` uses `canGoBack()` internally — won't appear on root screens

---

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
  - All/Open/In Progress status tabs + search by PO number/vendor
  - PO cards with progress bar
  - Detail screen with receipt progress + line items
  - API: `src/api/purchaseOrders.ts`

**Phase 2 — Sales & Delivery**
- **Sales Orders Screen** (`src/screens/salesOrders/`)
  - All/Open/Approved/Closed tabs + search by SO number/customer
  - Detail screen with line items and total row
  - API: `src/api/salesOrders.ts`

- **GRN Screen** (`src/screens/grn/GRNScreen.tsx`)
  - Overall receipt summary card
  - Per-PO progress bars with line item preview
  - Tappable cards navigate to PO detail

**Phase 3 — Finance**
- **Accounts Payable** (`src/screens/finance/AccountsPayableScreen.tsx`)
  - Summary/Bills/Vendors tabs, aging analysis bars
  - Search in Bills and Vendors tabs
  - API: `src/api/accountsPayable.ts`

- **Accounts Receivable** (`src/screens/finance/AccountsReceivableScreen.tsx`)
  - Summary/Invoices/Customers tabs, aging analysis
  - Search in Invoices and Customers tabs
  - API: `src/api/accountsReceivable.ts`

- **Journal Entries** (`src/screens/journalEntries/JournalEntriesScreen.tsx`)
  - Voucher type filter chips (JV, GRN, PAY, etc.)
  - Expandable cards showing journal lines
  - Date range filter with quick presets (Today, This Week, This Month, Last Month)
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

## What's Next (Session 8)

All primary roadmap items are complete. Remaining polish options:

1. **Low-stock threshold setting** — Let user configure the low-stock qty threshold (store in AsyncStorage)
2. **Extend offline caching further** — Add caching to Partners, PO list, SO list screens
3. **Notifications** — Local push notifications for overdue AP/AR items
4. **Partners detail** — Tap a partner row to see their purchase/sales order history

---

## Screen Inventory

| Screen | Status |
|---|---|
| Login (user selector) | ✅ Done |
| Dashboard / Home | ✅ Done |
| Inventory (Stock + Ledger + Warehouses tabs) | ✅ Done |
| Inventory Low-Stock Filter | ✅ Done |
| Inventory Ledger Date Filter | ✅ Done |
| Inventory Item Detail (tap stock row → item ledger) | ✅ Done |
| Materials (with offline cache) | ✅ Done |
| Purchase Orders + Detail | ✅ Done |
| Sales Orders + Detail | ✅ Done |
| GRN (with PO detail nav) | ✅ Done |
| Accounts Payable (with search + overdue alerts + offline cache) | ✅ Done |
| Vendor Detail (tap vendor → bill history) | ✅ Done |
| Accounts Receivable (with search + overdue alerts + offline cache) | ✅ Done |
| Customer Detail (tap customer → invoice history) | ✅ Done |
| Journal Entries (with date filter + presets + Export) | ✅ Done |
| Trial Balance (with Export) | ✅ Done |
| Financial Reports (P&L, BS, with Export) | ✅ Done |
| Business Partners | ✅ Done |
| Companies | ✅ Done |
| Dashboard Quick Actions wired | ✅ Done |
| Global Company Filter (all screens) | ✅ Done |
| Pull-to-refresh (all screens) | ✅ Done |
| Empty States | ✅ Done |
| API retry logic | ✅ Done |
| MoreMenu Finance deep links | ✅ Done |
| Back buttons (all non-root screens) | ✅ Done |
| Search (PO, SO, AP, AR) | ✅ Done |
| Date range filter + presets (JE) | ✅ Done |
| Offline caching (Dashboard, Inventory, AP, AR, Materials) | ✅ Done |
| OfflineBanner component | ✅ Done |

---

### UI Polish Log (Monochrome)

| Date (UTC) | Screen / Component | Summary |
|---|---|---|
| 2026-05-19 | `src/theme/index.ts` | Replaced full semantic color palette with monochrome tokens (black/gray/white). All export names kept stable; Colors.primary/success/danger/warning now resolve to #0a0a0a. Shadow toned down to near-zero opacity. Radius values tightened (md→8, lg→12). |
| 2026-05-19 | `src/components/CompanySelector.tsx` (new) | Built shared monochrome company selector: compact pill trigger with Feather chevron-down, opens bottom-sheet modal with bold active / gray inactive company list. |
| 2026-05-19 | `src/screens/dashboard/DashboardScreen.tsx` | Full monochrome polish: white top bar replacing blue, Feather icons (book-open/shopping-cart/package/truck/bar-chart-2/box) replacing all emojis, hairline borders replacing shadows on all cards, voucher type chips now outline-only, KPI values all black, status differentiated by weight not color. Migrated CompanyPicker → CompanySelector. |
| 2026-05-19 | `src/components/KPICard.tsx` | Replaced Shadow.card with hairline border. |
| 2026-05-19 | `src/components/ErrorView.tsx` | Replaced ⚠️ emoji with Feather alert-circle; button is now outline-style instead of colored fill. |
| 2026-05-19 | `src/navigation/AppNavigator.tsx` | Replaced emoji tab bar icons with Feather (home/box/dollar-sign/menu); dropped tab bar shadow; active tint = black, inactive = gray. |
| 2026-05-19 | `src/screens/more/MoreMenuScreen.tsx` | All emojis → Feather icons; Shadow.card → hairline border; `›` chevron → Feather chevron-right; icon wrapped in bordered square. |
| 2026-05-19 | `src/screens/financeMenu/FinanceMenuScreen.tsx` | Same as MoreMenuScreen: Feather icons, hairline borders, lock icon replaces 🔒. |
| 2026-05-19 | `src/screens/inventory/InventoryScreen.tsx` | Full monochrome polish: CompanyPicker → CompanySelector; 📦/📅 emojis → Feather icons; all VOUCHER_COLORS dropped to monochrome outline badges; stock filter chips now black-active/outline-inactive; qty values all black with "Out"/"Low" text label pills; date presets black-active; hairline borders everywhere; Feather search/x/chevron-right/arrow-up/arrow-down icons. |
| 2026-05-19 | `src/screens/inventory/ItemLedgerScreen.tsx` | Same monochrome treatment: 📅/📦 emojis → Feather; VOUCHER_COLORS removed; IN/OUT qty pills use arrow icons instead of color; summary bar all black; date filter presets black-active; hairline borders. |
| 2026-05-19 | `src/screens/purchaseOrders/PurchaseOrdersScreen.tsx` | 🛒/📅/🚚 emojis → Feather icons; PO_STATUS_COLORS dropped to outline badge; progress bar fill now black; tab active underline = black; inline Feather search input; hairline borders; BackButton import added. |
| 2026-05-19 | `src/screens/salesOrders/SalesOrdersScreen.tsx` | Same treatment: CompanyPicker → CompanySelector; 📦/📅/🚚 emojis → Feather; SO_STATUS_COLORS dropped; hairline borders; Feather chevron-right replaces "Tap for details →". |
| 2026-05-19 | `src/screens/journalEntries/JournalEntriesScreen.tsx` | CompanyPicker → CompanySelector; 📅/📒 emojis → Feather calendar/book-open; VOUCHER_COLORS and STATUS_COLORS dropped; all voucher badges outline-only; debit/credit values all black; type filter chips black-active; date preset chips black-active; export button outline-style; ▲/▼ → Feather chevron-up/down; hairline borders. |
| 2026-05-19 | `src/screens/finance/AccountsPayableScreen.tsx` | CompanyPicker → CompanySelector; 📅/⏰/⚠/🧾/🏪 → Feather icons; BILL_STATUS_COLORS dropped; KPI values all black; aging bars use grayscale gradient fills (not semantic colors); overdue banner neutral gray with Feather alert-circle; overdueTabBadge → black filled; red left border + danger backgrounds removed; hairline borders throughout. |
| 2026-05-19 | `src/screens/finance/AccountsReceivableScreen.tsx` | Same treatment as AP screen: CompanyPicker → CompanySelector; all semantic colors dropped; 📅/⏰/⚠/🧾/👥 → Feather icons; grayscale aging bars; neutral overdue banners; hairline borders. |
| 2026-05-19 | `src/components/StatusBadge.tsx` | Dropped STATUS_COLORS record with hardcoded semantic hex values; now hairline outline chip (Colors.border bg). MUTED_STATUSES set (closed/cancelled/inactive/rejected) → opacity 0.5. |
| 2026-05-19 | `src/components/OfflineBanner.tsx` | 📵 emoji → Feather wifi-off; warning colors → Colors.surfaceHover / Colors.textSecondary; hairline border. |
| 2026-05-19 | `src/components/FilterChip.tsx` | hairline borderWidth; chipActive → Colors.text fill (black) / white text; dropped unused `color` prop from internal logic. |
| 2026-05-19 | `src/components/TabBar.tsx` | Container hairline borderWidth; countActive → Colors.textSecondary. |
| 2026-05-19 | `src/components/SegmentedControl.tsx` | tabActive: shadow removed → hairline border; already monochrome via Colors.primary = black. |
| 2026-05-19 | `src/screens/trialBalance/TrialBalanceScreen.tsx` | ⚖️/⚠️ emojis → Feather scale/alert-circle; inline company picker: ▾ text → Feather chevron-down with Feather check for active; Shadow.card → hairline borders; semantic colors removed from totals/table; runBtn → Colors.text; out-of-balance warning neutral gray; Feather search/x in search bar. |
| 2026-05-19 | `src/screens/financialReports/FinancialReportsScreen.tsx` | ⚠️ emoji → Feather alert-circle; inline company picker polished with Feather chevron-down/check; Shadow.card/subtle → hairline borders; all semantic fill colors removed from summary blocks; tab active underline → Colors.text; runBtn → Colors.text; imbalance warning neutral gray; BackButton color prop removed. |
| 2026-05-19 | `src/screens/materials/MaterialsScreen.tsx` | 🔬 emoji → Feather grid; STATUS_COLORS dropped → inline outline badge with opacity for inactive; CompanyPicker → CompanySelector; filter chips black-active; Feather search/x in search bar; Shadow.card/subtle → hairline borders; unit chip neutral. |
| 2026-05-19 | `src/screens/partners/PartnersScreen.tsx` | 🤝/✉️/📞/🏢 emojis → Feather users/mail/phone/briefcase; roleBadge → hairline outline (no color); avatarCircle neutral; CompanyPicker → CompanySelector; filter chips black-active; Feather search/x; Shadow.card → hairline borders. |
| 2026-05-19 | `src/screens/grn/GRNScreen.tsx` | 🚚 emoji → Feather truck; BackButton import added (was missing); statusBadge → outline/filled for complete status; progress fills → Colors.text grayscale; semantic colors in itemPct dropped; cardFooter with Feather chevron-right; Shadow.card/subtle → hairline borders; tintColor → textMuted. Summary card remains black (dark/inverted monochrome aesthetic). |
| 2026-05-19 | `src/screens/companies/CompaniesScreen.tsx` | 🏢 emoji → Feather briefcase; BackButton import added (was missing); statusBadge → hairline outline, inactive = opacity 0.5; logoCircle → surfaceHover neutral; semantic successBg/dangerBg removed; Shadow.card/subtle → hairline borders. |
| 2026-05-19 | `src/screens/purchaseOrders/PODetailScreen.tsx` | STATUS_COLORS (hardcoded hex) dropped → hairline outline badge with MUTED_STATUSES opacity; ‹ text → Feather chevron-left; StatBox values all black; progress fills → Colors.text; Shadow.card → hairline borders; borderWidth 1 → hairlineWidth. |
| 2026-05-19 | `src/screens/purchaseOrders/PurchaseOrderDetailScreen.tsx` | PO_STATUS_COLORS dropped → MUTED_STATUSES outline badge; all semantic qty colors (success/warning/danger) → Colors.text / textSecondary; progress fills → Colors.text; Shadow.card/subtle → hairline borders; tintColor → textMuted. |
| 2026-05-19 | `src/screens/salesOrders/SalesOrderDetailScreen.tsx` | SO_STATUS_COLORS dropped → MUTED_STATUSES outline badge; lineItemAmount → Colors.text; totalRow → Colors.surfaceHover bg with Colors.text labels; Shadow.card/subtle → hairline borders; tintColor → textMuted. |
| 2026-05-19 | `src/screens/auth/LoginScreen.tsx` | 🐔 emoji → Feather layers icon in dark header; roleColor function removed → all role badges monochrome outline; avatarCircle/arrowWrap → surfaceHover neutral; ActivityIndicator → Colors.text; errorBanner → neutral gray surfaceHover; retryBtn → Colors.text; Shadow.card → hairline borders. |
| 2026-05-19 | `src/components/BackButton.tsx` | ‹ text character → Feather chevron-left; default color changed from #fff → Colors.text (prevents invisible button on white headers). |
