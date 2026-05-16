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
      heading("3. Implemented Features"),

      heading("3.1 Session 1 — Project Scaffolding & Core Screens", HeadingLevel.HEADING_2),

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

      heading("3.2 Session 2 — Phase 1 Core Data Screens", HeadingLevel.HEADING_2),

      heading("3.2.1 Inventory Screen (src/screens/inventory/InventoryScreen.tsx)", HeadingLevel.HEADING_3),
      bullet("In-screen tab bar: Stock Balances | Stock Ledger"),
      bullet("Stock Balances tab:"),
      bullet("  Summary strip showing total item count and total stock value", 1),
      bullet("  Search bar (filters by item name, code, warehouse, category)", 1),
      bullet("  Card list: item name, code, warehouse, category badge, quantity (color-coded), UOM, value", 1),
      bullet("  Pull-to-refresh", 1),
      bullet("Stock Ledger tab:"),
      bullet("  Lazy-loads on first tab switch to avoid redundant API calls", 1),
      bullet("  Transaction cards: voucher type badge, voucher number, date, item, warehouse", 1),
      bullet("  Qty IN (green) / Qty OUT (red) / Balance columns per transaction", 1),
      bullet("Back button shown when navigated from Quick Actions; hidden when accessed via bottom tab"),
      body(""),

      heading("3.2.2 Materials Screen (src/screens/materials/MaterialsScreen.tsx)", HeadingLevel.HEADING_3),
      bullet("Search bar filtering by name, code, type, and description"),
      bullet("Status filter chips: All | Active | Inactive"),
      bullet("Horizontal scroll type filter pills (dynamically loaded from /api/mobile/materials?view=types)"),
      bullet("Material cards: icon, name, code, unit, type badge, active/inactive status dot"),
      bullet("Live count of filtered results"),
      bullet("Pull-to-refresh"),
      body(""),

      heading("3.2.3 Purchase Orders Screen (src/screens/purchaseOrders/PurchaseOrdersScreen.tsx)", HeadingLevel.HEADING_3),
      bullet("Horizontal scrollable status tabs: All | Open | Approved | Closed | Draft"),
      bullet("Live count badges on each status tab"),
      bullet("PO cards: PO badge, number, vendor name, date, status badge (color-coded), total amount"),
      bullet("Receiving progress bar (ordered qty vs received qty) when data available"),
      bullet("Tap card to navigate to PO Detail screen"),
      bullet("Pull-to-refresh"),
      body(""),

      heading("3.2.4 PO Detail Screen (src/screens/purchaseOrders/PODetailScreen.tsx)", HeadingLevel.HEADING_3),
      bullet("PO header card: number, status badge, vendor, date, company, total amount"),
      bullet("Receiving Progress card:"),
      bullet("  Stats row: Ordered / Received / Balance quantity boxes", 1),
      bullet("  Large progress bar (color-coded: green=100%, blue=>50%, orange=<50%)", 1),
      bullet("  Percentage label", 1),
      bullet("Line Items card (when available):"),
      bullet("  Per-item: name, code, ordered/received/balance quantities, mini progress bar", 1),
      bullet("  Unit price and line total when available", 1),
      bullet("Notes section (when available)"),
      body(""),

      heading("3.2.5 API Service Modules (Session 2)", HeadingLevel.HEADING_3),
      bullet("src/api/inventory.ts — fetchStockBalances(), fetchStockLedger(), fetchInventoryItems()"),
      bullet("src/api/materials.ts — fetchMaterials(), fetchMaterialTypes()"),
      bullet("src/api/purchaseOrders.ts — fetchPurchaseOrders(), fetchPODetail()"),
      body(""),

      heading("3.2.6 Navigation (Session 2)", HeadingLevel.HEADING_3),
      bullet("AppStack (src/navigation/AppStack.tsx) — new native stack wrapping all authenticated screens"),
      bullet("Inventory tab in bottom nav now shows real InventoryScreen"),
      bullet("Dashboard Quick Actions: Inventory, Materials, Purchase Order are wired and navigate correctly"),
      bullet("Disabled Quick Actions (Journal Entry, Sales Order, GRN, Trial Balance) shown but grayed out"),

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
          tableRow(["Phase 1", "Inventory (Stock + Ledger)", "Done", "/api/mobile/inventory"]),
          tableRow(["Phase 1", "Materials", "Done", "/api/mobile/materials"], { alt: true }),
          tableRow(["Phase 1", "Purchase Orders + Detail", "Done", "/api/mobile/purchase-orders"]),
          tableRow(["Phase 2", "Sales Orders", "Next", "/api/mobile/sales-orders"], { alt: true }),
          tableRow(["Phase 2", "GRN / Goods Receipt", "Next", "/api/mobile/purchase-orders?view=progress"]),
          tableRow(["Phase 3", "Accounts Payable", "Planned", "/api/mobile/accounts-payable"], { alt: true }),
          tableRow(["Phase 3", "Accounts Receivable", "Planned", "/api/mobile/accounts-receivable"]),
          tableRow(["Phase 3", "Journal Entries", "Planned", "/api/mobile/journal-entries"], { alt: true }),
          tableRow(["Phase 4", "Trial Balance", "Planned", "/api/mobile/trial-balance"]),
          tableRow(["Phase 4", "Financial Reports", "Planned", "Computed from trial balance"], { alt: true }),
          tableRow(["Phase 5", "Business Partners", "Planned", "/api/mobile/partners"]),
          tableRow(["Phase 5", "Companies", "Planned", "/api/mobile/companies"], { alt: true }),
          tableRow(["Phase 6", "Navigation Wiring", "In Progress", "—"]),
          tableRow(["Phase 6", "Global Company Filter", "Planned", "—"], { alt: true }),
          tableRow(["Phase 6", "Polish & Empty States", "Planned", "—"]),
        ],
      }),

      // 5. Directory Structure
      heading("5. Directory Structure"),
      body("src/", { bold: true }),
      bullet("api/"),
      bullet("client.ts — Fetch wrapper with JWT auth", 1),
      bullet("auth.ts — Login/logout API calls", 1),
      bullet("dashboard.ts — Dashboard data fetching", 1),
      bullet("inventory.ts — Stock balances, ledger, items", 1),
      bullet("materials.ts — Materials list and types", 1),
      bullet("purchaseOrders.ts — PO list and detail", 1),
      bullet("components/"),
      bullet("LoadingView.tsx, ErrorView.tsx, KPICard.tsx, SectionHeader.tsx", 1),
      bullet("context/"),
      bullet("AuthContext.tsx — JWT auth state management", 1),
      bullet("navigation/"),
      bullet("RootNavigator.tsx — Auth/App switcher", 1),
      bullet("AppStack.tsx — Authenticated app stack navigator", 1),
      bullet("AppNavigator.tsx — Bottom tab navigator", 1),
      bullet("AuthNavigator.tsx — Login stack", 1),
      bullet("screens/"),
      bullet("auth/LoginScreen.tsx", 1),
      bullet("dashboard/DashboardScreen.tsx", 1),
      bullet("inventory/InventoryScreen.tsx", 1),
      bullet("materials/MaterialsScreen.tsx", 1),
      bullet("purchaseOrders/PurchaseOrdersScreen.tsx", 1),
      bullet("purchaseOrders/PODetailScreen.tsx", 1),
      bullet("theme/index.ts — Design tokens"),
      bullet("utils/currency.ts — Formatting utilities"),

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
      body("Note: This document is automatically updated by the scheduled build agent after each session.", { italics: true, color: GRAY }),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("FEATURES.docx", buffer);
  console.log("FEATURES.docx generated successfully");
});
