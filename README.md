# Ilmdeen Pharmacy

Offline-first pharmacy **frontend preview**, built with React, TypeScript and Vite. All assets are bundled locally; no CDN fonts, remote images or hosted backend are needed at runtime. Seed prices and medicine information are illustrative.

## Run on Windows

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:5173. `npm.cmd` avoids PowerShell's npm.ps1 execution-policy restriction. Build with `npm.cmd run build`; preview that build with `npm.cmd run preview`.

## Working frontend modules

- Overview: transaction-derived weekly chart, daily sales, stock and expiry alerts.
- POS: medicine/generic/barcode search, F2 shortcut, batch-specific prices, FEFO suggestions, integer base units, pack addition, item percentage discount then fixed bill discount, cash/card/assigned-customer credit, held bill, stock/payment validation and saved invoice.
- Inventory: medicine creation/editing, barcode uniqueness, pack conversion lock after receiving stock, reorder levels, batch list and quarantine/release. No expired batch can be sold.
- Expiry: configurable alert window, expired/quarantined filters, batch blocking, returned units awaiting inspection.
- Invoices: history, preserved original prices, A4/80mm preview, print dialog/Save as PDF, partial invoice-linked returns with original net prices and over-return protection. Returned units are held separately and never automatically resold. Cash/card return entries represent a refund obligation; actual payout settlement will be handled by the native cash ledger.
- Purchases: distributor-specific multi-company invoices, linked medicine selection, supplier invoice/date, per-line batch/expiry, packs or base units, bonus quantities, purchase rates, discounts and manually entered tax. Save updates stock and payable atomically; invoice preview prints to A4/PDF. Duplicate distributor invoice references and mismatched supply chains are blocked. Purchase orders and supplier returns remain planned.
- Distributors: create contacts, link existing companies or create new ones, register medicines under a linked company, browse shared medicine catalogues and view purchase/payment ledger. Record invoice-specific partial payments from Purchases.
- Customers: create and search, credit outstanding derived from invoices and returns.
- Reports: all-time gross sales, returns, net revenue, credit outstanding, CSV sales register.
- Backup: manual JSON download, validated import preview, prior-workspace recovery snapshot before replacement. Last export time means download requested, not a verified file on disk.
- Settings: pharmacy receipt details, default paper format and expiry window.

Data source: `src/data/pharmacy.json`. Business rules: `src/domain.ts` and `src/purchasing.ts`. Purchase UI: `src/PurchaseModule.tsx`. Browser persistence: `src/store.ts`. Full phased plan and research links: [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md).

## Storage and offline scope

This preview stores demo data in localStorage, isolated per browser/origin. Browser clearing removes it; export backups regularly. The frontend is prepared for desktop packaging, but is **not an installed offline application yet**. Run the local Vite/preview server to use it without internet after installation. Desktop delivery will add a transactional local database, secure sign-in/permissions, native printer integration, installer and consistent scheduled backups. Multiple-counter LAN behavior requires a shared local service; this frontend is not concurrency-safe.

To recover the snapshot retained before a restore, inspect the `waseela-before-restore` localStorage key and save its JSON as a backup file. Invalid saved database data is not silently replaced.

## Verification

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npx.cmd playwright test
```

An installed Edge can also run the UI tests: set `PLAYWRIGHT_CHANNEL=msedge` in your shell. Browser tests exercise sale/return/refresh, receiving stock, credit validation, backup/restore and mobile navigation. Screenshots and A4/thermal PDF artifacts are written under `artifacts/`. Actual thermal-printer margins, drivers, barcode hardware and native backup scheduling need desktop-stage validation.

Purchase tax percentages are entered by the user, applied after line discount and excluded from stock cost. Bonus units share the net purchase cost. No statutory tax-rate defaults, medication guidance, production authentication or full general ledger are included. Confirm pharmacy policy for month-only expiry labels, removal deadlines, discount permissions, invoice/license requirements and supplier returns before live use.

## Purchase setup and migration

Open **Distributors**, select a distributor and use **Manage company links** to link an existing company or create one. Use **Add medicine** within that company; creating a catalogue record does not increase stock. The same company/medicine can be supplied by multiple distributors without duplicate medicine masters. Open **Purchases > Make purchase** to build the invoice, then save after reviewing totals and paid amount.

Existing v1 data and backups remain supported: company masters derive from existing manufacturer names and distributor links derive only from recorded stock sources. Legacy paid receipts retain their historical paid status. New receipts retain separate valuation lots, even when the physical batch number repeats, preserving each purchase cost/source. Inventory batches show the distributor and invoice reference.
