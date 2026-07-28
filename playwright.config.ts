import { defineConfig, devices } from "@playwright/test";

const webPort = 15174;
const serverPort = 15175;
const webUrl = `http://127.0.0.1:${webPort}`;
const serverUrl = `http://127.0.0.1:${serverPort}`;

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
    baseURL: webUrl,
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
      url: `${serverUrl}/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        HOST: "127.0.0.1",
        PORT: String(serverPort),
        CLIENT_ORIGIN: webUrl,
        MATCH_COUNTDOWN_MS: "900",
        MATCH_TIME_LIMIT_MS: "30000",
        MAX_ROOMS: "20",
        MAX_CONNECTIONS_PER_ADDRESS: "16",
      },
    },
    {
      command: `vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webUrl,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        VITE_MULTIPLAYER_URL: serverUrl,
      },
    },
  ],
});
