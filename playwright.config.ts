import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 7_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  webServer: [
    {
      command: "npm run start",
      url: "http://127.0.0.1:5175/health",
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        MATCH_COUNTDOWN_MS: "900",
        MATCH_TIME_LIMIT_MS: "30000",
        MAX_ROOMS: "20",
        MAX_CONNECTIONS_PER_ADDRESS: "16",
      },
    },
    {
      command: "npm run vite",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
