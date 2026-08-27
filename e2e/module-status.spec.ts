import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { signInAs } from "./support/local-supabase";

test.describe("Truthful Module Status Pages (/app/[section])", () => {
  test("[STATUS-01] admin can view truthful settings and audit module status", async ({ page }) => {
    await signInAs(page, "admin");

    // 1. Settings module
    await page.goto("/app/settings");
    await expect(page.getByRole("heading", { level: 1, name: "ตั้งค่าระบบ" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("ยังไม่เปิดใช้งาน");
    await expect(page.getByRole("heading", { level: 2, name: "สิ่งที่โมดูลจะรองรับ" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "ขั้นตอนและแผนงานถัดไป" })).toBeVisible();
    await expect(page.getByRole("link", { name: "กลับสู่หน้าหลัก" })).toHaveAttribute("href", "/app");

    // 360px overflow check
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    // Axe a11y scan
    const axeSettings = await new AxeBuilder({ page }).analyze();
    expect(axeSettings.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);

    // 2. Audit module
    await page.goto("/app/audit");
    await expect(page.getByRole("heading", { level: 1, name: "ตรวจสอบเหตุการณ์" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("ยังไม่เปิดใช้งาน");
  });

  test("[STATUS-02] research_manager can view reports module status", async ({ page }) => {
    await signInAs(page, "research_manager");
    await page.goto("/app/reports");
    await expect(page.getByRole("heading", { level: 1, name: "รายงาน" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("ยังไม่เปิดใช้งาน");
    await expect(page.getByRole("heading", { level: 2, name: "สิ่งที่โมดูลจะรองรับ" })).toBeVisible();
  });

  test("[STATUS-03] field_collector can view my-work module status", async ({ page }) => {
    await signInAs(page, "field_collector");
    await page.goto("/app/my-work");
    await expect(page.getByRole("heading", { level: 1, name: "งานของฉัน" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("ยังไม่เปิดใช้งาน");
    await expect(page.getByRole("heading", { level: 2, name: "สิ่งที่โมดูลจะรองรับ" })).toBeVisible();
  });

  test("[STATUS-04] evaluator_readonly can view evaluation module status", async ({ page }) => {
    await signInAs(page, "evaluator_readonly");
    await page.goto("/app/evaluation");
    await expect(page.getByRole("heading", { level: 1, name: "ภาพรวมประเมิน" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("ยังไม่เปิดใช้งาน");
    await expect(page.getByRole("heading", { level: 2, name: "สิ่งที่โมดูลจะรองรับ" })).toBeVisible();
  });

  test("[RLS-09] farmer receives non-enumerating forbidden state on unauthorized sections", async ({
    page,
  }) => {
    await signInAs(page, "farmer");

    for (const section of ["settings", "audit", "reports", "my-work", "evaluation"]) {
      await page.goto(`/app/${section}`);
      await expect(page.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeVisible();
      await expect(page.getByRole("status")).not.toBeVisible();
    }
  });
});
