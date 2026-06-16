# Mobile App Progress

### UI Polish Log (Monochrome)

- **2026-06-16** — Session-89 audit: DashboardScreen `NWCTrendCard` fontSize 9 → 10 for `monthLabel` + `nwcVal`; VendorRankCard (PO) and CustomerCollectionRateCard (AR) clean — all Colors tokens, hairline borders, no semantic colors.

## Session 90 — 2026-06-16

### Completed This Session

**SalesOrders — Customer Revenue Ranking Card** (`src/screens/salesOrders/SalesOrdersScreen.tsx`)
- `customerRevenue` useMemo: groups all orders by customer name, sums `total` per customer, sorts descending, retains top 5
- `CustomerRevenueCard` component: ranked list (#1–5) with customer name, proportional bar, total revenue and SO count
- Bar proportional to `total / maxTotal`; hairline track with `Colors.text` fill; `as any` cast for percentage width
- Shown in All (register) tab when `customerRevenue.length >= 2` and no active search text; `crStyles` monochrome

**Dashboard — 7-Day Cash Flow Forecast Chart** (`src/screens/dashboard/DashboardScreen.tsx`)
- `cashFlowForecast` useMemo: iterates next 7 days, per-day AR = sum of `due30Invoices` matching date, AP = sum of `due30Bills` matching date
- `CashFlowForecastChart` component: for each of 7 days, two mini bars side-by-side (AR = `Colors.text`, AP = `Colors.textSecondary`)
- Bar height proportional to `amount / maxAmt × 40px`, minimum 3px when amount > 0; Today column highlighted with `Colors.background`
- Legend in header row (dark dot = AR, gray dot = AP); guarded by `hasAny` check
- Placed between `NetCashFlowCard` and `WeekAtAGlanceStrip`; `cffStyles`: monochrome, hairline borders, no shadows

### Next Session
- Consider: JournalEntries — account-level drill: tap a voucher type segment to also filter by account
- Consider: AccountsPayable — vendor payment velocity display: show `avgTermsDays` as "avg Xd terms" on each VendorCard
- Consider: Dashboard — Collections vs Payments 7-day forecast already done; next: overdue aging heatmap
- Consider: SalesOrders — period comparison: toggle current vs prior period total with % change badge
- Consider: Inventory — reorder suggestion card: items where qty < reorder threshold

---

## Session 89 — 2026-06-16

### Completed This Session

**PurchaseOrders — Vendor Performance Ranking Card** (`src/screens/purchaseOrders/PurchaseOrdersScreen.tsx`)
- `vendorPerf` useMemo: groups all orders by vendor name computing `total`, `completed` (CLOSED/CANCELLED/RECEIVED/COMPLETE), `overdue` (open with past `delivery_date`) counts
- `rate` = `Math.round(completed / total * 100)` — sorts descending by rate then total; top 5 vendors retained
- `VendorRankCard` component: rank number, vendor name + completion bar, rate % + PO count, optional overdue pill badge
- Shown in All tab below `DeliveryPerfCard` when `vendorPerf.length >= 2`
- `vrStyles`: monochrome card with `Colors.text` bar fill and `Colors.surfaceHover` overdue pill

**Dashboard — Net Working Capital Trend Card** (`src/screens/dashboard/DashboardScreen.tsx`)
- `NWCTrendCard`: derives `nwcBuckets = [{ label, nwc: arAmount - apAmount }]` from existing `dashMonthlyBuckets`
- 6-bar vertical chart: bar height proportional to `|nwc|/maxAbs * 36px`; positive months → `Colors.text` fill, negative months → `Colors.textSecondary` fill
- Header row: title "Net Working Capital" + latest month NWC with +/− prefix (K/M shorthand via `fmtShort`)
- Hint text: "AR billed − AP billed · 6-month"; placed immediately after `<DashMonthlySparkline>` in AP vs AR section
- `nwcStyles`: monochrome, Radius.md card, all Colors/Spacing/Radius tokens

**AccountsReceivable — Customer Collection Rate Card** (`src/screens/finance/AccountsReceivableScreen.tsx`)
- `customerCollectionStats` useMemo: groups invoices by customer name; sums `amount` (totalInvoiced) and `paid` (totalPaid); `overallRate = grandPaid/grandInvoiced*100`; `top3` sorted by rate then totalInvoiced
- `CustomerCollectionRateCard` component: header "Collection Rate" + trending-up icon
  - KPI row: Collected % / Total Paid / Outstanding with hairlineWidth dividers
  - Full-width progress bar (filled = overallRate %)
  - "TOP COLLECTORS" section: ranked list of top-3 customers with name, mini rate bar, % and invoice count
- `CollectionStats` interface; `ccrStyles`: monochrome card with hairlineWidth dividers throughout
- Shown in Customers tab before SectionHeader, hidden when `customerSearch` is active; guarded by `grandInvoiced > 0 && top3.length > 0`

### Next Session
- Consider: JournalEntries — account-level drill: tap a voucher type segment to also filter by account (combine type + account filters in one tap)
- Consider: AccountsPayable — vendor payment velocity: compute avg days from bill creation to expected payment (due_date − dt) per vendor; show in VendorCard as "avg Xd terms"
- Consider: Dashboard — Collections vs Payments 7-day forecast: side-by-side bar comparing AR collections due vs AP payments due for next 7 days by day of week
- Consider: SalesOrders — customer revenue ranking: top-5 customers by total SO amount with trend vs prior period
- Consider: Inventory — reorder suggestion card: items where qty < avg daily usage × lead time (if lead time configurable)

---

## Session 88 — 2026-06-15

### Completed This Session

**SalesOrders — Fulfillment Status Card** (`src/screens/salesOrders/SalesOrdersScreen.tsx`)
- `deliveryPerf` useMemo: iterates all orders; CLOSED/CANCELLED/DELIVERED/COMPLETE → `completedCount`; open orders: `delivery_date` in past → `overdueCount`, ≤7d → `thisWeekCount`, 7d+ → `onTrackCount`
- `DeliveryPerfCard` component: header row with package icon + "Fulfillment Status" title; tile grid with large number + label + sub-description per non-zero bucket; Fulfilled tiles use `tileValueDim` (textSecondary) to de-emphasize
- Shown in 'register' (All) tab above Orders SectionHeader; guarded by `orders.length > 0`
- `dpStyles`: monochrome card/tile/label styles; no shadows, no raw hex, all Colors tokens
- Mirrors the PO `DeliveryPerfCard` added in session 86

**Dashboard — Net Cash Flow Card** (`src/screens/dashboard/DashboardScreen.tsx`)
- `net7Flow` useMemo: sums `outstanding ?? amount ?? 0` from `due30Bills` and `due30Invoices` where days-to-due is 0–7; returns `{ arAmt, apAmt, net }`
- `NetCashFlowCard` component: header with trending-up icon + "Next 7 Days — Cash Flow" title; 3-cell row (AR In / AP Out / Net) separated by hairline dividers; AR and AP cells are `TouchableOpacity` navigating to their respective screens
- Net cell: `Colors.background` background to distinguish from flanking cells; negative net shown in `Colors.textSecondary`; positive net prefixed '+'
- Placed between `DueTodayCard` and `WeekAtAGlanceStrip`; guarded by `arAmt > 0 || apAmt > 0`
- `ncfStyles`: monochrome, Radius.lg card, all Colors tokens

**AccountsPayable — Vendor Payment Rate Card** (`src/screens/finance/AccountsPayableScreen.tsx`)
- `vendorPaymentStats` useMemo: per-vendor `totalBilled`, `totalPaid`, `billCount`, `paymentRate` (%), `avgTermsDays` (avg of due_date–dt for bills with both dates); overall rate and avg terms across all vendors; `topPayers` = top-3 by payment rate; `vendorRateMap` for per-card lookup
- `VendorPaymentRateCard` component: KPI row (% Paid / Total Paid / Outstanding), proportional bar track (Colors.text fill), top-3 vendor payment rate list with footer label
- `VendorCard`: gains `paymentRate?: number` prop; renders a "X% paid" pill badge in card header between bill count and chevron
- Shown above Vendors `SectionHeader` in Vendors tab; guarded by `vendors.length > 0`
- `vprStyles`: monochrome layout using Colors/Radius/Spacing tokens; `hairlineWidth` dividers; no shadows
