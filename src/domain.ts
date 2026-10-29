import { validatePurchasing } from "./purchasing.ts";
import type {
  Company,
  DistributorCompany,
  PurchaseLine,
  SupplierPayment,
} from "./purchasing";
export type Medicine = {
  companyId?: string;
  id: string;
  name: string;
  generic: string;
  strength: string;
  form: string;
  category: string;
  manufacturer: string;
  barcode: string;
  rack: string;
  unitsPerPack: number;
  reorder: number;
  price: number;
};
export type Batch = {
  id: string;
  medicineId: string;
  number: string;
  expiry: string;
  qty: number;
  cost: number;
  price: number;
  status: "available" | "quarantine";
  supplierId: string;
};
export type Party = {
  id: string;
  name: string;
  phone: string;
  address: string;
};
export type CartLine = { batchId: string; qty: number; discount: number };
export type SaleLine = CartLine & {
  name: string;
  batch: string;
  expiry: string;
  price: number;
  cost: number;
  returned: number;
};
export type Sale = {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  payment: string;
  paid: number;
  discount: number;
  lines: SaleLine[];
  total: number;
};
export type Purchase = {
  id: string;
  date: string;
  supplierId: string;
  reference: string;
  total: number;
  batchId: string;
  qty: number;
  invoiceDate?: string;
  distributorName?: string;
  lines?: PurchaseLine[];
  paid?: number;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
};
export type Movement = {
  id: string;
  date: string;
  batchId: string;
  qty: number;
  type: string;
  reference: string;
};
export type Return = {
  id: string;
  saleId: string;
  batchId: string;
  qty: number;
  refund: number;
  reason: string;
  date: string;
};
export type Settings = {
  name: string;
  address: string;
  phone: string;
  receiptNote: string;
  paper: string;
  alertDays: number;
};
export type Database = {
  companies?: Company[];
  distributorCompanies?: DistributorCompany[];
  supplierPayments?: SupplierPayment[];
  version: number;
  medicines: Medicine[];
  batches: Batch[];
  customers: Party[];
  suppliers: Party[];
  sales: Sale[];
  purchases: Purchase[];
  movements: Movement[];
  returns: Return[];
  settings: Settings;
  lastBackup: string | null;
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const money = (value: number) =>
  new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const daysUntil = (date: string, now = today()) =>
  Math.round((Date.parse(date) - Date.parse(now)) / 86400000);
export const eligible = (b: Batch, now = today()) =>
  b.status === "available" && b.qty > 0 && daysUntil(b.expiry, now) >= 0;
export const fefo = (batches: Batch[], medicineId: string, now = today()) =>
  batches
    .filter((b) => b.medicineId === medicineId && eligible(b, now))
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
export function totals(
  lines: { qty: number; price: number; discount: number }[],
  billDiscount = 0,
) {
  const subtotal = round(lines.reduce((a, l) => a + l.qty * l.price, 0));
  const itemDiscount = round(
    lines.reduce((a, l) => a + (l.qty * l.price * l.discount) / 100, 0),
  );
  const net = round(subtotal - itemDiscount);
  if (!Number.isFinite(billDiscount) || billDiscount < 0 || billDiscount > net)
    throw new Error("Bill discount must be between zero and the item total.");
  return {
    subtotal,
    itemDiscount,
    billDiscount,
    total: round(net - billDiscount),
  };
}
export function completeSale(
  db: Database,
  cart: CartLine[],
  customerId: string,
  payment: string,
  tendered: number,
  billDiscount: number,
): { db: Database; sale: Sale } {
  if (!cart.length) throw new Error("Add a medicine to the bill first.");
  if (new Set(cart.map((l) => l.batchId)).size !== cart.length)
    throw new Error("Combine duplicate batches into one bill line.");
  if (!["Cash", "Card", "Credit"].includes(payment))
    throw new Error("Choose a valid payment method.");
  if (payment === "Credit" && !customerId)
    throw new Error("Select a customer for a credit sale.");
  if (customerId && !db.customers.some((c) => c.id === customerId))
    throw new Error("The selected customer no longer exists.");
  const next = structuredClone(db);
  const lines: SaleLine[] = cart.map((l) => {
    const b = next.batches.find((b) => b.id === l.batchId);
    if (!b || !eligible(b))
      throw new Error("A selected batch is expired, blocked or unavailable.");
    if (!Number.isInteger(l.qty) || l.qty <= 0 || l.qty > b.qty)
      throw new Error("Quantity exceeds available stock or is invalid.");
    if (!Number.isFinite(l.discount) || l.discount < 0 || l.discount > 100)
      throw new Error("Item discount must be 0–100%.");
    b.qty -= l.qty;
    const m = next.medicines.find((m) => m.id === b.medicineId)!;
    return {
      ...l,
      name: `${m.name} ${m.strength}`,
      batch: b.number,
      expiry: b.expiry,
      price: b.price,
      cost: b.cost,
      returned: 0,
    };
  });
  const total = totals(lines, billDiscount).total;
  if (
    !Number.isFinite(tendered) ||
    tendered < 0 ||
    (payment !== "Credit" && tendered < total)
  )
    throw new Error("Payment must cover the bill total.");
  const customer = db.customers.find((c) => c.id === customerId);
  const sale: Sale = {
    id: `INV-${String(db.sales.length + 1).padStart(5, "0")}`,
    date: new Date().toISOString(),
    customerId,
    customerName: customer?.name || "Walk-in customer",
    payment,
    paid: payment === "Credit" ? Math.min(total, tendered) : total,
    discount: billDiscount,
    lines,
    total,
  };
  next.sales.unshift(sale);
  lines.forEach((l) =>
    next.movements.unshift({
      id: crypto.randomUUID(),
      date: sale.date,
      batchId: l.batchId,
      qty: -l.qty,
      type: "Sale",
      reference: sale.id,
    }),
  );
  return { db: next, sale };
}
export function returnSale(
  db: Database,
  saleId: string,
  batchId: string,
  qty: number,
  reason: string,
) {
  const next = structuredClone(db);
  const sale = next.sales.find((s) => s.id === saleId);
  const line = sale?.lines.find((l) => l.batchId === batchId);
  if (
    !sale ||
    !line ||
    !Number.isInteger(qty) ||
    qty <= 0 ||
    qty > line.qty - line.returned
  )
    throw new Error("Return quantity exceeds the remaining sold quantity.");
  if (!reason.trim()) throw new Error("Enter a return reason.");
  const net = totals(sale.lines).total;
  const factor =
    line.price *
    (1 - line.discount / 100) *
    (net ? (net - sale.discount) / net : 0);
  // Difference of cumulative rounded amounts prevents repeated partial returns from over-refunding a line.
  const refund = round(
    round(factor * (line.returned + qty)) - round(factor * line.returned),
  );
  line.returned += qty;
  const finalRefund = sale.lines.every((l) => l.returned === l.qty)
    ? round(
        sale.total -
          next.returns
            .filter((r) => r.saleId === sale.id)
            .reduce((n, r) => n + r.refund, 0),
      )
    : refund;
  // Returned medicine remains quarantined until physically inspected; never re-add to sellable stock.
  next.returns.unshift({
    id: crypto.randomUUID(),
    saleId,
    batchId,
    qty,
    refund: finalRefund,
    reason,
    date: new Date().toISOString(),
  });
  next.movements.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    batchId,
    qty,
    type: "Return • quarantine",
    reference: saleId,
  });
  return next;
}
export function validateBackup(value: unknown): value is Database {
  if (!value || typeof value !== "object") return false;
  const d = value as Database;
  const text = (v: unknown) => typeof v === "string";
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;
  const date = (v: unknown) =>
    text(v) && Number.isFinite(Date.parse(v as string));
  const list = (v: unknown): v is Record<string, unknown>[] =>
    Array.isArray(v) && v.every((x) => x && typeof x === "object");
  if (
    d.version !== 1 ||
    !list(d.medicines) ||
    !list(d.batches) ||
    !list(d.customers) ||
    !list(d.suppliers) ||
    !list(d.sales) ||
    !list(d.purchases) ||
    !list(d.movements) ||
    !list(d.returns)
  )
    return false;
  if (
    !d.settings ||
    !text(d.settings.name) ||
    !text(d.settings.address) ||
    !text(d.settings.phone) ||
    !text(d.settings.receiptNote) ||
    !["80mm", "A4"].includes(d.settings.paper) ||
    !num(d.settings.alertDays)
  )
    return false;
  if (
    !d.medicines.every(
      (m) =>
        [
          "id",
          "name",
          "generic",
          "strength",
          "form",
          "category",
          "manufacturer",
          "barcode",
          "rack",
        ].every((k) => text(m[k as keyof Medicine])) &&
        num(m.price) &&
        num(m.reorder) &&
        Number.isInteger(m.unitsPerPack) &&
        m.unitsPerPack > 0,
    )
  )
    return false;
  if (
    new Set(d.medicines.map((m) => m.id)).size !== d.medicines.length ||
    new Set(d.batches.map((b) => b.id)).size !== d.batches.length
  )
    return false;
  if (
    !d.batches.every(
      (b) =>
        text(b.id) &&
        text(b.number) &&
        text(b.supplierId) &&
        /^\d{4}-\d{2}-\d{2}$/.test(b.expiry) &&
        Number.isFinite(Date.parse(b.expiry)) &&
        Number.isInteger(b.qty) &&
        b.qty >= 0 &&
        num(b.cost) &&
        num(b.price) &&
        ["available", "quarantine"].includes(b.status) &&
        d.medicines.some((m) => m.id === b.medicineId),
    )
  )
    return false;
  if (
    ![...d.customers, ...d.suppliers].every(
      (p) => text(p.id) && text(p.name) && text(p.phone) && text(p.address),
    )
  )
    return false;
  if (
    !d.sales.every(
      (s) =>
        text(s.id) &&
        date(s.date) &&
        text(s.customerName) &&
        text(s.customerId) &&
        (s.customerId === "" ||
          d.customers.some((c) => c.id === s.customerId)) &&
        ["Cash", "Card", "Credit"].includes(s.payment) &&
        num(s.total) &&
        num(s.paid) &&
        s.paid <= s.total &&
        num(s.discount) &&
        list(s.lines) &&
        s.lines.length > 0 &&
        new Set(s.lines.map((l) => l.batchId)).size === s.lines.length &&
        s.lines.every(
          (l) =>
            text(l.name) &&
            text(l.batch) &&
            date(l.expiry) &&
            d.batches.some((b) => b.id === l.batchId) &&
            Number.isInteger(l.qty) &&
            l.qty > 0 &&
            num(l.price) &&
            num(l.cost) &&
            num(l.discount) &&
            l.discount <= 100 &&
            Number.isInteger(l.returned) &&
            l.returned >= 0 &&
            l.returned <= l.qty,
        ),
    )
  )
    return false;
  if (
    !d.sales.every((s) => {
      try {
        return totals(s.lines, s.discount).total === s.total;
      } catch {
        return false;
      }
    })
  )
    return false;
  for (const records of [
    d.medicines,
    d.batches,
    d.customers,
    d.suppliers,
    d.sales,
    d.purchases,
    d.movements,
    d.returns,
  ])
    if (new Set(records.map((r) => r.id)).size !== records.length) return false;
  if (d.lastBackup !== null && !date(d.lastBackup)) return false;
  if (!validatePurchasing(d)) return false;
  return (
    d.purchases.every(
      (p) =>
        text(p.id) &&
        date(p.date) &&
        text(p.reference) &&
        d.suppliers.some((s) => s.id === p.supplierId) &&
        d.batches.some((b) => b.id === p.batchId) &&
        Number.isInteger(p.qty) &&
        p.qty > 0 &&
        num(p.total),
    ) &&
    d.movements.every(
      (m) =>
        text(m.id) &&
        date(m.date) &&
        d.batches.some((b) => b.id === m.batchId) &&
        text(m.type) &&
        text(m.reference) &&
        Number.isInteger(m.qty),
    ) &&
    d.returns.every(
      (r) =>
        text(r.id) &&
        d.sales.some(
          (s) =>
            s.id === r.saleId && s.lines.some((l) => l.batchId === r.batchId),
        ) &&
        date(r.date) &&
        text(r.reason) &&
        Number.isInteger(r.qty) &&
        r.qty > 0 &&
        num(r.refund),
    )
  );
}
