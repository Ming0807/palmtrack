import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  completeValidPopulationImport,
  completeValidSamplingDraft,
  databaseSamplingRunCount,
  signInAs,
  validFixturePath,
} from "./support/local-supabase";

test("[E2E-03] research manager drafts, locks and activates a synthetic sampling run", async ({ page }, testInfo) => {
  await signInAs(page, "research_manager");
  await completeValidPopulationImport(page, validFixturePath);
  const draftsBefore = await databaseSamplingRunCount("draft");
  await completeValidSamplingDraft(page);
  expect(await databaseSamplingRunCount("draft")).toBe(draftsBefore + 1);

  const lockedBefore = await databaseSamplingRunCount("locked");
  await page.getByRole("button", { name: "ล็อกผลสุ่ม" }).first().click();
  await expect(page.getByText("ล็อกแล้ว").first()).toBeVisible();
  expect(await databaseSamplingRunCount("locked")).toBe(lockedBefore + 1);

  const activeBefore = await databaseSamplingRunCount("active");
  const supersededBefore = await databaseSamplingRunCount("superseded");
  await page.getByRole("button", { name: "เปิดใช้รอบนี้" }).first().click();
  await expect(page.getByText("ใช้งานอยู่").first()).toBeVisible();
  expect(await databaseSamplingRunCount("active")).toBe(1);
  expect(await databaseSamplingRunCount("superseded")).toBe(
    supersededBefore + (activeBefore > 0 ? 1 : 0),
  );

  await expect(page.getByText("sha256-mulberry32-fy-v1").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /แก้ไขผลสุ่ม/u })).toHaveCount(0);
  await expect(page.getByTestId("allocation-chart").first()).toBeVisible();
  await page.getByText("ดูตารางข้อมูล").first().click();
  await expect(page.getByRole("table", { name: /ตารางกราฟการจัดสรร/u }).first()).toBeVisible();
  if (process.env.PALMTRACK_E2E_CAPTURE_EVIDENCE === "1") {
    await page.getByRole("heading", { name: "สุ่มตัวอย่าง" }).click();
    await page.screenshot({
      path: `docs/assets/sampling/${testInfo.project.name === "mobile" ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
  }
});

test("[E2E-03][A11Y-01][A11Y-02] sampling flow is keyboard-safe and accessible", async ({ page }) => {
  await signInAs(page, "research_manager");
  await completeValidPopulationImport(page, validFixturePath);
  await completeValidSamplingDraft(page);
  await page.goto("/app/research/sampling");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const role of ["field_collector", "farmer"] as const) {
  test(`[RLS-09] ${role} receives a non-enumerating forbidden state on sampling`, async ({ page }) => {
    await signInAs(page, role);
    await page.goto("/app/research/sampling");
    await expect(page.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeVisible();
    await expect(page.getByText(/สุ่มตัวอย่าง|sha256-mulberry32/iu)).toHaveCount(0);
  });
}

test("[RLS-09] evaluator reads sampling evidence without mutation controls", async ({ page, context }) => {
  await signInAs(page, "research_manager");
  await completeValidPopulationImport(page, validFixturePath);
  await completeValidSamplingDraft(page);
  await context.clearCookies();
  await signInAs(page, "evaluator_readonly");
  await page.goto("/app/research/sampling");
  await expect(page.getByRole("heading", { name: "สุ่มตัวอย่าง" })).toBeVisible();
  await expect(page.getByRole("button", { name: /สร้างฉบับร่าง|ล็อกผลสุ่ม|เปิดใช้รอบนี้/u })).toHaveCount(0);
});
