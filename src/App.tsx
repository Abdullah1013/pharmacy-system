import { cloneElement, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  DatabaseBackup,
  Download,
  FileText,
  LayoutDashboard,
  Leaf,
  Minus,
  MoreHorizontal,
  Package,
  Pill,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Truck,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  completeSale,
  daysUntil,
  eligible,
  fefo,
  money,
  returnSale,
  round,
  today,
  totals,
  validateBackup,
} from "./domain";
import type {
  Batch,
  CartLine,
  Database,
  Medicine,
  Party,
  Sale,
} from "./domain";
import { download, readDatabase, saveDatabase } from "./store";

type Page =
  | "Overview"
  | "Point of sale"
  | "Inventory"
  | "Expiry center"
  | "Purchases"
  | "Invoices"
  | "Customers"
  | "Suppliers"
  | "Reports"
  | "Backup & restore"
  | "Settings";
type Dialog =
  | { kind: "medicine"; medicine?: Medicine }
  | { kind: "stock" }
  | { kind: "party"; type: "customers" | "suppliers" }
  | { kind: "receipt"; sale: Sale }
  | { kind: "return"; sale: Sale }
  | { kind: "restore"; data: Database }
  | { kind: "help" }
  | null;
type HeldBill = {
  cart: CartLine[];
  customer: string;
  payment: string;
  billDiscount: number;
  tendered: string;
};
function readDraft(): Partial<HeldBill> {
  try {
    const d = JSON.parse(localStorage.getItem("waseela-draft") || "{}");
    return d && typeof d === "object" && !Array.isArray(d) ? d : {};
  } catch {
    return {};
  }
}
const nav = [
  {
    title: "WORKSPACE",
    items: [
      { name: "Overview", icon: LayoutDashboard },
      { name: "Point of sale", icon: ShoppingCart },
      { name: "Inventory", icon: Package },
      { name: "Expiry center", icon: Activity },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { name: "Purchases", icon: ShoppingBag },
      { name: "Invoices", icon: FileText },
      { name: "Customers", icon: Users },
      { name: "Suppliers", icon: Truck },
      { name: "Reports", icon: ClipboardList },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { name: "Backup & restore", icon: DatabaseBackup },
      { name: "Settings", icon: Settings2 },
    ],
  },
];
const dateLabel = (value: string) =>
  new Date(
    value.length === 10 ? value + "T12:00:00" : value,
  ).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span />
      {children}
    </span>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <ClipboardList size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children as ReactElement<{ id: string }>, { id })}
    </div>
  );
}
function App() {
  const [startup] = useState(() => {
    try {
      return { db: readDatabase(), error: "" };
    } catch (e) {
      return { db: null, error: (e as Error).message };
    }
  });
  if (!startup.db)
    return (
      <div className="startup">
        <DatabaseBackup />
        <h1>Local data needs attention</h1>
        <p>{startup.error}</p>
        <p>Your saved data has not been overwritten.</p>
      </div>
    );
  return <Workspace initial={startup.db} />;
}
function Workspace({ initial }: { initial: Database }) {
  const [db, setDb] = useState(initial);
  const [page, setPage] = useState<Page>("Overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem("waseela-cart") || "[]");
      return Array.isArray(data)
        ? data.filter(
            (l) =>
              l &&
              typeof l.batchId === "string" &&
              Number.isInteger(l.qty) &&
              l.qty > 0 &&
              Number.isFinite(l.discount),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [customer, setCustomer] = useState(() =>
    typeof readDraft().customer === "string" ? readDraft().customer! : "",
  );
  const [payment, setPayment] = useState(() =>
    ["Cash", "Card", "Credit"].includes(readDraft().payment || "")
      ? readDraft().payment!
      : "Cash",
  );
  const [billDiscount, setBillDiscount] = useState(() =>
    Number.isFinite(readDraft().billDiscount) ? readDraft().billDiscount! : 0,
  );
  const [tendered, setTendered] = useState(() =>
    typeof readDraft().tendered === "string" ? readDraft().tendered! : "",
  );
  const [category, setCategory] = useState("All medicines");
  const [paper, setPaper] = useState(db.settings.paper);
  const [mobileNav, setMobileNav] = useState(false);
  const [held, setHeld] = useState<HeldBill | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem("waseela-held") || "null");
      if (Array.isArray(value))
        return {
          cart: value,
          customer: "",
          payment: "Cash",
          billDiscount: 0,
          tendered: "",
        };
      return value && Array.isArray(value.cart) ? value : null;
    } catch {
      return null;
    }
  });
  const restoreInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not([hidden]), select, [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [dialog]);
  useEffect(() => {
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    try {
      localStorage.setItem("waseela-cart", JSON.stringify(cart));
      localStorage.setItem("waseela-held", JSON.stringify(held));
      localStorage.setItem(
        "waseela-draft",
        JSON.stringify({ customer, payment, billDiscount, tendered }),
      );
    } catch {
      setToast("Cart could not be saved. Browser storage is full.");
    }
  }, [cart, held, customer, payment, billDiscount, tendered]);
  function navigate(p: Page) {
    setPage(p);
    setQuery("");
    setFilter("All");
    setMobileNav(false);
  }
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        navigate("Point of sale");
        setTimeout(() => searchInput.current?.focus(), 0);
      }
      if (e.key === "Escape") setDialog(null);
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  function commit(next: Database) {
    try {
      saveDatabase(next);
      setDb(next);
      return true;
    } catch {
      setToast(
        "Could not save. Free browser storage or export a backup before continuing.",
      );
      return false;
    }
  }
  function act(fn: () => void) {
    try {
      fn();
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  const stock = (id: string) =>
    db.batches
      .filter((b) => b.medicineId === id && eligible(b))
      .reduce((s, b) => s + b.qty, 0);
  const low = db.medicines.filter((m) => stock(m.id) <= m.reorder);
  const expired = db.batches.filter(
    (b) => daysUntil(b.expiry) < 0 && b.qty > 0,
  );
  const near = db.batches.filter(
    (b) => eligible(b) && daysUntil(b.expiry) <= db.settings.alertDays,
  );
  const salesToday = db.sales.filter(
    (s) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
        new Date(s.date),
      ) === today(),
  );
  const refunds = db.returns.reduce((s, r) => s + r.refund, 0);
  const revenue = db.sales.reduce((s, v) => s + v.total, 0) - refunds;
  const todayRefund = db.returns
    .filter(
      (r) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
          new Date(r.date),
        ) === today(),
    )
    .reduce((s, r) => s + r.refund, 0);
  const due = (id: string) =>
    db.sales
      .filter((s) => s.customerId === id)
      .reduce(
        (sum, s) =>
          sum +
          Math.max(
            0,
            s.total -
              s.paid -
              db.returns
                .filter((r) => r.saleId === s.id)
                .reduce((n, r) => n + r.refund, 0),
          ),
        0,
      );
  const med = (b: Batch) => db.medicines.find((m) => m.id === b.medicineId)!;
  const cartDetails = cart.flatMap((l) => {
    const b = db.batches.find((b) => b.id === l.batchId);
    return b ? [{ ...l, price: b.price, batch: b, medicine: med(b) }] : [];
  });
  const calc = totals(
    cartDetails,
    Math.min(Math.max(0, billDiscount || 0), totals(cartDetails).total),
  );
  function addBatch(b: Batch, qty = 1) {
    if (!eligible(b)) {
      setToast("This batch is not available for sale.");
      return;
    }
    const existing = cart.find((l) => l.batchId === b.id);
    if ((existing?.qty || 0) + qty > b.qty) {
      setToast("Not enough stock in this batch.");
      return;
    }
    setCart(
      existing
        ? cart.map((l) => (l.batchId === b.id ? { ...l, qty: l.qty + qty } : l))
        : [...cart, { batchId: b.id, qty, discount: 0 }],
    );
  }
  function addMedicine(m: Medicine) {
    const b = fefo(db.batches, m.id)[0];
    if (!b) {
      setToast("No sellable stock. Check expiry and quarantine.");
      return;
    }
    addBatch(b);
  }
  function updateLine(batchId: string, updates: Partial<CartLine>) {
    setCart(
      cart.map((l) => (l.batchId === batchId ? { ...l, ...updates } : l)),
    );
  }
  function checkout() {
    act(() => {
      if (cartDetails.length !== cart.length)
        throw new Error("A cart item is missing. Remove it before checkout.");
      const result = completeSale(
        db,
        cart,
        customer,
        payment,
        payment === "Credit"
          ? Number(tendered || 0)
          : Number(tendered || calc.total),
        billDiscount,
      );
      if (commit(result.db)) {
        setCart([]);
        setTendered("");
        setBillDiscount(0);
        setDialog({ kind: "receipt", sale: result.sale });
        setToast(`${result.sale.id} saved. Stock updated.`);
      }
    });
  }
  function exportBackup() {
    const next = { ...db, lastBackup: new Date().toISOString() };
    download(
      `ilmdeen-backup-${today()}-${Date.now()}.json`,
      JSON.stringify(next, null, 2),
    );
    commit(next);
    setToast("Backup download requested. Keep a copy on another drive.");
  }
  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error("Backup exceeds the 25 MB demo limit.");
      const value: unknown = JSON.parse(await file.text());
      if (!validateBackup(value))
        throw new Error(
          "Invalid backup. Structure or records did not pass validation.",
        );
      setDialog({ kind: "restore", data: value });
    } catch (e) {
      setToast((e as Error).message);
    }
    if (restoreInput.current) restoreInput.current.value = "";
  }
  const matching = db.medicines.filter((m) =>
    `${m.name} ${m.generic} ${m.strength} ${m.barcode} ${m.manufacturer}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const heading: Record<Page, string> = {
    Overview: "A clear view of your pharmacy.",
    "Point of sale": "A smoother checkout, every time.",
    Inventory: "Every medicine. Every batch.",
    "Expiry center": "Stay ahead of expiry.",
    Purchases: "Keep your shelves ready.",
    Invoices: "Every sale, neatly recorded.",
    Customers: "Care starts with knowing people.",
    Suppliers: "Your supply network, organized.",
    Reports: "Make sense of your numbers.",
    "Backup & restore": "Keep your work protected.",
    Settings: "Make this workspace yours.",
  };
  const pageAction =
    page === "Overview" ? (
      <button className="primary" onClick={() => navigate("Point of sale")}>
        <Plus size={17} />
        New sale <kbd>F2</kbd>
      </button>
    ) : page === "Inventory" ? (
      <button
        className="primary"
        onClick={() => setDialog({ kind: "medicine" })}
      >
        <Plus size={17} />
        Add medicine
      </button>
    ) : page === "Purchases" ? (
      <button className="primary" onClick={() => setDialog({ kind: "stock" })}>
        <Plus size={17} />
        Receive stock
      </button>
    ) : page === "Customers" || page === "Suppliers" ? (
      <button
        className="primary"
        onClick={() =>
          setDialog({
            kind: "party",
            type: page === "Customers" ? "customers" : "suppliers",
          })
        }
      >
        <Plus size={17} />
        Add {page === "Customers" ? "customer" : "supplier"}
      </button>
    ) : null;
  function stockTable(batches: Batch[], actions = false) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Medicine / batch</th>
              <th>Expiry date</th>
              <th>Remaining</th>
              <th>Unit price</th>
              <th>Status</th>
              {actions && <th />}
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>
                  <strong>
                    {med(b).name}{" "}
                    <span className="muted">{med(b).strength}</span>
                  </strong>
                  <small>
                    {b.number} · Rack {med(b).rack}
                  </small>
                </td>
                <td>
                  {dateLabel(b.expiry)}
                  <small>
                    {daysUntil(b.expiry) < 0
                      ? `${Math.abs(daysUntil(b.expiry))} days ago`
                      : `in ${daysUntil(b.expiry)} days`}
                  </small>
                </td>
                <td>
                  {b.qty} <span className="muted">units</span>
                </td>
                <td>Rs. {money(b.price)}</td>
                <td>
                  <Badge
                    tone={
                      b.status === "quarantine"
                        ? "neutral"
                        : daysUntil(b.expiry) < 0
                          ? "danger"
                          : daysUntil(b.expiry) <= db.settings.alertDays
                            ? "warning"
                            : "success"
                    }
                  >
                    {b.status === "quarantine"
                      ? "Quarantined"
                      : daysUntil(b.expiry) < 0
                        ? "Expired"
                        : daysUntil(b.expiry) <= db.settings.alertDays
                          ? "Expiring soon"
                          : "Available"}
                  </Badge>
                </td>
                {actions && (
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          b.status === "quarantine" &&
                          daysUntil(b.expiry) < 0
                        ) {
                          setToast(
                            "Expired stock cannot be released for sale.",
                          );
                          return;
                        }
                        commit({
                          ...db,
                          batches: db.batches.map((x) =>
                            x.id === b.id
                              ? {
                                  ...x,
                                  status:
                                    x.status === "quarantine"
                                      ? "available"
                                      : "quarantine",
                                }
                              : x,
                          ),
                        });
                      }}
                    >
                      {b.status === "quarantine" ? "Release" : "Quarantine"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!batches.length && (
          <Empty
            title="No batches here"
            detail="Try a different filter or receive new stock."
          />
        )}
      </div>
    );
  }
  function invoicesTable(sales: Sale[]) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Payment</th>
              <th className="right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>
                  <button
                    className="invoice-link"
                    onClick={() => {
                      setPaper(db.settings.paper);
                      setDialog({ kind: "receipt", sale: s });
                    }}
                  >
                    {s.id}
                  </button>
                </td>
                <td>
                  <strong>{s.customerName}</strong>
                  <small>
                    {s.lines.reduce((n, l) => n + l.qty, 0)} units ·{" "}
                    {s.lines.length} lines
                  </small>
                </td>
                <td>{dateLabel(s.date)}</td>
                <td>
                  <Badge tone={s.payment === "Credit" ? "warning" : "success"}>
                    {s.payment}
                  </Badge>
                </td>
                <td className="right">
                  <strong>Rs. {money(s.total)}</strong>
                  {db.returns.some((r) => r.saleId === s.id) && (
                    <small>Return recorded</small>
                  )}
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${s.id}`}
                    onClick={() => setDialog({ kind: "receipt", sale: s })}
                  >
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sales.length && (
          <Empty
            title="Your next sale starts here"
            detail="Complete a checkout to see its invoice and payment details."
            action={
              <button
                className="secondary"
                onClick={() => navigate("Point of sale")}
              >
                Open point of sale <ArrowRight size={15} />
              </button>
            }
          />
        )}
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <span className="brand-mark">
            <Plus size={24} strokeWidth={3} />
          </span>
          <span>
            Ilmdeen<span className="brand-sub">PHARMACY WORKSPACE</span>
          </span>
        </a>
        <div className="store-label">
          <span className="store-avatar">
            <ShoppingBag size={18} />
          </span>
          <div>
            <strong>Main pharmacy</strong>
            <small>Local workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav>
          {nav.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-title">{group.title}</div>
              {group.items.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  onClick={() => navigate(name as Page)}
                  className={`nav-item ${page === name ? "active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{name}</span>
                  {name === "Expiry center" &&
                    near.length + expired.length > 0 && (
                      <b>{near.length + expired.length}</b>
                    )}
                  {page === name && <i />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className="live-dot" />
            Offline-ready frontend
            <small>Demo data · stored on this browser</small>
          </div>
          <button
            className="profile"
            onClick={() => setDialog({ kind: "help" })}
          >
            <span className="avatar">IP</span>
            <span>
              <strong>Workspace admin</strong>
              <small>Local demo session</small>
            </span>
            <CircleHelp size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Toggle navigation"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <SlidersHorizontal size={19} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-pill">
              <span className="live-dot" />
              Local mode
            </span>
            <span className="top-date">{dateLabel(today())}</span>
            <button
              className="notification icon-button"
              aria-label="View expiry alerts"
              onClick={() => navigate("Expiry center")}
            >
              <Bell size={19} />
              {near.length + expired.length > 0 && <i />}
            </button>
            <span className="avatar small-avatar">IP</span>
          </div>
        </header>
        <main className={page === "Point of sale" ? "pos-main" : ""}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Overview"
                  ? "YOUR DAILY WORKSPACE"
                  : page === "Point of sale"
                    ? "COUNTER / NEW BILL"
                    : "PHARMACY MANAGEMENT"}
              </div>
              <h1>{page === "Overview" ? "Good to see you, Admin" : page}</h1>
              <p>{heading[page]}</p>
            </div>
            <div className="heading-actions">
              {page === "Overview" && (
                <button
                  className="secondary"
                  onClick={() => navigate("Reports")}
                >
                  <ClipboardList size={16} />
                  View reports
                </button>
              )}
              {pageAction}
            </div>
          </div>
          {page === "Overview" && (
            <>
              <div className="welcome-banner">
                <div className="welcome-icon">
                  <Leaf size={26} />
                </div>
                <div>
                  <strong>
                    A little attention today. A healthier tomorrow.
                  </strong>
                  <p>
                    {near.length} batches are nearing expiry and {low.length}{" "}
                    medicines need restocking.
                  </p>
                </div>
                <button onClick={() => navigate("Expiry center")}>
                  Review stock alerts <ArrowRight size={17} />
                </button>
                <div className="banner-art">
                  <Pill size={70} strokeWidth={1} />
                  <Plus size={23} />
                </div>
              </div>
              <div className="stats-grid">
                <Stat
                  title="Today's net sales"
                  value={`Rs. ${money(salesToday.reduce((n, s) => n + s.total, 0) - todayRefund)}`}
                  detail={`${salesToday.length} invoices today`}
                  icon={<Wallet />}
                  tone="green"
                />
                <Stat
                  title="Medicines in stock"
                  value={String(
                    db.medicines.filter((m) => stock(m.id) > 0).length,
                  ).padStart(2, "0")}
                  detail={`${db.medicines.length} medicines in catalogue`}
                  icon={<Package />}
                  tone="blue"
                />
                <Stat
                  title="Low stock items"
                  value={String(low.length).padStart(2, "0")}
                  detail="At or below reorder level"
                  icon={<Activity />}
                  tone="orange"
                />
                <Stat
                  title="Expiring soon"
                  value={String(near.length).padStart(2, "0")}
                  detail={`Within the next ${db.settings.alertDays} days`}
                  icon={<Pill />}
                  tone="rose"
                />
              </div>
              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Sales activity</h2>
                      <p>Your last 7 days at a glance</p>
                    </div>
                    <Badge>This week</Badge>
                  </div>
                  <SalesChart sales={db.sales} returns={db.returns} />
                  <div className="chart-footer">
                    <span>
                      <i className="legend-dot" />
                      Net sales
                    </span>
                    <strong>
                      Rs. {money(revenue)} <small>all-time net revenue</small>
                    </strong>
                  </div>
                </section>
                <section className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Quick actions</h2>
                      <p>A shortcut to your everyday tasks</p>
                    </div>
                    <MoreHorizontal size={20} />
                  </div>
                  {[
                    {
                      title: "Create a new sale",
                      detail: "Open the billing counter",
                      icon: ShoppingCart,
                      page: "Point of sale",
                    },
                    {
                      title: "Receive stock",
                      detail: "Record an incoming purchase",
                      icon: ArrowDownLeft,
                      page: "Purchases",
                    },
                    {
                      title: "Browse inventory",
                      detail: "Find a medicine or batch",
                      icon: Package,
                      page: "Inventory",
                    },
                    {
                      title: "Back up your data",
                      detail: "Keep a copy of your workspace",
                      icon: DatabaseBackup,
                      page: "Backup & restore",
                    },
                  ].map((x) => (
                    <button
                      className="quick-action"
                      key={x.title}
                      onClick={() =>
                        x.title === "Receive stock"
                          ? setDialog({ kind: "stock" })
                          : navigate(x.page as Page)
                      }
                    >
                      <span className="quick-icon">
                        <x.icon size={20} />
                      </span>
                      <span>
                        <strong>{x.title}</strong>
                        <small>{x.detail}</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                  <div className="safe-note">
                    <ShieldCheck size={17} />
                    <span>
                      Your work stays on this device.
                      <br />
                      <strong>Remember to export a backup.</strong>
                    </span>
                  </div>
                </section>
              </div>
              <div className="overview-lower">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent invoices</h2>
                      <p>The latest from your billing counter</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("Invoices")}
                    >
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  {invoicesTable(db.sales.slice(0, 4))}
                </section>
                <section className="panel attention-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Needs attention</h2>
                      <p>Small checks that make a difference</p>
                    </div>
                    <span className="alert-count">
                      {low.length + near.length + expired.length}
                    </span>
                  </div>
                  <button
                    className="attention-row"
                    onClick={() => {
                      navigate("Inventory");
                      setFilter("Low stock");
                    }}
                  >
                    <span className="attention-icon orange">
                      <Package size={18} />
                    </span>
                    <span>
                      <strong>Running low</strong>
                      <small>{low.length} medicines to reorder</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="attention-row"
                    onClick={() => navigate("Expiry center")}
                  >
                    <span className="attention-icon rose">
                      <Activity size={18} />
                    </span>
                    <span>
                      <strong>Expiry watch</strong>
                      <small>{near.length} near-expiry batches</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="attention-row"
                    onClick={() => {
                      navigate("Expiry center");
                      setFilter("Expired");
                    }}
                  >
                    <span className="attention-icon neutral">
                      <ShieldCheck size={18} />
                    </span>
                    <span>
                      <strong>Expired stock</strong>
                      <small>{expired.length} batches blocked from sale</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "Point of sale" && (
            <div className="pos-layout">
              <section className="pos-catalog panel">
                <div className="pos-search">
                  <Search size={20} />
                  <input
                    ref={searchInput}
                    aria-label="Search medicines"
                    placeholder="Search medicine, generic or scan barcode…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && matching.length === 1)
                        addMedicine(matching[0]);
                    }}
                  />
                  <kbd>F2</kbd>
                </div>
                <div className="category-chips">
                  {[
                    "All medicines",
                    "Tablet",
                    "Capsule",
                    "Suspension",
                    "Surgical",
                    "Inhaler",
                    "Sachet",
                  ].map((c) => (
                    <button
                      key={c}
                      className={category === c ? "selected" : ""}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="catalog-label">
                  <span>
                    {
                      matching.filter(
                        (m) =>
                          category === "All medicines" || m.form === category,
                      ).length
                    }{" "}
                    medicines
                  </span>
                  <span>Prices per unit · PKR</span>
                </div>
                <div className="medicine-grid">
                  {matching
                    .filter(
                      (m) =>
                        category === "All medicines" || m.form === category,
                    )
                    .map((m, index) => {
                      const batches = fefo(db.batches, m.id);
                      return (
                        <article
                          className={`medicine-card ${!batches.length ? "unavailable" : ""}`}
                          key={m.id}
                        >
                          <div className="medicine-card-top">
                            <span
                              className={`medicine-icon color-${index % 4}`}
                            >
                              <Pill size={23} />
                            </span>
                            <span className="form-tag">{m.form}</span>
                          </div>
                          <h3>
                            {m.name} <span>{m.strength}</span>
                          </h3>
                          <p>{m.generic}</p>
                          <div className="medicine-stock">
                            <span
                              className={`stock-dot ${stock(m.id) <= m.reorder ? "amber" : ""}`}
                            />
                            {stock(m.id)} units available
                            <span>Rack {m.rack}</span>
                          </div>
                          <div className="medicine-card-bottom">
                            <strong>
                              Rs. {money(batches[0]?.price || m.price)}
                              <small> / unit</small>
                            </strong>
                            <button
                              className="add-medicine"
                              aria-label={`Add ${m.name}`}
                              disabled={!batches.length}
                              onClick={() => addMedicine(m)}
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
                {!matching.length && (
                  <Empty
                    title="No medicine found"
                    detail="Search by name, generic or exact barcode."
                  />
                )}
                <div className="catalog-foot">
                  <ShieldCheck size={15} />
                  Earliest eligible expiry is selected first. Expired and
                  quarantined stock is excluded.
                </div>
              </section>
              <section className="bill-panel panel">
                <div className="bill-heading">
                  <span className="bill-icon">
                    <ShoppingCart size={20} />
                  </span>
                  <div>
                    <h2>Current bill</h2>
                    <p>{cart.length} items · New sale</p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Clear bill"
                    disabled={!cart.length}
                    onClick={() => {
                      setCart([]);
                      setBillDiscount(0);
                      setTendered("");
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="customer-select">
                  <Users size={17} />
                  <select
                    aria-label="Customer"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  >
                    <option value="">Walk-in customer</option>
                    {db.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button"
                    aria-label="Add customer"
                    onClick={() =>
                      setDialog({ kind: "party", type: "customers" })
                    }
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="bill-lines">
                  {!cart.length ? (
                    <Empty
                      title="Ready for your next customer"
                      detail="Search or select a medicine to start a bill."
                    />
                  ) : (
                    cartDetails.map((l) => (
                      <div className="bill-line" key={l.batchId}>
                        <div className="bill-line-title">
                          <strong>
                            {l.medicine.name}{" "}
                            <small>{l.medicine.strength}</small>
                          </strong>
                          <button
                            className="icon-button"
                            aria-label={`Remove ${l.medicine.name}`}
                            onClick={() =>
                              setCart(
                                cart.filter((x) => x.batchId !== l.batchId),
                              )
                            }
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="batch-select">
                          <select
                            aria-label={`Batch for ${l.medicine.name}`}
                            value={l.batchId}
                            onChange={(e) => {
                              const b = db.batches.find(
                                (b) => b.id === e.target.value,
                              )!;
                              if (cart.some((x) => x.batchId === b.id)) {
                                setToast("That batch is already in the bill.");
                                return;
                              }
                              setCart(
                                cart.map((x) =>
                                  x.batchId === l.batchId
                                    ? {
                                        ...x,
                                        batchId: b.id,
                                        qty: Math.min(x.qty, b.qty),
                                      }
                                    : x,
                                ),
                              );
                            }}
                          >
                            {fefo(db.batches, l.medicine.id).map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.number} · Exp {b.expiry.slice(0, 7)} · Rs{" "}
                                {b.price}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="bill-line-controls">
                          <div className="quantity-control">
                            <button
                              aria-label={`Decrease ${l.medicine.name}`}
                              disabled={l.qty <= 1}
                              onClick={() =>
                                updateLine(l.batchId, { qty: l.qty - 1 })
                              }
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              aria-label={`Quantity ${l.medicine.name}`}
                              type="number"
                              min="1"
                              max={l.batch.qty}
                              value={l.qty}
                              onChange={(e) =>
                                updateLine(l.batchId, {
                                  qty: Number(e.target.value),
                                })
                              }
                            />
                            <button
                              aria-label={`Increase ${l.medicine.name}`}
                              disabled={l.qty >= l.batch.qty}
                              onClick={() =>
                                updateLine(l.batchId, { qty: l.qty + 1 })
                              }
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          {l.medicine.unitsPerPack > 1 && (
                            <button
                              className="pack-button"
                              onClick={() =>
                                addBatch(l.batch, l.medicine.unitsPerPack)
                              }
                            >
                              + pack ({l.medicine.unitsPerPack})
                            </button>
                          )}
                          <strong>
                            {money(l.qty * l.price * (1 - l.discount / 100))}
                          </strong>
                        </div>
                        <label className="line-discount">
                          Item discount{" "}
                          <input
                            aria-label={`Discount ${l.medicine.name}`}
                            type="number"
                            min="0"
                            max="100"
                            value={l.discount}
                            onChange={(e) =>
                              updateLine(l.batchId, {
                                discount: Number(e.target.value),
                              })
                            }
                          />
                          %
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <div className="bill-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>Rs. {money(calc.subtotal)}</strong>
                  </div>
                  <div>
                    <span>Item discounts</span>
                    <strong>− {money(calc.itemDiscount)}</strong>
                  </div>
                  <div>
                    <label htmlFor="billDiscount">Bill discount (Rs.)</label>
                    <input
                      id="billDiscount"
                      type="number"
                      min="0"
                      max={totals(cartDetails).total}
                      value={billDiscount}
                      onChange={(e) => setBillDiscount(Number(e.target.value))}
                    />
                  </div>
                  <div className="grand-total">
                    <span>Total payable</span>
                    <strong>
                      <small>Rs.</small> {money(calc.total)}
                    </strong>
                  </div>
                  <div className="payment-tabs">
                    {["Cash", "Card", "Credit"].map((p) => (
                      <button
                        key={p}
                        className={payment === p ? "selected" : ""}
                        onClick={() => setPayment(p)}
                      >
                        {p === "Cash" ? (
                          <Wallet size={15} />
                        ) : (
                          <CreditCard size={15} />
                        )}
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="tendered">
                    <label htmlFor="tendered">
                      {payment === "Credit"
                        ? "Amount paid now"
                        : "Amount received"}
                      <small>
                        {payment === "Credit"
                          ? "Customer required"
                          : "Leave blank for exact payment"}
                      </small>
                    </label>
                    <input
                      id="tendered"
                      type="number"
                      min="0"
                      placeholder={
                        payment === "Credit" ? "0.00" : money(calc.total)
                      }
                      value={tendered}
                      onChange={(e) => setTendered(e.target.value)}
                    />
                  </div>
                  {payment === "Cash" && Number(tendered) > calc.total && (
                    <div className="change-line">
                      Change to return{" "}
                      <strong>
                        Rs. {money(Number(tendered) - calc.total)}
                      </strong>
                    </div>
                  )}
                  <button
                    className="checkout-button"
                    disabled={!cart.length}
                    onClick={checkout}
                  >
                    <CheckCircle2 size={18} />
                    Complete sale <ArrowRight size={19} />
                  </button>
                  <div className="hold-actions">
                    <button
                      disabled={!cart.length || !!held}
                      onClick={() => {
                        setHeld({
                          cart,
                          customer,
                          payment,
                          billDiscount,
                          tendered,
                        });
                        setCart([]);
                        setCustomer("");
                        setPayment("Cash");
                        setBillDiscount(0);
                        setTendered("");
                        setToast("Bill held. It will remain on this browser.");
                      }}
                    >
                      <ClipboardList size={14} />
                      Hold bill
                    </button>
                    <button
                      disabled={!held || !!cart.length}
                      onClick={() => {
                        setCart(held!.cart);
                        setCustomer(held!.customer);
                        setPayment(held!.payment);
                        setBillDiscount(held!.billDiscount);
                        setTendered(held!.tendered);
                        setHeld(null);
                      }}
                    >
                      <RotateCcw size={14} />
                      Resume held {held ? `(${held.cart.length})` : ""}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
          {page === "Inventory" && (
            <>
              <div className="compact-stats">
                <Mini title="Medicine catalogue" value={db.medicines.length} />
                <Mini
                  title="Sellable units"
                  value={db.batches
                    .filter((b) => eligible(b))
                    .reduce((s, b) => s + b.qty, 0)}
                />
                <Mini title="Low stock medicines" value={low.length} />
                <Mini
                  title="Stock at cost"
                  value={`Rs. ${money(db.batches.reduce((s, b) => s + b.qty * b.cost, 0))}`}
                />
              </div>
              <section className="panel">
                <Toolbar
                  query={query}
                  onQuery={setQuery}
                  placeholder="Search medicine, generic, manufacturer or barcode"
                  filters={["All", "Low stock", "Batches"]}
                  filter={filter}
                  onFilter={setFilter}
                />
                {filter === "Batches" ? (
                  stockTable(
                    db.batches.filter((b) =>
                      matching.some((m) => m.id === b.medicineId),
                    ),
                    true,
                  )
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Category</th>
                          <th>Stock / base units</th>
                          <th>Pack size</th>
                          <th>Rack</th>
                          <th>Status</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {matching
                          .filter(
                            (m) =>
                              filter !== "Low stock" ||
                              low.some((l) => l.id === m.id),
                          )
                          .map((m, i) => (
                            <tr key={m.id}>
                              <td>
                                <div className="table-medicine">
                                  <span
                                    className={`medicine-icon tiny color-${i % 4}`}
                                  >
                                    <Pill size={18} />
                                  </span>
                                  <div>
                                    <strong>
                                      {m.name} {m.strength}
                                    </strong>
                                    <small>
                                      {m.generic} · {m.manufacturer}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>{m.category}</td>
                              <td>
                                <strong>{stock(m.id)}</strong>
                                <small>Reorder at {m.reorder}</small>
                              </td>
                              <td>{m.unitsPerPack} units</td>
                              <td>{m.rack}</td>
                              <td>
                                <Badge
                                  tone={
                                    stock(m.id) === 0
                                      ? "danger"
                                      : stock(m.id) <= m.reorder
                                        ? "warning"
                                        : "success"
                                  }
                                >
                                  {stock(m.id) === 0
                                    ? "Out of stock"
                                    : stock(m.id) <= m.reorder
                                      ? "Low stock"
                                      : "In stock"}
                                </Badge>
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    setDialog({ kind: "medicine", medicine: m })
                                  }
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!matching.length && (
                      <Empty
                        title="No matching medicines"
                        detail="Try another name or barcode."
                      />
                    )}
                  </div>
                )}
              </section>
            </>
          )}
          {page === "Expiry center" && (
            <>
              <div className="notice">
                <ShieldCheck size={20} />
                <div>
                  <strong>
                    Sellable stock and expired stock stay separate.
                  </strong>
                  <span>
                    Expired batches cannot be billed. Quarantine a batch when it
                    needs inspection or recall.
                  </span>
                </div>
              </div>
              <div className="compact-stats">
                <Mini
                  title={`Expiring within ${db.settings.alertDays} days`}
                  value={near.length}
                />
                <Mini title="Expired batches" value={expired.length} />
                <Mini
                  title="Quarantined batches"
                  value={
                    db.batches.filter((b) => b.status === "quarantine").length
                  }
                />
                <Mini
                  title="Expired stock at cost"
                  value={`Rs. ${money(expired.reduce((s, b) => s + b.qty * b.cost, 0))}`}
                />
              </div>
              <section className="panel">
                <Toolbar
                  query={query}
                  onQuery={setQuery}
                  placeholder="Find a medicine or batch"
                  filters={["All", "Expiring soon", "Expired", "Quarantined"]}
                  filter={filter}
                  onFilter={setFilter}
                />
                {stockTable(
                  db.batches
                    .filter(
                      (b) =>
                        b.qty > 0 &&
                        `${med(b).name} ${b.number}`
                          .toLowerCase()
                          .includes(query.toLowerCase()) &&
                        (filter === "All"
                          ? daysUntil(b.expiry) <= db.settings.alertDays ||
                            b.status === "quarantine"
                          : filter === "Expired"
                            ? daysUntil(b.expiry) < 0
                            : filter === "Quarantined"
                              ? b.status === "quarantine"
                              : eligible(b) &&
                                daysUntil(b.expiry) <= db.settings.alertDays),
                    )
                    .sort((a, b) => a.expiry.localeCompare(b.expiry)),
                  true,
                )}
              </section>
              {db.returns.length > 0 && (
                <section className="panel section-gap">
                  <div className="panel-heading">
                    <div>
                      <h2>Returned units awaiting inspection</h2>
                      <p>These quantities are excluded from sellable stock.</p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Batch</th>
                          <th>Units</th>
                          <th>Reason</th>
                          <th>Refund / credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {db.returns.map((r) => (
                          <tr key={r.id}>
                            <td>{r.saleId}</td>
                            <td>
                              {
                                db.batches.find((b) => b.id === r.batchId)
                                  ?.number
                              }
                            </td>
                            <td>{r.qty}</td>
                            <td>{r.reason}</td>
                            <td>Rs. {money(r.refund)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
          {page === "Invoices" && (
            <section className="panel">
              <Toolbar
                query={query}
                onQuery={setQuery}
                placeholder="Search invoice number or customer"
                filters={["All", "Cash", "Card", "Credit"]}
                filter={filter}
                onFilter={setFilter}
              />
              {invoicesTable(
                db.sales.filter(
                  (s) =>
                    `${s.id} ${s.customerName}`
                      .toLowerCase()
                      .includes(query.toLowerCase()) &&
                    (filter === "All" || s.payment === filter),
                ),
              )}
            </section>
          )}
          {page === "Purchases" && (
            <>
              <div className="notice">
                <Truck size={20} />
                <div>
                  <strong>Record paid stock receipts</strong>
                  <span>
                    Add a medicine batch with its supplier, expiry, quantity and
                    actual purchase cost. Quantities are in base units.
                  </span>
                </div>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Stock receipts</h2>
                    <p>Incoming purchases recorded in this workspace</p>
                  </div>
                  <Badge>{db.purchases.length} receipts</Badge>
                </div>
                {db.purchases.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Receipt / reference</th>
                          <th>Supplier</th>
                          <th>Received</th>
                          <th>Quantity</th>
                          <th className="right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {db.purchases.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.id}</strong>
                              <small>{p.reference}</small>
                            </td>
                            <td>
                              {
                                db.suppliers.find((s) => s.id === p.supplierId)
                                  ?.name
                              }
                            </td>
                            <td>{dateLabel(p.date)}</td>
                            <td>{p.qty} units</td>
                            <td className="right">Rs. {money(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Ready to receive your next delivery"
                    detail="Record a paid stock receipt to update the relevant medicine batch."
                    action={
                      <button
                        className="secondary"
                        onClick={() => setDialog({ kind: "stock" })}
                      >
                        <Plus size={16} />
                        Receive stock
                      </button>
                    }
                  />
                )}
              </section>
            </>
          )}
          {(page === "Customers" || page === "Suppliers") && (
            <section className="panel">
              <Toolbar
                query={query}
                onQuery={setQuery}
                placeholder={`Search ${page.toLowerCase()} by name or phone`}
              />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{page === "Customers" ? "Customer" : "Supplier"}</th>
                      <th>Phone</th>
                      <th>Location</th>
                      <th>
                        {page === "Customers"
                          ? "Credit outstanding"
                          : "Recorded receipts"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {db[page === "Customers" ? "customers" : "suppliers"]
                      .filter((p) =>
                        `${p.name} ${p.phone}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="table-medicine">
                              <span className="avatar party-avatar">
                                {p.name
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((x) => x[0])
                                  .join("")}
                              </span>
                              <strong>{p.name}</strong>
                            </div>
                          </td>
                          <td>{p.phone || "—"}</td>
                          <td>{p.address || "—"}</td>
                          <td>
                            {page === "Customers"
                              ? `Rs. ${money(due(p.id))}`
                              : db.purchases.filter(
                                  (x) => x.supplierId === p.id,
                                ).length}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {page === "Reports" && (
            <>
              <div className="compact-stats">
                <Mini
                  title="Gross invoiced"
                  value={`Rs. ${money(db.sales.reduce((s, x) => s + x.total, 0))}`}
                />
                <Mini
                  title="Returns / credits"
                  value={`Rs. ${money(refunds)}`}
                />
                <Mini title="Net revenue" value={`Rs. ${money(revenue)}`} />
                <Mini
                  title="Customer credit due"
                  value={`Rs. ${money(db.customers.reduce((s, c) => s + due(c.id), 0))}`}
                />
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Sales register</h2>
                    <p>All recorded invoices · values in PKR</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      const quote = (v: unknown) =>
                        `"${String(v)
                          .replace(/"/g, '""')
                          .replace(/^[=+@-]/, "'")}"`;
                      download(
                        `sales-${today()}.csv`,
                        [
                          [
                            "Invoice",
                            "Date",
                            "Customer",
                            "Payment",
                            "Total",
                            "Paid",
                            "Return/credit",
                          ],
                          ...db.sales.map((s) => [
                            s.id,
                            s.date,
                            s.customerName,
                            s.payment,
                            s.total,
                            s.paid,
                            db.returns
                              .filter((r) => r.saleId === s.id)
                              .reduce((n, r) => n + r.refund, 0),
                          ]),
                        ]
                          .map((row) => row.map(quote).join(","))
                          .join("\r\n"),
                        "text/csv",
                      );
                      setToast("Sales CSV exported.");
                    }}
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>
                {invoicesTable(db.sales)}
              </section>
              <div className="report-foot">
                <CircleHelp size={16} />
                Revenue includes recorded returns. This frontend does not
                calculate a tax return or a full cash/accounting ledger.
              </div>
            </>
          )}
          {page === "Backup & restore" && (
            <>
              <div className="notice">
                <DatabaseBackup size={21} />
                <div>
                  <strong>Your workspace deserves a second copy.</strong>
                  <span>
                    This frontend exports a complete JSON snapshot. Save it
                    outside this computer for better protection.
                  </span>
                </div>
              </div>
              <div className="backup-grid">
                <section className="panel backup-card">
                  <span className="big-icon green">
                    <Download size={28} />
                  </span>
                  <h2>Export a backup</h2>
                  <p>
                    Medicines, batches, invoices, receipts, returns, contacts
                    and settings in one file.
                  </p>
                  <div className="backup-meta">
                    <span>Last export requested</span>
                    <strong>
                      {db.lastBackup
                        ? new Date(db.lastBackup).toLocaleString("en-PK", {
                            timeZone: "Asia/Karachi",
                          })
                        : "No backup exported yet"}
                    </strong>
                  </div>
                  <button className="primary" onClick={exportBackup}>
                    <Download size={16} />
                    Download full backup
                  </button>
                </section>
                <section className="panel backup-card">
                  <span className="big-icon blue">
                    <Upload size={28} />
                  </span>
                  <h2>Restore a backup</h2>
                  <p>
                    Choose a Ilmdeen backup file. Review its contents before
                    replacing the current workspace.
                  </p>
                  <div className="backup-meta">
                    <span>Restore protection</span>
                    <strong>Validation + recovery snapshot</strong>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => restoreInput.current?.click()}
                  >
                    <Upload size={16} />
                    Choose backup file
                  </button>
                  <input
                    hidden
                    type="file"
                    accept=".json,application/json"
                    ref={restoreInput}
                    onChange={(e) => void importBackup(e.target.files?.[0])}
                  />
                </section>
              </div>
              <div className="panel backup-explainer">
                <ShieldCheck size={22} />
                <div>
                  <h3>Desktop backup is part of the next phase</h3>
                  <p>
                    Scheduled local backups, folder selection, retention and
                    native database integrity checks will run in the desktop
                    app. This browser version offers manual export and restore.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === "Settings" && (
            <form
              className="panel settings-panel"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const settings = {
                  name: String(data.get("name")).trim(),
                  address: String(data.get("address")),
                  phone: String(data.get("phone")),
                  receiptNote: String(data.get("receiptNote")),
                  paper: String(data.get("paper")),
                  alertDays: Number(data.get("alertDays")),
                };
                if (commit({ ...db, settings }))
                  setToast("Pharmacy settings saved.");
              }}
            >
              <div className="panel-heading">
                <div>
                  <h2>Pharmacy & receipt details</h2>
                  <p>These details appear on your invoices.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Pharmacy name">
                  <input name="name" required defaultValue={db.settings.name} />
                </Field>
                <Field label="Phone number">
                  <input name="phone" defaultValue={db.settings.phone} />
                </Field>
                <Field label="Address">
                  <input name="address" defaultValue={db.settings.address} />
                </Field>
                <Field label="Default print format">
                  <select name="paper" defaultValue={db.settings.paper}>
                    <option>80mm</option>
                    <option>A4</option>
                  </select>
                </Field>
                <Field label="Near-expiry alert window (days)">
                  <input
                    name="alertDays"
                    type="number"
                    min="1"
                    max="730"
                    required
                    defaultValue={db.settings.alertDays}
                  />
                </Field>
                <Field label="Receipt footer">
                  <input
                    name="receiptNote"
                    defaultValue={db.settings.receiptNote}
                  />
                </Field>
              </div>
              <div className="form-footer">
                <span>
                  <ShieldCheck size={14} />
                  Saved locally on this browser
                </span>
                <button className="primary" type="submit">
                  <Check size={16} />
                  Save settings
                </button>
              </div>
            </form>
          )}
          <footer className="workspace-footer">
            <span>
              <Plus size={12} />
              Ilmdeen Pharmacy <span className="footer-divider">/</span> A
              little more care, in every detail.
            </span>
            <span>
              Frontend preview <span className="footer-divider">·</span> v0.1
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CircleHelp size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          <section
            className={`modal ${dialog.kind === "receipt" ? "receipt-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog.kind === "receipt"
                ? "Invoice preview"
                : dialog.kind === "medicine"
                  ? "Medicine details"
                  : dialog.kind === "stock"
                    ? "Receive stock"
                    : dialog.kind === "return"
                      ? "Record sale return"
                      : dialog.kind === "restore"
                        ? "Restore backup"
                        : dialog.kind === "party"
                          ? "Contact details"
                          : "Workspace help"
            }
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
            >
              <X size={20} />
            </button>
            {dialog.kind === "medicine" && (
              <MedicineForm
                medicine={dialog.medicine}
                onSave={(m) => {
                  if (
                    db.medicines.some(
                      (x) =>
                        x.id !== m.id && x.barcode === m.barcode && m.barcode,
                    )
                  ) {
                    setToast("That barcode belongs to another medicine.");
                    return;
                  }
                  if (
                    dialog.medicine &&
                    db.batches.some((b) => b.medicineId === m.id) &&
                    m.unitsPerPack !== dialog.medicine.unitsPerPack
                  ) {
                    setToast(
                      "Pack size cannot change after stock exists. Create a separate medicine variant.",
                    );
                    return;
                  }
                  const next = {
                    ...db,
                    medicines: dialog.medicine
                      ? db.medicines.map((x) => (x.id === m.id ? m : x))
                      : [...db.medicines, m],
                  };
                  if (commit(next)) {
                    setDialog(null);
                    setToast(
                      "Medicine saved. Receive stock to make it available for sale.",
                    );
                  }
                }}
              />
            )}
            {dialog.kind === "stock" && (
              <StockForm
                db={db}
                onSave={(batch, reference) => {
                  const next = structuredClone(db);
                  const existing = next.batches.find(
                    (b) =>
                      b.medicineId === batch.medicineId &&
                      b.number.toLowerCase() === batch.number.toLowerCase(),
                  );
                  if (existing) {
                    setToast(
                      "This medicine batch already exists. Use a unique batch number; merging receipts needs a weighted-cost policy.",
                    );
                    return;
                  }
                  next.batches.push(batch);
                  const purchase = {
                    id: `PUR-${String(db.purchases.length + 1).padStart(5, "0")}`,
                    date: new Date().toISOString(),
                    supplierId: batch.supplierId,
                    reference,
                    total: round(batch.qty * batch.cost),
                    batchId: batch.id,
                    qty: batch.qty,
                  };
                  next.purchases.unshift(purchase);
                  next.movements.unshift({
                    id: crypto.randomUUID(),
                    date: purchase.date,
                    batchId: batch.id,
                    qty: batch.qty,
                    type: "Purchase receipt",
                    reference: purchase.id,
                  });
                  if (commit(next)) {
                    setDialog(null);
                    setToast("Stock received and inventory updated.");
                  }
                }}
              />
            )}
            {dialog.kind === "party" && (
              <PartyForm
                type={dialog.type}
                onSave={(party) => {
                  if (
                    commit({
                      ...db,
                      [dialog.type]: [...db[dialog.type], party],
                    })
                  ) {
                    setDialog(null);
                    setToast("Contact saved.");
                  }
                }}
              />
            )}
            {dialog.kind === "receipt" && (
              <>
                <div className="receipt-tools">
                  <div>
                    <div className="eyebrow">INVOICE PREVIEW</div>
                    <h2>{dialog.sale.id}</h2>
                  </div>
                  <div>
                    <select
                      aria-label="Print format"
                      value={paper}
                      onChange={(e) => setPaper(e.target.value)}
                    >
                      <option>80mm</option>
                      <option>A4</option>
                    </select>
                    <button className="primary" onClick={() => window.print()}>
                      <Printer size={16} />
                      Print / PDF
                    </button>
                  </div>
                </div>
                <p className="print-hint">
                  Choose your printer or “Save as PDF” in the print dialog.
                  Match the paper size to the selected format.
                </p>
                <style>{`@media print { @page { size: ${paper === "A4" ? "A4" : "80mm auto"}; margin: ${paper === "A4" ? "14mm" : "3mm"}; } }`}</style>
                <Receipt
                  sale={dialog.sale}
                  settings={db.settings}
                  paper={paper}
                  returned={db.returns
                    .filter((r) => r.saleId === dialog.sale.id)
                    .reduce((s, r) => s + r.refund, 0)}
                />
                <div className="receipt-bottom">
                  <span>Original invoice · Prices preserved at sale</span>
                  <button
                    className="secondary"
                    onClick={() =>
                      setDialog({
                        kind: "return",
                        sale: db.sales.find((s) => s.id === dialog.sale.id)!,
                      })
                    }
                  >
                    <RotateCcw size={15} />
                    Record return
                  </button>
                </div>
              </>
            )}
            {dialog.kind === "return" && (
              <ReturnForm
                sale={dialog.sale}
                onSave={(batchId, qty, reason) =>
                  act(() => {
                    const next = returnSale(
                      db,
                      dialog.sale.id,
                      batchId,
                      qty,
                      reason,
                    );
                    if (commit(next)) {
                      setDialog(null);
                      setToast(
                        "Return recorded at the original net price. Units are quarantined pending inspection.",
                      );
                    }
                  })
                }
              />
            )}
            {dialog.kind === "restore" && (
              <>
                <span className="big-icon blue">
                  <DatabaseBackup size={25} />
                </span>
                <h2>Review backup before restoring</h2>
                <p>
                  This replaces your current workspace. An additional recovery
                  snapshot of your current data will be kept in browser storage.
                </p>
                <div className="restore-summary">
                  <Mini
                    title="Medicines"
                    value={dialog.data.medicines.length}
                  />
                  <Mini title="Invoices" value={dialog.data.sales.length} />
                  <Mini title="Batches" value={dialog.data.batches.length} />
                </div>
                <div className="form-footer">
                  <button className="secondary" onClick={() => setDialog(null)}>
                    Cancel
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      try {
                        localStorage.setItem(
                          "waseela-before-restore",
                          JSON.stringify(db),
                        );
                        if (commit(dialog.data)) {
                          setCart([]);
                          setHeld(null);
                          setCustomer("");
                          setPayment("Cash");
                          setBillDiscount(0);
                          setTendered("");
                          setDialog(null);
                          setToast(
                            "Backup restored. Previous workspace recovery snapshot retained.",
                          );
                        }
                      } catch {
                        setToast(
                          "Unable to preserve a recovery snapshot. Restore was cancelled.",
                        );
                      }
                    }}
                  >
                    Restore this backup
                  </button>
                </div>
              </>
            )}
            {dialog.kind === "help" && (
              <>
                <span className="big-icon green">
                  <CircleHelp size={25} />
                </span>
                <h2>Your local pharmacy workspace</h2>
                <p>
                  Press <kbd>F2</kbd> to open medicine search. Press{" "}
                  <kbd>Esc</kbd> to close a dialog.
                </p>
                <p>
                  This is a frontend preview with sample data, stored in this
                  browser. It includes no real sign-in, native database or
                  automatic backup scheduler yet.
                </p>
                <p>
                  Use Backup & restore to export your work. Sample medicines and
                  prices are for demonstration only.
                </p>
                <button className="primary" onClick={() => setDialog(null)}>
                  Got it
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${tone}`}>{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-detail">
        <span className={`stat-mini-dot ${tone}`} />
        {detail}
      </div>
    </div>
  );
}
function Mini({ title, value }: { title: string; value: ReactNode }) {
  return (
    <div className="mini-stat">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Toolbar({
  query,
  onQuery,
  placeholder,
  filters,
  filter,
  onFilter,
}: {
  query: string;
  onQuery: (s: string) => void;
  placeholder: string;
  filters?: string[];
  filter?: string;
  onFilter?: (s: string) => void;
}) {
  return (
    <div className="toolbar">
      <div className="table-search">
        <Search size={17} />
        <input
          aria-label={placeholder}
          value={query}
          placeholder={placeholder}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      {filters && (
        <div className="filter-tabs">
          {filters.map((f) => (
            <button
              key={f}
              className={filter === f ? "selected" : ""}
              onClick={() => onFilter?.(f)}
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function SalesChart({
  sales,
  returns,
}: {
  sales: Sale[];
  returns: Database["returns"];
}) {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today() + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 6 + i);
    return d.toISOString().slice(0, 10);
  });
  const day = (d: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
      new Date(d),
    );
  const values = dates.map(
    (d) =>
      sales.filter((s) => day(s.date) === d).reduce((n, s) => n + s.total, 0) -
      returns
        .filter((r) => day(r.date) === d)
        .reduce((n, r) => n + r.refund, 0),
  );
  const max = Math.max(100, ...values.map(Math.abs));
  return (
    <div className="sales-chart">
      <div className="chart-y">
        <span>{money(max)}</span>
        <span>{money(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="chart-plot">
        <div className="grid-lines">
          <i />
          <i />
          <i />
        </div>
        <div className="chart-bars">
          {dates.map((d, i) => (
            <div className="chart-column" key={d}>
              <div
                className={`chart-bar ${values[i] < 0 ? "negative" : ""}`}
                style={{
                  height: `${Math.max(0, (Math.abs(values[i]) / max) * 100)}%`,
                }}
                title={`${d}: Rs. ${money(values[i])}`}
              >
                <span>{money(values[i])}</span>
              </div>
              <label>
                {new Date(d + "T12:00:00").toLocaleDateString("en", {
                  weekday: "short",
                })}
              </label>
            </div>
          ))}
        </div>
        {!values.some(Boolean) && (
          <div className="chart-zero">
            <span>
              <Activity size={18} />
            </span>
            <strong>Your sales story starts today</strong>
            <small>Completed sales will appear here.</small>
          </div>
        )}
      </div>
    </div>
  );
}
function MedicineForm({
  medicine,
  onSave,
}: {
  medicine?: Medicine;
  onSave: (m: Medicine) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          id: medicine?.id || crypto.randomUUID(),
          name: String(f.get("name")).trim(),
          generic: String(f.get("generic")).trim(),
          strength: String(f.get("strength")).trim(),
          form: String(f.get("form")),
          category: String(f.get("category")).trim(),
          manufacturer: String(f.get("manufacturer")).trim(),
          barcode: String(f.get("barcode")).trim(),
          rack: String(f.get("rack")).trim(),
          unitsPerPack: Number(f.get("unitsPerPack")),
          reorder: Number(f.get("reorder")),
          price: Number(f.get("price")),
        });
      }}
    >
      <div className="eyebrow">MEDICINE CATALOGUE</div>
      <h2>{medicine ? "Edit medicine" : "Add a medicine"}</h2>
      <p>Prices and stock quantities use the smallest saleable unit.</p>
      <div className="form-grid">
        {[
          { key: "name", label: "Brand / medicine name" },
          { key: "generic", label: "Generic / composition" },
          { key: "strength", label: "Strength" },
          { key: "manufacturer", label: "Manufacturer" },
          { key: "category", label: "Category" },
          { key: "barcode", label: "Barcode" },
          { key: "rack", label: "Rack / shelf" },
        ].map((x) => (
          <Field key={x.key} label={x.label}>
            <input
              name={x.key}
              required={x.key === "name" || x.key === "generic"}
              maxLength={160}
              defaultValue={medicine?.[x.key as keyof Medicine]}
            />
          </Field>
        ))}
        <Field label="Dosage / item form">
          <select name="form" defaultValue={medicine?.form || "Tablet"}>
            {[
              "Tablet",
              "Capsule",
              "Suspension",
              "Syrup",
              "Inhaler",
              "Injection",
              "Sachet",
              "Surgical",
              "Other",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Units per pack">
          <input
            type="number"
            name="unitsPerPack"
            min="1"
            step="1"
            required
            defaultValue={medicine?.unitsPerPack || 1}
          />
        </Field>
        <Field label="Reorder level (units)">
          <input
            type="number"
            name="reorder"
            min="0"
            step="1"
            required
            defaultValue={medicine?.reorder ?? 10}
          />
        </Field>
        <Field label="Default selling price / unit (Rs.)">
          <input
            type="number"
            name="price"
            min="0.01"
            step="0.01"
            required
            defaultValue={medicine?.price || ""}
          />
        </Field>
      </div>
      <div className="form-footer">
        <span>Stock is added through a receipt.</span>
        <button className="primary" type="submit">
          <Check size={16} />
          Save medicine
        </button>
      </div>
    </form>
  );
}
function StockForm({
  db,
  onSave,
}: {
  db: Database;
  onSave: (b: Batch, reference: string) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave(
          {
            id: crypto.randomUUID(),
            medicineId: String(f.get("medicineId")),
            supplierId: String(f.get("supplierId")),
            number: String(f.get("number")).trim(),
            expiry: String(f.get("expiry")),
            qty: Number(f.get("qty")),
            cost: Number(f.get("cost")),
            price: Number(f.get("price")),
            status: "available",
          },
          String(f.get("reference")).trim(),
        );
      }}
    >
      <div className="eyebrow">PURCHASE / PAID STOCK RECEIPT</div>
      <h2>Receive a new batch</h2>
      <p>Check the physical batch number and expiry before saving.</p>
      <div className="form-grid">
        <Field label="Medicine">
          <select name="medicineId" required>
            <option value="">Select medicine</option>
            {db.medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.strength}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supplier">
          <select name="supplierId" required>
            <option value="">Select supplier</option>
            {db.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supplier invoice / reference">
          <input name="reference" required maxLength={100} />
        </Field>
        <Field label="Batch number">
          <input name="number" required maxLength={60} />
        </Field>
        <Field label="Expiry date">
          <input type="date" name="expiry" min={today()} required />
        </Field>
        <Field label="Received base units">
          <input name="qty" type="number" min="1" step="1" required />
        </Field>
        <Field label="Net purchase cost / unit (Rs.)">
          <input name="cost" type="number" min="0" step="0.01" required />
        </Field>
        <Field label="Selling price / unit (Rs.)">
          <input name="price" type="number" min="0.01" step="0.01" required />
        </Field>
      </div>
      <div className="notice small-notice">
        Enter net cost after supplier discounts. Credit purchases and bonus
        schemes are planned separately.
      </div>
      <div className="form-footer">
        <span>Saving immediately increases stock.</span>
        <button className="primary" type="submit">
          <Package size={16} />
          Receive stock
        </button>
      </div>
    </form>
  );
}
function PartyForm({
  type,
  onSave,
}: {
  type: "customers" | "suppliers";
  onSave: (p: Party) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          id: crypto.randomUUID(),
          name: String(f.get("name")).trim(),
          phone: String(f.get("phone")).trim(),
          address: String(f.get("address")).trim(),
        });
      }}
    >
      <div className="eyebrow">CONTACT DIRECTORY</div>
      <h2>Add {type === "customers" ? "customer" : "supplier"}</h2>
      <p>Keep billing and contact details together.</p>
      <div className="form-grid single">
        <Field label="Full name / business name">
          <input name="name" required maxLength={120} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" maxLength={30} />
        </Field>
        <Field label="Address">
          <input name="address" maxLength={200} />
        </Field>
      </div>
      <div className="form-footer">
        <span />
        <button className="primary" type="submit">
          Save contact
        </button>
      </div>
    </form>
  );
}
function ReturnForm({
  sale,
  onSave,
}: {
  sale: Sale;
  onSave: (id: string, qty: number, reason: string) => void;
}) {
  const [selected, setSelected] = useState(sale.lines[0].batchId);
  const line = sale.lines.find((l) => l.batchId === selected)!;
  return (
    <form
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave(selected, Number(f.get("qty")), String(f.get("reason")));
      }}
    >
      <div className="eyebrow">INVOICE-LINKED RETURN</div>
      <h2>Return against {sale.id}</h2>
      <p>
        Refund uses the original price after item and bill discounts. Returned
        medicine is held for inspection.
      </p>
      <div className="form-grid single">
        <Field label="Sold item / batch">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {sale.lines.map((l) => (
              <option key={l.batchId} value={l.batchId}>
                {l.name} · {l.batch}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={`Quantity (${line.qty - line.returned} units returnable)`}
        >
          <input
            key={selected}
            name="qty"
            type="number"
            min="1"
            max={line.qty - line.returned}
            step="1"
            required
            defaultValue="1"
          />
        </Field>
        <Field label="Reason / inspection note">
          <input name="reason" required maxLength={240} />
        </Field>
      </div>
      <div className="notice small-notice">
        Cash/card sales record a refund obligation; credit sales first reduce
        outstanding dues. Physical refund settlement belongs to the desktop cash
        ledger.
      </div>
      <div className="form-footer">
        <span />
        <button
          className="primary"
          disabled={line.qty === line.returned}
          type="submit"
        >
          <RotateCcw size={16} />
          Record return
        </button>
      </div>
    </form>
  );
}
function Receipt({
  sale,
  settings,
  paper,
  returned,
}: {
  sale: Sale;
  settings: Database["settings"];
  paper: string;
  returned: number;
}) {
  const calc = totals(sale.lines, sale.discount);
  return (
    <article
      id="printable-receipt"
      className={`receipt ${paper === "A4" ? "a4" : "thermal"}`}
    >
      <div className="receipt-brand">
        <span className="receipt-cross">✚</span>
        <h2>{settings.name}</h2>
        <p>{settings.address}</p>
        <p>{settings.phone}</p>
      </div>
      <div className="receipt-title">SALES INVOICE</div>
      <div className="receipt-meta">
        <div>
          <span>Invoice</span>
          <strong>{sale.id}</strong>
        </div>
        <div>
          <span>Date</span>
          <strong>
            {dateLabel(sale.date)} ·{" "}
            {new Date(sale.date).toLocaleTimeString("en-PK", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Karachi",
            })}
          </strong>
        </div>
        <div>
          <span>Customer</span>
          <strong>{sale.customerName}</strong>
        </div>
        <div>
          <span>Payment</span>
          <strong>{sale.payment}</strong>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Disc.</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((l) => (
            <tr key={l.batchId}>
              <td>
                <strong>{l.name}</strong>
                <small>
                  {l.batch} · Exp {l.expiry.slice(0, 7)}
                </small>
              </td>
              <td>{l.qty}</td>
              <td>{money(l.price)}</td>
              <td>{l.discount}%</td>
              <td className="right">
                {money(l.qty * l.price * (1 - l.discount / 100))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="receipt-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(calc.subtotal)}</span>
        </div>
        <div>
          <span>Item discount</span>
          <span>− {money(calc.itemDiscount)}</span>
        </div>
        <div>
          <span>Bill discount</span>
          <span>− {money(sale.discount)}</span>
        </div>
        <div className="receipt-grand">
          <strong>Total (PKR)</strong>
          <strong>{money(sale.total)}</strong>
        </div>
        <div>
          <span>Paid at sale</span>
          <span>{money(sale.paid)}</span>
        </div>
        <div>
          <span>Due at sale</span>
          <span>{money(Math.max(0, sale.total - sale.paid))}</span>
        </div>
        {returned > 0 && (
          <div>
            <span>Subsequent return / credit</span>
            <span>{money(returned)}</span>
          </div>
        )}
      </div>
      <div className="receipt-thanks">
        <p>{settings.receiptNote}</p>
        <small>Demo invoice · Not for live dispensing</small>
        <span>Powered by Ilmdeen</span>
      </div>
    </article>
  );
}
export default App;
