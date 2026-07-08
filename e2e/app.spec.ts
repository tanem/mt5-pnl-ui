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
  await expect(
    page.getByRole("columnheader", { name: "Week" }).first(),
  ).toBeVisible();
  // Traded days carry the flat P&L wash — a computed-style guard, because
  // jsdom unit tests never load the built stylesheet (this regressed once
  // via cascade-layer order without any test noticing).
  await expect(page.locator('.day-cell[data-tone="pos"]').first()).toHaveCSS(
    "background-color",
    "rgba(15, 122, 69, 0.12)",
  );
  await expect(page.locator('.day-cell[data-tone="neg"]').first()).toHaveCSS(
    "background-color",
    "rgba(192, 48, 60, 0.12)",
  );
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

test("renders lifetime account returns that survive filtering", async ({ page }) => {
  await page.goto("");
  await dropFixture(page);
  await page.getByLabel(/passphrase/i).fill("e2e-passphrase");
  await page.getByRole("button", { name: /unlock/i }).click();

  // USD (Trend EA + Grid EA): external deposited 10,000; external withdrawn
  // 2,000; internal transfer 500; floating +155; profit +200; gain +2.0%.
  const usd = page.getByRole("region", { name: /usd account returns/i });
  await expect(usd.getByText("10,000.00 USD")).toBeVisible();
  await expect(usd.getByText("2,000.00 USD")).toBeVisible();
  await expect(usd.getByText("+155.00 USD")).toBeVisible();
  await expect(usd.getByText("+200.00 USD")).toBeVisible();
  await expect(usd.locator(".stat-value", { hasText: "+2.0%" })).toBeVisible(); // Gain tile
  await expect(usd.getByText("500.00 USD")).toBeVisible(); // Transferred tile
  // the per-account table was removed (2026-07-09 spec) — totals only
  await expect(usd.getByRole("table")).toHaveCount(0);

  // EUR: deposited 4,000 against balance 5,000 with only 4.50 of deal nets
  // → the deliberate reconciliation failure; profit 1,000, gain +25.0%.
  const eur = page.getByRole("region", { name: /eur account returns/i });
  await expect(eur.getByText("+25.0%")).toBeVisible();
  await expect(eur.getByText(/don't reconcile/)).toBeVisible();

  // Lifetime: a date filter that excludes every deal leaves the band intact.
  await page.getByLabel("From").fill("2027-01-01");
  await expect(page.getByText(/no closed deals match/i).first()).toBeVisible();
  await expect(usd.getByText("10,000.00 USD")).toBeVisible();
  await expect(
    page.getByText("Not affected by date, symbol, or magic filters.").first(),
  ).toBeVisible();
});
