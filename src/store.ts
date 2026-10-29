import seed from "./data/pharmacy.json";
import { validateBackup } from "./domain";
import type { Database } from "./domain";
import { normalizePurchasing } from "./purchasing";
const KEY = "waseela-pharmacy-v1";
export function readDatabase(): Database {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (!validateBackup(parsed))
      throw new Error(
        "Saved data is invalid. Export or recover your browser data before continuing.",
      );
    // Preserve existing invoices/stock while updating the original default name.
    if (parsed.settings.name === "Waseela Pharmacy") {
      parsed.settings.name = "Ilmdeen Pharmacy";
    }
    return normalizePurchasing(parsed);
  }
  return normalizePurchasing(structuredClone(seed) as Database);
}
export function saveDatabase(db: Database) {
  localStorage.setItem(KEY, JSON.stringify(db));
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
