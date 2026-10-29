import { test, expect } from "@playwright/test";
test("sale, invoice, return, persistence and backup work as one flow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good to see you, Admin" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/overview-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Point of sale", exact: true })
    .click();
  await page.getByRole("button", { name: "Add Panadol", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Quantity Panadol", exact: true })
    .fill("10");
  await page
    .getByRole("spinbutton", { name: "Discount Panadol", exact: true })
    .fill("10");
  await page.getByLabel("Bill discount (Rs.)", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "Hold bill", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Complete sale" }),
  ).toBeDisabled();
  await page.reload();
  await page
    .getByRole("button", { name: "Point of sale", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resume held (1)", exact: true })
    .click();
  await expect(
    page.getByLabel("Bill discount (Rs.)", { exact: true }),
  ).toHaveValue("1.5");
  await page.screenshot({ path: "artifacts/pos-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Complete sale" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".receipt-grand")).toContainText("30.00");
  await expect(page.locator(".receipt")).toContainText("PN-2401");
  await page.screenshot({ path: "artifacts/invoice-80mm.png", fullPage: true });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: "artifacts/invoice-80mm.pdf",
    width: "80mm",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("combobox", { name: "Print format" }).selectOption("A4");
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: "artifacts/invoice-a4.pdf",
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  await page
    .getByLabel("Reason / inspection note")
    .fill("Unopened item for inspection");
  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Panadol" }),
  ).toContainText("930");
  await page.reload();
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "INV-00001", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Backup & restore", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full backup" }).click();
  const file = await downloaded;
  await file.saveAs("artifacts/test-backup.json");
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/test-backup.json");
  await expect(
    page.getByRole("heading", { name: "Review backup before restoring" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});
test("catalogue, receipts, credit validation, expiry and responsive navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Add medicine", exact: true }).click();
  await page
    .getByLabel("Medicine distributor", { exact: true })
    .selectOption("s1");
  await page
    .getByLabel("Medicine company", { exact: true })
    .selectOption({ label: "Haleon" });
  await page.getByLabel("Brand / medicine name").fill("Test medicine");
  await page.getByLabel("Generic / composition").fill("Demo generic");
  await page.getByLabel("Default selling price / unit (Rs.)").fill("12");
  await page
    .getByRole("button", { name: "Save medicine", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Test medicine" }),
  ).toContainText("Out of stock");
  await page.getByRole("button", { name: "Purchases", exact: true }).click();
  await page
    .getByRole("button", { name: "Receive stock", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Purchase distributor", { exact: true })
    .selectOption("s1");
  await page
    .getByLabel("Purchase company", { exact: true })
    .selectOption({ label: "Haleon" });
  await page
    .getByLabel("Purchase medicine", { exact: true })
    .selectOption({ label: "Test medicine" });
  await page
    .getByLabel("Distributor invoice number", { exact: true })
    .fill("SUP-123");
  await page
    .getByLabel("Purchase batch number", { exact: true })
    .fill("TM-001");
  await page.getByLabel("Purchase expiry", { exact: true }).fill("2099-01-01");
  await page.getByLabel("Purchased quantity", { exact: true }).fill("50");
  await page
    .getByLabel("Purchase price / unit (Rs.)", { exact: true })
    .fill("8");
  await page
    .getByLabel("Selling price / base unit (Rs.)", { exact: true })
    .fill("12");
  await page
    .getByRole("button", { name: "Add item to invoice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save purchase & update stock", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "SUP-123" }),
  ).toContainText("400.00");
  await page
    .getByRole("button", { name: "Point of sale", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Test medicine", exact: true })
    .click();
  await page.getByRole("button", { name: "Credit", exact: true }).click();
  await page.getByRole("button", { name: "Complete sale" }).click();
  await expect(page.getByRole("status")).toContainText("Select a customer");
  await page
    .getByRole("button", { name: "Expiry center", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Expired", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Brufen" }),
  ).toContainText("Expired");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Point of sale", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Point of sale", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({ path: "artifacts/pos-mobile.png", fullPage: true });
});
