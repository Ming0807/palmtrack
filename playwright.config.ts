import { defineConfig, devices } from "@playwright/test";

const e2eEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => {
    const isProjectConnection =
      name.startsWith("SUPABASE_") ||
      name.startsWith("NEXT_PUBLIC_SUPABASE_") ||
      name === "DATABASE_URL" ||
      name === "DIRECT_URL" ||
      name === "APP_WORKSPACE_ID" ||
      name === "EXPORT_SIGNING_SECRET";
    const looksSensitive =
      /(?:^|_)(?:PASSWORD|SECRET|TOKEN|PRIVATE_KEY|API_KEY)(?:$|_)/iu.test(
        name,
      );

    return !isProjectConnection && !looksSensitive;
  }),
);

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/population-import.spec.ts",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "output/playwright/test-results",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    env: {
      ...e2eEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
    url: "http://127.0.0.1:3100/prototype/field?variant=A",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1365, height: 900 },
      },
    },
  ],
});
