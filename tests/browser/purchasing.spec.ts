import { test, expect } from "@playwright/test";
test("build distributor chain, receive multi-company invoice, record payment and restore traceable stock", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Distributors", exact: true }).click();
  await page
    .getByRole("button", { name: "Add distributor", exact: true })
    .click();
  await page
    .getByLabel("Full name / business name")
    .fill("M&P Demo Distribution");
  await page.getByLabel("Phone", { exact: true }).fill("0300 1231234");
  await page.getByRole("button", { name: "Save contact", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "M&P Demo Distribution" })
    .click();
  await page
    .getByRole("button", { name: "Manage company links", exact: true })
    .click();
  await page
    .getByLabel("New company name", { exact: true })
    .fill("Demo Laboratories");
  await page.getByRole("button", { name: "Link company", exact: true }).click();
  await page
    .locator(".company-block")
    .filter({ hasText: "Demo Laboratories" })
    .getByRole("button", { name: "Add medicine", exact: true })
    .click();
  await expect(page.getByLabel("Medicine company")).toHaveValue(/.+/);
  await page.getByLabel("Brand / medicine name").fill("Demo tablet");
  await page.getByLabel("Generic / composition").fill("Demo composition");
  await page.getByLabel("Units per pack").fill("10");
  await page.getByLabel("Default selling price / unit (Rs.)").fill("12");
  await page
    .getByRole("button", { name: "Save medicine", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage company links", exact: true })
    .click();
  await page
    .getByLabel("Link existing company", { exact: true })
    .selectOption({ label: "GSK" });
  await page.getByRole("button", { name: "Link company", exact: true }).click();
  await page.screenshot({
    path: "artifacts/distributor-chain.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Purchases", exact: true }).click();
  await page
    .getByRole("button", { name: "Receive stock", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Purchase company")).toBeDisabled();
  expect(
    await page
      .locator(".purchase-modal")
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(900);
  await page
    .getByLabel("Purchase distributor", { exact: true })
    .selectOption({ label: "M&P Demo Distribution" });
  await expect(
    page.getByLabel("Purchase company").locator("option"),
  ).toHaveCount(3);
  await page
    .getByLabel("Distributor invoice number", { exact: true })
    .fill("MP-1001");
  await page
    .getByLabel("Purchase company", { exact: true })
    .selectOption({ label: "Demo Laboratories" });
  await page
    .getByLabel("Purchase medicine", { exact: true })
    .selectOption({ label: "Demo tablet" });
  await page.getByLabel("Purchase batch number").fill("DT-01");
  await page.getByLabel("Purchase expiry").fill("2099-12-31");
  await page.getByLabel("Buying unit").selectOption("pack");
  await page.getByLabel("Purchased quantity", { exact: true }).fill("2");
  await page.getByLabel("Bonus quantity", { exact: true }).fill("1");
  await page
    .getByLabel("Purchase price / pack (Rs.)", { exact: true })
    .fill("100");
  await page.getByLabel("Discount %", { exact: true }).fill("10");
  await page.getByLabel("GST / tax %", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Add item to invoice", exact: true })
    .click();
  await expect(
    page.getByLabel("Purchase distributor", { exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Purchase company", { exact: true })
    .selectOption({ label: "GSK" });
  await page
    .getByLabel("Purchase medicine", { exact: true })
    .selectOption({ label: "Ventolin 100mcg" });
  await page.getByLabel("Purchase batch number").fill("VN-NEW");
  await page.getByLabel("Purchase expiry").fill("2099-12-31");
  await page
    .getByLabel("Purchase price / unit (Rs.)", { exact: true })
    .fill("360");
  await page
    .getByRole("button", { name: "Add item to invoice", exact: true })
    .click();
  await page.getByLabel("Purchase amount paid", { exact: true }).fill("200");
  await page.screenshot({
    path: "artifacts/purchase-multi-item.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save purchase & update stock", exact: true })
    .click();
  await expect(page.locator(".purchase-print .receipt-grand")).toContainText(
    "558.00",
  );
  await expect(page.locator(".purchase-print")).toContainText("358.00");
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: "artifacts/purchase-invoice.pdf",
    format: "A4",
    preferCSSPageSize: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "MP-1001" })
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByLabel("Supplier payment amount").fill("100");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "MP-1001" }),
  ).toContainText("258.00");
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Demo tablet" }),
  ).toContainText("30");
  await page.getByRole("button", { name: "Batches", exact: true }).click();
  const batch = page.getByRole("row").filter({ hasText: "DT-01" });
  await expect(batch).toContainText("MP-1001");
  await expect(batch).toContainText("M&P Demo Distribution");
  await page.reload();
  await page.getByRole("button", { name: "Distributors", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "M&P Demo Distribution" })
    .click();
  await page
    .getByRole("button", { name: "Distributor ledger", exact: true })
    .click();
  await expect(page.locator(".purchase-ledger-total")).toContainText("258.00");
  await page
    .getByRole("button", { name: "Backup & restore", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full backup" }).click();
  const file = await pending;
  await file.saveAs("artifacts/purchase-backup.json");
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/purchase-backup.json");
  await expect(
    page.getByRole("heading", { name: "Review backup before restoring" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});
