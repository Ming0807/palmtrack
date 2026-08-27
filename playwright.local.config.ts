import { defineConfig, devices } from "@playwright/test";

const apiUrl = process.env.PALMTRACK_E2E_LOCAL_API_URL ?? "";
const publicKey = process.env.PALMTRACK_E2E_LOCAL_ANON_KEY ?? "";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "**/population-import.spec.ts",
    "**/sampling.spec.ts",
    "**/farm-core-ledger.spec.ts",
    "**/fallback-states.spec.ts",
    "**/module-status.spec.ts",
    "**/sign-out.spec.ts",
  ],
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "output/playwright/local-results",
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200/app",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      DATABASE_URL: "",
      DIRECT_URL: "",
      PALMTRACK_E2E_LOCAL_SERVICE_KEY: "",
    },
  },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1365, height: 900 } } },
  ],
});
