# Ilmdeen Pharmacy — offline-first implementation plan

Requested scope: modern, easy desktop pharmacy software; frontend first, JSON demo data, local backend later. No internet required for routine sales. One workstation is the current prototype assumption; LAN/multiple counters require a shared local server and transactional database design before production.

## Delivery sequence and acceptance criteria

1. Foundation and POS: local assets, shared data types, service boundaries; search name/generic/barcode, FEFO batch picker, loose/pack conversion, item and invoice discounts, cash/card/credit, held cart, payment and stock validation. Acceptance: complete a sale, refresh, verify invoice and stock; expired/quarantined stock cannot be sold.
2. Medicines and stock: catalogue CRUD, manufacturer/category/generic, barcode/rack, unit conversions, opening batch receipt, batch-specific cost/rate, expiry alerts, quarantine. Acceptance: multiple batches retain their own expiry and price; quantities use base units.
3. Invoices and printing: immutable sale price snapshots, history/detail, customer/payment details, item quantities/rates/discounts, batch/expiry, totals/paid/due, A4 and 80mm print CSS, original-invoice reprint. Browser print dialog supports Save as PDF; native printer enumeration, device selection and actual thermal hardware validation belong to desktop delivery.
4. Purchasing: supplier records, purchase order and receipt lifecycle, purchase invoice, free/bonus quantities, discounts, supplier payable and purchase return/credit note. Initial frontend includes single-line paid stock receipts, explicitly labelled; it does not pretend to be a complete payable ledger.
5. Returns and expiry: invoice-linked partial returns, original net paid price including allocated bill discount, prevent over-return, quarantine returned medicine pending inspection, supplier-return deadlines, expiry/recall blocks, write-off reasons. Returns reduce reported revenue and credit due; collected refunds require a future cash ledger. No automatic resale of returned medicine.
6. Parties and accounting: customer/supplier records; credit balance calculation; payments/allocations, expenses, cashier shift and reconciliation, journals and audit history. No simulated authentication or editable role label presented as security.
7. Reports: actual transaction-derived sales, stock valuation at batch cost, expiry, low stock, discounts and quarantine. CSV export; no invented historical chart. Full profit calculation requires return, purchase cost and tax policy validation.
8. Backup and settings: full demo JSON export, strict schema/reference checks before restore, preview, recovery snapshot before replacement, browser persistence failure handling. Native phase: consistent SQLite backup, scheduled backups/retention, checksums, restore integrity test, folder/USB paths. Never claim browser download is an automatic native backup.
9. Desktop/backend: evaluate Electron vs Tauri, local SQLite service; transaction-safe sale, migrations, discount permissions, audit events, password hashing, device printing, installer/update process. No CDN dependency. Verify LAN requirements before choosing a shared-server design.

## Business rules

- Dates use Asia/Karachi business day. A dated batch remains eligible through its recorded expiry day; month-only expiry conversion and any earlier removal deadline must be confirmed against pharmacy policy before production.
- FEFO suggests earliest eligible expiry, never expired/blocked. Batch override remains visible. Checkout revalidates quantities and status.
- All inventory counts are integer base units. Pack conversion is explicit per medicine. Price displayed and stored per base unit.
- Item % discount first, invoice fixed discount second. Discounts cannot create negative totals. Rules for stacking, customer prices, caps/manager approval and permitted promotions are separate future work; no automatic near-expiry promotion.
- No inferred GST or medication advice; tax configuration, license details and local regulatory invoice requirements need validation before live use.
- Browser data is a demo convenience, not production pharmacy storage or multi-counter concurrency protection.

## Research (2026-10-27, primary sources)

- ERPNext batches: https://docs.frappe.io/erpnext/batch — batches/expiry and stock filtering.
- ERPNext pricing: https://docs.frappe.io/erpnext/pricing-rule — rule scopes, priorities, discount stacking and bonus quantities.
- ERPNext returns implementation: https://github.com/frappe/erpnext/blob/develop/erpnext/controllers/selling_controller.py — original-document return rates and stock effects.
- Odoo FEFO: https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.html — removal/expiry workflow.
- Electron printing: https://www.electronjs.org/docs/latest/api/web-contents — native print and printToPDF capabilities.
- SQLite consistent backup: https://sqlite.org/backup.html — use backup API rather than blindly copying a live database.
- Open source candidates: https://github.com/Kitty-Hivens/Pharmacy (MIT; Angular/Spring), https://github.com/Raktim94/KinetiRx (AGPL; local tax/workflow adaptation needed). README/documentation review only; neither adopted or represented as audited software.

## Current frontend delivery

Implemented screens and exact limitations are documented in README.md. Native backup scheduling, authentication, LAN synchronization and physical printer certification are not frontend features.

### Purchase workflow delivered (2026-10-29)

- Distributor contacts with a shared company master and many-to-many distributor/company links. Each medicine has one company; linking that company to another distributor reuses its medicines.
- New catalogue medicines require a distributor and one of its linked companies. Creating a medicine does not increase stock. Company and pack-size changes are blocked after stock exists.
- One distributor per invoice; multiple companies and medicines per invoice; supplier invoice number and actual invoice date retained separately from entry timestamp.
- Per-line batch, expiry, quantity, bonus, pack/base-unit conversion, purchase rate, percentage discount, manually entered tax and per-base-unit selling price. Amount = purchased quantity × rate − discount + tax. Bonus increases received stock without increasing billed quantity.
- Stock cost = net pre-tax purchase amount / all received base units, including bonus. Tax remains separate; no statutory rate is assumed. Confirm input-tax capitalization policy before production.
- Save validates the entire invoice before committing stock, purchase snapshot and movement records. Repeated physical batches retain separate receipt/valuation lots for source and cost traceability; quarantine/release covers all lots of the physical medicine/batch.
- Initial paid amount, per-invoice partial payments, outstanding payable, distributor purchase/payment ledger, read-only purchase detail and printable A4 purchase record. This is a purchase subledger, not a full general ledger or cashier settlement system.
- Old saved data/backups migrate additively from manufacturer names and observed batch suppliers; old paid receipts retain their historical paid status. New company links/payments/purchase lines are included in backup validation.

Research for this change: [ERPNext Purchase Invoice](https://docs.frappe.io/erpnext/purchase-invoice), [Item supplier mappings](https://docs.frappe.io/erpnext/maintaining-suppliers-part-no-in-item), [tax versus stock valuation](https://docs.frappe.io/erpnext/difference-in-total-and-valuation-in-tax-and-charges). The distributor → company → medicine navigation follows the user's supplied reference; these sources support supplier invoices, shared item identity and explicit valuation/tax treatment.
