import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:4173/mt5-pnl-ui/" },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/mt5-pnl-ui/",
    reuseExistingServer: !process.env.CI,
  },
});
