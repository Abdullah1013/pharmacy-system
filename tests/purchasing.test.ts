import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateBackup } from "../src/domain.ts";
import {
  normalizePurchasing,
  linkCompany,
  companyMedicines,
  receivePurchase,
  recordSupplierPayment,
  purchaseDue,
  calculatePurchaseLine,
  setPhysicalBatchStatus,
} from "../src/purchasing.ts";
import type { Database } from "../src/domain.ts";
import type { PurchaseInput } from "../src/purchasing.ts";
const fixture = () =>
  normalizePurchasing(
    JSON.parse(
      readFileSync(
        new URL("../src/data/pharmacy.json", import.meta.url),
        "utf8",
      ),
    ) as Database,
  );
function item(db: Database): PurchaseInput {
  return {
    companyId: db.medicines[0].companyId!,
    medicineId: "m1",
    number: "NEW-PN",
    expiry: "2099-01-31",
    qty: 2,
    bonus: 1,
    unit: "pack",
    rate: 100,
    discount: 10,
    tax: 10,
    sellingPrice: 4,
  };
}
test("legacy data migration preserves invoices and infers only historical distributor links", () => {
  const legacy = fixture();
  delete legacy.companies;
  delete legacy.distributorCompanies;
  delete legacy.supplierPayments;
  legacy.medicines.forEach((m) => delete m.companyId);
  const db = normalizePurchasing(legacy);
  assert.equal(db.medicines[0].manufacturer, "Haleon");
  assert.ok(db.companies?.some((c) => c.id === db.medicines[0].companyId));
  assert.equal(validateBackup(db), true);
  assert.equal(normalizePurchasing(db), db);
  assert.equal(
    companyMedicines(db, "s2", db.medicines[0].companyId!).length,
    0,
  );
});
test("quarantining a physical batch blocks every receipt lot without changing quantities", () => {
  const db = fixture();
  const { db: next } = receivePurchase(db, {
    supplierId: "s1",
    reference: "REPEAT",
    invoiceDate: "2026-10-01",
    paid: 0,
    lines: [
      {
        ...item(db),
        number: db.batches[0].number,
        expiry: db.batches[0].expiry,
      },
    ],
  });
  const blocked = setPhysicalBatchStatus(next, db.batches[0].id, "quarantine");
  assert.ok(
    blocked.batches
      .filter((b) => b.number === db.batches[0].number && b.medicineId === "m1")
      .every((b) => b.status === "quarantine"),
  );
  assert.equal(blocked.batches[0].qty, 340);
  assert.equal(validateBackup(blocked), true);
});
test("same company and medicine can link to multiple distributors without duplicates", () => {
  const db = fixture();
  const next = linkCompany(db, "s2", db.medicines[0].companyId!);
  assert.equal(
    companyMedicines(next, "s2", db.medicines[0].companyId!)[0].id,
    "m1",
  );
  assert.equal(next.medicines.length, db.medicines.length);
  assert.throws(() => linkCompany(next, "s2", db.medicines[0].companyId!));
});
test("pack bonus, discounted tax, cost and payable update atomically", () => {
  const db = fixture();
  const { db: next, purchase } = receivePurchase(db, {
    supplierId: "s1",
    reference: "DIST-101",
    invoiceDate: "2026-10-01",
    paid: 50,
    lines: [
      item(db),
      {
        ...item(db),
        number: "NEW-PN-2",
        unit: "unit",
        qty: 3,
        bonus: 0,
        rate: 10,
        discount: 0,
        tax: 0,
      },
    ],
  });
  assert.equal(purchase.total, 228);
  assert.equal(purchase.qty, 303);
  assert.equal(next.batches.at(-2)?.qty, 300);
  assert.equal(next.batches.at(-2)?.cost, 0.6);
  assert.equal(purchaseDue(next, purchase), 178);
  assert.equal(db.purchases.length, 0);
  assert.equal(validateBackup(next), true);
});
test("invalid chain, duplicate reference, conflicting expiry and empty invoice cannot modify stock", () => {
  const db = fixture();
  const input = {
    supplierId: "s1",
    reference: "TEST",
    invoiceDate: "2026-10-01",
    paid: 0,
    lines: [item(db)],
  };
  assert.throws(() => receivePurchase(db, { ...input, supplierId: "s2" }));
  assert.throws(() => receivePurchase(db, { ...input, lines: [] }));
  assert.throws(() =>
    receivePurchase(db, {
      ...input,
      lines: [{ ...item(db), number: "PN-2401", expiry: "2098-01-01" }],
    }),
  );
  const next = receivePurchase(db, input).db;
  assert.throws(() => receivePurchase(next, { ...input, reference: " test " }));
  assert.throws(() => receivePurchase(db, { ...input, paid: 9999 }));
  assert.equal(db.batches.length, 11);
});
test("repeated receipt retains a separate valuation lot and quarantine status", () => {
  const db = fixture();
  db.batches[0].status = "quarantine";
  const { db: next } = receivePurchase(db, {
    supplierId: "s1",
    reference: "NEW",
    invoiceDate: "2026-10-01",
    paid: 0,
    lines: [{ ...item(db), number: "PN-2401", expiry: db.batches[0].expiry }],
  });
  assert.equal(next.batches.at(-1)?.status, "quarantine");
  assert.equal(next.batches[0].qty, 340);
  assert.notEqual(next.batches[0].id, next.batches.at(-1)?.id);
});
test("supplier payments reduce only their invoice, reject overpayment and survive backup validation", () => {
  const db = fixture();
  const result = receivePurchase(db, {
    supplierId: "s1",
    reference: "PAY-1",
    invoiceDate: "2026-10-01",
    paid: 50,
    lines: [item(db)],
  });
  const next = recordSupplierPayment(result.db, result.purchase.id, 100, "");
  assert.equal(purchaseDue(next, result.purchase), 48);
  assert.equal(validateBackup(next), true);
  assert.throws(() =>
    recordSupplierPayment(next, result.purchase.id, 49, "overpay"),
  );
  const broken = structuredClone(next);
  broken.purchases[0].lines![0].total = 1;
  assert.equal(validateBackup(broken), false);
});
test("purchase quantities, discounts and dates are validated", () => {
  const db = fixture();
  assert.throws(() => calculatePurchaseLine({ ...item(db), qty: 1.1 }, 1));
  assert.throws(() => calculatePurchaseLine({ ...item(db), tax: 101 }, 1));
  assert.throws(() =>
    receivePurchase(db, {
      supplierId: "s1",
      reference: "BAD",
      invoiceDate: "2026-02-30",
      paid: 0,
      lines: [item(db)],
    }),
  );
});
