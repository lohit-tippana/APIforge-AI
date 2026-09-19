import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    { command: "npm run dev -w ../api --prefix ../..", url: "http://localhost:4100/api/health", reuseExistingServer: true, timeout: 60_000 },
  ],
});
