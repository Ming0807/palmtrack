import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  completeValidPopulationImport,
  databaseImportCount,
  duplicateFixturePath,
  fillValidPopulationForm,
  signInAs,
  submitSyntheticMetadata,
  validFixturePath,
} from "./support/local-supabase";

test("[E2E-02] research manager validates and accepts a synthetic population", async ({ page }, testInfo) => {
  await signInAs(page, "research_manager");
  await completeValidPopulationImport(page, validFixturePath);
  await expect(page.getByText("snapshot ถูกล็อกแล้ว").first()).toBeVisible();
  await page.getByRole("heading", { name: "นำเข้าประชากร" }).click();
  await page.screenshot({
    path: `docs/assets/population-import/${testInfo.project.name === "mobile" ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
});

test("[E2E-15] admin uses the same audited import path", async ({ page }) => {
  await signInAs(page, "admin");
  await completeValidPopulationImport(page, validFixturePath);
  await expect(page.getByText("snapshot ถูกล็อกแล้ว").first()).toBeVisible();
});

for (const role of ["field_collector", "farmer", "evaluator_readonly"] as const) {
  test(`[RLS-09] ${role} receives a non-enumerating forbidden state`, async ({ page }) => {
    await signInAs(page, role);
    await page.goto("/app/research/population");
    await expect(page.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeVisible();
    await expect(page.getByText(/snapshot|นำเข้าประชากร/iu)).toHaveCount(0);
  });
}

test("[SEC-02] invalid duplicate file writes nothing and exposes no raw cell", async ({ page }) => {
  await signInAs(page, "research_manager");
  const before = await databaseImportCount();
  await page.goto("/app/research/population");
  await page.getByLabel("ไฟล์ประชากร CSV").setInputFiles(duplicateFixturePath);
  await submitSyntheticMetadata(page);
  const summary = page.getByRole("alert").filter({ hasText: "พบข้อมูลที่ต้องแก้ไข" });
  await expect(summary).toContainText("DUPLICATE_FARMER_CODE");
  await expect(summary).not.toContainText("SYN-001");
  expect(await databaseImportCount()).toBe(before);
});

test("[INT-01] double submission keeps one idempotent import", async ({ page }) => {
  await signInAs(page, "research_manager");
  const before = await databaseImportCount();
  await page.goto("/app/research/population");
  await fillValidPopulationForm(page, validFixturePath);
  await page.getByRole("button", { name: "ตรวจและนำเข้า" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText("ตรวจผ่านทั้งชุด")).toBeVisible();
  expect(await databaseImportCount()).toBe(before + 1);
});

test("[A11Y-01][A11Y-02] flow is keyboard-safe, offline-safe and accessible", async ({ page, context }) => {
  await signInAs(page, "research_manager");
  await page.goto("/app/research/population");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  const before = await databaseImportCount();
  await fillValidPopulationForm(page, validFixturePath);
  await context.setOffline(true);
  await page.getByRole("button", { name: "ตรวจและนำเข้า" }).click();
  await expect(page.getByRole("status")).toContainText("ออฟไลน์");
  expect(await databaseImportCount()).toBe(before);
  await context.setOffline(false);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
