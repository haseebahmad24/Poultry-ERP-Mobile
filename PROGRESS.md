# Mobile App Progress

## Session 1 — 2026-05-12

### Completed

**Project Scaffolding**
- Initialized Expo 51 / React Native 0.74 project in `/mobile`
- TypeScript configured with `@/` path aliases
- `babel-plugin-module-resolver` set up for clean imports
- `.gitignore` for mobile artifacts

**Design System (`src/theme/index.ts`)**
- Full color palette matching the web app (blues, greens, reds, oranges)
- Voucher type badge colors (JV, GRN, DN, PAY, REC, INV, SO, PO)
- Spacing, border radius, shadow, and typography scales

**Utilities (`src/utils/currency.ts`)**
- `formatCurrency(amount)` — PKR with M/B abbreviations for large numbers
- `formatDate` / `formatShortDate` helpers

**API Layer**
- `src/api/client.ts` — Fetch wrapper with `expo-secure-store` JWT token storage; attaches `Cookie: auth_token=...` header to all requests. Configure `EXPO_PUBLIC_API_URL` env var to point at the Next.js server.
- `src/api/auth.ts` — `fetchEmployees()`, `loginAs(id)` (captures `Set-Cookie` token), `logout()`
- `src/api/dashboard.ts` — `fetchDashboardData(companyId?)` calling `/api/dashboard`

**New Web API Endpoint**
- `src/app/api/dashboard/route.ts` — GET endpoint returning `{ kpis, recentVouchers }`. Requires valid JWT in `Cookie` or `Authorization: Bearer` header. Queries same DB as the home page server component.

**Auth Context (`src/context/AuthContext.tsx`)**
- React context with `loginAs` / `logout` actions
- Restores session from stored JWT on app start (decodes payload without re-fetching)
- `useAuth()` hook

**Shared Components**
- `LoadingView` — centered spinner with optional message
- `ErrorView` — error message with retry button
- `KPICard` — metric card (label / value / subtext, optional tap handler)
- `SectionHeader` — section title + optional right-side meta text

**Login Screen (`src/screens/auth/LoginScreen.tsx`)**
- Fetches all employees from `/api/employees`
- Displays a card list with avatar initials, name, email, and role badge
- Tap to login as that user (POST `/api/auth/switch`, stores JWT)
- Loading and error states with retry

**Dashboard Screen (`src/screens/dashboard/DashboardScreen.tsx`)**
- Top bar with greeting (morning/afternoon/evening), user name/role, sign out button
- Pull-to-refresh
- 3×2 grid of KPI cards: Revenue, Expenses, Net Income, Cash & Bank, Receivables, Payables
- Working Capital panel (Cash + AR − AP = Net)
- Quick Actions grid (Journal Entry, Purchase Order, Sales Order, GRN, Trial Balance, Inventory)
- Recent Activity list (last 20 vouchers with type badge, number, date, amount, status)

**Navigation (`src/navigation/`)**
- `AuthNavigator` — native stack with Login screen
- `AppNavigator` — bottom tabs: Dashboard, Inventory (placeholder), Finance (placeholder), More (placeholder)
- `RootNavigator` — switches between Auth/App based on `AuthContext` state

**App Entry (`App.tsx`)**
- `SafeAreaProvider` → `AuthProvider` → `RootNavigator`

---

## What's Next (Session 2)

Priority order per the task spec:

1. **Inventory** screen — stock balance by material/warehouse, filter by company
2. **Materials** screen — list and detail view for material master
3. **Purchase Orders** screen — list and status overview
4. **GRN (Goods Receipt Note)** screen — list + detail
5. Navigation wiring for Quick Action tiles on Dashboard

### Setup Notes

- Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your Next.js dev server LAN IP:
  ```
  EXPO_PUBLIC_API_URL=http://192.168.1.x:3000
  ```
- Run `npm install --legacy-peer-deps` inside `mobile/` before first start
- Start with `npm run start` from `mobile/`, then scan the QR with Expo Go

---

## Screen Inventory

| Screen | Status |
|---|---|
| Login (user selector) | ✅ Done |
| Dashboard / Home | ✅ Done |
| Inventory | 🔲 Next |
| Materials | 🔲 Next |
| Purchase Orders | 🔲 Planned |
| GRN | 🔲 Planned |
| Accounts Payable | 🔲 Planned |
| Accounts Receivable | 🔲 Planned |
| Journal Entries | 🔲 Planned |
| Trial Balance | 🔲 Planned |
| Financial Statements | 🔲 Planned |
| Business Partners | 🔲 Planned |
| Companies | 🔲 Planned |
| Users / Admin | 🔲 Planned |
