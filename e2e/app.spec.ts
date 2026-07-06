import { expect, test } from "@playwright/test";
import { dropFixture } from "./fixture";

test("decrypts a snapshot and renders the dashboard", async ({ page }) => {
  await page.goto("");
  await expect(page.getByText(/nothing leaves this machine/i)).toBeVisible();

  await dropFixture(page);
  await page.getByLabel(/passphrase/i).fill("e2e-passphrase");
  await page.getByRole("button", { name: /unlock/i }).click();

  // Overview: both currency sections render; no combined total
  await expect(page.getByRole("region", { name: /usd overview/i })).toBeVisible();
  await expect(page.getByRole("region", { name: /eur overview/i })).toBeVisible();
  await expect(page.getByText(/multiple currencies/i)).toBeVisible();

  // Navigate all views
  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page.getByRole("grid").first()).toBeVisible();
  await page.getByRole("link", { name: "Trades" }).click();
  await expect(page.getByRole("tab", { name: /closed deals/i })).toBeVisible();
  await page.getByRole("link", { name: "Strategies" }).click();
  const usdStrategies = page.getByRole("region", { name: /usd strategies/i });
  await expect(usdStrategies.getByRole("row", { name: /trend ea/i })).toBeVisible();
});

test("wrong passphrase shows the decrypt error and recovers", async ({ page }) => {
  await page.goto("");
  await dropFixture(page);
  await page.getByLabel(/passphrase/i).fill("wrong");
  await page.getByRole("button", { name: /unlock/i }).click();
  await expect(page.getByRole("alert")).toContainText(/wrong passphrase/i);

  await page.getByLabel(/passphrase/i).fill("e2e-passphrase");
  await page.getByRole("button", { name: /unlock/i }).click();
  await expect(page.getByRole("region", { name: /usd overview/i })).toBeVisible();
});

test("the served page carries the lockdown CSP", async ({ page }) => {
  await page.goto("");
  const csp = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(csp).toHaveAttribute("content", /connect-src 'none'/);
});
