import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

export async function dropFixture(
  page: Page,
  file = "snapshot.json.gz.age",
): Promise<void> {
  const fixture = readFileSync(`e2e/fixtures/${file}`);
  const dataTransfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "snapshot.json.gz.age"),
    );
    return dt;
  }, Array.from(fixture));
  await page.dispatchEvent("main", "drop", { dataTransfer });
}
