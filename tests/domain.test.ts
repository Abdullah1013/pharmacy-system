import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  completeSale,
  fefo,
  returnSale,
  totals,
  validateBackup,
} from "../src/domain.ts";
import type { Database } from "../src/domain.ts";
function fixture(): Database {
  const db = JSON.parse(
    readFileSync(new URL("../src/data/pharmacy.json", import.meta.url), "utf8"),
  );
  db.batches.forEach((b: { expiry: string }) => (b.expiry = "2099-12-31"));
  db.batches[0].expiry = "2098-01-01";
  return db;
}
test("FEFO excludes expired/quarantined stock and sorts by actual expiry", () => {
  const d = fixture();
  d.batches[1].expiry = "2020-01-01";
  assert.deepEqual(
    fefo(d.batches, "m1", "2026-10-27").map((b) => b.id),
    ["b1"],
  );
  d.batches[0].status = "quarantine";
  assert.equal(fefo(d.batches, "m1", "2026-10-27").length, 0);
});
test("item discount precedes fixed bill discount, without floating point residue", () => {
  assert.deepEqual(totals([{ qty: 3, price: 3.5, discount: 10 }], 1), {
    subtotal: 10.5,
    itemDiscount: 1.05,
    billDiscount: 1,
    total: 8.45,
  });
  assert.throws(() => totals([{ qty: 1, price: 5, discount: 0 }], 6));
});
test("checkout atomically deducts stock and snapshots invoice rates", () => {
  const d = fixture();
  const result = completeSale(
    d,
    [{ batchId: "b1", qty: 10, discount: 10 }],
    "",
    "Cash",
    100,
    1.5,
  );
  assert.equal(result.sale.total, 30);
  assert.equal(result.db.batches[0].qty, 330);
  assert.equal(d.batches[0].qty, 340);
  assert.equal(result.db.movements[0].qty, -10);
  result.db.batches[0].price = 9;
  assert.equal(result.sale.lines[0].price, 3.5);
});
test("checkout rejects overstock, expired batches, duplicate-line oversell, invalid discounts and unassigned credit", () => {
  const d = fixture();
  assert.throws(() =>
    completeSale(
      d,
      [{ batchId: "b1", qty: 9999, discount: 0 }],
      "",
      "Cash",
      999999,
      0,
    ),
  );
  assert.throws(() =>
    completeSale(
      d,
      [{ batchId: "b1", qty: 1, discount: 101 }],
      "",
      "Cash",
      100,
      0,
    ),
  );
  assert.throws(() =>
    completeSale(
      d,
      [{ batchId: "b1", qty: 1, discount: 0 }],
      "",
      "Credit",
      0,
      0,
    ),
  );
  assert.throws(() =>
    completeSale(
      d,
      [
        { batchId: "b1", qty: 200, discount: 0 },
        { batchId: "b1", qty: 200, discount: 0 },
      ],
      "",
      "Cash",
      99999,
      0,
    ),
  );
  d.batches[0].expiry = "2020-01-01";
  assert.throws(() =>
    completeSale(
      d,
      [{ batchId: "b1", qty: 1, discount: 0 }],
      "",
      "Cash",
      100,
      0,
    ),
  );
  assert.equal(d.sales.length, 0);
});
test("returns allocate bill discount and quarantine units rather than resell", () => {
  const d = completeSale(
    fixture(),
    [{ batchId: "b1", qty: 10, discount: 10 }],
    "",
    "Cash",
    100,
    1.5,
  ).db;
  const next = returnSale(
    d,
    d.sales[0].id,
    "b1",
    5,
    "Unopened return for inspection",
  );
  assert.equal(next.returns[0].refund, 15);
  assert.equal(next.sales[0].lines[0].returned, 5);
  assert.equal(next.batches[0].qty, d.batches[0].qty);
  assert.throws(() => returnSale(next, d.sales[0].id, "b1", 6, "Return"));
  assert.equal(d.returns.length, 0);
});
test("backup rejects invalid quantities and broken medicine references", () => {
  const d = fixture();
  assert.equal(validateBackup(d), true);
  d.batches[0].qty = -1;
  assert.equal(validateBackup(d), false);
  d.batches[0].qty = 10;
  d.batches[0].medicineId = "missing";
  assert.equal(validateBackup(d), false);
  assert.equal(validateBackup({ version: 1, medicines: [] }), false);
});
