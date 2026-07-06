import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  projects: [
    { name: "e2e", testIgnore: ["**/screenshot.spec.ts", "**/visual.spec.ts"] },
    // Not a test: regenerates docs/screenshot.png (npm run screenshot).
    { name: "screenshot", testMatch: "**/screenshot.spec.ts" },
    // Not a test: captures per-view screenshots into visual-review/
    // (npm run visual) for visual inspection after UI changes.
    { name: "visual", testMatch: "**/visual.spec.ts" },
  ],
  use: { baseURL: "http://localhost:4173/mt5-pnl-ui/" },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/mt5-pnl-ui/",
    reuseExistingServer: !process.env.CI,
  },
});
