# Mobile App Progress

## Session 1 — 2026-05-12

### Completed

**Project Scaffolding**
- Initialized Expo 51 / React Native 0.74 project
- TypeScript with `@/` path aliases via `babel-plugin-module-resolver`

**Design System (`src/theme/index.ts`)**
- Full color palette matching web app
- Voucher badge colors, spacing, radius, shadow, typography scales

**Utilities (`src/utils/currency.ts`)**
- `formatCurrency`, `formatDate`, `formatShortDate`

**API Layer**
- `src/api/client.ts` — fetch wrapper with JWT via `Cookie` header
- `src/api/auth.ts` — `fetchEmployees()`, `loginAs(id)`, `logout()`
- `src/api/dashboard.ts` — `fetchDashboardData(companyId?)`

**Shared Components**
- `LoadingView`, `ErrorView`, `KPICard`, `SectionHeader`

**Login Screen** — Employee card list, tap to login, stores JWT

**Dashboard Screen** — KPI grid, Working Capital panel, Quick Actions, Recent Vouchers

**Navigation** — `AuthNavigator`, `AppNavigator` (bottom tabs), `RootNavigator`

---

## Session 2 — 2026-05-16

### Completed

**API Services**
- `src/api/inventory.ts` — `fetchStockBalances()`, `fetchStockLedger()`, `fetchInventoryItems()`
- `src/api/materials.ts` — `fetchMaterials()`, `fetchMaterialTypes()`
- `src/api/purchaseOrders.ts` — `fetchPurchaseOrders()`, `fetchPODetail()`

**Inventory Screen (`src/screens/inventory/InventoryScreen.tsx`)**
- In-screen tabs: Stock Balances | Stock Ledger
- Stock tab: summary strip (count/total value), search bar, item cards with warehouse/category/quantity/value
- Ledger tab: transaction rows with voucher badge, qty in/out/balance
- Pull-to-refresh; lazy-loads Ledger on first tab switch

**Materials Screen (`src/screens/materials/MaterialsScreen.tsx`)**
- Search bar (name/code/type/description)
- Status filter chips: All / Active / Inactive
- Type filter horizontal scroll pills
- Material cards with icon, name, code, unit, type badge, active/inactive indicator
- Pull-to-refresh

**Purchase Orders Screen (`src/screens/purchaseOrders/PurchaseOrdersScreen.tsx`)**
- Horizontal status tabs: All / Open / Approved / Closed / Draft with live counts
- PO cards: number badge, vendor, date, status badge, amount, receiving progress bar
- Tap → navigates to PO Detail

**PO Detail Screen (`src/screens/purchaseOrders/PODetailScreen.tsx`)**
- PO header info (number, status, vendor, date, company, total)
- Receiving progress card with stats + large progress bar
- Line items list with ordered/received/balance quantities, mini progress bars
- Notes section

**Navigation Wiring (`src/navigation/AppStack.tsx`)**
- New `AppStack` native stack wrapping tabs + feature screens
- Dashboard Quick Actions wired: Inventory ✅, Materials ✅, Purchase Order ✅
- Disabled (not yet built): Journal Entry, Sales Order, GRN, Trial Balance

---

## Screen Inventory

| Screen | Status |
|---|---|
| Login (user selector) | ✅ Done |
| Dashboard / Home | ✅ Done |
| Inventory (Stock + Ledger) | ✅ Done |
| Materials | ✅ Done |
| Purchase Orders (list + detail) | ✅ Done |
| Sales Orders | 🔲 Next |
| GRN / Goods Receipt | 🔲 Next |
| Accounts Payable | 🔲 Planned |
| Accounts Receivable | 🔲 Planned |
| Journal Entries | 🔲 Planned |
| Trial Balance | 🔲 Planned |
| Financial Statements | 🔲 Planned |
| Business Partners | 🔲 Planned |
| Companies | 🔲 Planned |

---

## What's Next (Session 3)

Per roadmap **Phase 2: Sales & Delivery**:

1. **Sales Orders Screen** — status tabs (Open/Approved/Closed), detail view with line items. API: `/api/mobile/sales-orders`
2. **GRN Screen** — received POs with quantities. Reuse purchase-orders endpoint with `?view=progress`

Then **Phase 3: Finance**:
3. **Accounts Payable Screen** — summary dashboard, vendor list, bills list
4. **Accounts Receivable Screen** — same pattern as AP

### Setup Notes
- Set `EXPO_PUBLIC_API_URL` in `.env` to your Next.js server URL
- Run with `npx expo start` then scan QR with Expo Go
