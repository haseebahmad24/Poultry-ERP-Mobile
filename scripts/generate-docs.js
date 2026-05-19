const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType,
} = require("docx");
const fs = require("fs");

const BLUE = "0A6ED1";
const DARK = "1D2D3E";
const GRAY = "546E7A";
const LIGHT_BG = "F0F4F8";
const WHITE = "FFFFFF";
const GREEN = "2E7D32";

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 120 }, children: [new TextRun({ text, bold: true, color: DARK })] });
}

function body(text, opts = {}) {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, size: 22, color: opts.color || DARK, ...opts })] });
}

function bullet(text, level = 0) {
  return new Paragraph({ bullet: { level }, spacing: { after: 40 }, children: [new TextRun({ text, size: 22, color: DARK })] });
}

function tableCell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.header ? { type: ShadingType.SOLID, color: BLUE } : opts.alt ? { type: ShadingType.SOLID, color: LIGHT_BG } : undefined,
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text, size: 20, bold: !!opts.header, color: opts.header ? WHITE : DARK })] })],
  });
}

function tableRow(cells, opts = {}) {
  return new TableRow({ children: cells.map((c, i) => tableCell(c, { ...opts, width: opts.widths?.[i] })) });
}

const doc = new Document({
  creator: "Poultry ERP Team",
  title: "Poultry ERP Mobile App — Feature Documentation",
  description: "Comprehensive documentation of the React Native mobile app for Poultry ERP",
  sections: [{
    properties: {},
    children: [
      // Title
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Poultry ERP Mobile App", bold: true, size: 48, color: BLUE })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Feature Documentation & Implementation Guide", size: 28, color: GRAY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: `Generated: ${new Date().toISOString().slice(0, 10)}`, size: 20, color: GRAY, italics: true })] }),

      // 1. Overview
      heading("1. Project Overview"),
      body("The Poultry ERP Mobile App is a React Native (Expo) application that provides mobile access to the Poultry ERP system. It connects to the same PostgreSQL backend as the Next.js web application through dedicated REST API endpoints."),
      body(""),
      heading("1.1 Technology Stack", HeadingLevel.HEADING_2),
      bullet("React Native 0.74 with Expo SDK 51"),
      bullet("TypeScript for type safety"),
      bullet("React Navigation 6 (native stack + bottom tabs)"),
      bullet("Expo Secure Store for JWT token storage"),
      bullet("Custom fetch-based API client with cookie auth"),
      body(""),
      heading("1.2 Repository", HeadingLevel.HEADING_2),
      bullet("Mobile App: github.com/haseebahmad24/Poultry-ERP-Mobile"),
      bullet("Web App (Backend): github.com/haseebahmad24/Poultry-ERP-Next-JS"),

      // 2. Architecture
      heading("2. Architecture"),
      heading("2.1 Authentication Flow", HeadingLevel.HEADING_2),
      body("The mobile app uses the same JWT-based authentication as the web app:"),
      bullet("User selects an employee from the login screen"),
      bullet("App calls POST /api/auth/switch with the employee ID"),
      bullet("Server returns a JWT token in the response body"),
      bullet("Token is stored in Expo Secure Store (encrypted device storage)"),
      bullet("All subsequent API calls include the token as Cookie: auth_token=<token>"),
      bullet("AuthContext manages state: loading → unauthenticated → authenticated"),
      body(""),
      heading("2.2 Navigation Architecture (Updated Session 2)", HeadingLevel.HEADING_2),
      body("The app uses a two-level navigation structure:"),
      bullet("AppStack (native stack) — root navigator when authenticated"),
      bullet("  Tabs screen — bottom tab navigator (Dashboard, Inventory, Finance, More)", 1),
      bullet("  Inventory screen — full-screen stock/ledger view pushed from quick actions", 1),
      bullet("  Materials screen — materials list pushed from quick actions", 1),
      bullet("  PurchaseOrders screen — PO list pushed from quick actions", 1),
      bullet("  PODetail screen — PO detail pushed from PO list", 1),
      bullet("AuthNavigator (native stack) — Login screen when unauthenticated"),
      body(""),
      heading("2.3 API Layer", HeadingLevel.HEADING_2),
      body("The web app exposes dedicated REST endpoints under /api/mobile/ for the mobile app. Each endpoint accepts query parameters for filtering and returns JSON. Authentication is required on all endpoints."),
      body(""),

      // API Endpoints Table
      heading("2.4 Backend API Endpoints", HeadingLevel.HEADING_2),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          tableRow(["Endpoint", "Method", "Parameters", "Returns"], { header: true, widths: [30, 8, 32, 30] }),
          tableRow(["/api/employees", "GET", "—", "{ employees[] } — user list for login"]),
          tableRow(["/api/auth/switch", "POST", "{ id }", "{ ok, token, user }"], { alt: true }),
          tableRow(["/api/dashboard", "GET", "?company_id", "{ kpis, recentVouchers[] }"]),
          tableRow(["/api/mobile/inventory", "GET", "?view=stock|items|warehouses|uoms|categories|ledger, ?company_id, ?item_id, ?warehouse_id, ?from, ?to", "Stock balances, items, warehouses, ledger entries"], { alt: true }),
          tableRow(["/api/mobile/materials", "GET", "?view=list|types|views, ?company_id, ?type_id, ?status", "Materials list, material types"]),
          tableRow(["/api/mobile/purchase-orders", "GET", "?view=all|open|progress, ?status, ?id", "Purchase orders, PO progress"], { alt: true }),
          tableRow(["/api/mobile/sales-orders", "GET", "?view=open|approved|closed|detail|register, ?id, ?company_id", "Sales orders by status"]),
          tableRow(["/api/mobile/accounts-payable", "GET", "?view=summary|bills|vendors|drafts|due, ?company_id", "AP totals, aging, bills, vendors"], { alt: true }),
          tableRow(["/api/mobile/accounts-receivable", "GET", "?view=summary|invoices|customers|drafts, ?company_id", "AR totals, aging, invoices, customers"]),
          tableRow(["/api/mobile/journal-entries", "GET", "?company_id, ?from, ?to, ?account, ?type", "Journal entries"], { alt: true }),
          tableRow(["/api/mobile/trial-balance", "GET", "?company_id, ?as_of", "Trial balance rows"]),
          tableRow(["/api/mobile/partners", "GET", "?company_id", "Business partners"], { alt: true }),
          tableRow(["/api/mobile/companies", "GET", "—", "Companies list"]),
        ],
      }),

      // 3. Implemented Features
      heading("3. Implemented Features (Sessions 1–2)"),

      heading("3.1.1 Project Scaffolding", HeadingLevel.HEADING_3),
      bullet("Expo 51 / React Native 0.74 project initialized"),
      bullet("TypeScript with @/ path aliases via babel-plugin-module-resolver"),
      bullet("React Navigation with native stack and bottom tab navigators"),
      body(""),

      heading("3.1.2 Design System (src/theme/index.ts)", HeadingLevel.HEADING_3),
      bullet("Full color palette matching web app (primary blue #0A6ED1, greens, reds, oranges)"),
      bullet("Voucher type badge colors (JV, GRN, DN, PAY, REC, INV, SO, PO)"),
      bullet("Spacing scale, border radius tokens, shadow presets, typography scale"),
      body(""),

      heading("3.1.3 API Client (src/api/client.ts)", HeadingLevel.HEADING_3),
      bullet("Fetch wrapper with automatic JWT token attachment"),
      bullet("Token stored/retrieved via expo-secure-store (encrypted device storage)"),
      bullet("Sends Cookie: auth_token=<token> header on all requests"),
      bullet("Configurable base URL via EXPO_PUBLIC_API_URL env var"),
      body(""),

      heading("3.1.4 Auth Context (src/context/AuthContext.tsx)", HeadingLevel.HEADING_3),
      bullet("React context with loginAs / logout actions"),
      bullet("Restores session from stored JWT on app start (decodes payload)"),
      bullet("Three states: loading, unauthenticated, authenticated"),
      bullet("useAuth() hook for consuming components"),
      body(""),

      heading("3.1.5 Login Screen (src/screens/auth/LoginScreen.tsx)", HeadingLevel.HEADING_3),
      bullet("Fetches employee list from /api/employees"),
      bullet("Card list with avatar initials, name, email, role badge"),
      bullet("Tap to login — calls /api/auth/switch, stores JWT token"),
      bullet("Loading and error states with retry button"),
      body(""),

      heading("3.1.6 Dashboard Screen (src/screens/dashboard/DashboardScreen.tsx)", HeadingLevel.HEADING_3),
      bullet("Top bar with time-based greeting, user name/role, sign out button"),
      bullet("Pull-to-refresh support"),
      bullet("3×2 KPI grid: Revenue, Expenses, Net Income, Cash & Bank, Receivables, Payables"),
      bullet("Working Capital panel (Cash + AR − AP = Net)"),
      bullet("Quick Actions grid: wired to Inventory, Materials, Purchase Orders (others disabled until built)"),
      bullet("Recent Activity list (last 20 vouchers with type badge, number, date, amount, status)"),
      body(""),

      heading("3.1.7 Shared Components (src/components/)", HeadingLevel.HEADING_3),
      bullet("LoadingView — centered spinner with optional message"),
      bullet("ErrorView — error message with retry button"),
      bullet("KPICard — metric card (label / value / subtext, optional color)"),
      bullet("SectionHeader — section title with optional right-side meta text"),
      body(""),

      heading("3.10 Inventory Screen (src/screens/inventory/InventoryScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Internal tab view: Stock Balances and Stock Ledger"),
      bullet("Stock Balances: item/warehouse/qty cards with color-coded quantity levels"),
      bullet("Stock Ledger: movement log with IN/OUT/balance amounts and voucher type badges"),
      bullet("Search filter across both tabs (item name, warehouse)"),
      bullet("Pull-to-refresh, loading and empty states"),
      body(""),

      heading("3.11 Materials Screen (src/screens/materials/MaterialsScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Searchable list by name, code, type, category"),
      bullet("Horizontal type filter chips fetched from /api/mobile/materials?view=types"),
      bullet("Material cards: name, code, type badge, status badge (Active/Inactive), unit chip"),
      body(""),

      heading("3.12 Purchase Orders Screen (src/screens/purchaseOrders/)", HeadingLevel.HEADING_2),
      bullet("Three status tabs: All / Open / In Progress"),
      bullet("PO cards with: PO number, vendor, date, status badge, total amount, progress bar"),
      bullet("Detail screen: PO header, receipt progress bar, line items with qty ordered/received/pending"),
      body(""),

      heading("3.13 Sales Orders Screen (src/screens/salesOrders/)", HeadingLevel.HEADING_2),
      bullet("Four status tabs: All / Open / Approved / Closed"),
      bullet("SO cards with: SO number, customer, date, status badge, total amount"),
      bullet("Detail screen: SO header, line items list, total row"),
      body(""),

      heading("3.14 GRN Screen (src/screens/grn/GRNScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Goods receipt progress view per purchase order"),
      bullet("Overall summary card: PO count, overall % received, progress bar"),
      bullet("Per-PO cards: receipt progress, optional line item preview"),
      bullet("Tappable cards navigate to PO Detail screen (Session 4)"),
      body(""),

      heading("3.15 Accounts Payable Screen (src/screens/finance/AccountsPayableScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Three tabs: Summary / Bills / Vendors"),
      bullet("Summary: KPI cards (outstanding, overdue, vendor count, bill count) + aging analysis bars"),
      bullet("Bills: bill cards with status, amounts, due date + search by number/vendor/status (Session 4)"),
      bullet("Vendors: vendor cards with outstanding/overdue balances + search by name (Session 4)"),
      body(""),

      heading("3.16 Accounts Receivable Screen (src/screens/finance/AccountsReceivableScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Three tabs: Summary / Invoices / Customers"),
      bullet("Summary: KPI cards + aging analysis bars (same pattern as AP)"),
      bullet("Invoices: invoice cards with outstanding amounts + search by number/customer/status (Session 4)"),
      bullet("Customers: customer cards with outstanding/overdue balances + search by name (Session 4)"),
      body(""),

      heading("3.17 Journal Entries Screen (src/screens/journalEntries/JournalEntriesScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Searchable list: voucher number, narration"),
      bullet("Voucher type filter chips (JV, GRN, PAY, REC, INV, SO, PO, DN)"),
      bullet("Cards with colored type badge, status badge (POSTED/DRAFT/VOID), debit/credit totals"),
      bullet("Expandable cards reveal journal lines (account, debit, credit)"),
      bullet("Date range filter with From/To inputs (YYYY-MM-DD) — server-side filtering (Session 4)"),
      bullet("Quick date presets: Today, This Week, This Month, Last Month (Session 4)"),
      body(""),

      heading("3.18 Trial Balance Screen (src/screens/trialBalance/TrialBalanceScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Company selector dropdown (populated from /api/options/companies)"),
      bullet("As-of date text input (YYYY-MM-DD format, Run Report button)"),
      bullet("Account search filter"),
      bullet("Summary card: total debit / total credit with balance diff warning"),
      bullet("Hierarchical account table with group headers, level-based indentation"),
      body(""),

      heading("3.19 Business Partners Screen (src/screens/partners/PartnersScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Searchable list (name, code, email)"),
      bullet("Role filter tabs: All / Customers / Vendors"),
      bullet("Partner cards: avatar initials, name, code, role badges (Customer=green, Vendor=blue)"),
      bullet("Contact info: email, phone, company"),
      body(""),

      heading("3.20 Companies Screen (src/screens/companies/CompaniesScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Company list with logo circle (initial letter), name, code, active/inactive status badge"),
      bullet("Detail grid: currency, fiscal year, phone, email, address"),
      body(""),

      heading("3.21 Financial Reports Screen (src/screens/financialReports/)", HeadingLevel.HEADING_2),
      bullet("Two tabs: Profit & Loss / Balance Sheet"),
      bullet("P&L: revenue vs expense sections, net income summary card"),
      bullet("Balance Sheet: assets, liabilities, equity sections with balance check warning"),
      bullet("Company selector + as-of date picker (same pattern as Trial Balance)"),
      bullet("Accounts classified by account_type keyword matching"),
      body(""),

      heading("3.22 Global Company Filter (Updated Session 3)", HeadingLevel.HEADING_2),
      bullet("CompanyContext (src/context/CompanyContext.tsx) — global state: companies list, selectedCompany, companyId"),
      bullet("CompanyPicker (src/components/CompanyPicker.tsx) — horizontal scrollable company chips"),
      bullet("CompanyProvider wrapped around app in App.tsx"),
      bullet("Now applied to all data screens: Dashboard, Inventory, Materials, Journal Entries, Partners, Sales Orders, AP, AR"),
      bullet("TrialBalance and FinancialReports use companies list from context (no duplicate API calls)"),
      bullet("CompanyContext re-loads after login (was incorrectly loading before auth on app start)"),
      body(""),

      heading("3.23 Navigation Architecture (Updated Session 3)", HeadingLevel.HEADING_2),
      bullet("AppStack (native stack) — thin root wrapper, contains only the Tabs screen"),
      bullet("AppNavigator (bottom tabs): Dashboard, Inventory, Finance, More"),
      bullet("FinanceNavigator (stack): FinanceMenu → AccountsPayable, AccountsReceivable, JournalEntries, TrialBalance, FinancialReports"),
      bullet("MoreNavigator (stack): MoreMenu → Materials, PurchaseOrders, PurchaseOrderDetail, SalesOrders, SalesOrderDetail, GRN, Partners, Companies"),
      bullet("MoreMenu Finance section navigates to Finance tab's real screens via getParent()"),
      bullet("Dashboard Quick Actions wired to real screens via tab navigation"),
      body(""),

      heading("3.24 API Client Retry Logic (Session 3)", HeadingLevel.HEADING_2),
      bullet("apiRequest() now retries 2 times on network errors and 5xx/429 HTTP status codes"),
      bullet("Exponential backoff delays: 500ms, 1000ms, 2000ms between attempts"),
      bullet("Helps recover from transient connectivity issues on mobile networks"),
      body(""),

      // 4. Roadmap
      heading("4. Feature Roadmap"),
      body("The following features are planned and will be built incrementally by the scheduled build agent:"),
      body(""),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          tableRow(["Phase", "Screen", "Status", "API Endpoint"], { header: true, widths: [15, 25, 15, 45] }),
          tableRow(["Setup", "Login Screen", "Done", "/api/employees, /api/auth/switch"]),
          tableRow(["Setup", "Dashboard", "Done", "/api/dashboard"], { alt: true }),
          tableRow(["Phase 1", "Inventory", "Done", "/api/mobile/inventory"]),
          tableRow(["Phase 1", "Materials", "Done", "/api/mobile/materials"], { alt: true }),
          tableRow(["Phase 1", "Purchase Orders", "Done", "/api/mobile/purchase-orders"]),
          tableRow(["Phase 2", "Sales Orders", "Done", "/api/mobile/sales-orders"], { alt: true }),
          tableRow(["Phase 2", "GRN / Goods Receipt", "Done", "/api/mobile/purchase-orders?view=progress"]),
          tableRow(["Phase 3", "Accounts Payable", "Done", "/api/mobile/accounts-payable"], { alt: true }),
          tableRow(["Phase 3", "Accounts Receivable", "Done", "/api/mobile/accounts-receivable"]),
          tableRow(["Phase 3", "Journal Entries", "Done", "/api/mobile/journal-entries"], { alt: true }),
          tableRow(["Phase 4", "Trial Balance", "Done", "/api/mobile/trial-balance"]),
          tableRow(["Phase 4", "Financial Reports", "Done", "Computed from trial balance"], { alt: true }),
          tableRow(["Phase 5", "Business Partners", "Done", "/api/mobile/partners"]),
          tableRow(["Phase 5", "Companies", "Done", "/api/mobile/companies"], { alt: true }),
          tableRow(["Phase 6", "Navigation Wiring", "Done", "—"]),
          tableRow(["Phase 6", "Global Company Filter", "Done", "CompanyContext + CompanyPicker"], { alt: true }),
          tableRow(["Phase 6", "Polish & Empty States", "Done", "—"]),
          tableRow(["Session 4", "Back Buttons (all screens)", "Done", "—"], { alt: true }),
          tableRow(["Session 4", "Search (PO, SO, AP Bills, AP Vendors, AR Invoices, AR Customers)", "Done", "—"]),
          tableRow(["Session 4", "Date Range Filter + Presets (Journal Entries)", "Done", "/api/mobile/journal-entries?from=&to="], { alt: true }),
          tableRow(["Session 4", "GRN → PO Detail navigation", "Done", "—"]),
        ],
      }),

      // 5. Directory Structure
      heading("5. Directory Structure"),
      body("src/", { bold: true }),
      bullet("api/"),
      bullet("client.ts — Fetch wrapper with JWT auth", 1),
      bullet("auth.ts — Login/logout API calls", 1),
      bullet("dashboard.ts — Dashboard data fetching", 1),
      bullet("inventory.ts — Stock balances and ledger", 1),
      bullet("materials.ts — Material master list and types", 1),
      bullet("purchaseOrders.ts — PO list and detail", 1),
      bullet("salesOrders.ts — SO list and detail", 1),
      bullet("accountsPayable.ts — AP summary, bills, vendors", 1),
      bullet("accountsReceivable.ts — AR summary, invoices, customers", 1),
      bullet("journalEntries.ts — Journal entry list with filters", 1),
      bullet("trialBalance.ts — Trial balance with company/date params", 1),
      bullet("partners.ts — Business partners list", 1),
      bullet("companies.ts — Company details", 1),
      bullet("src/components/ — Shared UI components (LoadingView, ErrorView, KPICard, SectionHeader)", 0),
      bullet("src/context/ — React contexts (AuthContext)", 0),
      bullet("src/navigation/ — Navigation stack definitions", 0),
      bullet("AppNavigator.tsx — Bottom tabs with type-safe nested navigator params", 1),
      bullet("FinanceNavigator.tsx — Stack for Finance tab screens", 1),
      bullet("MoreNavigator.tsx — Stack for More tab screens", 1),
      bullet("AuthNavigator.tsx — Stack for unauthenticated screens", 1),
      bullet("src/screens/ — Screen components by feature", 0),
      bullet("src/theme/ — Design tokens (colors, spacing, shadows)", 0),
      bullet("src/utils/ — Utility functions (currency, dates)", 0),

      // 6. Setup
      heading("6. Development Setup"),
      body("Prerequisites:", { bold: true }),
      bullet("Node.js 18+"),
      bullet("Expo CLI (npx expo)"),
      bullet("Expo Go app on iOS/Android device"),
      bullet("Next.js web app running (for backend API)"),
      body(""),
      body("Steps:", { bold: true }),
      bullet("1. Clone the repo: git clone github.com/haseebahmad24/Poultry-ERP-Mobile"),
      bullet("2. Install dependencies: npm install --legacy-peer-deps"),
      bullet("3. Create .env file with EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000"),
      bullet("4. Start the Next.js web app (backend): cd <web-repo> && npm run dev"),
      bullet("5. Start Expo: npm run start"),
      bullet("6. Scan QR code with Expo Go on your phone"),
      body(""),
      body("Both devices must be on the same local network.", { italics: true, color: GRAY }),

      // 7. Changelog
      heading("7. Changelog"),
      heading("Session 2 — 2026-05-16", HeadingLevel.HEADING_2),
      bullet("Added API service modules: inventory, materials, purchase orders"),
      bullet("Built InventoryScreen with Stock Balances and Stock Ledger tabs"),
      bullet("Built MaterialsScreen with search, status filter, and type filter pills"),
      bullet("Built PurchaseOrdersScreen with status tabs, live counts, and progress bars"),
      bullet("Built PODetailScreen with header info, receiving progress, and line items"),
      bullet("Created AppStack navigator — wraps bottom tabs + all new feature screens"),
      bullet("Wired Dashboard Quick Actions: Inventory, Materials, Purchase Order navigate correctly"),
      bullet("Fixed: InventoryScreen hides back button when accessed as bottom tab"),
      body(""),
      heading("Session 1 — 2026-05-12", HeadingLevel.HEADING_2),
      bullet("Project scaffolded with Expo 51, TypeScript, React Navigation"),
      bullet("Design system created matching web app colors"),
      bullet("API client with JWT auth via Secure Store"),
      bullet("Login screen with employee selector"),
      bullet("Dashboard with KPIs, working capital, quick actions, recent activity"),
      bullet("Bottom tab navigation (Dashboard, Inventory, Finance, More)"),
      body(""),

      heading("Session 2 — 2026-05-15", HeadingLevel.HEADING_2),
      bullet("Phase 1: Inventory screen (stock balances + ledger tab view, search)"),
      bullet("Phase 1: Materials screen (searchable list, type filter chips, status badges)"),
      bullet("Phase 1: Purchase Orders screen (All/Open/In Progress tabs, PO detail with progress bar)"),
      bullet("Phase 2: Sales Orders screen (All/Open/Approved/Closed tabs, SO detail with line items)"),
      bullet("Phase 2: GRN screen (receipt progress per PO, overall summary card)"),
      bullet("Phase 3: Accounts Payable screen (summary/aging, bills, vendors tabs)"),
      bullet("Phase 3: Accounts Receivable screen (summary/aging, invoices, customers tabs)"),
      bullet("Phase 3: Journal Entries screen (type filter chips, expandable cards with journal lines)"),
      bullet("Phase 4: Trial Balance screen (company selector, date input, hierarchical account table)"),
      bullet("Phase 4: Financial Reports screen (P&L and Balance Sheet tabs computed from trial balance)"),
      bullet("Phase 5: Business Partners screen (role filter, customer/vendor badges)"),
      bullet("Phase 5: Companies screen (company cards with fiscal year, status, contact info)"),
      bullet("Phase 6: FinanceNavigator and MoreNavigator stack navigators wired up"),
      bullet("Phase 6: Dashboard Quick Action tiles wired to real screens via tab navigation"),
      bullet("Phase 6: CompanyContext and CompanyPicker for global company filtering"),
      bullet("Phase 6: Inventory, AP, AR screens use global company filter"),
      body(""),
      heading("Session 3 — 2026-05-18", HeadingLevel.HEADING_2),
      bullet("Global company filter extended to all screens: Dashboard, Materials, Journal Entries, Partners, Sales Orders"),
      bullet("TrialBalance and FinancialReports now read companies from CompanyContext (no redundant API calls)"),
      bullet("CompanyContext fixed to reload after login instead of failing silently on app start"),
      bullet("API client: added exponential-backoff retry (2 attempts, 500/1000ms) for network errors and 5xx/429"),
      bullet("MoreMenu Finance section: removed disabled items, now navigates directly into Finance tab screens"),
      bullet("AppStack: removed dead duplicate routes (Inventory, Materials, POs) — all nav through tab stacks"),
      bullet("Fixed Inventory tab icon (was using wrong key InventoryTab instead of Inventory)"),
      bullet("PurchaseOrder type: added received/receipt_pct fields for progress view endpoint"),
      body(""),
      heading("Session 4 — 2026-05-19", HeadingLevel.HEADING_2),
      bullet("Journal Entries: added date range filter (from/to inputs) with server-side filtering via API params"),
      bullet("Journal Entries: added quick date presets — Today, This Week, This Month, Last Month"),
      bullet("Accounts Payable: added search bars in Bills tab (by number/vendor/status) and Vendors tab (by name)"),
      bullet("Accounts Receivable: added search bars in Invoices tab (by number/customer/status) and Customers tab (by name)"),
      bullet("Purchase Orders: added search bar (by PO number, vendor, status)"),
      bullet("Sales Orders: added search bar (by SO number, customer, status)"),
      bullet("GRN screen: made PO cards tappable — tap navigates to PurchaseOrderDetail screen"),
      bullet("Back buttons: added BackButton component to all non-root stack screens (11 screens total)"),
      bullet("Back button header style: fixed AP, AR, Financial Reports headers to use flexDirection row"),
      body(""),
      body("Note: This document is automatically updated by the scheduled build agent after each session.", { italics: true, color: GRAY }),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("FEATURES.docx", buffer);
  console.log("FEATURES.docx generated successfully");
});
