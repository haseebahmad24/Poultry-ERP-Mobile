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
      heading("2.2 API Layer", HeadingLevel.HEADING_2),
      body("The web app exposes dedicated REST endpoints under /api/mobile/ for the mobile app. Each endpoint accepts query parameters for filtering and returns JSON. Authentication is required on all endpoints."),
      body(""),

      // API Endpoints Table
      heading("2.3 Backend API Endpoints", HeadingLevel.HEADING_2),
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
      heading("3. Implemented Features (Session 1)"),

      heading("3.1 Project Scaffolding", HeadingLevel.HEADING_2),
      bullet("Expo 51 / React Native 0.74 project initialized"),
      bullet("TypeScript with @/ path aliases via babel-plugin-module-resolver"),
      bullet("React Navigation with native stack and bottom tab navigators"),
      bullet(".gitignore configured for mobile artifacts"),
      body(""),

      heading("3.2 Design System (src/theme/index.ts)", HeadingLevel.HEADING_2),
      bullet("Full color palette matching web app (primary blue #0A6ED1, greens, reds, oranges)"),
      bullet("Voucher type badge colors (JV, GRN, DN, PAY, REC, INV, SO, PO)"),
      bullet("Spacing scale, border radius tokens, shadow presets, typography scale"),
      body(""),

      heading("3.3 Utilities (src/utils/currency.ts)", HeadingLevel.HEADING_2),
      bullet("formatCurrency(amount) — PKR formatting with M/B abbreviations"),
      bullet("formatDate / formatShortDate helpers"),
      body(""),

      heading("3.4 API Client (src/api/client.ts)", HeadingLevel.HEADING_2),
      bullet("Fetch wrapper with automatic JWT token attachment"),
      bullet("Token stored/retrieved via expo-secure-store"),
      bullet("Sends Cookie: auth_token=<token> header on all requests"),
      bullet("Configurable base URL via EXPO_PUBLIC_API_URL env var"),
      body(""),

      heading("3.5 Auth Context (src/context/AuthContext.tsx)", HeadingLevel.HEADING_2),
      bullet("React context with loginAs / logout actions"),
      bullet("Restores session from stored JWT on app start (decodes payload)"),
      bullet("Three states: loading, unauthenticated, authenticated"),
      bullet("useAuth() hook for consuming components"),
      body(""),

      heading("3.6 Login Screen (src/screens/auth/LoginScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Fetches employee list from /api/employees"),
      bullet("Card list with avatar initials, name, email, role badge"),
      bullet("Tap to login — calls /api/auth/switch, stores JWT token"),
      bullet("Loading and error states with retry button"),
      body(""),

      heading("3.7 Dashboard Screen (src/screens/dashboard/DashboardScreen.tsx)", HeadingLevel.HEADING_2),
      bullet("Top bar with time-based greeting, user name/role, sign out button"),
      bullet("Pull-to-refresh support"),
      bullet("3×2 KPI grid: Revenue, Expenses, Net Income, Cash & Bank, Receivables, Payables"),
      bullet("Working Capital panel (Cash + AR − AP = Net)"),
      bullet("Quick Actions grid: Journal Entry, Purchase Order, Sales Order, GRN, Trial Balance, Inventory"),
      bullet("Recent Activity list (last 20 vouchers with type badge, number, date, amount, status)"),
      body(""),

      heading("3.8 Navigation (src/navigation/)", HeadingLevel.HEADING_2),
      bullet("AuthNavigator — native stack with Login screen"),
      bullet("AppNavigator — bottom tabs: Dashboard, Inventory, Finance, More"),
      bullet("RootNavigator — switches between Auth/App based on AuthContext state"),
      body(""),

      heading("3.9 Shared Components (src/components/)", HeadingLevel.HEADING_2),
      bullet("LoadingView — centered spinner with optional message"),
      bullet("ErrorView — error message with retry button"),
      bullet("KPICard — metric card (label / value / subtext, optional color)"),
      bullet("SectionHeader — section title with optional right-side meta text"),

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
          tableRow(["Phase 1", "Inventory", "Planned", "/api/mobile/inventory"]),
          tableRow(["Phase 1", "Materials", "Planned", "/api/mobile/materials"], { alt: true }),
          tableRow(["Phase 1", "Purchase Orders", "Planned", "/api/mobile/purchase-orders"]),
          tableRow(["Phase 2", "Sales Orders", "Planned", "/api/mobile/sales-orders"], { alt: true }),
          tableRow(["Phase 2", "GRN / Goods Receipt", "Planned", "/api/mobile/purchase-orders?view=progress"]),
          tableRow(["Phase 3", "Accounts Payable", "Planned", "/api/mobile/accounts-payable"], { alt: true }),
          tableRow(["Phase 3", "Accounts Receivable", "Planned", "/api/mobile/accounts-receivable"]),
          tableRow(["Phase 3", "Journal Entries", "Planned", "/api/mobile/journal-entries"], { alt: true }),
          tableRow(["Phase 4", "Trial Balance", "Planned", "/api/mobile/trial-balance"]),
          tableRow(["Phase 4", "Financial Reports", "Planned", "Computed from trial balance"], { alt: true }),
          tableRow(["Phase 5", "Business Partners", "Planned", "/api/mobile/partners"]),
          tableRow(["Phase 5", "Companies", "Planned", "/api/mobile/companies"], { alt: true }),
          tableRow(["Phase 6", "Navigation Wiring", "Planned", "—"]),
          tableRow(["Phase 6", "Global Company Filter", "Planned", "—"], { alt: true }),
          tableRow(["Phase 6", "Polish & Empty States", "Planned", "—"]),
        ],
      }),

      // 5. Directory Structure
      heading("5. Directory Structure"),
      body("mobile/", { bold: true }),
      bullet("App.tsx — Entry point: SafeAreaProvider → AuthProvider → RootNavigator"),
      bullet("app.json — Expo configuration"),
      bullet("package.json — Dependencies"),
      bullet("tsconfig.json — TypeScript config with @/ alias"),
      bullet("babel.config.js — Babel with module-resolver plugin"),
      bullet("PROGRESS.md — Build progress tracker (updated each session)"),
      bullet("FEATURES.docx — This document"),
      bullet("src/api/ — API client and service modules", 0),
      bullet("client.ts — Fetch wrapper with auth", 1),
      bullet("auth.ts — Login/logout API calls", 1),
      bullet("dashboard.ts — Dashboard data fetching", 1),
      bullet("src/components/ — Shared UI components", 0),
      bullet("src/context/ — React contexts (AuthContext)", 0),
      bullet("src/navigation/ — Navigation stack definitions", 0),
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
