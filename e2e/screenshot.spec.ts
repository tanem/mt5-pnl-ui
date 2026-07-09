// Not part of the e2e suite: captures docs/screenshot.png for the
// README (npm run screenshot). Rerun and commit the image after
// visible UI changes.
import { expect, test } from "@playwright/test";
import { dropFixture } from "./fixture";

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

test("captures the Overview view for the README", async ({ page }) => {
  await page.goto("");
  await dropFixture(page, "screenshot.json.gz.age");
  await page.getByLabel(/passphrase/i).fill("e2e-passphrase");
  await page.getByRole("button", { name: /unlock/i }).click();

  await expect(
    page.getByRole("region", { name: /usd overview/i }),
  ).toBeVisible();
  // Fixed pause so the ECharts entry animations finish before capture;
  // over-waiting is harmless here, this is not an assertion.
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "docs/screenshot.png" });
});
