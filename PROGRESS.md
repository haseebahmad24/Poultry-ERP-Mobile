# Mobile App Progress

## Session 47 — 2026-06-08

### Completed This Session

**FinancialAnalytics — 30-Day Aging History Trend Chart** (`src/screens/analytics/FinancialAnalyticsScreen.tsx`, `src/utils/agingSnapshot.ts`)
- `AgingHistoryEntry` type: `{date, companyId, apTotal, arTotal, apOver90, arOver90}`
- `saveAgingHistory()` + `loadAgingHistory()` — rolling 30-entry array keyed by `aging-history:${companyId}`; skips same-day overwrite; trims oldest when over 30
- `FinancialAnalyticsScreen`: `agingHistory` state loaded alongside snapshot in `Promise.all`; new entry saved after API fetch; history reloaded to include today's entry
- `AgingHistoryChart`: grouped daily bars (AP=muted, AR=dark) for last 10 visible entries; `fmtHistoryDate()` formats as "Jun 8"; over-90 summary row shown when any entry has non-zero over_90; hidden when `history.length < 2`
- Placed below AR Aging section before Top Customers with "AP vs AR History" section header

**ProcurementAnalytics — Average Order Value in Ranked Lists** (`src/screens/analytics/ProcurementAnalyticsScreen.tsx`)
- `VendorRow` and `CustomerRow` interfaces gain `avgValue: number` field
- `computeAnalytics`: topVendors and topCustomers slices `.map()` to add `avgValue = total / count`
- `fmtAvg()` helper: formats with K/M suffix + "avg" label (e.g., "45K avg")
- `RankedBarList`: renders avg as 3rd line below order count (`rankedStyles.avg`) when `avgValue > 0`

**Dashboard — Month-over-Month AP/AR Billing Comparison Card** (`src/screens/dashboard/DashboardScreen.tsx`)
- `monthComparison` state: `{apThis, apPrev, arThis, arPrev, thisLabel, prevLabel}` computed in existing `useFocusEffect` from `bills.dt` and `invoices.dt` — zero extra API calls
- `fmtK()` helper hoisted to module scope (removed duplicate local function from Upcoming Cash block)
- `MoMRow` component: prev-month → this-month with trending icon (`trending-up`/`trending-down`/`minus`) and integer % change badge
- Card placed after Finance Health, before Supply Chain Snapshot; hidden when `monthComparison` is null (all zero billing)

### Next Session
- Consider: FinancialAnalytics — multi-snapshot trend visualization (line chart over rolling history, currently shown as bars)
- Consider: JournalEntries — top accounts by debit volume (bar chart from line items, requires lines data)
- Consider: StockHealth — filter velocity card by warehouse, or date range for ledger period
- Consider: ProcurementAnalytics — vendor/customer trend comparison (side-by-side monthly bars for top 2 vendors)
- Consider: Dashboard — "Quick Stats" sparkline card (tiny revenue/expense trendline from last 7 daily KPI snapshots)

---

## Session 46 — 2026-06-08

### Completed This Session

**Journal Entries Dr/Cr Monthly Flow Chart** (`src/screens/journalEntries/JournalEntriesScreen.tsx`)
- `buildMonthBuckets()`: groups filtered entries by year-month for the last 6 months, sums `total_debit` and `total_credit` per bucket; uses `dt.slice(0,7)` as the month key
- `DrCrFlowChart`: compact grouped bar chart (dark bar = Dr, muted bar = Cr) with month labels; hidden when no `dt` data present
- Rendered inside `JESummaryCard` below the voucher type breakdown; zero extra API calls

**StockHealth — Stock Velocity Card** (`src/screens/analytics/StockHealthScreen.tsx`)
- `computeVelocity()`: aggregates all `StockLedgerEntry` rows by `item_name`, sums `qty_in` + `qty_out`, returns top 8 items by total movement
- `VelocityCard`: ranked list with stacked proportional bar (dark = IN, muted = OUT), per-item IN/OUT totals on right; hidden when no movement data
- `fetchStockLedger({ companyId })` called in `load()` alongside stock/warehouses fetch; cached independently under `stock-velocity:*` key (returns immediately from cache on subsequent loads)
- Placed between "Top Items by Quantity" and "Warehouse Distribution" sections

**Dashboard — Upcoming Cash Flow Summary Card** (`src/screens/dashboard/DashboardScreen.tsx`)
- 3-tile horizontal card: AP Outflow | Net | AR Inflow — computed from existing `dueSoonBills`/`dueSoonInvoices` state (zero extra API calls)
- Net tile uses `fmtK()` helper (K/M formatting), shows dark when positive (net inflow), muted when negative (net outflow) with hint text "inflow"/"outflow"
- AP tile taps → AccountsPayable screen; AR tile taps → AccountsReceivable screen
- Placed between "Top Customers" section and the per-item "Upcoming Payments" list; only visible when there is at least one due-soon bill or invoice

### Next Session
- Consider: FinancialAnalytics — historical aging trend (multi-day snapshots stored in AsyncStorage, visualise bucket shifts over time)
- Consider: ProcurementAnalytics — average order value per vendor/customer (value ÷ count column in ranked lists)
- Consider: JournalEntries — top accounts by debit volume (bar chart from line items, requires lines data)
- Consider: StockHealth — filter velocity card by warehouse, or date range for ledger period
- Consider: Dashboard — "This Month vs Last Month" mini-trend for AP/AR outstanding

---

## Session 45 — 2026-06-07

### Completed This Session

**Journal Entries Summary Card** (`src/screens/journalEntries/JournalEntriesScreen.tsx`)
- `JESummaryCard` renders above the voucher list when `filtered.length > 0` — zero extra API calls
- Header row: total entry count on left, compact Dr / Cr totals on right (K/M formatted via `fmtCompactJE`)
- Type-breakdown section: groups all filtered entries by `voucher_type`, renders up to 6 types as compact horizontal bars (proportional to count), with count label on right
- Only the type grid is hidden when there is just one type (single-type filtered view)

**FinancialAnalytics DSO / DPO / CCC Turnover Card** (`src/screens/analytics/FinancialAnalyticsScreen.tsx`)
- `computeTurnoverMetrics()`: derives Days Sales Outstanding (DSO) and Days Payable Outstanding (DPO) from 6-month average monthly billed amounts vs current outstanding; CCC = DSO − DPO
- `TurnoverCard`: three-tile card (DSO / DPO / CCC in days) placed directly below the Net Position card
- CCC positive → hint "Collecting slower than paying"; negative → "Collecting faster than paying — healthy position"
- Returns `null` when no 6-month billing data available; no extra API calls

**ProcurementAnalytics Order Value Distribution Histogram** (`src/screens/analytics/ProcurementAnalyticsScreen.tsx`)
- `VALUE_BUCKETS`: five size bands — <10K / 10-50K / 50-100K / 100-500K / 500K+
- `computeValueDistribution()`: counts POs and SOs in each bucket from existing raw data — zero extra API calls
- `ValueDistributionChart`: vertical grouped bar chart (dark = PO, muted gray = SO); bucket total label below each column
- Hidden when all bucket counts are zero; inserted after SO Status breakdown section

### Next Session
- Consider: FinancialAnalytics — historical aging trend (multi-day snapshots stored in AsyncStorage, visualise bucket shifts over time)
- Consider: ProcurementAnalytics — average order value per vendor/customer (value ÷ count column in ranked lists)
- Consider: Dashboard — "This Week" payment summary: AP bills due this week vs AR expected this week
- Consider: JournalEntries — debit/credit flow mini-chart (by month) similar to AP/AR monthly trend
- Consider: StockHealth — stock velocity card: items with highest IN/OUT ledger movement in the period

---

## Session 44 — 2026-06-07

### Completed This Session

**Dashboard AP/AR Aging Mini-Chart** (`src/screens/dashboard/DashboardScreen.tsx`)
- `computeClientAging()`: builds AP and AR aging buckets from all unpaid bills/invoices already loaded in `useFocusEffect` — zero extra API calls
- `AgingMiniBar`: compact stacked bar + per-bucket count/amount legend; placed between Finance Status and Top Vendors cards
- Renders only when both AP and AR data have been cached (screen visited before)

**Flagged PDF Date Range** (`src/utils/pdfExport.ts` + AP/AR screens)
- `exportFlaggedBillsPDF` and `exportFlaggedInvoicesPDF` accept optional `fromISO`/`toISO` params
- Date range appears in PDF header meta line when supplied
- `AccountsPayableScreen` passes its active `billDateRange`; `AccountsReceivableScreen` passes `invDateRange`

**FinancialAnalytics Aging Delta Row** (`src/screens/analytics/FinancialAnalyticsScreen.tsx` + `src/utils/agingSnapshot.ts`)
- `agingSnapshot.ts`: `saveAgingSnapshot()` saves daily AP+AR aging fields to AsyncStorage; skips overwrite if same calendar day; `loadAgingSnapshot()` retrieves previous snapshot for comparison
- `AgingDeltaRow`: per-bucket +/− delta vs last snapshot with compact K/M formatting, shown below each aging breakdown card
- Delta row shows "No change since last snapshot" when all buckets are identical

### Next Session
- The items above were the "next session" items from Session 43

---

## Session 43 — 2026-06-05

### Completed This Session

**Dashboard "Top Customers by AR" Card** (`src/screens/dashboard/DashboardScreen.tsx`)
- `topCustomers` state (Array of `{name, outstanding, invoiceCount}`) computed alongside `topVendors` in `useFocusEffect` from the AR invoice cache — zero extra API calls
- Aggregates outstanding by customer name, excludes PAID/RECEIVED/CLOSED/CANCELLED, top 3 by outstanding
- Card placed after Top Vendors section with rank badge, customer name, muted-gray progress bar (visually distinct from vendor's blue), outstanding amount + invoice count
- Tap any row or "View AR" header link → navigates to AccountsReceivable screen
- Only renders when `topCustomers.length > 0`

**Procurement Analytics Monthly Trend Count/Value Toggle** (`src/screens/analytics/ProcurementAnalyticsScreen.tsx`)
- `ChartMode` type: `'count' | 'value'`; `chartMode` state (default `'count'`)
- `MonthlyTrendChart` accepts `mode` prop; selects `poCount/soCount` or `poValue/soValue` for bar heights and totals
- `fmtBottom()` helper formats column total as raw integer count or K/M-shortened value string
- Count/Value chip toggle rendered in Monthly Trend `SectionHeader` action slot; active chip has filled dark background + white text

**FinancialAnalytics 6-Month AP vs AR Monthly Trend Chart** (`src/screens/analytics/FinancialAnalyticsScreen.tsx`)
- `MonthlyNetChart` component: grouped vertical bar chart for last 6 months showing AP billed (muted) vs AR billed (dark)
- `buildMonthlyBuckets()`: groups `APBill.amount` and `ARInvoice.amount` by `dt` year-month prefix into 6 buckets
- Net label per month column (AR − AP formatted as compact K/M); positive in textSecondary, negative in text
- Returns `null` when all buckets are zero — no empty-state noise
- Placed below `NetPositionCard` with "6-Month Trend · AP vs AR · billed per month" section header
- Reads from `ap:/ar:` AsyncStorage cache first — zero extra API calls when AP/AR screens have been visited

### Next Session
- Consider: FinancialAnalyticsScreen net position trend by month (monthly AR vs AP chart) ✅ Done this session
- Consider: Dashboard "Top Customers by AR" companion card ✅ Done this session
- Consider: Procurement Analytics value chart toggle ✅ Done this session
- Consider: Journal Entry creation form (POST API needed from backend)
- Consider: AP/AR combined export with date range filter applied (pass dateRange from AP/AR screens)
- Consider: Dashboard "Overdue AP/AR" mini-chart — stacked bar showing current vs 30/60/90+ day buckets
- Consider: FinancialAnalytics aging buckets trend (month-over-month aging bucket shift chart)

---

## Session 42 — 2026-06-04

### Completed This Session

**Procurement Analytics Date Range Filter** (`src/screens/analytics/ProcurementAnalyticsScreen.tsx`, `src/components/DateRangeBar.tsx`)
- Raw PO/SO data stored in `rawData` state; `analytics` derived via `useMemo` — date filtering applied before `computeAnalytics()`
- Calendar icon button in header: tap to show/hide DateRangeBar; active range shown as `MM-DD–MM-DD` inline badge; tap again to close and clear
- `getMonthsInRange()` helper: generates month buckets for any custom range (capped at 12 months); `computeAnalytics` accepts optional `fromISO`/`toISO` and selects last-6-months or custom range accordingly
- All KPIs (PO Value, SO Value, Open POs/SOs), ranked vendor/customer lists, and status grids all reflect the active date filter
- Monthly Trend subtitle updates to show `from–to` range when active; PDF export uses filtered analytics data
- SectionHeader gains `subtitle?: string` prop (renders as second line below title) — fixes silent `subtitle` usage in ProcurementAnalyticsScreen and StockHealthScreen

**Dashboard "Top Vendors by Outstanding AP Balance" card** (`src/screens/dashboard/DashboardScreen.tsx`)
- `topVendors` state (Array of `{name, outstanding, billCount}`) computed in `useFocusEffect` from all unpaid AP bills (already fetched/cached for due-soon section — zero extra API calls)
- Aggregates `outstanding` by vendor name, excludes PAID/CLOSED/CANCELLED, top 3 by outstanding balance
- Card (placed after Finance Status, before Upcoming Payments) with rank badge, vendor name, blue progress bar, outstanding amount + bill count
- Tap any row or "View AP" header link → navigates to AccountsPayable screen
- Only renders when `topVendors.length > 0`

**Out-of-Stock Standalone PDF Reorder Export** (`src/screens/analytics/StockHealthScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportOutOfStockPDF()` added to `pdfExport.ts`: 3-tile summary (out-of-stock count / in-stock count / total items), full table (Item Name / Warehouse / Unit / Status in red), footer with count; shares via native Share sheet
- `exportingOOS` state + `handleExportOOS` callback in `StockHealthScreen`
- File-text icon (ActivityIndicator while exporting) in the "Out of Stock" `SectionHeader` action slot — only visible when `outOfStockItems > 0`

**AP/AR Combined Flagged Items PDF Export** (`src/screens/dashboard/DashboardScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportFlaggedCombinedPDF()` added to `pdfExport.ts`: 4-tile summary (flagged bills count / flagged invoices count / AP outstanding / AR outstanding), AP bills section + AR invoices section each with full table and overdue rows in bold, footer totals; optional `fromISO`/`toISO` date range label in header
- `exportingCombined` state + `handleExportCombined` callback in Dashboard — resolves flagged IDs from AsyncStorage and actual bill/invoice objects from AP/AR cache (no extra API calls when cached)
- File-text icon button in Pending Actions `SectionHeader` action slot; only shown when `flaggedBillCount > 0 AND flaggedInvoiceCount > 0`

### Next Session
- Consider: FinancialAnalyticsScreen net position trend (monthly AR vs AP chart)
- Consider: Procurement Analytics value chart (toggle between order count and order value in monthly trend)
- Consider: Journal Entry creation form (POST API needed from backend)
- Consider: AP/AR combined export with date range filter applied (pass dateRange from AP/AR screens)
- Consider: Dashboard "Top Customers by AR" companion card (symmetric to Top Vendors)

---

## Session 41 — 2026-06-03

### Completed This Session

**Date Range Filter on AP Bills / AR Invoices Tab** (`src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`, `src/components/DateRangeBar.tsx`)
- Both screens import `DateRangeBar, DateRangeValue` from `@/components/DateRangeBar`
- `billDateRange`/`invDateRange` state + `showDateFilter` toggle added to each screen
- `dateFilteredBills`/`dateFilteredInvoices` pre-filter step: filters by `dt` (document date) against the selected range; all downstream filters (search, overdue/due-soon/flagged/reviewed chips) operate on the date-scoped set
- `overdueCount` / `dueSoonCount` chip badges now reflect the date-filtered set for accurate in-context counts
- Calendar icon chip added to filter row: tap to expand DateRangeBar below chips, shows `MM-DD–MM-DD` range when active; tap again to clear and collapse
- SectionHeader meta includes `· MM-DD–MM-DD` when date range active
- All exports (CSV, flagged PDF) use `filteredBills`/`filteredInvoices` and automatically respect the date range

**Compact Company Switcher in Dashboard Top Bar** (`src/components/CompanySelector.tsx`, `src/screens/dashboard/DashboardScreen.tsx`)
- `CompanySelector` gains `variant?: 'row' | 'compact'` prop (default `'row'`)
- `'compact'` variant: small inline pill (briefcase icon + company name/code + chevron-down) with hairline border, aligned self-start — embeds cleanly in any header area
- `DashboardScreen`: removed the full-width CompanySelector row below the header; added `<CompanySelector showAll variant="compact" />` inside `topBarLeft`, below the sub-greeting text — saves one row of vertical height
- Same picker modal works for both variants; company change propagates globally via `CompanyContext`

**Partner Notes Search and Filter** (`src/screens/partners/PartnersScreen.tsx`)
- `showNotesOnly` state and a "Notes (N)" filter chip added: only visible when `notesPartnersCount > 0`; filters list to note-holders only
- `filtered` logic extended: when `search` query is non-empty, also matches against `partnerNotesMap[p.id]` (note content) — type any keyword to find partners whose notes contain it
- `notesPartnersCount` derived from `partnerNotesMap` for chip label badge
- Search placeholder updated to "Search by name, code, email, notes…"
- `SectionHeader` meta appends "· has notes" when notes filter is active
- Empty state message covers the new `showNotesOnly` case

**Partner Notes Bulk CSV Export** (`src/utils/csvExport.ts`, `src/screens/partners/PartnersScreen.tsx`)
- `exportPartnerNotesCSV()` added to `csvExport.ts`: Company / export date header rows, then Name / Code / Role / Note columns for every partner with a note; uses native Share sheet
- `handleExportNotes()` in PartnersScreen: builds note entries for all partners with notes (role derived from partner flags), calls `exportPartnerNotesCSV`
- "Notes" pill button (download icon + "Notes" label) in screen header; visible when `notesPartnersCount > 0`; shows ActivityIndicator during export

**Stock Ledger IN/OUT/NET Summary Bar** (`src/screens/inventory/InventoryScreen.tsx`)
- `ledgerSummary` computed from `filteredLedger`: `totalIn` (sum of `qty_in`), `totalOut` (sum of `qty_out`), and net = `totalIn - totalOut`
- 3-tile summary bar (IN | OUT | NET) appears above the Movement Log SectionHeader when `filteredLedger.length > 0`
- NET tile renders in muted color when negative; bar respects active search and date range filters
- `ledgerSummaryBar`, `ledgerSummaryTile`, `ledgerSummaryDivider`, `ledgerSummaryLabel`, `ledgerSummaryValue`, `ledgerSummaryNeg` styles added

### Next Session
- Consider: AP/AR combined PDF export (flagged + date range in one export, with cover stats)
- Consider: Dashboard "Top Vendors by spend" mini table (top 3 vendors from AP data)
- Consider: Journal Entry creation form (POST API needed from backend)
- Consider: Procurement Analytics date range filter
- Consider: StockHealth standalone out-of-stock PDF (separate from combined health PDF)

---

## Session 40 — 2026-06-03

### Completed This Session

**StockHealth Out-of-Stock PDF Export** (`src/utils/pdfExport.ts`, `src/screens/analytics/StockHealthScreen.tsx`)
- `StockHealthPDFData` gains optional `outOfStock?: Array<{...}>` field
- `exportStockHealthPDF`: new out-of-stock table rendered before the low-stock section — red `color:#c00` section label, qty shown as `0` in red, only rendered when `outOfStockRows` non-empty
- `StockHealthScreen.tsx`: passes `data.outOfStock` to export call

**AP/AR Flagged Bills/Invoices PDF Export** (`src/utils/pdfExport.ts`, `src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`)
- New `exportFlaggedBillsPDF()`: 3-tile summary (count / total outstanding / overdue), full bills table (Bill# / Vendor / Date / Due Date / Status / Amount / Outstanding), overdue rows in `font-weight:600`, totals footer
- New `exportFlaggedInvoicesPDF()`: identical structure for AR invoices
- `AccountsPayableScreen` bills tab: PDF button appears alongside CSV when `showFlaggedOnly && flaggedBillIds.size > 0`
- `AccountsReceivableScreen` invoices tab: same pattern for flagged invoices

**AP/AR Batch Unflag-All + Clear-Reviews** (`src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`)
- "Unflag All" button: visible when flagged-only filter is active; calls `clearAllFlagged('bill'/'invoice')`, resets `flaggedIds` state + turns off filter
- "Clear Reviews" button: visible when reviewed-only filter is active; calls `clearAllReviewed('bill'/'invoice')`, resets `reviewedIds` state + filter
- Both AP/AR import `clearAllFlagged` and `clearAllReviewed` from respective utils
- `clearBtn` style (lighter border) visually distinguishes from export buttons

**Mark as Reviewed in VendorDetail/CustomerDetail** (`src/screens/finance/VendorDetailScreen.tsx`, `src/screens/finance/CustomerDetailScreen.tsx`)
- `VendorDetailScreen`: `reviewedBillIds` state (Set<number>) loaded via `getReviewedIds('bill')` on mount
  - `BillCard` gains `reviewed` + `onToggleReview` props; check-circle icon (filled = reviewed, `borderLight` = not)
  - `cardReviewed` style: `opacity: 0.6` on reviewed cards
  - Toggle writes to AsyncStorage + refreshes full Set for consistency
- `CustomerDetailScreen`: identical pattern for `InvoiceCard` with `getReviewedIds('invoice')`
- Review state is shared with AP/AR screens (same AsyncStorage key) — reviewing in detail auto-reflects in list and vice versa

**Partner Notes Modal in PartnersScreen** (`src/screens/partners/PartnersScreen.tsx`)
- Imports `getNote, saveNote` from `partnerNotes.ts`
- `partnerNotesMap` state: `Record<number, string>` — loaded in batch via `Promise.all` after partners load (one `AsyncStorage.getItem` per partner)
- Edit-3 icon on every partner card; filled icon + small dot indicator when note exists
- `openNoteModal(p)`: determines note type (`vendor`/`customer`) from partner role, loads existing note, opens modal
- `savePartnerNote()`: writes via `saveNote`, updates `partnerNotesMap` in-place (no reload needed), closes modal
- Modal: slide-up sheet with `KeyboardAvoidingView`, multiline `TextInput`, Cancel + Save buttons with loading state
- Note type uses same key as VendorDetailScreen/CustomerDetailScreen — notes are seamlessly shared between screens

### Next Session
- Consider: StockHealth PDF export for the out-of-stock tab (separate standalone PDF for zero-stock items only)
- Consider: AP/AR export flagged-only PDF with date range filter (combining date + flagged filter for export)
- Consider: Global company filter in Dashboard header affecting all screens simultaneously
- Consider: Partner notes search / bulk notes export
- Consider: Journal Entry creation form (POST API needed)

---

## Session 39 — 2026-06-02

### Completed This Session

**Out-of-Stock Items List in Stock Health** (`src/screens/analytics/StockHealthScreen.tsx`)
- `computeStockHealth` now returns `outOfStock: StockBalance[]` — all items with qty ≤ 0, sorted alphabetically A–Z, no 8-item cap (unlike low-stock)
- `StockHealthData` type extended with `outOfStock` field
- New "Out of Stock" section displayed above the low-stock list (zero-stock is more critical), only shown when `outOfStockItems > 0`
- `RankedItemList` new `showOutOfStock` prop: x-circle icon badge, no proportional bar track, qty shown as `'0'` in muted colour
- All out-of-stock items are tappable — opens the same `ItemDetailModal` drill-down as low-stock items (warehouse breakdown + recent ledger)

**Mark as Reviewed for Bills & Invoices** (`src/utils/reviewedItems.ts`, `src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`)
- New `src/utils/reviewedItems.ts`: AsyncStorage-backed utility mirroring `flaggedItems.ts`
  - `getReviewedIds(type)` → `Set<number>`, `toggleReviewed(type, id)` → new state, `clearAllReviewed(type)`
  - Separate keys: `reviewed_bills` / `reviewed_invoices`
- `AccountsPayableScreen` bills tab:
  - `reviewedBillIds` state loaded on mount
  - `check-circle` filter chip (shows count badge when any bills reviewed) toggling `showReviewedOnly`
  - `BillCard`: check-circle icon (filled = reviewed, borderLight = not); opacity 0.6 on reviewed cards
  - `showReviewedOnly` filter composable with flagged/overdue/due-soon
- `AccountsReceivableScreen` invoices tab: identical pattern via `InvoiceCard` + `reviewedInvoiceIds`

**Vendor & Customer Local Notes** (`src/utils/partnerNotes.ts`, `src/screens/finance/VendorDetailScreen.tsx`, `src/screens/finance/CustomerDetailScreen.tsx`)
- New `src/utils/partnerNotes.ts`:
  - `getNote(type, id)` → stored string or `''`; `saveNote(type, id, text)` → stores or removes (empty text → `removeItem`)
  - Keyed by `partner_note:<type>:<id>` for clean per-entity namespacing
- `VendorDetailScreen`: new "Notes" tab (4th tab after Bills / Payments / Ledger)
  - Multi-line `TextInput` backed by AsyncStorage; Save button with `noteSaving` loading state
  - Tab label shows `' ·'` dot when a note is non-empty — visible from the tab bar
  - Hint text shown when note is empty (payment terms, contact preferences, follow-up reminders)
- `CustomerDetailScreen`: identical Notes tab with customer-specific copy text
- Notes persist across restarts; stored on device only, no API involvement

### Next Session
- Consider: Inventory screen date-range filter on stock ledger tab (currently only filters by keyword/item)
- Consider: AP/AR batch actions on flagged items (unflag all, export flagged-only as PDF)
- Consider: "Mark as reviewed" also on VendorDetailScreen bills + CustomerDetailScreen invoices (propagate state from AP/AR)
- Consider: StockHealthScreen out-of-stock PDF export (add outOfStock array to StockHealthPDFData)
- Consider: Partner notes field also accessible from PartnersScreen (not just Vendor/Customer detail)

---

## Session 38 — 2026-06-02

### Completed This Session

**AP/AR Bills & Invoices CSV Export** (`src/components/SectionHeader.tsx`, `src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`, `src/utils/csvExport.ts`)
- `SectionHeader`: added optional `action?: ReactNode` prop — renders to the right of the meta label
- `AccountsPayableScreen` bills tab: CSV button (download icon + "CSV" label) in `SectionHeader` action slot — calls `exportAPBillsCSV()` with currently-filtered bills
- `AccountsReceivableScreen` invoices tab: identical CSV button — calls `exportARInvoicesCSV()` with currently-filtered invoices
- Both export functions were written in Session 37 (`csvExport.ts`); this session wires them into the UI
- Exported CSV respects active filter chips (overdue / due-soon / flagged-only) — exports what the user sees

**Dashboard "Pending Actions" Card** (`src/screens/dashboard/DashboardScreen.tsx`, `src/utils/flaggedItems.ts`)
- Replaced the old plain inbox banner with a structured Pending Actions card
- Loads `flaggedBillCount` and `flaggedInvoiceCount` via `getFlaggedIds()` on screen focus (alongside existing unread inbox count)
- Card renders only when total > 0; shows up to three tappable rows:
  - Flagged Bills (amber star icon → AccountsPayable screen)
  - Flagged Invoices (blue star icon → AccountsReceivable screen)
  - Unread Notifications (inbox icon + red dot → Inbox screen)
- Each row: colored icon badge, label, sublabel, count badge (rounded pill), chevron
- Dividers only between visible rows; card disappears when all counts are zero

**Stock Health Item Drill-Down Modal** (`src/screens/analytics/StockHealthScreen.tsx`)
- `RankedItemList` rows are now tappable — accepts `onPress: (item: StockBalance) => void` prop + shows chevron
- New `ItemDetailModal` (React Native `Modal`, slide-up bottom sheet) opens when any item is tapped
- Modal sections:
  - **Summary tiles**: total stock qty across all warehouses, warehouse count, unit
  - **Stock by Warehouse**: aggregates `allStock` client-side by item name/id → proportional bar + percentage
  - **Recent Activity**: fetches last 15 entries from `/api/mobile/inventory?view=ledger&item_id=...` on mount
  - Ledger rows: in/out dot (dark=in, gray=out), voucher type + number, date, signed qty change, running balance
- `allStock` saved in state during initial load (zero extra API calls for the warehouse breakdown)
- Both low-stock and top-by-qty lists are now tappable drill-downs

### Next Session
- Consider: out-of-stock items list on StockHealthScreen (currently only shows low-stock + top-by-qty)
- Consider: Inventory screen date-range filter on stock ledger tab
- Consider: Vendor/Customer notes field (local note-taking via AsyncStorage, no API needed)
- Consider: "Mark as reviewed" state for bills/invoices (complements the existing flag/star system)
- Consider: AP/AR list — batch actions on flagged items (unflag all, export flagged only as PDF)

---

## Session 37 — 2026-06-01

### Completed This Session

**CSV Share Export** (`src/utils/csvExport.ts`, `src/screens/trialBalance/TrialBalanceScreen.tsx`, `src/screens/journalEntries/JournalEntriesScreen.tsx`)
- New `src/utils/csvExport.ts` utility: RFC 4180-compliant CSV generation with proper escaping (commas, quotes, newlines in values)
- `exportTrialBalanceCSV()`: account code, name, level, debit, credit rows + totals + company/as-of header rows
- `exportJournalEntriesCSV()`: one row per JE line — voucher type/no/date/account/debit/credit/narration/status
- `exportAPBillsCSV()` and `exportARInvoicesCSV()` prepared for future AP/AR screens
- Both functions use `Share.share()` — native share sheet, no extra packages needed
- TrialBalanceScreen: replaced "Share" text button with "CSV" grid-icon button
- JournalEntriesScreen: replaced "Share" text button with "CSV" grid-icon button
- Unused `Share` import removed from both screens

**PO Delivery Approaching Notifications** (`src/utils/settings.ts`, `src/utils/notifications.ts`, `src/screens/purchaseOrders/PurchaseOrdersScreen.tsx`, `src/screens/settings/SettingsScreen.tsx`, `src/navigation/AppNavigator.tsx`)
- `settings.ts`: `NOTIFY_PO_DELIVERY` (bool, default true) + `PO_DELIVERY_DAYS` (int, default 3) keys + getter/setter functions
- `notifications.ts`: `schedulePoDeliveryReminder(orders[])` — scans open POs for overdue or approaching delivery dates within N days; schedules daily notification 1 hour after overdue reminder; `IDENTIFIER_PO_DELIVERY` constant
- `cancelPoDeliveryReminder()` exported
- `PurchaseOrdersScreen`: calls `schedulePoDeliveryReminder(data)` after each fresh API fetch (best-effort, non-blocking)
- `SettingsScreen`: "PO delivery approaching" toggle in Notifications section + new "ALERTS — PO DELIVERY WINDOW" chip selector (1/2/3/5/7 days)
- `AppNavigator`: tapping PO delivery notification navigates to PurchaseOrders screen

**Bill/Invoice Flag System** (`src/utils/flaggedItems.ts`, `src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`)
- New `src/utils/flaggedItems.ts`: AsyncStorage-backed star/flag toggle per `type: 'bill' | 'invoice'`
  - `toggleFlagged()` returns new state; `getFlaggedIds()` returns Set<number>; `clearAllFlagged()` for cleanup
- `AccountsPayableScreen` bills tab:
  - `flaggedBillIds` state (Set<number>) loaded from AsyncStorage on mount
  - Star chip added to filter row — shows count badge (⭐ N) and toggles `showFlaggedOnly`
  - `BillCard` gets `flagged` + `onToggleFlag` props: filled star when flagged, borderLight outline when not
  - `onToggleFlag` writes to AsyncStorage then reloads the full flag set for consistency
- `AccountsReceivableScreen` invoices tab: identical pattern via `InvoiceCard` + `flaggedInvoiceIds`
- Flags persist across restarts; star filter can be combined with overdue/due-soon filters

### Next Session
- Consider: AP/AR CSV export buttons (bills and invoices tabs — `exportAPBillsCSV` / `exportARInvoicesCSV` already in csvExport.ts)
- Consider: Vendor/Customer notes field (requires API support or local note-taking system)
- Consider: Journal Entry creation form (requires POST API support)
- Consider: Dashboard "Pending Actions" card — unread inbox + flagged bills/invoices count in one card
- Consider: Stock Health screen improvements — item detail drill-down from low-stock list

---

## Session 36 — 2026-06-01

### Completed This Session

**6-Month Outstanding Balance Trend Chart** (`src/components/MonthlyBalanceChart.tsx`, `src/screens/finance/VendorDetailScreen.tsx`, `src/screens/finance/CustomerDetailScreen.tsx`)
- New `MonthlyBalanceChart` shared component: takes `{date, balance}[]` ledger entries and renders a 6-column vertical bar chart
- `computeMonthlyBalances()`: for each of the last 6 months, finds the last ledger entry on or before month-end to get closing balance
- Bar heights proportional to max balance; current month column uses bold/dark bar + `textSecondary` value label
- `fmtShort()` formats values as "45K", "1.2M", etc. to keep labels compact
- Mounted in `VendorDetailScreen` between the aging breakdown and contact card — shows "6-MONTH OUTSTANDING TREND" section label
- Mounted in `CustomerDetailScreen` in the same position — identical layout for AR side
- Both screens import `MonthlyBalanceChart` from `@/components/MonthlyBalanceChart`
- Section only rendered when `ledgerEntries.length > 0` (no empty placeholder)
- Styles: `trendCard`, `trendTitle` (same pattern as `agingCard`/`agingTitle`)

**Partner List Tappable Call/Email** (`src/screens/partners/PartnersScreen.tsx`)
- Added `Linking` to React Native imports
- `PartnerCard` email row: wrapped in `TouchableOpacity` → `Linking.openURL('mailto:${p.email}')` on tap
- `PartnerCard` phone row: wrapped in `TouchableOpacity` → `Linking.openURL('tel:${p.phone}')` on tap
- `contactTextTappable` style: underlined text to signal tappability; distinguishes from non-tappable address text
- Outer card `onPress` still navigates to PartnerDetail; inner contact taps are independently consumed

**Vendor/Customer Recently Viewed Tracking** (`src/screens/finance/VendorDetailScreen.tsx`, `src/screens/finance/CustomerDetailScreen.tsx`, `src/screens/dashboard/DashboardScreen.tsx`)
- Both VendorDetailScreen and CustomerDetailScreen now call `addRecentlyViewed()` in a `useEffect([loading])` after data loads
- Vendor entry: `type: 'vendor'`, title = vendorName, subtitle = "Vendor · AP", navParams includes outstanding + overdue
- Customer entry: `type: 'customer'`, title = customerName, subtitle = "Customer · AR", same navParams
- Dashboard `onPress` handler in `RecentlyViewedSection` now has `case 'vendor'` and `case 'customer'` branches
- Vendor tap: `navigate('Finance', { screen: 'VendorDetail', params: { vendorId, vendorName, outstanding, overdue } })`
- Customer tap: `navigate('Finance', { screen: 'CustomerDetail', params: { customerId, customerName, outstanding, overdue } })`
- `RecentlyViewedSection` already had icons for both types (briefcase/user) — no component changes needed

**Weekly Payment/Collection Schedule** (`src/components/WeeklyScheduleCard.tsx`, `src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`)
- New `WeeklyScheduleCard` component: displays a list of weekly buckets with proportional horizontal bars
- Each row: bucket label (e.g., "This Week") + date range sublabel + bar track with fill proportional to max amount + amount value + item count
- Overdue bucket gets bold label + dark bar fill (`Colors.text`); regular buckets use `Colors.textSecondary`
- `WeekBucket` type exported: `{ label, sublabel, amount, count, isOverdue? }`
- **AP Summary tab**: `apWeeklyBuckets` computed from all bills (Overdue / This Week / Week 2 / Week 3 / Week 4 / Later) — shown as "Payment Schedule · By week · upcoming" section
- **AR Summary tab**: `arWeeklyBuckets` computed from all invoices (same structure) — shown as "Collection Schedule · By week · upcoming" section
- `getWeekRange()` / `fmtDateRange()` helpers compute date ranges for sublabels (e.g., "Jun 1–7")
- Schedule card hidden when all buckets are zero (null return from `WeeklyScheduleCard`)

### Next Session
- Consider: Vendor/Customer notes field (show notes/description from partner data if available)
- Consider: AP/AR bills — mark as reviewed / add a flag/star system for follow-up tracking
- Consider: Journal Entry creation form (requires POST API support)
- Consider: PO delivery status push notification (when delivery date is approaching)
- Consider: Financial Reports — export to Excel/CSV format in addition to PDF

---

## Session 35 — 2026-05-31

### Completed This Session

**Vendor/Customer Contact Info** (`src/screens/finance/VendorDetailScreen.tsx`, `src/screens/finance/CustomerDetailScreen.tsx`)
- Both screens now fetch partner data from `/api/mobile/partners` in a `useEffect` after main data loads (best-effort, non-blocking)
- Match logic: partner is found by `id === vendorId/customerId` OR `name` case-insensitive match
- Contact card rendered between aging chart and tab bar: phone (Feather phone → `tel:` link), email (Feather mail → `mailto:` link), address (Feather map-pin, static text)
- Uses `Linking.openURL()` from React Native — phone opens native dialer, email opens mail client
- Card only shown when at least one contact field (phone/email/address) is available
- Styles: `contactCard` (flexRow/wrap, hairline bottom border), `contactItem`, `contactText` (underline for tappable items)

**AP/AR Pay-by / Collect-by Mini Summary Bar** (`src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`)
- **AccountsPayableScreen** gains a `payByStats` computation bucketing outstanding bills: **Overdue** | **This Week** (0–7d) | **Later** (8d+)
- **AccountsReceivableScreen** gains identical `collectByStats` for outstanding invoices
- Mini bar rendered above the Bills/Invoices `SectionHeader`, only when `filter === 'all'` and at least one bucket has value
- Overdue tile: `surfaceHover` background for visual emphasis; Later tile: muted opacity
- Each tile shows uppercase label + formatted outstanding amount — instant cash-flow snapshot without navigating to CashFlow screen

**Dashboard "Finance Health" Card** (`src/screens/dashboard/DashboardScreen.tsx`)
- New card section between Working Capital and Supply Chain
- Stacked horizontal bar: dark segment = AR (Receivables), muted = AP (Payables), proportional width
- Legend row: left = RECEIVABLES label + amount; center = Net position (+/−) and AR/AP ratio (X.XXx); right = PAYABLES label + amount
- Only rendered when `kpis.totalAR > 0 || kpis.totalAP > 0`
- Styles: `fhCard`, `fhBarTrack`, `fhBarAR`, `fhBarAP`, `fhLegend`, `fhLegendItem`, `fhDot`, `fhNetLabel`, `fhRatio`

**Upcoming Payments PDF Export** (`src/utils/pdfExport.ts`, `src/screens/dashboard/DashboardScreen.tsx`)
- `exportUpcomingPaymentsPDF({ bills, invoices, dueSoonDays, companyName })` added to `pdfExport.ts`
- 3-tile summary: To Pay (AP bills total) | To Collect (AR invoices total) | Net Cash Impact (AR−AP)
- Bills table: Bill# / Vendor / Due Date / Days Left / Outstanding — sorted soonest-first; overdue entries bold
- Invoices table: Invoice# / Customer / Due Date / Days Left / Outstanding — same sort
- Dashboard "Upcoming Payments" section header replaced with inline row including `file-text` PDF button
- `exportingPayments` state drives ActivityIndicator while generating; button disabled during export

### Next Session
- Consider: Vendor/Customer balance history chart (last 6 months outstanding trend) in VendorDetail/CustomerDetail
- Consider: AP/AR screen — "Pay by week" calendar view showing amounts due per day/week
- Consider: Journal Entry creation form (requires POST API support from backend)
- Consider: Global company selector in Dashboard top bar affecting all screens at once
- Consider: Partner list improvements — direct call/email from partner list row (not just detail screen)

---

## Session 34 — 2026-05-31

### Completed This Session

**Dashboard "Upcoming Payments" Section** (`src/components/DueSoonPaymentsSection.tsx`, `src/screens/dashboard/DashboardScreen.tsx`)
- New `DueSoonPaymentsSection` component: shows upcoming AP bills + AR invoices due within the configured "due soon" window directly on the Dashboard
- Reads from AP/AR cache (`ap:<companyId>` / `ar:<companyId>`) in a `useFocusEffect` — zero extra API calls when cache is warm
- If cache is cold, fetches AP/AR data in the background; updates on every Dashboard focus
- Combined bill+invoice list sorted by days-until-due (soonest first), max 5 shown
- Card header: `X payments due in Nd` + total outstanding amount
- Per-row: bullet dot (black=bill, gray=invoice), ref number, party · due date, formatted amount, "Xd left" or "due today" dashed chip
- Footer: "View all N upcoming payments" or "View cash flow" → navigates to Finance > CashFlow
- Section hidden when both arrays are empty (no visual noise)
- `SectionHeader` label: "Upcoming Payments · due in Nd"

**Global Search: AP Bills + AR Invoices** (`src/screens/search/SearchScreen.tsx`)
- Added `'bill'` and `'invoice'` as new `ResultType` values
- Bill results: searches `bill_number`, `vendor`, `id`; shows vendor name + outstanding amount + status badge
- Invoice results: searches `invoice_number`, `customer`, `id`; shows customer name + outstanding + status badge
- Data sourced from AP/AR cache (`ap:all` / `ar:all`) — reuses data cached by AP/AR screens; falls back to fresh API fetch when cache is absent/stale
- Navigation: bill tap → Finance > VendorDetail (with vendorId, vendorName, outstanding) when vendor_id available; else → AP screen. Invoice tap → Finance > CustomerDetail; else → AR screen.
- Search placeholder updated: "Search POs, SOs, bills, invoices, materials…"
- Help text updated to mention all 7 searchable types

**AP/AR Invoice Filter Chips** (`src/screens/finance/AccountsPayableScreen.tsx`, `src/screens/finance/AccountsReceivableScreen.tsx`)
- Both screens gain a filter chip row below their respective search bars on the Bills/Invoices tab
- Three filter modes: **All** (default) | **Overdue** (red-badge count) | **Due Soon** (upcoming within configured window)
- Filter counts shown inline in chip label: `Overdue (3)`, `Due Soon (5)`
- Active chip: filled dark background with white text; inactive: outline
- `daysDueIn()` helper added to both screens for the due-soon computation
- `dueSoonDays` read from `getDueSoonDays()` settings on mount (respects user preference)
- Section header meta updated to show filter state: "23 records · due in 7d"
- Empty state message adapts: "No overdue bills found" / "No due soon invoices found"

**FinanceMenu Due-Soon Outline Badge** (`src/screens/financeMenu/FinanceMenuScreen.tsx`)
- AP and AR rows in Finance menu now show a secondary outline badge (hairline border) with the `apDueSoon` / `arDueSoon` count
- Badge only appears when overdue count = 0 (overdue badge takes priority)
- Uses `apDueSoon` + `arDueSoon` from `useOverdue()` context (populated by AlertsScreen on load)
- Style: outline pill, gray text — visually distinct from the solid overdue badge

### Next Session
- Consider: AP/AR screen — "Pay by" summary: total amount of bills/invoices due this week vs next week (mini cash-flow stats bar)
- Consider: Vendor/Customer contact info display — show phone/email from partner data as tappable links in VendorDetail/CustomerDetail
- Consider: Dashboard "Finance Health" mini-card — ratio of AR/AP, days outstanding average
- Consider: Journal Entry creation form (requires POST API)
- Consider: PDF export for the Dashboard Upcoming Payments section

---

## Session 33 — 2026-05-30

### Completed This Session

**Financial Analytics → AP/AR Drill-Through** (`src/screens/analytics/FinancialAnalyticsScreen.tsx`)
- AP section header and summary tiles are tappable → cross-tab navigation to Finance > AccountsPayable
- AR section header and summary tiles are tappable → cross-tab navigation to Finance > AccountsReceivable
- Top Vendors rank list rows: each row taps → Finance > VendorDetail (passes vendorId, vendorName, outstanding, overdue)
- Top Customers rank list rows: each row taps → Finance > CustomerDetail (same params)
- `PartnerRankList` updated: accepts optional `onPress` per item; renders `chevron-right` indicator when tappable
- Uses `navigation.getParent<TabNav>().navigate('Finance', { screen, params })` pattern

**Due Soon Alerts** (`src/screens/alerts/AlertsScreen.tsx`)
- New "Bills Due in N Days (AP)" section — bills due within configurable window (default 7d), not yet overdue
- New "Invoices Due in N Days (AR)" section — same pattern for AR invoices
- `daysDueIn()` helper: returns positive days-until-due for upcoming, −9999 for paid/closed/cancelled
- Items sorted soonest-first; dashed chip badge shows "Xd left" or "due today"
- UPCOMING divider row separates critical overdue alerts from informational upcoming section
- "All clear" state now triggers only when all 5 categories are empty (overdue bills, overdue invoices, low stock, due-soon bills, due-soon invoices)
- Header badge: black for overdue, secondary gray for due-soon (when no overdue items)

**OverdueContext Extended** (`src/context/OverdueContext.tsx`)
- Added `apDueSoon` + `arDueSoon` count states
- Added `setAPDueSoon` + `setARDueSoon` setters
- AlertsScreen publishes due-soon counts to context on every load

**Due Soon Push Notification** (`src/utils/notifications.ts`)
- `scheduleDueSoonReminder({ apDueSoon, arDueSoon })`: schedules a separate daily notification 30 minutes after the overdue reminder hour
- Content: "Upcoming payments" title + "X bills due soon · Y invoices due soon" body
- Respects `getNotifyDueSoon()` setting; cancels when total = 0
- `cancelDueSoonReminder()` counterpart function
- AppNavigator: schedules due-soon reminder when `[apDueSoon, arDueSoon]` changes; "due-soon" notification tap → Alerts screen

**Settings: Due Soon Configuration** (`src/utils/settings.ts`, `src/screens/settings/SettingsScreen.tsx`)
- `getDueSoonDays()` / `setDueSoonDays()`: configurable window (1/3/7/14/30 days, default 7)
- `getNotifyDueSoon()` / `setNotifyDueSoon()`: toggle for due-soon push notifications (default true)
- New "Upcoming payments (due soon)" Switch in NOTIFICATIONS card
- New "ALERTS — DUE SOON WINDOW" section with 5-chip picker

**FEATURES.docx + generate-docs.js** — Updated with Session 33 changelog, new roadmap rows, drill-through + due-soon entries in Section 3

### Next Session
- Consider: JE creation form (draft a new journal entry — requires POST API)
- Consider: Batch partner ledger export — export all vendor/customer ledgers as ZIP from AP/AR screen
- Consider: AP/AR "Due Soon" section on dashboard (quick glance at what's coming due this week)
- Consider: Push notification deep-link directly to VendorDetail/CustomerDetail for specific due bills

---

## Session 32 — 2026-05-30

### Completed This Session

**Financial Analytics Screen** (`src/screens/analytics/FinancialAnalyticsScreen.tsx`)
- New screen under More → Analytics section (4th item, dollar-sign icon)
- Net Position card: AR Outstanding − AP Outstanding = net receivable/payable with descriptive hint
- AP Overview: total outstanding + overdue summary tiles
- AP Aging breakdown: stacked bar chart (Current / 1-30d / 31-60d / 61-90d / 90+d) using APSummary.aging
- AR Overview: total outstanding + overdue summary tiles
- AR Aging breakdown: same stacked bar pattern using ARSummary.aging
- Top 5 Vendors by outstanding: ranked list with progress bars and bill count
- Top 5 Customers by outstanding: ranked list with progress bars and invoice count
- PDF export via `exportFinancialAnalyticsPDF()` — net position row, 4-block AP/AR summary, both aging tables with % mini-bars, both partner ranking tables
- Pull-to-refresh + 24h offline cache (key: `financial-analytics:<companyId>`)
- CompanySelector at top for per-company filtering
- MoreNavigator: `FinancialAnalytics` route registered
- MoreMenu ANALYTICS section: Financial Analytics entry added

**Per-vendor aging breakdown** (`src/screens/finance/VendorDetailScreen.tsx`)
- `AgingChart` rendered between summary tiles and the tab bar when vendor has outstanding > 0
- Aging buckets computed client-side from bills: Current (not past due), 1-30d, 31-60d, 61-90d, 90+d
- Uses same `daysOverdue()` helper already in the file
- Only visible when `totalOutstanding > 0`

**Per-customer aging breakdown** (`src/screens/finance/CustomerDetailScreen.tsx`)
- Identical pattern to vendor: `AgingChart` computed from AR invoices
- Aging buckets: Current, 1-30d, 31-60d, 61-90d, 90+d based on invoice `due_date`
- Only visible when `totalOutstanding > 0`

**Expandable narrations on JE list cards** (`src/screens/journalEntries/JournalEntriesScreen.tsx`)
- `JECard` component now tracks `narrationExpanded` local state
- Narrations longer than 80 chars show truncated to 1 line with a chevron-down + "more" toggle
- Tapping the narration area (not the card) expands to full text; tapping again collapses with chevron-up + "less"
- Full card tap still navigates to JE detail — expand/collapse is independent

**FEATURES.docx + generate-docs.js** — Updated with Session 32 changelog, new roadmap rows, FinancialAnalyticsScreen in Section 3

### Next Session
- Consider: JE creation form (draft a new journal entry — requires POST API)
- Consider: Batch partner ledger export — export all vendor/customer ledgers as ZIP from AP/AR screen
- Consider: Due date reminders / push notifications for AP bills nearing due date
- Consider: AP/AR drill-down from Financial Analytics screen → AccountsPayable / AccountsReceivable screens

---

## Session 30 — 2026-05-30

### Completed This Session

**Procurement Analytics Screen** (`src/screens/analytics/ProcurementAnalyticsScreen.tsx`)
- New screen under More → Analytics section
- KPI summary row: Total PO Value, Total SO Value, Open POs, Open SOs
- Monthly trend chart: grouped vertical bar chart (last 6 months), PO count vs SO count per month
- Top 5 Vendors ranked by total PO value with progress bars and order count
- Top 5 Customers ranked by total SO value with progress bars and order count
- PO Status Distribution: chips grid with count + % share + mini progress bar
- SO Status Distribution: same pattern for sales orders
- PDF export via `exportProcurementAnalyticsPDF()` in pdfExport.ts
- Pull-to-refresh with offline cache (key: `procurement-analytics:<companyId>`)
- CompanySelector at top for per-company filtering
- Dashboard "Analytics" quick action tile added

**Stock Health Screen** (`src/screens/analytics/StockHealthScreen.tsx`)
- New screen under More → Analytics section
- Stock status overview card: Healthy / Low Stock / Out of Stock counts + stacked horizontal bar
- Legend showing threshold boundary (configurable in Settings)
- Conditional "Low Stock Items" section (shows only when items exist below threshold), sorted ascending by qty
- Top 8 items by quantity with ranked bars
- Warehouse distribution list: per-warehouse item count + total qty with progress bars
- PDF export via `exportStockHealthPDF()` in pdfExport.ts
- Pull-to-refresh with offline cache (key: `stock-health:<companyId>`)

**Analytics section in MoreMenu**
- New "ANALYTICS" section added to MoreMenuScreen between Operations and Finance
- Contains: Procurement Analytics, Stock Health, Company Comparison (moved from Admin)
- Admin section now focuses on business data: Partners, Companies, Bookmarks, Settings

**FEATURES.docx + generate-docs.js** — Updated with Session 30 changelog

---

## Session 29 — 2026-05-29

### Completed This Session

**Delivery Calendar Screen** (`src/screens/deliveryCalendar/DeliveryCalendarScreen.tsx`)
- New screen: monthly calendar grid showing PO and SO delivery dates
- Colored dot indicators per day: overdue (red), due-today (amber), 1-3d urgent (blue), 4-14d (green)
- All/POs/SOs type filter toggle chips at top
- Month navigation arrows with prev/next month; "Today" button jumps back to current month
- Monthly summary badges: overdue count + pending count shown below month title
- Weekday header row (Sun–Sat)
- Tapping a calendar day shows the order list for that day below the grid
- Day detail cards: type pill (PO black / SO purple), order number, party name, urgency chip, tap → PO/SO detail
- "No deliveries scheduled" empty state for days with no orders
- Urgency color legend at bottom
- Pull-to-refresh with offline cache (keys: `delivery-cal:po`, `delivery-cal:so`)
- Added to MoreNavigator + MoreMenu under Operations section

**Dashboard Supply Chain Snapshot: Delivery Stats**
- `SupplyChainSnapshot` gains `deliveriesDueThisWeek`, `deliveriesOverdue`, `openPOList`, `openSOList`
- Supply Chain row: 4th card shows overdue count (red) if any, otherwise deliveries due in 7 days; taps to DeliveryCalendar
- "Deliveries" quick action tile added to Dashboard Quick Actions grid

**Upcoming Deliveries Section on Dashboard** (`src/components/UpcomingDeliveriesSection.tsx`)
- New component renders below Supply Chain row on Dashboard
- Shows next 5 delivery entries from open POs + SOs due within 14 days (overdue first)
- Each row: type dot, order label, party name, urgency chip, chevron → PO/SO detail
- Footer link: "View all N deliveries" → DeliveryCalendar
- Zero additional API calls — uses openPOList/openSOList already fetched in supply chain snapshot

---

## Session 28 — 2026-05-29

### Completed This Session

**Payment Timeline Tab in VendorDetail + CustomerDetail** (`VendorDetailScreen.tsx`, `CustomerDetailScreen.tsx`)
- Both screens now have three tabs: "Bills | Payments | Ledger" (Vendor) and "Invoices | Payments | Ledger" (Customer)
- Payments tab for Vendor: extracts PMT (payment) entries from the running ledger; shows payment count, total paid, avg payment stats bar
- Payments tab for Customer: extracts REC (receipt) entries; labels as "Receipt History" with total received + avg receipt stats
- Visual timeline design: vertical dot-and-line connector per entry, each card shows date, reference, and amount
- PDF export button hidden on Payments tab (no dedicated PDF; Bills/Ledger tabs retain their export buttons)

**Date Range Filter on PO and SO List Screens** (`PurchaseOrdersScreen.tsx`, `SalesOrdersScreen.tsx`)
- Both PurchaseOrdersScreen and SalesOrdersScreen now have a `DateRangeBar` below the status tabs row
- Filters orders client-side by `dt` (creation date) so it works with cached data
- Preset chips: Today, This Week, This Month, Last Month, Custom range
- Works in combination with search text and status tab filters

**Delivery Countdown Chips on PO and SO Cards** (`PurchaseOrdersScreen.tsx`, `SalesOrdersScreen.tsx`)
- PO and SO list cards now show a delivery status chip when `delivery_date` is set and order is not closed/cancelled:
  - "X days overdue" — alert-circle icon, bolder border
  - "Due today" — clock icon
  - "Due in Xd" — for 1-7 days ahead (shown for 1-7 days only; nothing shown beyond 7 days)
- Logic: `getDeliveryStatus(deliveryDate, status)` computes urgency level; closed/cancelled/received orders show nothing

---

## Session 27 — 2026-05-28

### Completed This Session

**Vendor/Customer Ledger Tab** (`VendorDetailScreen.tsx`, `CustomerDetailScreen.tsx`)
- Both Vendor and Customer detail screens now have a two-tab layout: "Bills" | "Ledger" (Vendor) and "Invoices" | "Ledger" (Customer)
- Ledger tab shows a running-balance accounting ledger constructed from AP bills / AR invoices
- Vendor ledger: BILL entries (debit) from bill amounts + PMT entries (credit) from paid amounts
- Customer ledger: INV entries (debit) from invoice amounts + REC entries (credit) from paid amounts
- Entries sorted chronologically; running balance computed per entry
- Table: Date+type chip | Reference | Debit | Credit | Running Balance
- Totals row at bottom with column sums and closing balance
- Summary row updated: Outstanding | Overdue | Total Billed/Invoiced | Paid/Received
- PDF export button is context-aware: exports Bills/Invoices PDF on bills tab, Ledger PDF on ledger tab
- `exportVendorLedgerPDF()` and `exportCustomerLedgerPDF()` added to `pdfExport.ts`

**Account Picker Modal in JournalEntriesScreen** (`src/screens/journalEntries/JournalEntriesScreen.tsx`)
- Interactive account filter replaces static route-param-only filtering
- "Filter by account…" hint shown when no filter active; tapping opens the picker
- When filter active: shows "Account: <code — name>" with edit (pencil) and clear (×) buttons
- `AccountPickerModal` slides up as a pageSheet: fetches non-group accounts from trial balance API, real-time search by account code or name
- Selecting an account refreshes JE list filtered to that account; title updates to "JEs — <account name>"
- Account picker initialization still honours `route.params.account` (backward-compatible with TrialBalance → AccountStatement navigation flow)

**Tappable Account Lines in JournalEntryDetailScreen** (`src/screens/journalEntries/JournalEntryDetailScreen.tsx`)
- Each JE line row is now a `TouchableOpacity`; tapping navigates to `AccountStatement` for that account
- `parseAccountField()` helper splits "1001 - Cash" / "1001 – Cash" strings into code + name parts
- Chevron indicator rendered on tappable rows; rows without an account are non-interactive
- Deep integration: JE list → JE detail → Account Statement creates a seamless drill-down flow

### Next Session
- Consider: Due date reminders — local push notifications for AP bills/AR invoices nearing due date
- Consider: Partner search — global search for vendor/customer name across AP+AR screens
- Consider: Aging breakdown per partner (pie or bar chart in VendorDetail/CustomerDetail summary)
- Consider: Journal Entry narration full-text in JE list (expandable card)
- Consider: Batch ledger export — export all partner ledgers at once from AP/AR summary screen

---

## Session 26 — 2026-05-28

### Completed This Session

**Account Statement Screen** (`src/screens/finance/AccountStatementScreen.tsx`)
- New Finance screen: shows all journal entry lines for a single account with a running balance column
- Accessible from Trial Balance — tapping any non-group account row now navigates to Account Statement (previously went to Journal Entries)
- Route params: `accountCode`, `accountName`, `accountType`
- Date range filter via `DateRangeBar` (defaults to current month)
- Running balance computed per line: debit-normal accounts (1xx = Assets, 5xx = Expenses) accumulate debit minus credit; credit-normal accounts (2xx/3xx/4xx) accumulate credit minus credit
- Summary tiles: Total Debits | Total Credits | Closing Balance (shows "Cr" suffix when negative)
- Transactions table: Date | Voucher badge + number + narration | Debit | Credit | Running Balance
- Totals row at table bottom
- 24h offline cache per company + account + date range
- Pull-to-refresh, DetailSkeleton loading state, ErrorView, empty state
- `exportAccountStatementPDF()` in `pdfExport.ts`: summary tiles + full transactions table with running balance column; filename includes account code
- `FinanceNavigator`: `AccountStatement` route added with typed params
- `linking.ts`: `finance/account-statement` deep link added

**Dashboard Summary PDF Export** (`src/screens/dashboard/DashboardScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportDashboardSummaryPDF()`: generates a full-page PDF snapshot of the Dashboard
  - KPI grid: Revenue MTD, Expenses MTD, Net Income MTD, Cash & Bank, AR, AP — each with MoM trend indicator when prev-month data available
  - Working Capital section: Cash + AR − AP with net total row
  - Supply Chain snapshot tiles (if available): Open POs / Open SOs / Active Materials
  - Voucher Activity by Type table (up to 8 types with count and amount)
  - Recent Vouchers table (last 5 entries with date, type badge, amount, status)
- Dashboard top bar: `file-text` icon button added between search and bell; shows ActivityIndicator while exporting; disabled when KPI data not yet loaded

### Next Session (Session 29+)
- ~~Partner payments / receipts timeline~~ ✅ Done (Session 28)
- Consider: Push notification integration with backend alerts API
- Consider: Journal Entry creation form (draft JE with account line entry — requires POST API)
- Consider: Purchase Order creation form (requires POST API)
- Consider: Export queue — schedule multiple exports and download as ZIP
- Consider: PO/SO delivery calendar view (monthly calendar with delivery dates)

---

## Session 25 — 2026-05-28

### Completed This Session

**Dashboard: Net Income + Vouchers Month-over-Month Trends**
- Net Income KPI card now shows MoM trend using existing `revenuePrevMonth`/`expensesPrevMonth` data
- Vouchers MTD: added `vouchersPrevMonth` to KPIs type; API computes it from previous month journal entries
- `SectionHeader` meta line now shows voucher trend (e.g., "+12% vs last mo")
- Fixed: Net Income `trendInverted` was incorrectly true when loss — up is always good for net income

**Dashboard: 7-Day Daily Voucher Sparkline** (`src/components/VoucherSparkline.tsx`, `src/api/dashboard.ts`)
- `fetchDashboardData` builds `dailyVouchers: {date, count}[]` for the last 7 days from fetched journal entries
- `VoucherSparkline` renders 7 proportional bars; today's bar highlighted in dark; count label shown on non-zero days
- Appears in a "Last 7 Days" section above the voucher type activity chart

**Dashboard: Supply Chain Snapshot** (`src/api/dashboard.ts` `fetchSupplyChainSnapshot`, `DashboardScreen.tsx`)
- Lazy-fetched after main dashboard data (separate `useEffect`) to avoid blocking render
- Shows Open POs / Open SOs / Active Materials as 3 tappable count tiles
- Each tile navigates to the corresponding screen

**Dashboard: Recently Viewed** (`src/utils/recentlyViewed.ts`, `src/components/RecentlyViewedSection.tsx`, `DashboardScreen.tsx`)
- AsyncStorage-backed history with max 8 items; deduplicates by type+entityId
- Tracking added to: PurchaseOrderDetailScreen, PODetailScreen, SalesOrderDetailScreen, PartnerDetailScreen, MaterialDetailScreen
- Dashboard shows last 5 items with type icon, title, subtitle; tapping navigates to that record
- Section loads on focus so new views appear immediately on next dashboard visit

**Settings: Date Format Live Preview**
- Shows `Preview: <formatted sample date>` below format chips using the actual `formatDate()` function
- Updates instantly when format is changed

**Pull-to-Refresh Additions**
- `PODetailScreen` (GRN flow): RefreshControl added to ScrollView
- `BookmarksScreen`: RefreshControl on both FlatList and empty-state ScrollView; `flexGrow:1` for empty container

**Inventory Screen Improvements**
- Stock Ledger tab: PDF export button (`exportStockLedgerPDF`) — summary tiles + full movement log table
- Stock Balance tab: sort button in header (cycles name A–Z → qty high-low → qty low-high); sort mode shown inline in filter bar

**Materials Screen: Sort Button**
- Sort cycles: name A–Z → code A–Z → type A–Z
- Shown as a chip-style button with Sliders icon and current sort label

### Next Session
- Consider: "Account Statement" screen (journal entry lines for a single account with running balance)
- Consider: Dashboard summary PDF export (snapshot of all KPI cards + charts)
- Consider: Partner payments / receipts timeline in Vendor/Customer detail
- Consider: Push notification integration with backend alerts
- Consider: Batch export — export all reports in one action

---

## Session 24 — 2026-05-27

### Completed This Session

**Date Format Setting** (`src/utils/settings.ts`, `src/utils/currency.ts`, `src/screens/settings/SettingsScreen.tsx`, `App.tsx`)
- New `DateFormat` type: `'natural'` (Jan 15, 2025) | `'dmy'` (DD/MM/YYYY) | `'mdy'` (MM/DD/YYYY)
- Module-level `_dateFormatCache` initialized via `initDateFormat()` called in `App.tsx` on startup
- `getDateFormatSync()` used synchronously in `formatDate()` and `formatShortDate()` — no async overhead at render time
- New "DATE FORMAT" section in Settings screen with 3 chip-style option buttons; selection persists to AsyncStorage and immediately updates the in-memory cache
- Changing format affects all date displays app-wide without a restart

**Companies List PDF Export** (`src/utils/pdfExport.ts` `exportCompaniesPDF`, `src/screens/companies/CompaniesScreen.tsx`)
- `exportCompaniesPDF()`: summary grid (total / active / inactive counts), table with Name, Code, Currency, Phone, Email, Status columns
- PDF button (file-text icon) in CompaniesScreen header; shown when data is loaded; shows ActivityIndicator while generating
- Exports the currently-filtered list (respects search and status filter)

**Dashboard Month-over-Month Trend Indicators** (`src/api/dashboard.ts`, `src/components/KPICard.tsx`, `src/screens/dashboard/DashboardScreen.tsx`)
- `fetchDashboardData` now fetches previous month's journal entries in parallel and computes `revenuePrevMonth` / `expensesPrevMonth`
- `KPICard` gains optional `trendPct` (number | null) and `trendInverted` (boolean) props
- Trend row shows trending-up/down icon + "±X.X% vs last mo" in green (good) or red (bad); hidden when prev-month data is unavailable
- Revenue card: positive trend = green; Expenses card: `trendInverted=true` so positive trend = red

### Next Session
- Consider: Companies list PDF export already done; next: net-income trend on the Net Income KPI card
- Consider: Voucher count trend (this month vs last month) on the Vouchers KPI card
- Consider: Date format setting preview — show a sample date in Settings as user selects format

---

## Session 23 — 2026-05-27

### Completed This Session

**Company KPI Comparison PDF Export** (`src/utils/pdfExport.ts` `exportComparisonPDF`, `src/screens/comparison/ComparisonScreen.tsx`)
- `exportComparisonPDF()`: renders all 8 metric sections (Net Income, Revenue, Expenses, Cash, AR, AP, Vouchers MTD, Working Capital) as ranked tables with inline CSS proportional bars
- Summary tile grid shows total companies / loaded count / failed count
- PDF button (file-text icon) added to ComparisonScreen header; visible only when at least one snapshot has loaded; shows ActivityIndicator while exporting

**Settings Screen: Default Company Picker** (`src/screens/settings/SettingsScreen.tsx`)
- New "DEFAULT COMPANY" section at the top of Settings (shown only when companies list is non-empty)
- Lists all available companies as tappable rows with briefcase icon, company name, optional code subtext
- Active (selected) company shows a check icon and bold name
- Tapping any row calls `setSelectedCompany()` which persists the choice to AsyncStorage and restores it on next app launch

**InboxScreen Pull-to-Refresh** (`src/screens/inbox/InboxScreen.tsx`)
- `refreshing` state + `handleRefresh` callback added
- FlatList gains `refreshControl` prop with `tintColor={Colors.textMuted}`
- Empty state (inbox is empty) now uses `ScrollView` with `RefreshControl` so pull-to-refresh works even when list is empty
- `emptyState` style: `flex → flexGrow` to work correctly as ScrollView `contentContainerStyle`

**Recent Search History** (`src/screens/search/SearchScreen.tsx`)
- AsyncStorage-backed recent search history (max 8 terms, deduplicates case-insensitively)
- `loadSearchHistory` / `saveSearchHistory` / `clearSearchHistory` helpers added
- `recentSearches` state loaded on mount alongside data
- `commitSearch()` called on TextInput `onSubmitEditing` + before each result navigation
- When no query typed and history is non-empty: shows "Recent" header with clock-icon history rows, individual × delete per row, and a "Clear" button
- Tapping a history row populates the query to re-run that search
- Falls back to original "Search everything" placeholder when history is empty

**Materials List PDF Export** (`src/utils/pdfExport.ts` `exportMaterialsListPDF`, `src/screens/materials/MaterialsScreen.tsx`)
- `exportMaterialsListPDF()`: 3-tile summary (Total/Active/Types), "By Type" breakdown grid (up to 4 types), full table with Code/Name/Type/Category/Unit/Status; inactive items at 0.6 opacity
- PDF button in MaterialsScreen header; respects current type + search filters; passes filterLabel to report

**Partners List PDF Export** (`src/utils/pdfExport.ts` `exportPartnersListPDF`, `src/screens/partners/PartnersScreen.tsx`)
- `exportPartnersListPDF()`: dynamic summary grid (Total/Vendors/Customers/Both), full table with Name/Code/Role/Email/Phone/Address (truncated 40 chars)
- PDF button in PartnersScreen header; respects role filter (Customers/Vendors) + search filter

**PO List PDF Export** (`src/utils/pdfExport.ts` `exportPOListPDF`, `src/screens/purchaseOrders/PurchaseOrdersScreen.tsx`)
- `exportPOListPDF()`: 3-tile summary (Total Orders / Total Value / Statuses), By Status grid, full orders table (PO# / Vendor / Order Date / Delivery Date / Status / Total)
- Alternating row background; filename includes active tab label (All / Open / In Progress)
- PDF button added to PurchaseOrdersScreen header; respects search filter

**SO List PDF Export** (`src/utils/pdfExport.ts` `exportSOListPDF`, `src/screens/salesOrders/SalesOrdersScreen.tsx`)
- Same structure: summary tiles + By Status grid + full table (SO# / Customer / dates / Status / Total)
- Filename includes active tab (All / Open / Approved / Closed)
- PDF button added to SalesOrdersScreen header; respects search filter

### Next Session
- Consider: Companies list PDF export
- Consider: Date format setting (DD/MM/YYYY vs MM/DD/YYYY) with cached preference
- Consider: Dashboard charts — revenue trend sparkline or month-over-month comparison

---

## Session 22 — 2026-05-27

### Completed This Session

**Cash Flow PDF Export** (`src/utils/pdfExport.ts` `exportCashFlowPDF`, `src/screens/finance/CashFlowScreen.tsx`)
- Full Cash Flow Report PDF with 2-tile summary (Total Payable / Total Receivable)
- Net Cash Position banner with green/red color coding based on sign
- Per-period breakdown sections (Overdue → This Week → Next Week → week_3 → week_4 → 30+ days → Undated)
- Each period section shows TO PAY (bills table) and TO COLLECT (invoices table) with Ref, Party, Amount, Due Date columns
- Period net row at the bottom of each section with color-coded value
- PDF button appears in CashFlowScreen header when data is loaded and non-empty
- Shows ActivityIndicator while export is in progress; uses selectedCompany name in report header

**Warehouse List PDF Export** (`src/utils/pdfExport.ts` `exportWarehousesPDF`, `src/screens/inventory/InventoryScreen.tsx`)
- Warehouse List PDF with 2-tile summary: Total Warehouses / Active count
- Full table: Code | Name | Type | Address | Status (color-coded pill badge) | Items | Total Qty
- PDF button added to InventoryScreen header when Warehouses tab is active and filteredWarehouses is non-empty
- Reuses existing exportBtn/exportBtnText style classes from the Stock tab's PDF button

---

## Session 21 — 2026-05-26

### Completed This Session

**Journal Entry Detail Screen** (`src/screens/journalEntries/JournalEntryDetailScreen.tsx`)
- Full-page view for any journal entry tapped in the JE list
- Header: BackButton + voucher type badge + voucher number + Share icon + PDF export icon
- Body: info card (voucher no/type/date/status badge), narration card (italic), debit/credit amount blocks
- Journal lines table: Account | Debit | Credit columns, line narration sub-text, totals row with thick border
- `exportJournalEntryDetailPDF()` added to `pdfExport.ts`: 2-tile summary, full lines table with column headers and total row

**JournalEntriesScreen — navigation upgrade**
- Cards now navigate to `JournalEntryDetail` on tap (chevron-right + "N lines" hint replaces expand chevron)
- Screen accepts `{ account?, accountName? }` route params; passes `account` to API for server-side filtering
- Account filter banner shown between header and CompanySelector when opened from TrialBalance drill-down
- Cache key updated to include `accountFilter` so filtered views cache independently

**Trial Balance → JE Drill-down** (`src/screens/trialBalance/TrialBalanceScreen.tsx`)
- Non-group account rows are now tappable (wrapped in `TouchableOpacity`)
- Each tappable row shows a `chevron-right` icon (12px, textMuted) at the right edge
- Tap navigates to `JournalEntries` with `{ account: row.account_code ?? row.account_name, accountName: row.account_name }`
- Group rows (subtotals/headers) remain non-interactive (no chevron)

**AP Summary PDF Export** (`src/utils/pdfExport.ts` `exportAPSummaryPDF`, `src/screens/finance/AccountsPayableScreen.tsx`)
- 4-tile summary grid: Total Outstanding / Total Overdue / Vendors count / Bills count
- Aging analysis table: 5 buckets with progressively darker gray background
- Top Vendors table (up to 30) and Bills list (up to 50) with all key columns
- PDF button added to AccountsPayableScreen header; only visible when bills data is loaded

**AR Summary PDF Export** (`src/utils/pdfExport.ts` `exportARSummaryPDF`, `src/screens/finance/AccountsReceivableScreen.tsx`)
- Same structure as AP export: 4-tile summary, aging table, customers table, invoices list
- PDF button added to AccountsReceivableScreen header; only visible when invoices loaded

### Next Session
- Consider: Cash Flow PDF export
- Consider: ComparisonScreen PDF export
- Consider: Settings screen enhancements (default company picker, date format)
- Consider: Stock alert threshold configuration

---

## Session 20 — 2026-05-26

### Completed This Session

**Item Ledger PDF Export** (`src/screens/inventory/ItemLedgerScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportItemLedgerPDF()`: item name + code in report header, date range shown when filter is active, 4-tile summary (Total In / Total Out / Current Balance / Transactions), full movement log table (Type | Voucher # | Date | Warehouse | In | Out | Balance | Unit)
- `ItemLedgerScreen`: Feather `file-text` PDF button in header; visible only when entries are loaded; passes live entries + current dateRange + selectedCompany name

**GRN Goods Receipt PDF Export** (`src/screens/grn/GRNScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportGRNPDF()`: 4-tile summary (Total POs / Complete / Overall % / Value Received), per-PO table with inline CSS progress bar, line item sub-rows showing item name + received/ordered quantities + percentage
- `GRNScreen`: `useCompany` added for company name; Feather `file-text` PDF button in header; only visible when orders are loaded; header `alignItems: 'baseline'` → `'center'` with `flex: 1` on subtitle to accommodate the button

**Cash Flow Screen** (`src/screens/finance/CashFlowScreen.tsx`)
- New screen under Finance tab showing all outstanding AP bills + AR invoices grouped by time period relative to today's date
- Periods: Overdue | Due This Week | Due Next Week | Due in 2–3 Weeks | Due in 3–4 Weeks | Due in 30+ Days | No Due Date
- Summary tiles: Total Payable (outstanding AP bills count) / Total Receivable (outstanding AR invoices count)
- Net Cash Position card: large value with darker border/background when net is negative; contextual hint text
- Per-period sections: TO PAY group (bills) and TO COLLECT group (invoices), each item shows party name, reference number, outstanding amount, and due date; Overdue groups get bold `borderColor: Colors.text` treatment
- Period Net row at bottom of each section
- 24h offline cache per company (`cash-flow:<companyId>`); `CompanySelector`; `OfflineBanner`; `ErrorView`; `ListScreenSkeleton` loading state; pull-to-refresh
- Wired: `CashFlow` route in `FinanceNavigator` + `FinanceMenuScreen` (Feather `trending-up` icon, between AR and Journal Entries)
- Deep link: `poultryerp://finance/cash-flow` added to `linking.ts`

**Dashboard Quick Actions expanded to 12 tiles** (`src/screens/dashboard/DashboardScreen.tsx`)
- 3 new tiles added to bring grid from 9 to 12 (4 complete rows of 3):
  - `Cash Flow` (Feather `trending-up`) → Finance > CashFlow
  - `Partners` (Feather `users`) → More > Partners
  - `Reports` (Feather `pie-chart`) → Finance > FinancialReports

---

## Session 19 — 2026-05-25

### Completed This Session

**Bookmark Count Badge** (`src/screens/dashboard/DashboardScreen.tsx`)
- Added `bookmarkCount` state loaded from `getBookmarks().length` in `useFocusEffect` (same refresh pattern as `inboxUnread`)
- Quick action tile badge rendered using existing badge renderer; shows numeric count when > 0; hides when empty

**Bookmarks PDF Export** (`src/screens/bookmarks/BookmarksScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportBookmarksPDF()`: summary grid (count per type), then per-type tables: Name / Details / Amount / Saved Date
- `BookmarksScreen`: Feather `file-text` PDF button in header alongside Clear All; wrapped in `headerActions` row; only visible when bookmarks non-empty

**PO Detail PDF Export** (`src/screens/purchaseOrders/PurchaseOrderDetailScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportPODetailPDF(po)`: PO summary tiles (status / amount / order date / delivery date), receipt progress bar (received/ordered), full line items table (item / ordered / received / pending / unit / rate / amount) with totals row
- `PurchaseOrderDetailScreen`: Feather `file-text` button in header between BackButton and BookmarkButton

**SO Detail PDF Export** (`src/screens/salesOrders/SalesOrderDetailScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportSODetailPDF(so)`: SO summary tiles, line items table (item / qty / unit / rate / amount) with totals row
- `SalesOrderDetailScreen`: Feather `file-text` button in header between BackButton and BookmarkButton

**Partner Detail PDF Export** (`src/screens/partners/PartnerDetailScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportPartnerDetailPDF()`: PO + SO summary tiles, separate PO/SO tables with date/status/amount and totals rows
- `PartnerDetailScreen`: Feather `file-text` button in header; passes live `pos`/`sos`/`roles` at press time

**Material Detail PDF Export** (`src/screens/materials/MaterialDetailScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportMaterialDetailPDF()`: 4-tile summary (total qty / warehouses / total in / total out), stock-by-warehouse table with status flags, ledger table (date / voucher type / voucher# / warehouse / in / out / balance)
- `MaterialDetailScreen`: Feather `file-text` button in header; passes live `stock` + `ledger` state at press time

**Vendor Detail PDF Export** (`src/screens/finance/VendorDetailScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportVendorDetailPDF()`: 4-tile summary (outstanding / overdue / total billed / bill count), bills table with number/date/due-date/status/amount/paid/outstanding + totals row
- `VendorDetailScreen`: Feather `file-text` button in header; only shown when `bills.length > 0`

**Customer Detail PDF Export** (`src/screens/finance/CustomerDetailScreen.tsx`, `src/utils/pdfExport.ts`)
- `exportCustomerDetailPDF()`: same structure as Vendor but for AR invoices; filename from `customerName`
- `CustomerDetailScreen`: Feather `file-text` button in header; only shown when `invoices.length > 0`

---

## Session 18 — 2026-05-25

### Completed This Session

**Bookmarks System** (`src/utils/bookmarks.ts`, `src/components/BookmarkButton.tsx`, `src/screens/bookmarks/BookmarksScreen.tsx`)
- `bookmarks.ts`: AsyncStorage-backed bookmark registry (max 100 entries, sorted by addedAt desc)
  - Types: `BookmarkType = 'po' | 'so' | 'partner' | 'material'`; Bookmark stores `entityId`, `title`, `subtitle`, `meta`, `navParams`, `addedAt`
  - `addBookmark()`, `removeBookmark()`, `isBookmarked()`, `getBookmarks()`, `clearBookmarks()`
  - `navParams` field for extra navigation params (e.g. `isVendor`/`isCustomer` for partners)
- `BookmarkButton`: toggle Feather bookmark icon; reads initial state on mount via `isBookmarked()`; persists on press; opacity-dim when unsaved; accepts optional `color` prop for dark headers
- `BookmarksScreen`: FlatList grouped by type section headers (Purchase Orders, Sales Orders, Partners, Materials)
  - Tapping any row navigates to the appropriate detail screen with all required params
  - X button per row with confirmation alert; Clear All with destructive confirmation
  - Empty state with bookmark icon and instruction text
- Navigation: `Bookmarks` route added to `MoreNavigator`; deep link `poultryerp://bookmarks`
- `MoreMenuScreen`: "Bookmarks" item in ADMIN section (Feather bookmark icon)
- BookmarkButton wired into 4 detail screen headers:
  - `PurchaseOrderDetailScreen` — type=po, title=po_number, subtitle=vendor, meta=total amount
  - `SalesOrderDetailScreen` — type=so, title=so_number, subtitle=customer, meta=total amount
  - `PartnerDetailScreen` — type=partner, title=partnerName, subtitle=roles, navParams={isVendor, isCustomer}
  - `MaterialDetailScreen` — type=material, title=materialName, subtitle=type, meta=unit, navParams={all route params}
- `DashboardScreen`: Bookmarks added as 9th quick action tile (Feather bookmark icon)

**Inbox Swipe-to-Delete** (`src/screens/inbox/InboxScreen.tsx`, `src/utils/notificationLog.ts`)
- `notificationLog.ts`: added `deleteInboxEntry(id: string)` — filters entry by id and writes back
- `InboxScreen`: replaced `EntryRow` with `SwipeableEntryRow` using `PanResponder` + `Animated.Value`
  - Swipe left ≥ 80px snaps open a 72px dark delete action button (Feather trash-2 + "Delete" label)
  - Tap the action button: card animates off-screen (200ms) then removes from state + AsyncStorage
  - Swipe < threshold snaps back with spring animation (bounciness: 4)
  - Header subtitle shows "Swipe left to delete" when entries are present; "Notification history" when empty

**Multi-Company KPI Comparison** (`src/screens/comparison/ComparisonScreen.tsx`)
- Fetches `fetchDashboardData(companyId)` for every company in parallel on mount and on pull-to-refresh
- Company status chip row: green dot (loaded) / spinner (loading) / alert-circle (failed) per company
- Summary tiles: total companies / loaded count / loading count (if > 0) / failed count (if > 0)
- 9 ranked metric sections — each shows all companies ranked by value with proportional horizontal bars:
  - Net Income (revenue − expenses), Revenue MTD, Expenses MTD, Cash Balance
  - Accounts Receivable, Accounts Payable, Vouchers MTD, Working Capital (AR − AP)
  - Also: per-company bar width = |value| / max; #1 rank uses full-weight bar + bold value text
  - Negative values use muted-color bar; "lower is better" metrics (expenses, AP) rank lowest first
- Navigation: `Comparison` route in `MoreNavigator`; "Company Comparison" in MoreMenuScreen ADMIN; `poultryerp://comparison` deep link

---

## Session 17 — 2026-05-25

### Completed This Session

**In-App Notification Inbox** (`src/utils/notificationLog.ts`, `src/screens/inbox/InboxScreen.tsx`)
- `notificationLog.ts`: new AsyncStorage-backed inbox log (max 50 entries)
  - `logNotificationEvent({ apCount, arCount, stockCount })` — prepends a timestamped entry
  - `getInboxEntries()` / `getUnreadCount()` / `markAllRead()` / `clearInbox()`
- `notifications.ts`: `scheduleOverdueReminder` now calls `logNotificationEvent` after every successful schedule
- `InboxScreen`: FlatList of notification history
  - Unread entries: bold border + dot indicator on icon
  - Breakdown chips per entry (AP N / AR N / Stock N)
  - "Time ago" relative timestamps (Just now / Xm ago / Xh ago / X days ago)
  - Marks all read on screen open; "Clear all" with destructive confirmation
  - Empty state with Feather `inbox` icon
- `MoreNavigator`: Inbox route added; `linking.ts`: `poultryerp://inbox` deep link
- `MoreMenuScreen`: split single Alerts banner into side-by-side Alerts + Inbox banners; Inbox shows unread count badge; unread reloads via `useFocusEffect`
- `AppNavigator`: More tab `tabBarBadge` shows `inboxUnread` count; refreshed on mount + on foreground (`AppState` active) transitions

**Dashboard Inbox Integration** (`src/screens/dashboard/DashboardScreen.tsx`)
- Inbox added as 8th Quick Action tile (Feather `inbox`) with unread count badge overlay
- Inbox unread banner shown between Finance Status and Quick Actions when `inboxUnread > 0`; tapping navigates to Inbox
- `inboxUnread` state loaded from `getUnreadCount()` on every `useFocusEffect` (Dashboard focus)

**Batch PDF Export — Combined Reports** (`src/utils/pdfExport.ts`)
- `exportCombinedReportPDF()`: generates a single PDF combining all three financial reports
  - Cover page with TOC (3 numbered entries: Trial Balance / P&L / Balance Sheet)
  - Page-break dividers between sections with section numbers
  - `COMBINED_EXTRA_CSS`: `.page-break`, `.report-bundle-cover`, `.toc-item` styles for print layout
  - `classifyRow()` helper embedded in pdfExport.ts to avoid importing from FinancialReportsScreen
  - Derives P&L and BS from raw TB rows internally; no double API call needed
- `TrialBalanceScreen`: "Bundle" button (Feather `layers`) added alongside existing PDF + Share buttons; uses raw `result.rows` (unfiltered) for full combined export
- `FinancialReportsScreen`: same "Bundle" button; derives `totalDebit/Credit` from current `rows`

**Stock Balances PDF Export** (`src/utils/pdfExport.ts`, `src/screens/inventory/InventoryScreen.tsx`)
- `exportStockBalancePDF()`: generates item/warehouse/qty/unit table with 2-summary grid (item count + total qty)
- `InventoryScreen`: PDF button in header visible on Stock tab when data loaded; exports `filteredStock` (respects current search + low/out-of-stock filter)
- `selectedCompany` destructured from `useCompany()` for company name in PDF header

---

## Session 16 — 2026-05-24

### Completed This Session

**Notification Time Picker + Per-Type Toggles** (`src/utils/settings.ts`, `src/utils/notifications.ts`, `src/screens/settings/SettingsScreen.tsx`, `src/navigation/AppNavigator.tsx`)
- `settings.ts`: 4 new AsyncStorage-backed settings with defaults:
  - `notificationHour` (0–23, default 9) — hour at which the daily reminder fires
  - `notifyApOverdue` (bool, default true) — whether AP overdue bills trigger a notification
  - `notifyArOverdue` (bool, default true) — whether AR overdue invoices trigger a notification
  - `notifyLowStock` (bool, default true) — whether low-stock items trigger a notification
- `notifications.ts`: `scheduleOverdueReminder` now reads all 4 new settings on each call; silently drops disabled types from the notification body; schedules at the configured hour instead of hardcoded 9 AM
- `SettingsScreen`: new NOTIFICATIONS section replaces the old SECURITY-embedded toggle:
  - Master `Switch` toggle for enabling/disabling overdue reminders
  - 8-chip time picker (6 AM → 6 PM) shown only when master toggle is on
  - 3 per-type `Switch` rows (Overdue bills AP / Overdue invoices AR / Low-stock items) shown only when master toggle is on
- `AppNavigator`: added `Notifications.addNotificationResponseReceivedListener` — tapping the daily reminder notification navigates to the Alerts screen (`More > Alerts`) via `CommonActions.navigate`

**Deep Link Navigation** (`app.json`, `src/navigation/linking.ts`, `src/navigation/RootNavigator.tsx`)
- `app.json`: added `scheme: "poultryerp"` — enables `poultryerp://` custom URL scheme on iOS and Android
- Installed `expo-linking`
- `src/navigation/linking.ts`: new `LinkingOptions` config mapping 17 URL paths to screen names across all tab/stack navigators:
  - `poultryerp://dashboard` → Dashboard tab
  - `poultryerp://inventory` → InventoryMain
  - `poultryerp://finance`, `/finance/ap`, `/finance/ar`, `/finance/journal`, `/finance/trial-balance`, `/finance/reports`
  - `poultryerp://materials`, `/purchase-orders`, `/sales-orders`, `/grn`, `/partners`, `/companies`
  - `poultryerp://alerts`, `/settings`, `/search`
- `RootNavigator`: `NavigationContainer` receives the linking config when user is authenticated (not on login/loading screens)

**PDF Export for Financial Reports + Journal Entries** (`src/utils/pdfExport.ts`, updated screens)
- Installed `expo-print` + `expo-sharing`
- `src/utils/pdfExport.ts`: new shared PDF utility with 4 export functions:
  - `exportTrialBalancePDF`: account table with debit/credit columns, group rows with level indentation, totals row, balanced/out-of-balance status message
  - `exportPLPDF`: summary grid (revenue/expenses), Net Income box, separate revenue and expense account tables
  - `exportBSPDF`: assets/liabilities/equity tables, imbalance warning, L+E total
  - `exportJournalEntriesPDF`: summary grid (voucher count + total), full entry table with group header rows (voucher type/number/date) + indented line items (account + debit/credit)
  - Shared `BASE_CSS`: clean monochrome print stylesheet matching app design
  - `printAndShare`: renders HTML to PDF via `expo-print.printToFileAsync`, opens OS share sheet via `expo-sharing.shareAsync`; falls back to `printAsync` (print dialog) when sharing unavailable
- `TrialBalanceScreen`: PDF button (Feather `file-text` icon) added alongside existing Share text button
- `FinancialReportsScreen`: PDF button added; dispatches to `exportPLPDF` or `exportBSPDF` based on active tab
- `JournalEntriesScreen`: PDF button added; uses `selectedCompany.name` from context for the company label

---

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

**2026-06-08** — Session-46 audit: chart label readability + VelocityCard visual legend. `JournalEntriesScreen` DrCrFlowChart `monthLabel` bumped 9pt → 10pt (consistent with sessions 44–45 audit fixes for ProcurementAnalytics and FinancialAnalytics). `StockHealthScreen` VelocityCard: added visual IN/OUT legend row (dark dot = IN, muted dot = OUT) at top of card with hairline bottom border, matching the pattern in DrCrFlowChart; updated SectionHeader subtitle from "dark=IN, muted=OUT" text description to "Top 8 items by combined movement".

**2026-06-04** — Semantic token sweep: replaced all remaining `Colors.primary` / `Colors.danger` references in screens and components with `Colors.text`. Affected files: `LoadingView.tsx` (ActivityIndicator), `SegmentedControl.tsx` (active label), `TabBar.tsx` (active tab border + label), `DeliveryCalendarScreen.tsx` (ActivityIndicator, type chip active state, selected day cell), `DashboardScreen.tsx` (inbox unread dot). No visual change — `Colors.primary` and `Colors.danger` both resolved to `#0a0a0a`; this cleanup makes the intent explicit and eliminates all legacy semantic token usage from the UI layer.

**2026-06-03** — `pdfExport.ts` session-41 audit: removed final 7 semantic color values from Cash Flow PDF, Warehouse List PDF, and Companies PDF. Overdue section backgrounds changed from `#fff1f2` (light red) to `#f3f4f6` (gray). Overdue section borders from `#fca5a5` to `#d1d5db`. Section titles and net position values from green/red to `#111` monochrome. Overdue due dates now use `font-weight:700` (bold) instead of `#dc2626` red. Warehouse and company status badges changed from `#dcfce7`/`#166534` (green) to monochrome `#f3f4f6`/`#111` for active, `#9ca3af` for inactive. Full codebase now free of all semantic colors (`#16a34a`, `#166534`, `#991b1b`, `#dc2626`, `#fca5a5`, `#fff1f2`, `#dcfce7`).

**2026-05-29** — `DeliveryCalendarScreen` + `DashboardScreen`: removed all 4 semantic urgency colors (red/amber/blue/green) from DeliveryCalendar. Replaced `URGENCY_COLORS` with `DOT_SHADES` (black→darkGray→midGray→lightGray opacity scale), month-summary badges switched to outline hairline style, order-card urgency badges now monochrome outline with bold weight for overdue. PO/SO type pills unified to same gray. Dashboard: overdue count now uses `fontWeight:'700'` instead of `color:'#dc2626'`.

**2026-05-25** — `BiometricLockOverlay`: replaced hardcoded `borderRadius: 40` on `iconWrap` with `Radius.full` — the only remaining numeric borderRadius literal introduced by the Session 17 build. Full post-build audit confirms all 28 screens and all shared components are clean: no emojis, no semantic hex colors, no hardcoded borderRadius, no shadow spreads; only `'#fff'` (white text on black button/chip — intentional monochrome) remains as a literal.

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

## What's Next (Session 30+)

Sessions 1–30 are complete. All roadmap screens + polish + analytics are done. Remaining enhancement options:

1. ~~**Partner payments timeline**~~ — ✅ Done (Session 28)
2. **Journal Entry creation form** — Draft JE with account line entry (requires POST API on web app)
3. **Purchase Order creation** — Draft PO form with item line entry (requires POST API endpoint on web app)
4. **Widget support** — Expo WidgetKit for home screen KPI summary (iOS 17+)
5. **Universal links** — Associate poultryerp:// scheme with a web domain (requires associated-domains entitlement + server-side apple-app-site-association)
6. ~~**Cash Flow PDF export**~~ — ✅ Done (Session 22)
7. ~~**Account Statement screen**~~ — ✅ Done (Session 26)
8. ~~**Dashboard Summary PDF**~~ — ✅ Done (Session 26)
9. ~~**PO/SO delivery calendar view**~~ — ✅ Done (Session 29)
10. **Export queue** — Schedule multiple PDF exports and download as combined ZIP
11. ~~**Procurement Analytics**~~ — ✅ Done (Session 30)
12. ~~**Stock Health screen**~~ — ✅ Done (Session 30)

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
| Notification time picker (configurable hour) | ✅ Done |
| Per-type notification toggles (AP/AR/Stock) | ✅ Done |
| Notification tap → Alerts screen deep link | ✅ Done |
| Deep link navigation (poultryerp:// URL scheme) | ✅ Done |
| PDF export — Trial Balance | ✅ Done |
| PDF export — P&L + Balance Sheet | ✅ Done |
| PDF export — Journal Entries | ✅ Done |
| In-app notification inbox (history log) | ✅ Done |
| Inbox unread badge on More tab | ✅ Done |
| Inbox unread banner + tile on Dashboard | ✅ Done |
| Batch PDF export (TB + P&L + BS combined) | ✅ Done |
| Stock balances PDF export | ✅ Done |
| Bookmarks system (save POs, SOs, partners, materials) | ✅ Done |
| BookmarkButton on PO/SO/Partner/Material detail headers | ✅ Done |
| BookmarksScreen — grouped list, tap to navigate, per-entry delete | ✅ Done |
| Inbox swipe-to-delete (per-entry PanResponder gesture) | ✅ Done |
| Multi-company KPI comparison screen (ranked metrics, proportional bars) | ✅ Done |
| Bookmark count badge on Dashboard Bookmarks tile | ✅ Done |
| PDF export — Bookmarks list | ✅ Done |
| PDF export — PO Detail (summary + receipt progress + line items) | ✅ Done |
| PDF export — SO Detail (summary + line items) | ✅ Done |
| PDF export — Partner Detail (PO/SO history) | ✅ Done |
| PDF export — Material Detail (stock + ledger) | ✅ Done |
| PDF export — Vendor Detail (AP bills) | ✅ Done |
| PDF export — Customer Detail (AR invoices) | ✅ Done |
| PDF export — Item Ledger (movement log + summary) | ✅ Done |
| PDF export — GRN Goods Receipt (progress + per-PO line items) | ✅ Done |
| Cash Flow screen (outstanding AP/AR grouped by due date period) | ✅ Done |
| Dashboard Quick Actions expanded to 12 tiles (Cash Flow, Partners, Reports added) | ✅ Done |
| Journal Entry Detail Screen (full-page view: lines table, share, PDF export) | ✅ Done |
| Trial Balance → JE drill-down (tap account row → filtered Journal Entries) | ✅ Done |
| PDF export — AP Summary (aging analysis + vendor table + bills list) | ✅ Done |
| PDF export — AR Summary (aging analysis + customer table + invoices list) | ✅ Done |
| PDF export — Cash Flow (per-period TO PAY / TO COLLECT tables) | ✅ Done |
| PDF export — Warehouse List (summary + full table) | ✅ Done |
| PDF export — Company KPI Comparison (8 metric sections, ranked tables) | ✅ Done |
| PDF export — Materials List (type breakdown grid + full table) | ✅ Done |
| PDF export — Partners List (role summary + full table) | ✅ Done |
| PDF export — PO List (status breakdown + full orders table, tab-labeled) | ✅ Done |
| PDF export — SO List (status breakdown + full orders table, tab-labeled) | ✅ Done |
| Settings: Default company picker (explicit company selection in Settings) | ✅ Done |
| InboxScreen pull-to-refresh (RefreshControl on FlatList + ScrollView empty state) | ✅ Done |
| Recent search history in SearchScreen (AsyncStorage, max 8, per-item delete) | ✅ Done |
| Account Statement screen (account-level JE lines with running balance, TB drill-down) | ✅ Done |
| PDF export — Account Statement (transactions table + running balance + summary tiles) | ✅ Done |
| Dashboard Summary PDF export (KPI grid + working capital + supply chain + activity) | ✅ Done |
| Vendor Ledger tab (Bills + running-balance ledger) | ✅ Done |
| Customer Ledger tab (Invoices + running-balance ledger) | ✅ Done |
| Vendor Payment Timeline tab (chronological payment history) | ✅ Done |
| Customer Receipt Timeline tab (chronological receipt history) | ✅ Done |
| Date range filter on Purchase Orders list (DateRangeBar) | ✅ Done |
| Date range filter on Sales Orders list (DateRangeBar) | ✅ Done |
| Delivery countdown chips on PO cards (overdue/today/urgent/soon) | ✅ Done |
| Delivery countdown chips on SO cards (overdue/today/urgent/soon) | ✅ Done |
| Delivery Calendar screen (monthly grid, dot indicators, day-detail panel) | ✅ Done |
| Upcoming Deliveries section on Dashboard (next 5 deliveries, urgency chips) | ✅ Done |
| Supply Chain snapshot: delivery stats card (overdue / due-7d count, taps to calendar) | ✅ Done |
| Dashboard Quick Actions: Deliveries tile → DeliveryCalendar | ✅ Done |
| Procurement Analytics screen (monthly PO/SO trend, top vendors, top customers, status breakdown) | ✅ Done |
| Stock Health screen (overview bar, low-stock list, top items, warehouse distribution) | ✅ Done |
| MoreMenu Analytics section (Procurement Analytics + Stock Health + Company Comparison) | ✅ Done |
| Dashboard Analytics quick-action tile → ProcurementAnalytics | ✅ Done |
| PDF export — Procurement Analytics | ✅ Done |
| PDF export — Stock Health | ✅ Done |

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
| 2026-05-24 | GRNScreen + LoginScreen: eliminate last dark surfaces | `GRNScreen` summary card: dropped dark-inverted design (black bg, white text, rgba overlays) → white surface card with hairline border and standard black/gray typography hierarchy; progress bar track/fill now match rest of app (Colors.border / Colors.text). `LoginScreen` header: same treatment — black hero header + white text → white surface header, black icon (Feather layers), black app name, muted gray tagline; `StatusBar style` changed from "light" → "dark". Removes all remaining `rgba(255,255,255,…)` white-on-dark patterns from the codebase. |
| 2026-05-25 | Session-18 audit — full codebase clean | Comprehensive audit of all 6 screens and 5 components added by build-agent sessions 16–18 (`BookmarksScreen`, `ComparisonScreen`, `InboxScreen`, `SettingsScreen`, `SearchScreen`, `BiometricLockOverlay`, `BookmarkButton`, `VoucherActivityChart`, `DashboardSkeleton`, `SkeletonBox`). All already clean: Feather icons, hairline borders, Radius tokens, Colors tokens, no emojis, no shadows. Single fix: `MaterialDetailScreen` `RefreshControl` now includes `tintColor={Colors.textMuted}` for consistency with all other screens. Zero hardcoded borderRadius values remain (verified). Zero Shadow usages remain (verified). |
| 2026-05-26 | Session-19 audit + menu icon-wrap fix | Full audit of all screens and components added/modified by build-agent session 19 (PDF export for VendorDetailScreen, CustomerDetailScreen, PartnerDetailScreen, MaterialDetailScreen, BookmarksScreen, PO/SO detail). All already clean: Feather file-text icon, Colors tokens, hairline borders. Two shared fixes: (1) `MoreMenuScreen` Company Comparison icon changed from `layers` (duplicate of Materials) → `bar-chart` for clear visual distinction. (2) `MoreMenuScreen` + `FinanceMenuScreen` `menuIconWrap.backgroundColor`: `Colors.surface` → `Colors.surfaceHover` — icon backgrounds were invisible (white-on-white) while every other screen in the app uses `Colors.surfaceHover` for icon wraps; now consistent. |
| 2026-05-26 | Session-20 audit + PODetailScreen header fix | Full audit of all screens and components added by build-agent session 20 (`CashFlowScreen`, Dashboard quick-action expansion, ItemLedger/GRN PDF export). All already clean: Feather icons, Colors tokens, hairline borders, no emojis, no shadows. Single fix: `PODetailScreen` (orphaned file, not in navigator) still had a dark-inverted header (`backgroundColor: Colors.text`, white chevron, `StatusBar style="light"`) — converted to white-surface header matching every other detail screen: `Colors.surface` bg, hairline border, `BackButton` component, `Typography.h2` title, `StatusBar style="dark"`. Removed now-unused `Feather` and `TouchableOpacity` imports. Zero dark-surface headers remain anywhere in the codebase. |
| 2026-05-26 | Session-21 audit — all clean | Full audit of all files added/modified by build-agent session 21: `JournalEntryDetailScreen` (new), `JournalEntriesScreen` (drill-down + account filter banner), `TrialBalanceScreen` (tappable account rows), `AccountsPayableScreen` (PDF export button), `AccountsReceivableScreen` (PDF export button). All already clean: `JournalEntryDetailScreen` authored with full monochrome palette from the start (Colors tokens, hairline borders, Feather icons, Radius/Spacing/Typography tokens, no emojis, no shadows). JE drill-down additions use `Colors.surfaceHover` banner, Feather filter icon, no semantic colors. TB chevron uses `Colors.textMuted`. AP/AR export buttons follow established outline-pill pattern. Codebase-wide grep confirms: zero emojis, zero semantic color hex values, zero `Shadow.*` usages, zero raw `borderWidth: 1` (only `hairlineWidth` and intentional `1.5`/`1` unread-dot halos). |
| 2026-05-27 | Session-22 audit + AlertsScreen header refactor + CashFlowScreen cleanup | Full post-build audit of all screens and components after session-22 PDF export additions (CashFlowScreen + InventoryScreen warehouse PDF). All 28+ screens confirmed clean. Two real inconsistencies found and fixed: (1) `AlertsScreen` header refactored to standard pattern — removed `headerCenter` View wrapper and `<View style={{ width: 40 }} />` spacer, changed `justifyContent: 'space-between'` → `gap: Spacing.sm`, changed `paddingTop: Spacing.sm / paddingBottom: Spacing.md` → `paddingVertical: Spacing.sm + 4`, changed `headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text }` → `headerTitle: { ...Typography.h2, flex: 1 }`, added `Typography` to theme imports. (2) `CashFlowScreen` `headerTitle: { ...Typography.h3, color: Colors.text }` → `{ ...Typography.h3 }` — dropped redundant color override already provided by the token. |
| 2026-05-27 | Session-23 audit + Typography token cleanup pass | Full audit of all 8 files modified by build-agent session 23 (SettingsScreen company picker, SearchScreen history, MaterialsScreen/PartnersScreen/PurchaseOrdersScreen/SalesOrdersScreen PDF export, AlertsScreen, CashFlowScreen). All already clean: Feather icons, Colors tokens, hairline borders, no emojis, no shadows, no semantic hex values. Cleanup: removed redundant `color: Colors.text` overrides (already provided by Typography tokens) from `ErrorView`, `BiometricLockOverlay`, `ItemLedgerScreen` (×2), `CashFlowScreen` (×3), `PurchaseOrderDetailScreen`, `SalesOrderDetailScreen`. Replaced hand-crafted `{ fontSize: 22/20, fontWeight: '700', color: Colors.text }` inline styles with `...Typography.h1/h2` spread in `MaterialDetailScreen`, `ComparisonScreen`, `InventoryScreen`, `DashboardScreen`, `AlertsScreen`, and `ScreenHeader` (also added `Typography` import). |
| 2026-05-28 | Session-25 audit + KPICard + InventoryScreen sort label | Post-build audit of sessions 24–25 additions (Dashboard MoM trend, KPICard trend props, recently-viewed section, sparkline, supply chain snapshot, stock sort, stock ledger PDF). Two fixes: (1) `KPICard` trend color: removed `'#16a34a'` / `'#dc2626'` semantic green/red — now uses `Colors.textSecondary` for any non-zero trend; the trending-up/down Feather icon already conveys direction without color. (2) `InventoryScreen` sort label text: `'Qty ↑'` / `'Qty ↓'` unicode arrows simplified to `'Qty'` (direction shown by the adjacent Feather arrow-up/down icon). Zero semantic hex values remain anywhere in the codebase. |
| 2026-05-28 | Session-26 audit: TrialBalance icon fix + AP/AR search bar | Full post-build audit of sessions 25–26 additions (recently-viewed tracking, Account Statement screen, Dashboard PDF export). All new screens already clean. Two targeted fixes: (1) `TrialBalanceScreen` empty state icon: `Feather name="scale"` (not in Feather set — renders nothing) → `Feather name="book-open"` for correct icon rendering. (2) `AccountsPayableScreen` + `AccountsReceivableScreen` search inputs: wrapped bare `TextInput` in a proper bordered `searchBar` pill (matching the pattern used everywhere else in the app); `searchContainer` background changed from `Colors.background` (gray) to `Colors.surface` (white) with a hairline border at the bottom. Search inputs are now visually consistent across all screens. |
| 2026-05-29 | Session-27 audit: VendorDetail + CustomerDetail Ledger tab hairline fix | Full audit of all 4 files added/modified by build-agent session 27 (`VendorDetailScreen` Ledger tab, `CustomerDetailScreen` Ledger tab, `JournalEntriesScreen` account picker modal, `JournalEntryDetailScreen` tappable account lines + PDF export). All new code already clean: Feather icons, Colors tokens, hairline borders, Radius/Spacing/Typography tokens, no emojis, no shadows. Single fix applied to both detail screens: `ledgerTotalsRow.borderTopWidth: 1` → `StyleSheet.hairlineWidth` — the only raw non-hairline border added by the build agent this session. Codebase-wide grep confirms: zero emojis, zero semantic color hex values, zero `Shadow.*` usages, zero raw `borderWidth: 1` (only `hairlineWidth` and intentional unread-dot halos). |
| 2026-05-30 | Session-30 audit: analytics screen design fixes | Post-build audit of `ProcurementAnalyticsScreen` and `StockHealthScreen`. Two violations found and fixed: (1) `ProcurementAnalyticsScreen` `chartStyles.bar.borderRadius: 2` → `Radius.sm` — hardcoded pixel radius on vertical bar should use token. (2) `StockHealthScreen` `barStyles.warnText.color: '#6b7280'` → `Colors.textSecondary` — hardcoded semantic gray hex value not in the approved monochrome palette. All other styles already clean: Feather icons, hairline borders, Radius/Spacing/Typography tokens, no emojis, no shadows, no semantic fill colors. |
| 2026-05-30 | Session-31 audit: UpcomingDeliveriesSection + DeliveryCalendarScreen | Two components from sessions 28–29 had residual violations. `UpcomingDeliveriesSection`: removed `URGENCY_COLORS` (#dc2626/#d97706/#2563eb/#059669) and `URGENCY_BG` semantic background palette; urgency chip replaced with hairline-outline pill; urgencyText now Colors.textSecondary base / Colors.text+bold for overdue (matching DeliveryCalendarScreen pattern); SO type dot changed from #7c3aed (purple) → Colors.textSecondary; Shadow.card removed. `DeliveryCalendarScreen`: two residual `Shadow.card` spreads removed from orderCard (inline) and main calendar card (style block) — both already had hairline borders. Shadow removed from imports. Zero Shadow usages, zero semantic hex values remain anywhere in screens/ or components/. |
| 2026-05-30 | Session-32 audit: FinancialAnalyticsScreen + DeliveryCalendarScreen + DashboardScreen hairline pass | Full post-build audit of all files added/modified by build-agent session 32 (`FinancialAnalyticsScreen` new screen, `VendorDetailScreen` + `CustomerDetailScreen` aging breakdown charts, `JournalEntriesScreen` expandable narrations, `MoreMenuScreen` Financial Analytics entry). All session-32 additions already clean: Feather icons, Colors tokens, hairline borders, Radius/Spacing/Typography tokens, no emojis, no shadows. Four `borderWidth: 1` violations fixed: (1) `FinancialAnalyticsScreen` `netStyles.card` — session-32 addition with raw `borderWidth: 1` → `StyleSheet.hairlineWidth`. (2–3) `DeliveryCalendarScreen` `typeChip` and `navBtn` — residuals from session-28 build that survived prior audits → `StyleSheet.hairlineWidth`. (4) `DeliveryCalendarScreen` `todayBtn` — same origin → `StyleSheet.hairlineWidth`. (5) `DashboardScreen` alert notification dot `borderWidth: 1` → `StyleSheet.hairlineWidth`. Zero `borderWidth: 1` instances remain in screens/ or components/. |
| 2026-05-31 | Session-33 audit: Due Soon alerts + FinancialAnalytics drill-through | Full post-build audit of all files added/modified by build-agent session 33 (`AlertsScreen` due-soon bills/invoices sections, `FinancialAnalyticsScreen` AP/AR drill-through, `SettingsScreen` due-soon window setting, `OverdueContext` new fields, `AppNavigator` scheduleDueSoonReminder). All session-33 additions already clean: Feather clock icon for due-soon rows, dashed-border chip for "Xd left" badge, UPCOMING divider with hairline lines, `Colors.textSecondary` badge for due-soon count, `StyleSheet.hairlineWidth` borders throughout, Colors/Radius/Spacing/Typography tokens only. Single fix: `DeliveryCalendarScreen` `DOT_SHADES` palette had four raw hex literals (`#0a0a0a`, `#525252`, `#a3a3a3`, `#d4d4d4`) that survived all prior audits — replaced with `Colors.text`, `Colors.textSecondary`, `Colors.textMuted`, `Colors.border` respectively. `#d4d4d4` (neutral-300, no Colors token) is now `Colors.border` (#e5e7eb), maintaining the light-to-dark visual gradient while using only approved token values. Zero hardcoded hex values remain anywhere in screens/ or components/ (excluding `AGING_FILLS` graduated grayscale arrays which are intentional monochrome visualization). |
| 2026-05-31 | Session-34 audit: Dashboard Due Soon section + AP/AR filter chips + FinanceMenu due-soon badge | Full post-build audit of all files added/modified by build-agent session 34 (`DueSoonPaymentsSection` new component, `DashboardScreen` upcoming payments section, `AccountsPayableScreen` + `AccountsReceivableScreen` All/Overdue/Due Soon filter chips, `FinanceMenuScreen` due-soon outline badge, `SearchScreen` AP/AR result types). All new filter chip styles use `Radius.full` token, `StyleSheet.hairlineWidth`, `Colors.border`/`Colors.text` tokens, and `'#fff'` for white text on black active chips (intentional monochrome pattern, consistent with FilterChip/DateRangeBar). `FinanceMenuScreen` due-soon badge is outline-only (no fill) with `Colors.textSecondary` count — correctly differentiated from the filled overdue badge. Single fix: `DueSoonPaymentsSection` `kindDot.borderRadius: 999` → `Radius.full`. Zero hardcoded numeric borderRadius values remain anywhere in screens/ or components/. |
| 2026-06-01 | Session-35 audit: VendorDetailScreen + CustomerDetailScreen contact row + Dashboard Finance Health card + AP/AR pay-by/collect-by bar | Full post-build audit of all files added/modified by build-agent session 35 (`VendorDetailScreen` contact-info row + tappable phone/email/address, `CustomerDetailScreen` same, `DashboardScreen` Finance Health AR vs AP card + Upcoming Payments PDF export button, `AccountsPayableScreen` pay-by summary bar on bills tab, `AccountsReceivableScreen` collect-by summary bar on invoices tab). All session-35 additions already clean: Feather icons (phone/mail/map-pin/file-text), Colors tokens, `StyleSheet.hairlineWidth` borders, `Radius` tokens, `Spacing` tokens, `Typography` tokens, no emojis, no shadows. Three fixes applied: (1) `VendorDetailScreen` `timelineDot.borderRadius: 5` → `Radius.full`. (2) `CustomerDetailScreen` same fix. (3) `UpcomingDeliveriesSection` `typeDot.borderRadius: 999` → `Radius.full`. Zero hardcoded numeric `borderRadius` values remain anywhere in `screens/` or `components/`. |
| 2026-06-01 | Session-36 audit — all clean | Full post-build audit of all files added/modified by build-agent session 36 (`MonthlyBalanceChart` new component, `WeeklyScheduleCard` new component, `VendorDetailScreen` 6-month trend chart + recently-viewed tracking, `CustomerDetailScreen` same, `AccountsPayableScreen` weekly payment schedule, `AccountsReceivableScreen` weekly collection schedule, `DashboardScreen` vendor/customer recently-viewed navigation, `PartnersScreen` tappable call/email contacts). All session-36 additions already clean: `MonthlyBalanceChart` uses Colors/Radius/Spacing tokens, bar fill uses `Colors.border`/`Colors.text`, no semantic colors. `WeeklyScheduleCard` uses `StyleSheet.hairlineWidth`, Colors tokens, Radius tokens throughout. Vendor/Customer `trendCard` style uses `hairlineWidth`, `Colors.surface`, `Colors.border`, `Colors.textMuted`. `PartnersScreen` tappable contacts use `Colors.textSecondary + textDecorationLine: 'underline'` — conveys interactivity without color change. Codebase-wide grep confirms: zero emojis, zero `Shadow.*` usages, zero raw `borderWidth: 1`, zero non-approved hex literals, zero raw numeric `borderRadius` values. |
| 2026-06-02 | Session-37 audit + icon deduplication fix | Full post-build audit of all files added/modified by build-agent session 37 (AP/AR bill/invoice flag system, PO delivery approaching notifications, CSV export for Trial Balance and Journal Entries). All session-37 additions already clean: Feather star icon for flag toggle, `Colors.text`/`Colors.borderLight`/`Colors.textSecondary` tokens used correctly, `StyleSheet.hairlineWidth` borders, `refreshChip`/`refreshChipActive` styles follow existing patterns. Two icon deduplication fixes: (1) `MoreMenuScreen` "Financial Analytics" icon changed `dollar-sign` → `sliders` — `dollar-sign` was already used for "Accounts Receivable" in the same screen's Finance section, creating visual ambiguity. (2) `DashboardScreen` "Analytics" quick action icon changed `trending-up` → `bar-chart` — `trending-up` was already used for "Cash Flow" in the same quick-action grid, making both items appear identical. Codebase-wide grep confirms: zero emojis, zero `Shadow.*` usages, zero raw `borderWidth: 1`, zero non-approved hex literals, zero raw numeric `borderRadius` values. |
| 2026-06-02 | Session-38 audit: DashboardScreen Pending Actions card color fix | Full post-build audit of all files added/modified by build-agent session 38 (StockHealth item drill-down modal, Dashboard Pending Actions card, AP/AR bills/invoices CSV export). `StockHealthScreen` drill-down modal already clean: Colors/Radius/Spacing tokens, `StyleSheet.hairlineWidth`, Feather icons, `rgba(0,0,0,0.35)` backdrop (intentional overlay), no semantic colors. `SectionHeader` action prop + AP/AR CSV export buttons already clean: `Radius.sm`, `StyleSheet.hairlineWidth`, `Colors.border`/`Colors.textSecondary`. Four fixes in `DashboardScreen` Pending Actions card: (1) `pendingIconWarn.backgroundColor: '#fef3c7'` (amber tint) → `Colors.surfaceHover`. (2) `pendingIconBlue.backgroundColor: '#dbeafe'` (blue tint) → `Colors.surfaceHover`. (3) `Feather star color="#b45309"` (amber) on Flagged Bills row → `Colors.textSecondary`. (4) `Feather star color="#1d4ed8"` (blue) on Flagged Invoices row → `Colors.textSecondary`. Also fixed: `pendingInboxDot.borderRadius: 3` → `Radius.full`; `pendingBadge.borderRadius: 11` → `Radius.full`. Codebase-wide grep confirms: zero emojis, zero `Shadow.*` usages, zero raw `borderWidth: 1`, zero non-approved hex literals, zero raw numeric `borderRadius` values. |
| 2026-06-03 | Sessions-39-40 audit + pdfExport.ts semantic color sweep | Full post-build audit of all files added/modified by build-agent sessions 39–40 (`StockHealthScreen` out-of-stock list section, `AccountsPayableScreen` + `AccountsReceivableScreen` reviewed state + batch clear actions + flagged PDF button, `VendorDetailScreen` + `CustomerDetailScreen` notes tab + reviewed bills/invoices, `PartnersScreen` partner notes modal, `pdfExport.ts` out-of-stock PDF section + flagged bills/invoices PDF functions). All screen/component additions already clean: Feather icons (check-circle, x-circle, edit-2), Colors tokens, `StyleSheet.hairlineWidth` borders, `Radius` tokens, `rgba(0,0,0,0.4)` modal backdrop (intentional overlay), no emojis, no shadows, no raw numeric borderRadius. Six fixes in `pdfExport.ts` HTML strings: (1) `style="background:#f0faf0"` (green tint) removed from "✓ Balanced" divs in JE and TB PDF exports. (2) `style="color:#c00"` (red) removed from "Out of Stock Items" section label. (3) `style="color:#c00"` (red) removed from out-of-stock qty cell — replaced with `font-weight:700`. (4–5) `style="color:#c00"` (red) removed from overdue amount cells in Financial Analytics vendor/customer rows. (6) `style="color:#c00"` (red) removed from negative net cash impact value. (7–8) `color:#16a34a` (green) and `color:#dc2626` (red) removed from stock ledger in-qty/out-qty spans and summary values. Zero semantic color values remain anywhere in pdfExport.ts HTML strings. |
| 2026-06-04 | Session-42 audit: pdfExport out-of-stock PDF + ProcurementAnalyticsScreen button state | Full post-build audit of all files added/modified by build-agent session 42 (`ProcurementAnalyticsScreen` date range filter + `SectionHeader` subtitle prop, `DashboardScreen` top vendors card, `StockHealthScreen` out-of-stock PDF export, `pdfExport.ts` out-of-stock reorder PDF + AP/AR combined flagged items PDF). `SectionHeader` subtitle prop clean. `DashboardScreen` top vendors card clean: Colors/Radius/Spacing tokens, `StyleSheet.hairlineWidth` throughout. `StockHealthScreen` PDF export button clean. `exportFlaggedCombinedPDF` clean: `font-weight:600` for overdue rows, no semantic colors. Three fixes: (1) `pdfExport.ts` `exportOutOfStockPDF` row status cell: `style="color:#c00;font-weight:700"` → `style="font-weight:700"` — red removed, weight retained. (2) Same fix on out-of-stock count summary tile. (3) `ProcurementAnalyticsScreen` `iconBtnActive`: `backgroundColor: Colors.primaryLight` (dark gray #525252, making black icon invisible) → `backgroundColor: Colors.text`; badge and icon color → `'#fff'` — now matches the standard black-fill / white-content active chip pattern used throughout the app. Codebase-wide grep confirms: zero emojis, zero `Shadow.*` usages, zero raw `borderWidth: 1`, zero semantic hex color values, zero raw numeric `borderRadius` values. |
| 2026-06-06 | Session-43 audit + AP/AR filter chip overflow fix | Full post-build audit of all files added/modified by build-agent session 43 (`DashboardScreen` Top Customers card, `ProcurementAnalyticsScreen` count/value toggle, `FinancialAnalyticsScreen` 6-month AP vs AR chart). All three session-43 additions already clean: `DashboardScreen` topCustomerBarFill uses `Colors.textSecondary`, all tokens throughout. `ProcurementAnalyticsScreen` modeChipTextActive `color: '#fff'` is the correct white-on-black pattern. `FinancialAnalyticsScreen` MonthlyNetChart uses `Colors.textSecondary` for AP bars and `Colors.text` for AR bars — correctly monochrome. `pdfExport.ts` confirmed all-grayscale (no semantic colors). One visual fix applied to both `AccountsPayableScreen` and `AccountsReceivableScreen`: the Bills/Invoices tab `filterChips` row (6 chips: All, Overdue, Due Soon, ★, ✓, 📅) was a plain `View` and would clip on narrow screens (~370pt content vs ~343pt usable). Changed to `ScrollView horizontal showsHorizontalScrollIndicator={false}` with `keyboardShouldPersistTaps="handled"` and added `paddingRight: Spacing.md` to trailing edge — matches the same pattern used in `DateRangeBar`. All chips now accessible by scrolling on any screen width. |
| 2026-06-07 | Session-44 audit + compact chart legend readability fix | Full post-build audit of all files added/modified by build-agent session 44 (`DashboardScreen` AgingMiniBar component, `FinancialAnalyticsScreen` AgingDeltaRow component). Both new components confirmed clean: `AGING_MICRO_FILLS` uses graduated grayscale `['#d1d5db','#9ca3af','#6b7280','#374151','#111827']` (intentional monochrome visualization), all layout styles use Colors/Radius/Spacing tokens, `StyleSheet.hairlineWidth` borders, Feather icons, no emojis, no shadows. One readability fix across both screens: four compact chart legend text elements were set to `fontSize: 9` — below the design system's 11pt minimum for labels and visibly illegible at arm's length. Bumped to `fontSize: 10` in `agingMicroStyles.legendLabel` + `legendAmt` (`DashboardScreen`) and `netChartStyles.netLabel` + `deltaStyles.bucketLabel` (`FinancialAnalyticsScreen`). These dense mini-chart elements need compactness but 10pt preserves readability within the `flexWrap` legend layout. Codebase-wide grep confirms: zero emojis, zero `Shadow.*` usages, zero raw `borderWidth: 1`, zero semantic hex color values, zero raw numeric `borderRadius` values. |
| 2026-06-07 | Session-45 audit: ProcurementAnalytics bucket label readability fix | Full post-build audit of all files added/modified by build-agent session 45 (`JournalEntriesScreen` JESummaryCard, `FinancialAnalyticsScreen` TurnoverCard DSO/DPO/CCC, `ProcurementAnalyticsScreen` ValueDistributionChart). `JESummaryCard` clean: all styles use Colors tokens, `StyleSheet.hairlineWidth`, `Radius.md`/`Radius.full`/`Spacing` tokens; `typeBadge` at 10pt is acceptable for compact bar-chart label. `TurnoverCard` clean: `tileLabel`/`tileSub` at 10pt acceptable for compact metric tiles; `cccBad` uses `Colors.text`, `cccGood` uses `Colors.textSecondary` — correct monochrome status differentiation by weight not semantic color. `ValueDistributionChart` all styles clean (Colors/Radius/StyleSheet tokens) except one violation: `distStyles.bucketLabel: { fontSize: 9 }` — same below-floor pattern fixed last session. Fixed: bumped to `fontSize: 10, lineHeight: 13` (matches `netChartStyles.monthLabel` pattern). `pdfExport.ts` unchanged this session. Codebase-wide grep confirms: zero emojis, zero `Shadow.*` usages, zero raw `borderWidth: 1`, zero semantic hex color values, zero raw numeric `borderRadius` values. |
| 2026-06-08 | Session-47 audit: chart date/month label readability fix | Full post-build audit of all files added/modified by build-agent session 47 (`FinancialAnalyticsScreen` 30-day AP/AR aging history trend chart, `DashboardScreen` month-over-month AP/AR billing comparison card, `ProcurementAnalyticsScreen` avg order value in vendor/customer lists). `ProcurementAnalyticsScreen` additions clean: `avg` style uses `fontSize: 10`, Colors tokens. Six `fontSize: 9` violations found and fixed across two files: (1) `FinancialAnalyticsScreen` `historyStyles.dateLabel` (new in session-47, date axis labels under aging history bars) bumped 9→10. (2) `FinancialAnalyticsScreen` `netStyles.colLabel` (pre-existing, survived prior audits, column headers "RECEIVABLE (AR)" / "PAYABLE (AP)" / "NET POSITION") bumped 9→10. (3) `DashboardScreen` `momStyles.monthLabel` (new in session-47, month column headers in MoM comparison card) bumped 9→10. (4) `DashboardScreen` `alertsDotText` (pre-existing badge count dot) bumped 9→10. (5) `DashboardScreen` `fhLegendLabel` (pre-existing Finance Health chart legend) bumped 9→10. (6) `DashboardScreen` `quickBadgeText` (pre-existing quick-action badge count) bumped 9→10. Codebase-wide grep confirms: zero `fontSize: 9` usages remain anywhere in screens/ or components/. |
| 2026-06-08 | Deep codebase sweep: fontSize + borderRadius token pass | Full sweep of all screens and components not yet caught by per-session audits. 12 `fontSize: 9` violations found and fixed across 10 files: `PODetailScreen` (`qtyLabelText`), `AccountsPayableScreen` (`payByLabel`), `AccountsReceivableScreen` (`payByLabel`), `VendorDetailScreen` (`ledgerTypeChip`), `CustomerDetailScreen` (`ledgerTypeChip`), `AccountStatementScreen` (`voucherType`), `SearchScreen` (`badgeText`), `MoreMenuScreen` (`bellBadgeText`), `VoucherSparkline` (`label` + `count`), `MonthlyBalanceChart` (`valueLabel` + `monthLabel`) — all bumped to `fontSize: 10`. Three raw numeric `borderRadius` violations fixed: `JournalEntriesScreen` `legendDot: 3` → `Radius.full`, `JournalEntriesScreen` `bar: 2` → `Radius.sm`, `StockHealthScreen` `legendDot: 3` → `Radius.full`. Codebase-wide grep confirms: zero `fontSize: 9`, zero raw numeric `borderRadius`, zero `Shadow.*`, zero raw `borderWidth: 1`, zero semantic hex color values remain anywhere in screens/ or components/. |
