# Mobile App Progress

## Session 15 — 2026-05-24

### Completed This Session

**Trial Balance + Financial Reports Offline Caching**
- Both screens now follow the established caching pattern: serve cached data instantly on mount, refresh from API in background
- Cache key: `trial-balance:<companyId>:<asOf>` — shared between both screens (same API endpoint, same data)
- `OfflineBanner` shown when stale cached data is served after a failed network request
- `ErrorView` only shown when no cached data is available (errors don't clobber existing UI)
- Added `isStale` state that tracks whether current data came from an expired cache entry

**Biometric Lock** (`src/components/BiometricLockOverlay.tsx`, `src/navigation/AppNavigator.tsx`, `src/screens/settings/SettingsScreen.tsx`)
- Installed `expo-local-authentication`
- `BiometricLockOverlay`: full-screen overlay component that auto-triggers `LocalAuthentication.authenticateAsync()` on mount; shows "Try Again" state when auth fails or is cancelled; calls `onUnlock()` callback when auth succeeds
- `AppNavigator`: `AppState` listener (separate from the existing session timeout listener) detects background → foreground transitions; reads `getBiometricEnabled()` and sets `biometricLocked=true` when enabled; the overlay renders above the tab navigator as an absolute-fill element
- `SettingsScreen`: new Biometric lock `Switch` toggle in SECURITY section; only shown when device has enrolled biometrics (`LocalAuthentication.hasHardwareAsync() && isEnrolledAsync()`); requires one successful auth to enable (prevents accidental lockout when hardware is unavailable or user denies)
- `settings.ts`: added `getBiometricEnabled()` / `setBiometricEnabled()` via AsyncStorage key `setting:biometricEnabled`

**Local Push Notifications** (`src/utils/notifications.ts`, `src/navigation/AppNavigator.tsx`, `src/screens/settings/SettingsScreen.tsx`)
- Installed `expo-notifications` v56
- `notifications.ts`:
  - `setNotificationHandler`: banner + list display; no sound; no badge
  - `requestNotificationPermissions()`: checks existing OS grant, prompts if needed, returns boolean
  - `scheduleOverdueReminder({ apOverdue, arOverdue, lowStock })`: cancels old scheduled notification then schedules a new one for the next 9 AM occurrence; body composed from alert counts (e.g. "3 overdue bills · 2 low-stock items"); cancels when total = 0; silently ignores scheduling failures (Expo Go / missing credentials)
  - `cancelOverdueReminder()`: cancels the scheduled notification by identifier
  - `getNotificationsEnabled()` / `setNotificationsEnabled()`: AsyncStorage-backed toggle key `setting:notificationsEnabled`
- `AppNavigator`: `useEffect` on `[apOverdue, arOverdue, lowStock]` reschedules the overdue reminder whenever alert counts change (only when setting is on)
- `SettingsScreen`: "Overdue reminders" `Switch` in SECURITY section; on enable → requests OS permissions (shows Alert with instructions if denied); on disable → cancels pending notification

---

## Session 14 — 2026-05-24

### Completed This Session

**Dashboard Auto-Refresh** (`src/screens/dashboard/DashboardScreen.tsx`)
- New `isSilent` flag on `load()` — silent auto-refresh runs in the background without triggering RefreshControl or replacing error state
- `useFocusEffect` re-reads the refresh interval whenever Dashboard comes into focus (picks up Settings changes immediately)
- `setInterval` fires `load(true, true)` at the configured interval; cleared on unmount/interval change
- `lastUpdated: Date` state tracks successful fetches and is displayed in the top bar as "Updated X min ago"
- 60-second tick interval keeps the relative-time label fresh without API calls
- "Auto ↻Xm" indicator shown in the subGreeting when auto-refresh is active

**Auto-Refresh Interval Setting** (`src/screens/settings/SettingsScreen.tsx`)
- New DASHBOARD section in Settings with chip picker: Off / 1 min / 5 min / 10 min / 30 min
- Reads/writes `setting:autoRefreshInterval` via `getAutoRefreshInterval` / `setAutoRefreshInterval` from `settings.ts`
- Instant feedback — no Save button needed; setting takes effect on next Dashboard focus

**Company Selection Persistence** (`src/context/CompanyContext.tsx`)
- Selected company ID is now persisted to AsyncStorage (`setting:selectedCompanyId`) via the wrapping `setSelectedCompany` callback
- On app restart, `load()` reads the saved ID alongside the companies list and restores the previous selection
- Falls back to the first company when the saved ID is absent or no longer in the list
- `setSelectedCompanyState` used internally to avoid triggering AsyncStorage writes during initial restore

**Session Timeout / Security Lock** (`src/hooks/useSessionTimeout.ts`, `src/navigation/AppNavigator.tsx`)
- New `useSessionTimeout(onTimeout)` hook using React Native's built-in `AppState` API
- Records `backgroundedAt` timestamp when app moves to background; re-reads the timeout setting on each background event
- On foreground: computes elapsed time; calls `onTimeout` (→ `logout()`) when elapsed ≥ configured timeout
- `AppNavigator` wires `useSessionTimeout(logout)` so the check runs for all authenticated screens
- New SECURITY section in Settings with chip picker: Off / 5 min / 15 min / 30 min / 1 hr

**Journal Entries Offline Caching** (`src/screens/journalEntries/JournalEntriesScreen.tsx`)
- Added `isStale` state and caching via `getCached` / `setCached` (24h TTL)
- Cache key: `journal-entries:<companyId>:<type>` — per company + voucher type
- Cache bypassed when a date range filter is active (too many permutations)
- Serves cached data instantly on mount, then refreshes from API in background
- `OfflineBanner` shown when serving stale data after a failed refresh
- Network errors no longer clobber existing entries when cached data is present

---

## Session 13 — 2026-05-23

### Completed This Session

**Material Detail Screen** (`src/screens/materials/MaterialDetailScreen.tsx`)
- New detail screen: tappable from MaterialsScreen, Search results, and Alerts (low-stock items)
- Header: material name + optional code badge
- Meta row: type / category / unit / status chips
- Optional description bar (shown when description param is provided)
- Summary tiles (2×2): Total Stock · Warehouse Count · Total In · Total Out
- **Stock by Warehouse** section: cards per warehouse with qty, unit, low-stock/out-of-stock indicators
- **Transactions** section: up to 50 latest ledger entries with voucher type badge, date, qty delta (+/-), running balance
- **DateRangeBar** date filter on transactions: Today / This Week / This Month / Last Month / Custom presets; re-fetches API when changed; cache only written when no date filter active
- DetailSkeleton loading state, ErrorView, pull-to-refresh, 24h offline cache
- `MoreNavigator`: added `MaterialDetail` route with typed params (materialId, name, code, type, unit, category, status, description)
- `MaterialsScreen`: cards now `TouchableOpacity` with chevron-right affordance; navigate to MaterialDetail with all params

**Dashboard Voucher Activity Chart** (`src/components/VoucherActivityChart.tsx`)
- New `VoucherActivityChart` component: horizontal proportional bars showing top-6 voucher types
- Bar width = type count / max count; shows type label + count + amount per row
- `fetchDashboardData` extended to return `voucherTypeStats` (count + amount per type, sorted by count desc)
- DashboardScreen: "Activity by Type" section shown above Recent Activity when stats are non-empty
- Cache key backwards-compatible (voucherTypeStats is optional in cached shape)

**Search → MaterialDetail navigation**
- MaterialDetail now reachable from Global Search (tapping a material result navigates directly to detail)
- `materialMeta` added to SearchResult type; `materialToResult` populates it; navigate path updated
- `materialDescription` passed through as well

**AlertsScreen → MaterialDetail navigation**
- Low-stock items in Alerts now navigate to MaterialDetail when `item_id` is available
- Falls back to Inventory tab when item_id is absent

---

## Session 12 — 2026-05-23

### Completed This Session

**Animated Skeleton Loading System** (Phase 6 — #16 Empty states and loading skeletons)
- `SkeletonBox`: single animated shimmer box using Animated.loop (opacity 0.4→1.0→0.4, 700ms per leg)
- `SkeletonListItem`: card-shaped skeleton with left column (title+subtitle+meta) and optional right badge column
- `SkeletonKPICard`: matches KPI card proportions (label row + number + sub-label)
- `DashboardSkeleton`: full-page standalone skeleton — top bar + 2×2 KPI grid + 6 quick-action tiles + 4 voucher rows
- `ListScreenSkeleton`: inline skeleton — optional search bar + optional tab bar + N list item rows
- `FinanceSummarySkeleton`: inline skeleton — 2×2 summary tiles + aging bar placeholder + tab bar + N rows
- `DetailSkeleton`: inline skeleton — 2-col summary tiles (configurable count) + section label + N list rows

**Screens migrated from spinner to skeleton:**
- `DashboardScreen`: full-page DashboardSkeleton (entire chrome)
- `PurchaseOrdersScreen`: header stays visible, body shows ListScreenSkeleton
- `SalesOrdersScreen`: same inline pattern with header + skeleton body
- `MaterialsScreen`: same inline pattern
- `InventoryScreen`: header stays; ListScreenSkeleton replaces all 3 tabs body while loading
- `AccountsPayableScreen`: header + CompanySelector stay; FinanceSummarySkeleton for body
- `AccountsReceivableScreen`: same AP pattern
- `JournalEntriesScreen`: header stays; skeleton replaces filter+search+list
- `PartnersScreen`: header stays; skeleton replaces search+filter+list
- `GRNScreen`: header stays; ListScreenSkeleton replaces ScrollView
- `AlertsScreen`: chained ternary (loading→skeleton, empty→all-clear, else→list)
- `CompaniesScreen`: header stays; ListScreenSkeleton for body
- `PurchaseOrderDetailScreen`: full SafeAreaView wrap with DetailSkeleton
- `PODetailScreen`: full SafeAreaView wrap with DetailSkeleton
- `SalesOrderDetailScreen`: full SafeAreaView wrap with DetailSkeleton
- `VendorDetailScreen`: full SafeAreaView wrap with DetailSkeleton
- `CustomerDetailScreen`: full SafeAreaView wrap with DetailSkeleton
- `ItemLedgerScreen`: full SafeAreaView wrap with DetailSkeleton
- `PartnerDetailScreen`: full SafeAreaView wrap with DetailSkeleton
- `TrialBalanceScreen`: header + tabs stay; ListScreenSkeleton for data body
- `FinancialReportsScreen`: header + tabs stay; ListScreenSkeleton for data body

**Result**: Zero full-screen spinner loading states remain. All 20+ screens now show contextually appropriate animated skeleton UI while data loads.

**Keyboard UX improvements**: Applied `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"` to all list screen ScrollViews.

**Inventory tab badge**: Added `lowStock` count badge to Inventory bottom tab (mirrors Finance tab's `totalOverdue` badge) from OverdueContext.

**Dashboard tappable vouchers**: Recent Activity voucher rows are now `TouchableOpacity` elements navigating to Journal Entries. Chevron affordance added per row. "View all journal entries" footer link added below the list.

---

### UI Polish Log (Monochrome)

**2026-05-23** — Detail screen loading states: replaced 7 hardcoded `backgroundColor:'#fafafa'` inline styles with `Colors.background` token in `PurchaseOrderDetailScreen`, `PODetailScreen`, `SalesOrderDetailScreen`, `VendorDetailScreen`, `CustomerDetailScreen`, `ItemLedgerScreen`, `PartnerDetailScreen`. These were introduced by the Session 12 skeleton loading migration; all skeleton SafeAreaView wrappers now reference the theme token instead of a literal.

**2026-05-22** — Replaced all hardcoded `borderRadius` literals with Radius theme tokens across 5 screens: `AlertsScreen` (totalBadge→Radius.full, alertIcon→Radius.md, daysBadge→Radius.sm), `MoreMenuScreen` (alertBannerIcon→Radius.md, bellBadge→Radius.full, menuIconWrap→Radius.md), `FinanceMenuScreen` (menuIconWrap→Radius.md, alertBadge→Radius.full), `SearchScreen` (resultIconWrap→Radius.md), `SettingsScreen` (actionIconWrap→Radius.md). Zero hardcoded numeric borderRadius values remain in any screen or component.

**2026-05-22** — Third borderRadius pass (final): fixed 4 remaining hardcoded pixel values missed by prior passes. `DashboardScreen` alertsDot (8→Radius.full) and quickBadge (8→Radius.full), `AgingChart` legend dot (4→Radius.full), `CompanySelector` sheet handle (2→Radius.full). Confirmed zero hardcoded numeric `borderRadius` values remain across all screens and components.

**2026-05-22** — Second borderRadius pass: replaced remaining numeric literals for circular avatar/badge elements and icon buttons. `CompaniesScreen` logoCircle (22→Radius.full), `LoginScreen` logoWrap (36→Radius.full) and avatar (24→Radius.full), `PartnersScreen` avatarCircle (20→Radius.full), `DashboardScreen` iconBtn/alertsBtn (10→Radius.md), `DateRangeBar` clearBtn (13→Radius.full), `CompanySelector` bottom-sheet corners (16→Radius.xl).

---

## Session 11 — 2026-05-22

### Completed This Session

**Global Search Screen** (`src/screens/search/SearchScreen.tsx`)
- Unified search across 5 data types: Purchase Orders, Sales Orders, Stock Balances, Materials, Business Partners
- Cache-first data loading — pre-loads all sources on mount; background refresh when stale
- Instant client-side filtering (minimum 2 chars), no API call on keystroke
- Results grouped by type with section headers (icon + label + count)
- Each result shows title, subtitle, optional amount/qty/badge metadata
- Navigation: PO→PODetail, SO→SODetail, Partner→PartnerDetail, Stock→cross-tab Inventory>ItemLedger, Material→MaterialsScreen
- Loading, empty-query, and zero-results states with Feather icons
- Auto-focuses input on mount; × clear button; keyboard-aware FlatList

**Navigation wiring for Search**
- Added `Search` route to `MoreStackParamList` and `MoreNavigator`
- `MoreMenuScreen`: tappable search shortcut bar at top (above scroll) navigates to SearchScreen
- `DashboardScreen`: search icon button (Feather `search`) added to top bar between bell and sign-out

**AgingChart component** (`src/components/AgingChart.tsx`)
- New reusable stacked horizontal aging bar component
- Full-width proportional bar: each segment's width = bucket_amount / total
- 5 grayscale fills (light → dark): Current, 1–30d, 31–60d, 61–90d, 90d+
- Legend grid below bar: dot + short label + formatted amount + percentage
- Graceful zero-total case (shows empty gray bar)
- `AccountsPayableScreen`: replaced 5 separate `AgingBar` rows with `<AgingChart>`; removed old function + styles
- `AccountsReceivableScreen`: same migration

---

## Session 10 — 2026-05-21

### Completed This Session

**Alerts/Notifications Screen** (`src/screens/alerts/AlertsScreen.tsx`)
- New screen showing all active alerts in one place: overdue AP bills, overdue AR invoices, low-stock inventory items
- Loads data from cache first (fast, no spinner delay); falls back to API if no cache
- Overdue bills/invoices sorted most-overdue first with "Xd overdue" badge
- Low-stock items sorted by qty ascending (most critical first); threshold from settings
- Tapping bills/invoices navigates cross-tab to Finance → AP/AR; tapping stock → Inventory
- Pull-to-refresh; "All clear" empty state with check-circle icon
- Updates `OverdueContext` counts on every load

**OverdueContext extended**
- Added `lowStock: number` and `setLowStock` to `OverdueContext`
- Added `totalAlerts = apOverdue + arOverdue + lowStock` field
- `InventoryScreen` now publishes low-stock count via `useEffect` on `[stockData, lowStockThreshold]`

**Dashboard improvements**
- Bell icon button in top bar showing `totalAlerts` badge (disappears when zero)
- Alerts quick-action tile added to the 6-tile grid with badge overlay
- Finance Status panel (new section below Working Capital): shows overdue bill/invoice counts as tappable cards — only rendered when alerts exist, no visual noise when clean
- All KPI cards now tappable:
  - Revenue → Financial Reports
  - Expenses → Journal Entries
  - Net Income → Financial Reports
  - Receivables → Accounts Receivable
  - Payables → Accounts Payable

**KPICard component**
- Tappable cards now show a Feather `chevron-right` in the label row to indicate interactivity

**FinanceMenu overdue badges**
- Accounts Payable and Accounts Receivable rows in FinanceMenuScreen show black pill badges with overdue counts from `OverdueContext`

**MoreMenu Alerts banner**
- Prominent `Alerts` banner at top of More menu showing total alert count and breakdown (overdue bills · overdue invoices · low-stock items)
- Active (dark border) when alerts > 0; neutral state when all clear

---

## Session 9 — 2026-05-21

### Completed This Session

**Offline Caching extended further**
- `GRNScreen`: caches GRN progress data per company (24h TTL), OfflineBanner on stale+error
- `CompaniesScreen`: caches companies list with search+filter preserved
- `PODetailScreen` + `PurchaseOrderDetailScreen`: both cache individual PO detail by ID

**Finance tab overdue badge**
- `OverdueContext` + `useOverdue` hook created to share `apOverdue` / `arOverdue` counts
- `AccountsPayableScreen` and `AccountsReceivableScreen` call `setAPOverdue` / `setAROverdue`
- `AppNavigator` Finance tab shows black badge with `totalOverdue` count

**SO Detail caching**
- `SalesOrderDetailScreen`: caches detail per SO id (24h TTL)

**Companies screen search/filter**
- Added real-time search by name/code; active-only toggle chip

---

## Session 8 — 2026-05-20

### Completed This Session

**Settings Screen** (`src/screens/settings/SettingsScreen.tsx`)
- New screen accessible from MoreMenu → Admin section → Settings
- **Low-stock threshold**: text input to configure the qty below which items are flagged as "low stock" on Inventory screen; stored in AsyncStorage via `src/utils/settings.ts`; default 100 units
- **Clear cached data**: destructive action with confirmation alert; calls `clearCache()` to wipe all `cache:*` AsyncStorage keys; shows "Cache cleared" feedback for 2s
- **About** section: app name + version
- `SettingsScreen` added to `MoreNavigator` and `MoreMenuScreen` admin section

**Partner Detail Screen** (`src/screens/partners/PartnerDetailScreen.tsx`)
- `PartnersScreen` cards are now tappable — chevron-right affordance, navigates to `PartnerDetailScreen`
- `PartnerDetailScreen` receives `partnerId`, `partnerName`, `isVendor`, `isCustomer` params
- Fetches all POs (`fetchPurchaseOrders('all')`) and filters client-side by `vendor_id` / vendor name; same for SOs
- Summary tiles: Total POs value + count / Total SOs value + count
- Dual-role tab bar (POs | SOs) shown only when partner has both roles
- PO cards navigate to `PurchaseOrderDetail`; SO cards navigate to `SalesOrderDetail`
- Pull-to-refresh, loading state, empty states per section

**Offline Caching extended**
- `PurchaseOrdersScreen`: caches per tab key (`purchase-orders:all/open/progress`, 24h TTL); shows `OfflineBanner` on stale+error
- `SalesOrdersScreen`: caches per tab+company combo; shows `OfflineBanner` on stale+error
- `PartnersScreen`: caches per company (`partners:all/companyId`); shows `OfflineBanner` on stale+error

**Low-stock threshold wired end-to-end**
- `src/utils/settings.ts`: `getLowStockThreshold()` / `setLowStockThreshold()` via AsyncStorage key `setting:lowStockThreshold`
- `InventoryScreen`: replaced hardcoded `LOW_STOCK_THRESHOLD = 100` with state loaded from `getLowStockThreshold()` on mount; threshold now respects user setting in real time

---

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

## What's Next (Session 16+)

Sessions 1–15 are complete. All roadmap screens + polish + key enhancements are done. Remaining enhancement options:

1. **Deep link navigation** — Universal links / custom URL scheme for sharing screen URLs (`expo-linking`)
2. **Purchase Order creation** — Draft PO form with item line entry (requires POST API endpoint on web app)
3. **Notification scheduling improvements** — Configurable notification time (not just 9 AM), per-alert-type toggles
4. **Report export to PDF** — Generate PDF version of Trial Balance / P&L / Balance Sheet using a PDF library
5. **Widget support** — Expo WidgetKit for home screen KPI summary (iOS 17+)

---

## Screen Inventory

| Screen | Status |
|---|---|
| Login (user selector) | ✅ Done |
| Dashboard / Home | ✅ Done |
| Dashboard KPI card navigation (tap to drill down) | ✅ Done |
| Dashboard Finance Status panel (overdue bill/invoice count cards) | ✅ Done |
| Dashboard Alerts bell + quick action tile | ✅ Done |
| Inventory (Stock + Ledger + Warehouses tabs) | ✅ Done |
| Inventory Low-Stock Filter (configurable threshold) | ✅ Done |
| Inventory Ledger Date Filter | ✅ Done |
| Inventory Item Detail (tap stock row → item ledger) | ✅ Done |
| Materials (with offline cache) | ✅ Done |
| Purchase Orders + Detail (with offline cache) | ✅ Done |
| Sales Orders + Detail (with offline cache) | ✅ Done |
| GRN (with PO detail nav + offline cache) | ✅ Done |
| Accounts Payable (with search + overdue alerts + offline cache) | ✅ Done |
| Vendor Detail (tap vendor → bill history) | ✅ Done |
| Accounts Receivable (with search + overdue alerts + offline cache) | ✅ Done |
| Customer Detail (tap customer → invoice history) | ✅ Done |
| Journal Entries (with date filter + presets + Export + offline cache) | ✅ Done |
| Trial Balance (with Export) | ✅ Done |
| Financial Reports (P&L, BS, with Export) | ✅ Done |
| Business Partners (with offline cache + tappable) | ✅ Done |
| Partner Detail (tap partner → PO/SO history) | ✅ Done |
| Companies (with search/filter + offline cache) | ✅ Done |
| Settings (low-stock threshold + cache management) | ✅ Done |
| Alerts / Notifications Center | ✅ Done |
| Dashboard Quick Actions wired | ✅ Done |
| Global Company Filter (all screens) | ✅ Done |
| Pull-to-refresh (all screens) | ✅ Done |
| Empty States | ✅ Done |
| API retry logic | ✅ Done |
| MoreMenu Finance deep links | ✅ Done |
| MoreMenu Alerts banner with count breakdown | ✅ Done |
| FinanceMenu overdue badges on AP/AR rows | ✅ Done |
| Back buttons (all non-root screens) | ✅ Done |
| Search (PO, SO, AP, AR) | ✅ Done |
| Global Search Screen (POs, SOs, Stock, Materials, Partners) | ✅ Done |
| AgingChart stacked bar in AP/AR Summary tabs | ✅ Done |
| Dashboard search icon button | ✅ Done |
| MoreMenu search shortcut bar | ✅ Done |
| Date range filter + presets (JE, Inventory Ledger) | ✅ Done |
| Offline caching (all major screens) | ✅ Done |
| OfflineBanner component | ✅ Done |
| Finance tab badge (overdue count) | ✅ Done |
| KPICard tappable chevron indicator | ✅ Done |
| Dashboard auto-refresh interval (configurable) | ✅ Done |
| Dashboard "last updated" timestamp in top bar | ✅ Done |
| Company selection persistence across restarts | ✅ Done |
| Session timeout / security lock (configurable) | ✅ Done |
| Journal Entries offline cache | ✅ Done |
| Trial Balance offline cache | ✅ Done |
| Financial Reports offline cache | ✅ Done |
| Biometric lock (fingerprint / Face ID) | ✅ Done |
| Local push notifications (overdue reminders) | ✅ Done |

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
| 2026-05-20 | `src/components/DateRangeBar.tsx` (new) | Built shared controlled date-range bar: horizontally scrollable preset chips (Today / This Week / This Month / Last Month / Custom), compact From→To summary pill, inline Custom inputs — all monochrome. Supports `mode="range"` (default) and `mode="single"` for as-of screens. Active chip: black fill, white text; inactive: outline gray. |
| 2026-05-20 | `src/screens/inventory/InventoryScreen.tsx` | Migrated Stock Ledger date filter to DateRangeBar: removed showDateFilter toggle, fromInput/toInput/fromDate/toDate state and all helper fns; replaced datePanel block with `<DateRangeBar value={dateRange} onChange={setDateRange} />` (shown only on Ledger tab); removed calendar toggle button from header. API contract unchanged (from/to strings passed directly). |
| 2026-05-20 | `src/screens/journalEntries/JournalEntriesScreen.tsx` | Migrated date filter to DateRangeBar: removed showDateFilter toggle, fromDate/toDate state, DATE_PRESETS array and all inline date filter UI; replaced with `<DateRangeBar value={dateRange} onChange={setDateRange} />` always visible below CompanySelector; removed calendar icon button from header. validFrom/validTo derivation preserved for API call. |
| 2026-05-21 | `src/screens/trialBalance/TrialBalanceScreen.tsx` | Migrated local company picker + As-of TextInput + Run Report button → `<CompanySelector showAll />` + `<DateRangeBar mode="single" />`. Removed local selectedCompany/asOfInput/showCompanyPicker state and initializing useEffect; load deps now use companyId from context. Export uses ctxCompany?.name. All filter-related styles removed. |
| 2026-05-21 | `src/screens/financialReports/FinancialReportsScreen.tsx` | Same migration as TrialBalance: local company picker + date TextInput + Run Report button → `<CompanySelector showAll />` + `<DateRangeBar mode="single" />`. TextInput removed from imports (no search bar in this screen). Local Company type definition and selectedCompany/asOfInput/showCompanyPicker state removed. |
| 2026-05-21 | Shared component polish pass | `ScreenHeader`: ‹ text → Feather chevron-left, `borderBottomWidth: 1` → hairlineWidth. `SearchBar`: added Feather search icon + conditional Feather ×-clear button, `borderWidth: 1` → hairlineWidth. `CompanyPicker`: chip active state → black fill / white text (matching FilterChip pattern), `borderWidth/borderBottomWidth: 1` → hairlineWidth. `AppNavigator`: tab bar `borderTopWidth: 1` → hairlineWidth. |
| 2026-05-21 | `src/screens/inventory/ItemLedgerScreen.tsx` | Migrated bespoke date filter (showDateFilter toggle, fromDate/toDate/fromInput/toInput state, 4 helper fns, preset chips, TextInput panel) → `<DateRangeBar value={dateRange} onChange={setDateRange} />` always visible below summary bar. Calendar toggle button removed from header. TextInput and helper date fns removed from file. API contract unchanged (from/to passed as-is). |
| 2026-05-21 | 11 screens — OfflineBanner `visible` prop fix | All screens using `{stale && error && <OfflineBanner />}` had a silent bug: the required `visible` prop was missing so the banner never rendered. Fixed to `<OfflineBanner visible={!!(stale && error)} />` in MaterialsScreen, CompaniesScreen, PODetailScreen, PurchaseOrderDetailScreen, SalesOrderDetailScreen, AccountsPayableScreen, AccountsReceivableScreen, GRNScreen, SalesOrdersScreen, PurchaseOrdersScreen, PartnersScreen. |
| 2026-05-23 | Skeleton components audit + hairline border pass | Full session audit confirmed all screens/components monochrome and clean after build-agent session 13. Fixed visual inconsistency in 4 skeleton components: replaced `Shadow.card` with `borderWidth: StyleSheet.hairlineWidth` in `SkeletonKPICard`, `SkeletonListItem`, `DetailSkeleton` tile, and `FinanceSummarySkeleton` tile — now pixel-accurate to the actual cards they preview, eliminating layout shift on load. `DashboardSkeleton` quickTile also switched from Shadow to hairline border. |
| 2026-05-24 | Session 14 audit + detail screen header fixes | Full audit of 6 files added/modified by build-agent sessions 13–14: `MaterialDetailScreen`, `VoucherActivityChart`, `SearchScreen`, `AlertsScreen`, `DashboardScreen`, `SettingsScreen` — all already clean. Fixes applied: (1) `DashboardScreen` sub-greeting `↻` symbol → plain "Refresh Xm" text. (2) `MaterialDetailScreen` + `VoucherActivityChart`: removed redundant `Shadow.card` spreads from cards that already had hairline borders; removed unused `Shadow` imports. (3) `PurchaseOrderDetailScreen` + `SalesOrderDetailScreen`: added custom white header (BackButton + title) to each; both previously relied on the black native stack header while also wrapping content in `SafeAreaView edges={['top']}`, causing double-padding. (4) `MoreNavigator`: set `headerShown: false` for `PurchaseOrderDetail` and `SalesOrderDetail` to suppress the black native headers in favour of the new custom ones. Zero Shadow usages remain in screens/components. |
