import { defineConfig } from "@playwright/test";

// Browser tests drive the real UI, served by the real Python server.
//
//   npm run test:e2e         offline test mode: stand-in models, no keys, no cost, same result every run
//   npm run test:e2e:live    live models from working-slice/.env (real calls; costs a few cents)
//
// Both build the UI first. Results and screenshots of failures go to web/test-results/.

const live = process.env.PARCHI_E2E_LIVE === "1";
const port = live ? 8767 : 8766;

export default defineConfig({
  testDir: "./e2e",
  timeout: live ? 90_000 : 30_000,
  expect: { timeout: live ? 30_000 : 5_000 },
  fullyParallel: false,          // one server, one clinic: tests run one after another
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: "chrome",           // uses the Chrome already installed; no browser download
    headless: true,
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python -m parchi.server",
    cwd: "..",
    url: `http://127.0.0.1:${port}/api/system`,
    env: {
      PARCHI_ENV: "test",
      PARCHI_FAKE_MODELS: live ? "0" : "1",
      PARCHI_DEMO_LOGINS: "1",       // test sign-ins (doctor-test, reception-test) for the dashboard tests
      PARCHI_PORT: String(port),
      PYTHONIOENCODING: "utf-8",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
