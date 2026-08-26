import { expect, test } from "@playwright/test";

import {
  completeValidPopulationImport,
  samplingFixturePath,
  signInAs,
} from "./support/local-supabase";

test.describe("sampling acceptance", () => {
  test("[E2E-03] manager imports, activates and reloads a 93-member receipt", async ({ page }, testInfo) => {
    await signInAs(page, "research_manager");
    await completeValidPopulationImport(page, samplingFixturePath);
    await expect(page.getByText("snapshot ถูกล็อกแล้ว").first()).toBeVisible();

    await page.goto("/app/research/sampling");
    await expect(page.getByRole("heading", { name: "สร้างการสุ่มตัวอย่าง" })).toBeVisible();
    await expect(page.getByText("ข้อมูลสังเคราะห์เท่านั้น")).toBeVisible();
    await page.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }).click();
    await expect(page.getByRole("heading", { name: "ผลคำนวณเบื้องต้น" })).toBeVisible();
    await expect(page.getByText("121 ราย", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("93 ราย", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "ผลคำนวณเบื้องต้น" }).getByRole("region", { name: "ตารางการจัดสรรตามชั้นพื้นที่" }).locator("tbody tr")).toHaveCount(3);

    await page.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
    await expect(page.getByText("บันทึกฉบับร่างแล้ว · รอการล็อก")).toBeVisible();

    await page.getByRole("button", { name: "ล็อกหลักฐาน" }).click();
    const lockDialog = page.getByRole("dialog", { name: "ยืนยันการล็อกหลักฐาน" });
    await expect(lockDialog).toBeVisible();
    await expect(lockDialog.getByRole("button", { name: "กลับไปตรวจสอบ" })).toBeFocused();
    await lockDialog.getByRole("button", { name: "ล็อกหลักฐาน" }).click();
    await expect(page.getByText("ล็อกหลักฐานสำเร็จ · run รอการเปิดใช้งาน")).toBeVisible();
    await expect(page.getByText("สถานะ: ล็อกแล้ว · แก้ไขไม่ได้")).toBeVisible();

    await page.getByRole("button", { name: "เปิดใช้งาน" }).click();
    const activateDialog = page.getByRole("dialog", { name: "ยืนยันการเปิดใช้งาน" });
    await expect(activateDialog).toBeVisible();
    await expect(activateDialog.getByRole("button", { name: "กลับไปตรวจสอบ" })).toBeFocused();
    await activateDialog.getByRole("button", { name: "เปิดใช้งาน" }).click();
    await expect(page.getByText("เปิดใช้งานสำเร็จ · run นี้เป็นชุดปัจจุบัน")).toBeVisible();
    await expect(page.getByText("สถานะ: กำลังใช้งาน · เป็นชุดปัจจุบัน")).toBeVisible();

    await page.reload();
    await expect(page.getByText("สถานะ: กำลังใช้งาน · เป็นชุดปัจจุบัน")).toBeVisible();
    await expect(page.getByRole("heading", { name: "หลักฐานที่บันทึกไว้" }).first()).toBeVisible();
    await expect(page.getByText("ข้อมูลสังเคราะห์เท่านั้น")).toBeVisible();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);

    if (process.env.PALMTRACK_E2E_CAPTURE_EVIDENCE === "1") {
      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: `docs/assets/sampling/${testInfo.project.name === "mobile" ? "mobile" : "desktop"}.png`,
      });
    }
  });

  for (const role of ["field_collector", "farmer"] as const) {
    test(`[RLS-09] ${role} cannot enumerate sampling evidence`, async ({ page }) => {
      await signInAs(page, role);
      await page.goto("/app/research/sampling");
      await expect(page.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeVisible();
      await expect(page.getByText(/sampling|สุ่มตัวอย่าง|ผลคำนวณ/iu)).toHaveCount(0);
    });
  }

  test("[E2E-03][RLS-09] evaluator receives aggregate-only sampling receipts", async ({ page }) => {
    await signInAs(page, "evaluator_readonly");
    await page.goto("/app/research/sampling");
    await expect(page.getByRole("heading", { name: "สร้างการสุ่มตัวอย่าง" })).toBeVisible();
    await expect(page.getByText("บัญชีนี้อ่านใบเสร็จหลักฐานได้เท่านั้น · ไม่มีฟอร์มหรือปุ่มเปลี่ยนสถานะ")).toBeVisible();
    await expect(page.getByText("สถานะ: กำลังใช้งาน · เป็นชุดปัจจุบัน")).toBeVisible();
    await expect(page.getByLabel("ประชากรที่รับรองแล้ว")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ดูตัวอย่างหลักฐาน|บันทึกฉบับร่าง|ล็อกหลักฐาน|เปิดใช้งาน/iu })).toHaveCount(0);
    await expect(page.getByText("หลักฐานที่บันทึกไว้")).toHaveCount(0);
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
  });
});
