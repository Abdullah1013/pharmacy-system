import { test, expect } from "@playwright/test";
test("loaded frontend bills without internet and rejects malformed restore", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Point of sale", exact: true })
    .click();
  await page.getByRole("button", { name: "Add Panadol", exact: true }).click();
  await page.getByRole("button", { name: "Complete sale" }).click();
  await expect(page.locator(".receipt-grand")).toContainText("3.50");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Backup & restore", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1,"sales":[]}'),
    });
  await expect(page.getByRole("status")).toContainText("Invalid backup");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
