import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("routes the production entry to a truthful unconfigured sign-in state", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/sign-in$/u);
  await expect(
    page.getByRole("heading", {
      name: "ยังไม่ได้เชื่อมต่อระบบยืนยันตัวตน",
    }),
  ).toBeVisible();
  await expect(page.locator("main").locator("form, input, button")).toHaveCount(0);
  await expect(page.getByText(/SUPABASE_SERVICE_ROLE_KEY|service.role|secret/iu)).toHaveCount(0);
});

test("keeps the protected application truthful before local auth is configured", async ({
  page,
}) => {
  await page.goto("/app");

  await expect(
    page.getByRole("heading", {
      name: "ยังไม่ได้เชื่อมต่อระบบยืนยันตัวตน",
    }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("has no serious accessibility issue or horizontal overflow at the configured viewport", async ({
  page,
}) => {
  await page.goto("/sign-in");

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    ),
  ).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("does not expose the synthetic prototype from production navigation", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.locator('a[href^="/prototype"]')).toHaveCount(0);
  await page.goto("/prototype/field?variant=A");
  await expect(page.getByRole("heading", { name: "งานของฉัน" })).toBeVisible();
});
