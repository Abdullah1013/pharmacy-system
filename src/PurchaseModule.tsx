import { useState } from "react";
import type { Database, Purchase } from "./domain";
import { money, today } from "./domain";
import {
  calculatePurchaseLine,
  companyMedicines,
  linkCompany,
  purchaseDue,
  purchasePaid,
  purchaseTotals,
  receivePurchase,
  recordSupplierPayment,
} from "./purchasing";
import type { PurchaseInput, PurchaseLine } from "./purchasing";
import {
  ArrowRight,
  Building2,
  Check,
  FileText,
  Package,
  Plus,
  Printer,
  Trash2,
  Truck,
} from "lucide-react";
import "./purchasing.css";

type Props = {
  db: Database;
  commit: (db: Database) => boolean;
  notify: (message: string) => void;
};
function run(action: () => void, notify: Props["notify"]) {
  try {
    action();
  } catch (e) {
    notify((e as Error).message);
  }
}
const blank = (): PurchaseInput => ({
  companyId: "",
  medicineId: "",
  number: "",
  expiry: "",
  qty: 1,
  bonus: 0,
  unit: "unit",
  rate: 0,
  discount: 0,
  tax: 0,
  sellingPrice: 0,
});

export function PurchaseForm({
  db,
  onSave,
  onCancel,
}: {
  db: Database;
  onSave: (db: Database, purchase: Purchase) => void;
  onCancel: () => void;
}) {
  const [supplierId, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [invoiceDate, setDate] = useState(today());
  const [paid, setPaid] = useState("0");
  const [draft, setDraft] = useState<PurchaseInput>(blank);
  const [items, setItems] = useState<PurchaseInput[]>([]);
  const [error, setError] = useState("");
  const companies = (db.companies || []).filter((c) =>
    db.distributorCompanies?.some(
      (l) => l.supplierId === supplierId && l.companyId === c.id,
    ),
  );
  const medicines = companyMedicines(db, supplierId, draft.companyId);
  const medicine = db.medicines.find((m) => m.id === draft.medicineId);
  function preview(l: PurchaseInput) {
    return calculatePurchaseLine(
      l,
      l.unit === "pack"
        ? db.medicines.find((m) => m.id === l.medicineId)?.unitsPerPack || 1
        : 1,
    );
  }
  const total = purchaseTotals(items.map(preview));
  let lineAmount = 0;
  try {
    lineAmount = preview(draft).total;
  } catch {
    /* Incomplete editor has no committed value. */
  }
  function field<K extends keyof PurchaseInput>(
    key: K,
    value: PurchaseInput[K],
  ) {
    setDraft({ ...draft, [key]: value });
    setError("");
  }
  function addItem() {
    try {
      if (
        !medicine ||
        !draft.number.trim() ||
        !draft.expiry ||
        draft.expiry < today()
      )
        throw new Error(
          "Select a company and medicine, then enter the batch number and an unexpired expiry date.",
        );
      preview(draft);
      if (
        items.some(
          (l) =>
            l.medicineId === draft.medicineId &&
            l.number.trim().toLowerCase() === draft.number.trim().toLowerCase(),
        )
      )
        throw new Error(
          "This medicine/batch is already in the invoice. Remove its row to replace it.",
        );
      setItems([...items, { ...draft }]);
      setDraft({ ...blank(), companyId: draft.companyId });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="purchase-form">
      <div className="eyebrow">PURCHASE / DISTRIBUTOR INVOICE</div>
      <h2>Receive a purchase</h2>
      <p>
        One distributor per invoice. Add medicines from any of its linked
        companies.
      </p>
      <div className="purchase-steps">
        <span>
          <b>1</b>Distributor
        </span>
        <ArrowRight size={13} />
        <span>
          <b>2</b>Company & medicines
        </span>
        <ArrowRight size={13} />
        <span>
          <b>3</b>Review & save
        </span>
      </div>
      <div className="purchase-header-fields">
        <label>
          Distributor
          <select
            aria-label="Purchase distributor"
            value={supplierId}
            disabled={items.length > 0}
            onChange={(e) => {
              setSupplier(e.target.value);
              setDraft(blank());
            }}
          >
            <option value="">Select distributor</option>
            {db.suppliers.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Distributor invoice number
          <input
            aria-label="Distributor invoice number"
            value={reference}
            maxLength={100}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label>
          Invoice date
          <input
            aria-label="Purchase invoice date"
            type="date"
            max={today()}
            value={invoiceDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      {items.length > 0 && (
        <div className="purchase-hint">
          Distributor is fixed while items are added. Remove all rows to change
          it.
        </div>
      )}
      <section className="purchase-item-editor">
        <div className="purchase-section-title">
          <Package size={17} />
          <strong>Add an invoice item</strong>
          <small>Choose company first, then medicine</small>
        </div>
        <div className="purchase-editor-grid">
          <label>
            Company
            <select
              aria-label="Purchase company"
              disabled={!supplierId}
              value={draft.companyId}
              onChange={(e) =>
                setDraft({ ...blank(), companyId: e.target.value })
              }
            >
              <option value="">Select linked company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            Medicine
            <select
              aria-label="Purchase medicine"
              value={draft.medicineId}
              disabled={!draft.companyId}
              onChange={(e) => {
                const m = db.medicines.find((m) => m.id === e.target.value);
                setDraft({
                  ...draft,
                  medicineId: e.target.value,
                  sellingPrice: m?.price || 0,
                });
              }}
            >
              <option value="">Select medicine</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.strength}
                </option>
              ))}
            </select>
          </label>
          <label>
            Batch number
            <input
              aria-label="Purchase batch number"
              value={draft.number}
              maxLength={60}
              onChange={(e) => field("number", e.target.value)}
            />
          </label>
          <label>
            Expiry
            <input
              aria-label="Purchase expiry"
              type="date"
              min={today()}
              value={draft.expiry}
              onChange={(e) => field("expiry", e.target.value)}
            />
          </label>
          <label>
            Buying unit
            <select
              aria-label="Buying unit"
              value={draft.unit}
              onChange={(e) => field("unit", e.target.value as "pack" | "unit")}
            >
              <option value="unit">Base units</option>
              <option value="pack">
                Packs ({medicine?.unitsPerPack || 1} units each)
              </option>
            </select>
          </label>
          {(
            [
              { key: "qty", label: "Purchased quantity", min: 1, step: 1 },
              { key: "bonus", label: "Bonus quantity", min: 0, step: 1 },
              {
                key: "rate",
                label: `Purchase price / ${draft.unit} (Rs.)`,
                min: 0,
                step: 0.01,
              },
              {
                key: "discount",
                label: "Discount %",
                min: 0,
                step: 0.01,
                max: 100,
              },
              {
                key: "tax",
                label: "GST / tax %",
                min: 0,
                step: 0.01,
                max: 100,
              },
              {
                key: "sellingPrice",
                label: "Selling price / base unit (Rs.)",
                min: 0.01,
                step: 0.01,
              },
            ] as const
          ).map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                aria-label={f.label}
                type="number"
                min={f.min}
                step={f.step}
                max={"max" in f ? f.max : undefined}
                value={draft[f.key]}
                onChange={(e) => field(f.key, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        <div className="purchase-editor-footer">
          <span>
            Line total <strong>Rs. {money(lineAmount)}</strong>
          </span>
          <button
            className="secondary"
            disabled={!supplierId || !draft.medicineId}
            onClick={addItem}
          >
            <Plus size={16} />
            Add item to invoice
          </button>
        </div>
      </section>
      {supplierId && companies.length === 0 && (
        <div className="purchase-error">
          No companies linked. Open Distributors → Manage company links before
          receiving stock.
        </div>
      )}
      <div className="purchase-hint">
        Bonus is not billed. Tax applies to the amount after discount. Stock
        cost excludes tax and spreads net cost across purchased + bonus units.
      </div>
      <div className="table-scroll purchase-lines">
        <table>
          <thead>
            <tr>
              <th>Medicine / company</th>
              <th>Batch / expiry</th>
              <th>Qty + bonus</th>
              <th>Rate</th>
              <th>Disc.</th>
              <th>Tax</th>
              <th className="right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={i}>
                <td>
                  <strong>
                    {db.medicines.find((m) => m.id === l.medicineId)?.name}
                  </strong>
                  <small>
                    {db.companies?.find((c) => c.id === l.companyId)?.name}
                  </small>
                </td>
                <td>
                  {l.number}
                  <small>{l.expiry}</small>
                </td>
                <td>
                  {l.qty} + {l.bonus} {l.unit}
                  <small>{preview(l).receivedUnits} base units</small>
                </td>
                <td>{money(l.rate)}</td>
                <td>{l.discount}%</td>
                <td>{l.tax}%</td>
                <td className="right">{money(preview(l).total)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Remove purchase item ${i + 1}`}
                    onClick={() => setItems(items.filter((_, n) => n !== i))}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="purchase-empty">
            No items added yet. Build the invoice using the item editor above.
          </div>
        )}
      </div>
      <div className="purchase-summary">
        <div>
          <span>Subtotal</span>
          <strong>{money(total.subtotal)}</strong>
          <span>Discount</span>
          <strong>− {money(total.discountTotal)}</strong>
          <span>Tax</span>
          <strong>{money(total.taxTotal)}</strong>
        </div>
        <div className="purchase-grand">
          <span>Grand total (PKR)</span>
          <strong>{money(total.total)}</strong>
        </div>
        <label>
          Amount paid now (Rs.)
          <input
            aria-label="Purchase amount paid"
            type="number"
            min="0"
            max={total.total}
            step="0.01"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
          />
        </label>
        <div>
          <span>Distributor payable</span>
          <strong>Rs. {money(total.total - Number(paid || 0))}</strong>
        </div>
      </div>
      {error && (
        <div role="alert" className="purchase-error">
          {error}
        </div>
      )}
      <div className="form-footer">
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={!items.length}
          onClick={() => {
            try {
              if (draft.medicineId)
                throw new Error(
                  "Add the medicine currently in the editor to the invoice first.",
                );
              const result = receivePurchase(db, {
                supplierId,
                reference,
                invoiceDate,
                paid: Number(paid),
                lines: items,
              });
              onSave(result.db, result.purchase);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Check size={16} />
          Save purchase & update stock
        </button>
      </div>
    </div>
  );
}

export function PurchaseWorkspace({
  db,
  commit,
  notify,
  onView,
  onReceive,
}: Props & { onView: (p: Purchase) => void; onReceive: () => void }) {
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const rows = db.purchases.filter(
    (p) =>
      (!supplier || p.supplierId === supplier) &&
      `${p.id} ${p.reference} ${p.distributorName || db.suppliers.find((s) => s.id === p.supplierId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const total = rows.reduce((s, p) => s + p.total, 0),
    due = rows.reduce((s, p) => s + purchaseDue(db, p), 0);
  return (
    <>
      <div className="compact-stats">
        <div className="mini-stat">
          <span>Purchase invoices</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="mini-stat">
          <span>Total purchased</span>
          <strong>Rs. {money(total)}</strong>
        </div>
        <div className="mini-stat">
          <span>Recorded payments</span>
          <strong>Rs. {money(total - due)}</strong>
        </div>
        <div className="mini-stat">
          <span>Distributor payable</span>
          <strong>Rs. {money(due)}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="toolbar">
          <input
            className="purchase-search"
            aria-label="Search purchases"
            placeholder="Search invoice, reference or distributor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Filter purchase distributor"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">All distributors</option>
            {db.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Purchase / invoice</th>
                <th>Distributor</th>
                <th>Invoice date</th>
                <th>Items / units</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="invoice-link" onClick={() => onView(p)}>
                      {p.id}
                    </button>
                    <small>{p.reference}</small>
                  </td>
                  <td>
                    {p.distributorName ||
                      db.suppliers.find((s) => s.id === p.supplierId)?.name}
                  </td>
                  <td>{p.invoiceDate || p.date.slice(0, 10)}</td>
                  <td>
                    {p.lines?.length || 1} items
                    <small>{p.qty} base units</small>
                  </td>
                  <td>{money(p.total)}</td>
                  <td>{money(purchasePaid(db, p))}</td>
                  <td>
                    <strong>{money(purchaseDue(db, p))}</strong>
                  </td>
                  <td>
                    {purchaseDue(db, p) > 0 ? (
                      <button
                        className="text-button"
                        onClick={() => {
                          setPaymentId(p.id);
                          setAmount(String(purchaseDue(db, p)));
                          setReference("");
                        }}
                      >
                        Record payment
                      </button>
                    ) : (
                      <span className="badge success">Paid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="purchase-empty">
              <FileText size={28} />
              <h3>No purchase invoices yet</h3>
              <p>
                Receive medicines from a distributor to update stock and its
                payable.
              </p>
              <button className="secondary" onClick={onReceive}>
                <Plus size={15} />
                Receive stock
              </button>
            </div>
          )}
        </div>
      </section>
      {paymentId && (
        <form
          className="panel purchase-payment"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => {
              if (
                commit(
                  recordSupplierPayment(
                    db,
                    paymentId,
                    Number(amount),
                    reference,
                  ),
                )
              ) {
                setPaymentId("");
                notify(
                  "Distributor payment recorded. Invoice balance updated.",
                );
              }
            }, notify);
          }}
        >
          <h2>Payment against {paymentId}</h2>
          <div className="purchase-header-fields">
            <label>
              Payment amount (Rs.)
              <input
                aria-label="Supplier payment amount"
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Payment reference / note
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={100}
              />
            </label>
            <button className="primary" type="submit">
              Save payment
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setPaymentId("")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export function DistributorWorkspace({
  db,
  commit,
  notify,
  onAddMedicine,
  onViewPurchase,
}: Props & {
  onAddMedicine: (supplierId: string, companyId: string) => void;
  onViewPurchase: (p: Purchase) => void;
}) {
  const [selected, setSelected] = useState(db.suppliers[0]?.id || "");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [linking, setLinking] = useState(false);
  const [tab, setTab] = useState("Companies & medicines");
  const [query, setQuery] = useState("");
  const distributor = db.suppliers.find((s) => s.id === selected);
  const companies = (db.companies || []).filter((c) =>
    db.distributorCompanies?.some(
      (l) => l.supplierId === selected && l.companyId === c.id,
    ),
  );
  const purchases = db.purchases.filter((p) => p.supplierId === selected);
  const due = purchases.reduce((s, p) => s + purchaseDue(db, p), 0);
  return (
    <div className="distributor-layout">
      <section className="panel distributor-list">
        <div className="panel-heading">
          <h2>Distributors</h2>
          <Truck size={18} />
        </div>
        <input
          aria-label="Search distributors"
          placeholder="Find a distributor…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {db.suppliers
          .filter((s) =>
            `${s.name} ${s.phone}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((s) => (
            <button
              className={selected === s.id ? "selected" : ""}
              key={s.id}
              onClick={() => {
                setSelected(s.id);
                setLinking(false);
                setCompany("");
                setName("");
              }}
            >
              <span className="quick-icon">
                <Truck size={18} />
              </span>
              <span>
                <strong>{s.name}</strong>
                <small>
                  {db.distributorCompanies?.filter((l) => l.supplierId === s.id)
                    .length || 0}{" "}
                  companies
                </small>
              </span>
            </button>
          ))}
      </section>
      <div>
        {distributor ? (
          <>
            <section className="panel distributor-profile">
              <div>
                <span className="eyebrow">DISTRIBUTOR / SUPPLY CHAIN</span>
                <h2>{distributor.name}</h2>
                <p>
                  {distributor.phone || "No phone"} ·{" "}
                  {distributor.address || "No address"}
                </p>
              </div>
              <div>
                <span>Outstanding payable</span>
                <strong>Rs. {money(due)}</strong>
              </div>
            </section>
            <div className="supply-tabs">
              {["Companies & medicines", "Distributor ledger"].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "selected" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "Companies & medicines" ? (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Companies under this distributor</h2>
                    <p>
                      Linked companies share one medicine catalogue across
                      distributors.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setLinking(!linking)}
                  >
                    <Plus size={15} />
                    Manage company links
                  </button>
                </div>
                {linking && (
                  <form
                    className="company-link-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(() => {
                        if (commit(linkCompany(db, selected, company, name))) {
                          setLinking(false);
                          setName("");
                          setCompany("");
                          notify("Company linked to distributor.");
                        }
                      }, notify);
                    }}
                  >
                    <label>
                      Link existing company
                      <select
                        aria-label="Link existing company"
                        value={company}
                        onChange={(e) => {
                          setCompany(e.target.value);
                          setName("");
                        }}
                      >
                        <option value="">Create a new company instead</option>
                        {db.companies
                          ?.filter((c) => !companies.some((x) => x.id === c.id))
                          .map((c) => (
                            <option value={c.id} key={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {!company && (
                      <label>
                        New company name
                        <input
                          aria-label="New company name"
                          required
                          value={name}
                          maxLength={120}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </label>
                    )}
                    <button className="primary" type="submit">
                      Link company
                    </button>
                  </form>
                )}
                {!companies.length && (
                  <div className="purchase-empty">
                    <Building2 size={26} />
                    <h3>Build this distributor's supply chain</h3>
                    <p>
                      Link or create a company, then register its medicines.
                    </p>
                  </div>
                )}
                {companies.map((c) => (
                  <div className="company-block" key={c.id}>
                    <div>
                      <span className="quick-icon">
                        <Building2 size={20} />
                      </span>
                      <div>
                        <h3>{c.name}</h3>
                        <small>
                          {
                            db.medicines.filter((m) => m.companyId === c.id)
                              .length
                          }{" "}
                          medicines ·{" "}
                          {
                            db.distributorCompanies?.filter(
                              (l) => l.companyId === c.id,
                            ).length
                          }{" "}
                          linked distributors
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => onAddMedicine(selected, c.id)}
                      >
                        <Plus size={14} />
                        Add medicine
                      </button>
                    </div>
                    <div className="company-medicines">
                      {db.medicines
                        .filter((m) => m.companyId === c.id)
                        .map((m) => (
                          <span key={m.id}>
                            {m.name} <small>{m.strength}</small>
                          </span>
                        ))}
                      {!db.medicines.some((m) => m.companyId === c.id) && (
                        <p>No medicines registered yet.</p>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            ) : (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Distributor ledger</h2>
                    <p>
                      Invoices increase payable. Recorded payments reduce it.
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Entry</th>
                        <th>Purchase</th>
                        <th>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.flatMap((p) => [
                        <tr key={p.id}>
                          <td>{p.invoiceDate || p.date.slice(0, 10)}</td>
                          <td>
                            <button
                              className="invoice-link"
                              onClick={() => onViewPurchase(p)}
                            >
                              {p.id} / {p.reference}
                            </button>
                          </td>
                          <td>Purchase invoice</td>
                          <td>{money(p.total)}</td>
                          <td>{money(p.paid ?? p.total)}</td>
                        </tr>,
                        ...(db.supplierPayments || [])
                          .filter((x) => x.purchaseId === p.id)
                          .map((x) => (
                            <tr key={x.id}>
                              <td>{x.date.slice(0, 10)}</td>
                              <td>
                                {p.id}
                                <small>{x.reference || "Payment"}</small>
                              </td>
                              <td>Distributor payment</td>
                              <td>—</td>
                              <td>{money(x.amount)}</td>
                            </tr>
                          )),
                      ])}
                    </tbody>
                  </table>
                  {!purchases.length && (
                    <div className="purchase-empty">
                      No purchases recorded for this distributor.
                    </div>
                  )}
                </div>
                <div className="purchase-ledger-total">
                  Current payable <strong>Rs. {money(due)}</strong>
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="panel purchase-empty">
            Add a distributor to begin building your supply chain.
          </section>
        )}
      </div>
    </div>
  );
}

export function PurchaseInvoice({
  db,
  purchase: p,
}: {
  db: Database;
  purchase: Purchase;
}) {
  return (
    <>
      <div className="receipt-tools">
        <div>
          <div className="eyebrow">PURCHASE INVOICE</div>
          <h2>{p.id}</h2>
        </div>
        <button className="primary" onClick={() => window.print()}>
          <Printer size={16} />
          Print / PDF
        </button>
      </div>
      <style>{"@media print {@page {size:A4;margin:14mm}}"}</style>
      <article className="receipt a4 purchase-print">
        <div className="receipt-brand">
          <h2>{db.settings.name}</h2>
          <p>{db.settings.address}</p>
          <p>{db.settings.phone}</p>
        </div>
        <div className="receipt-title">PURCHASE RECORD · {p.id}</div>
        <div className="receipt-meta">
          <div>
            <span>Distributor</span>
            <strong>
              {p.distributorName ||
                db.suppliers.find((s) => s.id === p.supplierId)?.name}
            </strong>
          </div>
          <div>
            <span>Distributor invoice</span>
            <strong>{p.reference}</strong>
          </div>
          <div>
            <span>Invoice date</span>
            <strong>{p.invoiceDate || p.date.slice(0, 10)}</strong>
          </div>
        </div>
        {p.lines ? (
          <table>
            <thead>
              <tr>
                <th>Medicine / company</th>
                <th>Batch / expiry</th>
                <th>Qty + bonus</th>
                <th>Rate</th>
                <th>Disc.</th>
                <th>Tax</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.medicineName}</strong>
                    <small>{l.companyName}</small>
                  </td>
                  <td>
                    {l.number}
                    <small>{l.expiry}</small>
                  </td>
                  <td>
                    {l.qty} + {l.bonus} {l.unit}
                    <small>{l.receivedUnits} units</small>
                  </td>
                  <td>{money(l.rate)}</td>
                  <td>{l.discount}%</td>
                  <td>{money(l.taxAmount)}</td>
                  <td className="right">{money(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>
            Legacy paid receipt · {p.qty} base units · Batch{" "}
            {db.batches.find((b) => b.id === p.batchId)?.number}
          </p>
        )}
        <div className="receipt-totals">
          <div>
            <span>Subtotal</span>
            <span>{money(p.subtotal ?? p.total)}</span>
          </div>
          <div>
            <span>Discount</span>
            <span>− {money(p.discountTotal ?? 0)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>{money(p.taxTotal ?? 0)}</span>
          </div>
          <div className="receipt-grand">
            <strong>Total PKR</strong>
            <strong>{money(p.total)}</strong>
          </div>
          <div>
            <span>Total payments</span>
            <span>{money(purchasePaid(db, p))}</span>
          </div>
          <div>
            <strong>Outstanding payable</strong>
            <strong>{money(purchaseDue(db, p))}</strong>
          </div>
        </div>
        <div className="receipt-thanks">
          <p>
            Internal purchase record · compare with the distributor's original
            invoice.
          </p>
          <span>Ilmdeen Pharmacy</span>
        </div>
      </article>
    </>
  );
}
