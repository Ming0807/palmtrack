import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./support/local-supabase";

async function expectModuleStatus(
  page: Page,
  title: string,
  currentNavigationLabel: string,
) {
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(
    page.getByRole("status", {
      name: `สถานะโมดูล ${title}: ยังไม่เปิดใช้งาน`,
    }),
  ).toContainText("ยังไม่เปิดใช้งาน");
  await expect(page.getByRole("heading", { level: 2, name: "สิ่งที่โมดูลจะรองรับ" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "ขั้นตอนและแผนงานถัดไป" })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "เมนูหลัก" })
      .getByRole("link", { name: currentNavigationLabel }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
}

async function expectForbiddenWithoutModuleMetadata(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeVisible();
  await expect(page.getByRole("status")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "สิ่งที่โมดูลจะรองรับ" })).toHaveCount(0);
}

test.describe("Truthful Module Status Pages (/app/[section])", () => {
  test("[E2E-01][A11Y-01] admin can view truthful settings and audit module status", async ({ page }) => {
    await signInAs(page, "admin");

    await page.goto("/app/settings");
    await expectModuleStatus(page, "ตั้งค่าระบบ", "ตั้งค่าระบบ");
    await expect(page.getByRole("link", { name: "กลับสู่หน้าหลัก" })).toHaveAttribute("href", "/app");

    await page.goto("/app/audit");
    await expectModuleStatus(page, "ตรวจสอบเหตุการณ์", "ตรวจสอบเหตุการณ์");

    await expectForbiddenWithoutModuleMetadata(page, "/app/reports");
  });

  test("[E2E-01] research_manager can view reports module status", async ({ page }) => {
    await signInAs(page, "research_manager");
    await page.goto("/app/reports");
    await expectModuleStatus(page, "รายงาน", "รายงาน");

    await expectForbiddenWithoutModuleMetadata(page, "/app/settings");
  });

  test("[E2E-01] field_collector can view my-work module status", async ({ page }) => {
    await signInAs(page, "field_collector");
    await page.goto("/app/my-work");
    await expectModuleStatus(page, "งานของฉัน", "งานของฉัน");

    await expectForbiddenWithoutModuleMetadata(page, "/app/evaluation");
  });

  test("[E2E-01] evaluator_readonly can view evaluation module status", async ({ page }) => {
    await signInAs(page, "evaluator_readonly");
    await page.goto("/app/evaluation");
    await expectModuleStatus(page, "ภาพรวมประเมิน", "ภาพรวมประเมิน");

    await expectForbiddenWithoutModuleMetadata(page, "/app/my-work");
  });

  test("[E2E-01] farmer receives non-enumerating forbidden state on unauthorized sections", async ({
    page,
  }) => {
    await signInAs(page, "farmer");

    await expect(
      page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "สวนของฉัน" }),
    ).toBeVisible();
    await expectForbiddenWithoutModuleMetadata(page, "/app/audit");

    await page.goto("/app/unknown-module");
    await expect(page.getByRole("heading", { name: "ไม่พบหน้าที่ต้องการ (404)" })).toBeVisible();
  });
});
