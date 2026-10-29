import type { Database, Medicine, Purchase } from "./domain";

export type Company = { id: string; name: string };
export type DistributorCompany = { supplierId: string; companyId: string };
export type PurchaseInput = {
  companyId: string;
  medicineId: string;
  number: string;
  expiry: string;
  qty: number;
  bonus: number;
  unit: "unit" | "pack";
  rate: number;
  discount: number;
  tax: number;
  sellingPrice: number;
};
export type PurchaseLine = PurchaseInput & {
  id: string;
  batchId: string;
  medicineName: string;
  companyName: string;
  factor: number;
  receivedUnits: number;
  gross: number;
  discountAmount: number;
  net: number;
  taxAmount: number;
  total: number;
  costPerUnit: number;
};
export type SupplierPayment = {
  id: string;
  purchaseId: string;
  supplierId: string;
  date: string;
  amount: number;
  reference: string;
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const businessDay = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const validDate = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const number = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
const text = (s: unknown): s is string =>
  typeof s === "string" && s.trim().length > 0;

/** Additive v1 migration. Historical distributor/company links come only from recorded stock. */
export function normalizePurchasing(source: Database): Database {
  if (
    source.companies &&
    source.distributorCompanies &&
    source.supplierPayments
  )
    return source;
  const db = structuredClone(source);
  db.companies ??= [];
  db.distributorCompanies ??= [];
  db.supplierPayments ??= [];
  for (const m of db.medicines) {
    if (!m.companyId) {
      let company = db.companies.find(
        (c) => c.name.toLowerCase() === m.manufacturer.trim().toLowerCase(),
      );
      if (!company) {
        company = {
          id: `legacy-company-${m.id}`,
          name: m.manufacturer.trim() || "Unspecified company",
        };
        db.companies.push(company);
      }
      m.companyId = company.id;
    }
    for (const b of db.batches.filter((b) => b.medicineId === m.id))
      if (
        db.suppliers.some((s) => s.id === b.supplierId) &&
        !db.distributorCompanies.some(
          (l) => l.supplierId === b.supplierId && l.companyId === m.companyId,
        )
      )
        db.distributorCompanies.push({
          supplierId: b.supplierId,
          companyId: m.companyId,
        });
  }
  return db;
}
export function companyMedicines(
  db: Database,
  supplierId: string,
  companyId: string,
): Medicine[] {
  if (
    !db.distributorCompanies?.some(
      (l) => l.supplierId === supplierId && l.companyId === companyId,
    )
  )
    return [];
  return db.medicines.filter((m) => m.companyId === companyId);
}
export function linkCompany(
  source: Database,
  supplierId: string,
  companyId: string,
  name = "",
): Database {
  const db = structuredClone(normalizePurchasing(source));
  if (!db.suppliers.some((s) => s.id === supplierId))
    throw new Error("Select a valid distributor.");
  if (!companyId) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Enter the company name.");
    const existing = db.companies!.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    companyId = existing?.id || crypto.randomUUID();
    if (!existing) db.companies!.push({ id: companyId, name: trimmed });
  }
  if (!db.companies!.some((c) => c.id === companyId))
    throw new Error("Select a valid company.");
  if (
    db.distributorCompanies!.some(
      (l) => l.supplierId === supplierId && l.companyId === companyId,
    )
  )
    throw new Error("This company is already linked to the distributor.");
  db.distributorCompanies!.push({ supplierId, companyId });
  return db;
}
export function calculatePurchaseLine(input: PurchaseInput, factor: number) {
  if (
    !Number.isSafeInteger(input.qty) ||
    input.qty <= 0 ||
    !Number.isSafeInteger(input.bonus) ||
    input.bonus < 0
  )
    throw new Error(
      "Purchased quantity must be positive and bonus must be a whole number.",
    );
  if (
    !Number.isSafeInteger(factor) ||
    factor < 1 ||
    !Number.isSafeInteger((input.qty + input.bonus) * factor)
  )
    throw new Error("Invalid pack conversion or quantity.");
  if (
    !number(input.rate) ||
    !number(input.sellingPrice) ||
    input.sellingPrice === 0 ||
    !number(input.discount) ||
    input.discount > 100 ||
    !number(input.tax) ||
    input.tax > 100
  )
    throw new Error(
      "Enter valid rates. Discount and tax must be between 0 and 100%.",
    );
  const gross = round(input.qty * input.rate);
  const discountAmount = round((gross * input.discount) / 100);
  const net = round(gross - discountAmount);
  const taxAmount = round((net * input.tax) / 100);
  const receivedUnits = (input.qty + input.bonus) * factor;
  if (!Number.isSafeInteger(Math.round((net + taxAmount) * 100)))
    throw new Error("Purchase amount is too large.");
  return {
    factor,
    receivedUnits,
    gross,
    discountAmount,
    net,
    taxAmount,
    total: round(net + taxAmount),
    costPerUnit: net / receivedUnits,
  };
}
export function purchaseTotals(
  lines: Pick<
    PurchaseLine,
    "gross" | "discountAmount" | "net" | "taxAmount" | "total"
  >[],
) {
  return {
    subtotal: round(lines.reduce((s, l) => s + l.gross, 0)),
    discountTotal: round(lines.reduce((s, l) => s + l.discountAmount, 0)),
    net: round(lines.reduce((s, l) => s + l.net, 0)),
    taxTotal: round(lines.reduce((s, l) => s + l.taxAmount, 0)),
    total: round(lines.reduce((s, l) => s + l.total, 0)),
  };
}
export function purchasePaid(db: Database, p: Purchase) {
  return round(
    (p.paid ?? p.total) +
      (db.supplierPayments || [])
        .filter((x) => x.purchaseId === p.id)
        .reduce((s, x) => s + x.amount, 0),
  );
}
export function purchaseDue(db: Database, p: Purchase) {
  return round(p.total - purchasePaid(db, p));
}
export function receivePurchase(
  source: Database,
  input: {
    supplierId: string;
    reference: string;
    invoiceDate: string;
    paid: number;
    lines: PurchaseInput[];
  },
): { db: Database; purchase: Purchase } {
  const db = structuredClone(normalizePurchasing(source));
  const supplier = db.suppliers.find((s) => s.id === input.supplierId);
  if (!supplier) throw new Error("Select a distributor.");
  const reference = input.reference.trim();
  if (!reference) throw new Error("Enter the distributor invoice number.");
  if (
    db.purchases.some(
      (p) =>
        p.supplierId === input.supplierId &&
        p.reference.trim().toLowerCase() === reference.toLowerCase(),
    )
  )
    throw new Error(
      "This invoice number is already recorded for the distributor.",
    );
  if (!validDate(input.invoiceDate) || input.invoiceDate > businessDay())
    throw new Error("Enter a valid invoice date, no later than today.");
  if (!input.lines.length)
    throw new Error("Add at least one medicine to the purchase.");
  const keys = new Set<string>();
  const lines: PurchaseLine[] = input.lines.map((l) => {
    const m = companyMedicines(db, input.supplierId, l.companyId).find(
      (m) => m.id === l.medicineId,
    );
    if (!m)
      throw new Error(
        "The medicine does not belong to this distributor/company chain.",
      );
    if (!text(l.number) || !validDate(l.expiry) || l.expiry < businessDay())
      throw new Error("Enter a batch number and an unexpired expiry date.");
    if (!["unit", "pack"].includes(l.unit))
      throw new Error("Choose units or packs.");
    const key = `${m.id}|${l.number.trim().toLowerCase()}`;
    if (keys.has(key))
      throw new Error(
        "Combine the same medicine/batch into a single invoice line.",
      );
    keys.add(key);
    const old = db.batches.find(
      (b) =>
        b.medicineId === m.id &&
        b.number.trim().toLowerCase() === l.number.trim().toLowerCase(),
    );
    if (old && old.expiry !== l.expiry)
      throw new Error(
        "This batch already has a different expiry date. Check the supplier bill.",
      );
    const amounts = calculatePurchaseLine(
      l,
      l.unit === "pack" ? m.unitsPerPack : 1,
    );
    return {
      ...l,
      number: l.number.trim(),
      id: crypto.randomUUID(),
      batchId: crypto.randomUUID(),
      medicineName: `${m.name} ${m.strength}`.trim(),
      companyName: db.companies!.find((c) => c.id === l.companyId)!.name,
      ...amounts,
    };
  });
  const amounts = purchaseTotals(lines);
  if (
    !number(input.paid) ||
    round(input.paid) !== input.paid ||
    input.paid > amounts.total
  )
    throw new Error(
      "Amount paid must be between zero and the invoice total (up to 2 decimals).",
    );
  const purchase: Purchase = {
    id: `PUR-${String(db.purchases.length + 1).padStart(5, "0")}`,
    date: new Date().toISOString(),
    invoiceDate: input.invoiceDate,
    supplierId: supplier.id,
    distributorName: supplier.name,
    reference,
    ...amounts,
    paid: input.paid,
    lines,
    batchId: lines[0].batchId,
    qty: lines.reduce((s, l) => s + l.receivedUnits, 0),
  };
  // Each receipt is its own valuation lot: same physical batch can be received again at a different cost.
  for (const l of lines) {
    db.batches.push({
      id: l.batchId,
      medicineId: l.medicineId,
      number: l.number,
      expiry: l.expiry,
      qty: l.receivedUnits,
      cost: l.costPerUnit,
      price: l.sellingPrice,
      status: db.batches.some(
        (b) =>
          b.medicineId === l.medicineId &&
          b.number.toLowerCase() === l.number.toLowerCase() &&
          b.status === "quarantine",
      )
        ? "quarantine"
        : "available",
      supplierId: supplier.id,
    });
    db.movements.unshift({
      id: crypto.randomUUID(),
      date: purchase.date,
      batchId: l.batchId,
      qty: l.receivedUnits,
      type: "Purchase receipt",
      reference: purchase.id,
    });
  }
  db.purchases.unshift(purchase);
  return { db, purchase };
}
export function recordSupplierPayment(
  source: Database,
  purchaseId: string,
  amount: number,
  reference: string,
) {
  const db = structuredClone(normalizePurchasing(source));
  const p = db.purchases.find((p) => p.id === purchaseId);
  if (!p) throw new Error("Purchase invoice not found.");
  if (
    !number(amount) ||
    amount <= 0 ||
    round(amount) !== amount ||
    amount > purchaseDue(db, p)
  )
    throw new Error(
      "Payment must be positive and cannot exceed this invoice balance.",
    );
  db.supplierPayments!.push({
    id: crypto.randomUUID(),
    purchaseId,
    supplierId: p.supplierId,
    date: new Date().toISOString(),
    amount,
    reference: reference.trim(),
  });
  return db;
}

export function setPhysicalBatchStatus(
  source: Database,
  batchId: string,
  status: "available" | "quarantine",
) {
  const db = structuredClone(source);
  const batch = db.batches.find((b) => b.id === batchId);
  if (!batch) throw new Error("Batch not found.");
  const lots = db.batches.filter(
    (b) =>
      b.medicineId === batch.medicineId &&
      b.number.trim().toLowerCase() === batch.number.trim().toLowerCase(),
  );
  if (status === "available" && lots.some((b) => b.expiry < businessDay()))
    throw new Error("Expired stock cannot be released for sale.");
  for (const lot of lots) {
    lot.status = status;
    db.movements.unshift({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      batchId: lot.id,
      qty: 0,
      type: status === "quarantine" ? "Batch quarantined" : "Batch released",
      reference: batch.number,
    });
  }
  return db;
}

export function validatePurchasing(db: Database): boolean {
  // Older backups without supply-chain metadata remain importable and are migrated on load.
  if (
    db.companies === undefined &&
    db.distributorCompanies === undefined &&
    db.supplierPayments === undefined
  )
    return !db.purchases.some((p) => p.lines !== undefined);
  if (
    !Array.isArray(db.companies) ||
    !Array.isArray(db.distributorCompanies) ||
    !Array.isArray(db.supplierPayments)
  )
    return false;
  if (
    !db.companies.every((c) => c && text(c.id) && text(c.name)) ||
    new Set(db.companies.map((c) => c.id)).size !== db.companies.length
  )
    return false;
  if (
    !db.distributorCompanies.every(
      (l) =>
        l &&
        db.suppliers.some((s) => s.id === l.supplierId) &&
        db.companies!.some((c) => c.id === l.companyId),
    ) ||
    new Set(
      db.distributorCompanies.map((l) => `${l.supplierId}|${l.companyId}`),
    ).size !== db.distributorCompanies.length
  )
    return false;
  if (
    !db.medicines.every((m) => db.companies!.some((c) => c.id === m.companyId))
  )
    return false;
  if (
    !db.supplierPayments.every(
      (p) =>
        p &&
        text(p.id) &&
        typeof p.reference === "string" &&
        text(p.date) &&
        Number.isFinite(Date.parse(p.date)) &&
        number(p.amount) &&
        p.amount > 0 &&
        db.purchases.some(
          (x) => x.id === p.purchaseId && x.supplierId === p.supplierId,
        ),
    )
  )
    return false;
  if (
    new Set(db.supplierPayments.map((p) => p.id)).size !==
    db.supplierPayments.length
  )
    return false;
  return db.purchases.every((p) => {
    if (p.lines === undefined) return p.paid === undefined;
    if (
      !Array.isArray(p.lines) ||
      !p.lines.length ||
      !validDate(p.invoiceDate) ||
      !text(p.distributorName) ||
      !number(p.paid) ||
      p.paid > p.total
    )
      return false;
    try {
      if (
        !p.lines.every(
          (l) =>
            l &&
            text(l.id) &&
            text(l.medicineName) &&
            text(l.companyName) &&
            text(l.number) &&
            validDate(l.expiry) &&
            db.medicines.some(
              (m) =>
                m.id === l.medicineId &&
                m.companyId === l.companyId &&
                (l.unit === "unit"
                  ? l.factor === 1
                  : l.factor === m.unitsPerPack),
            ) &&
            db.companies!.some((c) => c.id === l.companyId) &&
            db.batches.some(
              (b) =>
                b.id === l.batchId &&
                b.medicineId === l.medicineId &&
                b.supplierId === p.supplierId,
            ) &&
            ["unit", "pack"].includes(l.unit) &&
            Object.entries(calculatePurchaseLine(l, l.factor)).every(
              ([key, v]) =>
                Math.abs(v - (l[key as keyof PurchaseLine] as number)) <
                0.000001,
            ),
        )
      )
        return false;
      const t = purchaseTotals(p.lines);
      return (
        new Set(p.lines.map((l) => l.id)).size === p.lines.length &&
        new Set(p.lines.map((l) => l.batchId)).size === p.lines.length &&
        p.batchId === p.lines[0].batchId &&
        t.total === p.total &&
        t.subtotal === p.subtotal &&
        t.taxTotal === p.taxTotal &&
        t.discountTotal === p.discountTotal &&
        p.qty === p.lines.reduce((s, l) => s + l.receivedUnits, 0) &&
        purchaseDue(db, p) >= 0
      );
    } catch {
      return false;
    }
  });
}
