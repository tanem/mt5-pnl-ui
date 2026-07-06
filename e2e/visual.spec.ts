// Not part of the e2e suite: captures one screenshot per view into
// visual-review/ (git-ignored) so UI changes can be inspected in a real
// browser render (npm run visual). jsdom-based unit tests cannot see
// layout, and the e2e suite only asserts DOM structure — these captures
// are the "does it look right" check. Not assertions; nothing fails on
// visual differences.
import { expect, test, type Page } from "@playwright/test";
import { dropFixture } from "./fixture";

const OUT = "visual-review";

test.use({ viewport: { width: 1440, height: 900 } });

async function load(page: Page): Promise<void> {
  await page.goto("");
  await dropFixture(page);
  await page.getByLabel(/passphrase/i).fill("e2e-passphrase");
  await page.getByRole("button", { name: /unlock/i }).click();
  await expect(
    page.getByRole("region", { name: /usd overview/i }),
  ).toBeVisible();
  await page.waitForTimeout(1200); // let ECharts animations settle
}

test("captures Overview, with and without a chart tooltip", async ({ page }) => {
  await load(page);
  await page.screenshot({ path: `${OUT}/overview.png`, fullPage: true });
  const chart = page.getByRole("img", { name: /cumulative net p&l \(usd\)/i });
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${OUT}/overview-tooltip.png`,
    clip: {
      x: box.x,
      y: Math.max(0, box.y - 20),
      width: box.width,
      height: box.height + 40,
    },
  });
});

test("captures the Calendar in light and dark themes", async ({ page }) => {
  await load(page);
  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page.getByRole("grid").first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/calendar-light.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/calendar-dark.png`, fullPage: true });
});

test("captures the Trades table", async ({ page }) => {
  await load(page);
  await page.getByRole("link", { name: "Trades" }).click();
  await expect(page.getByRole("tab", { name: /closed deals/i })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/trades.png`, fullPage: true });
});

test("captures the Strategies view", async ({ page }) => {
  await load(page);
  await page.getByRole("link", { name: "Strategies" }).click();
  await expect(
    page.getByRole("region", { name: /usd strategies/i }),
  ).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/strategies.png`, fullPage: true });
});
