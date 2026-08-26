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
    const draftReceipt = page.getByTestId("sampling-run-receipt").filter({ has: page.locator('[data-status="draft"]') }).last();
    const createdRunId = await draftReceipt.getAttribute("data-run-id");
    expect(createdRunId).toMatch(/^[0-9a-f-]{36}$/iu);
    const createdReceipt = page.locator(`[data-testid="sampling-run-receipt"][data-run-id="${createdRunId}"]`);

    await createdReceipt.getByRole("button", { name: "ล็อกหลักฐาน" }).click();
    const lockDialog = page.getByRole("dialog", { name: "ยืนยันการล็อกหลักฐาน" });
    await expect(lockDialog).toBeVisible();
    await expect(lockDialog.getByRole("button", { name: "กลับไปตรวจสอบ" })).toBeFocused();
    await lockDialog.getByRole("button", { name: "ล็อกหลักฐาน" }).click();
    await expect(page.getByText("ล็อกหลักฐานสำเร็จ · run รอการเปิดใช้งาน")).toBeVisible();
    await expect(createdReceipt.locator('[data-status="locked"]')).toBeVisible();

    await createdReceipt.getByRole("button", { name: "เปิดใช้งาน" }).click();
    const activateDialog = page.getByRole("dialog", { name: "ยืนยันการเปิดใช้งาน" });
    await expect(activateDialog).toBeVisible();
    await expect(activateDialog.getByRole("button", { name: "กลับไปตรวจสอบ" })).toBeFocused();
    await activateDialog.getByRole("button", { name: "เปิดใช้งาน" }).click();
    await expect(page.getByText("เปิดใช้งานสำเร็จ · run นี้เป็นชุดปัจจุบัน")).toBeVisible();
    await expect(createdReceipt.locator('[data-status="active"]')).toBeVisible();

    const evaluatorContext = await page.context().browser()!.newContext({ viewport: page.viewportSize() });
    const evaluatorPage = await evaluatorContext.newPage();
    await signInAs(evaluatorPage, "evaluator_readonly");
    await evaluatorPage.goto("/app/research/sampling");
    await expect(evaluatorPage.getByRole("heading", { name: "สร้างการสุ่มตัวอย่าง" })).toBeVisible();
    await expect(evaluatorPage.getByText("บัญชีนี้อ่านใบเสร็จหลักฐานได้เท่านั้น · ไม่มีฟอร์มหรือปุ่มเปลี่ยนสถานะ")).toBeVisible();
    const evaluatorReceipt = evaluatorPage.locator(`[data-testid="sampling-run-receipt"][data-run-id="${createdRunId}"]`);
    await expect(evaluatorReceipt.locator('[data-status="active"]')).toBeVisible();
    await expect(evaluatorReceipt).toContainText("121 ราย");
    await expect(evaluatorReceipt).toContainText("93 ราย");
    await expect(evaluatorPage.getByLabel("ประชากรที่รับรองแล้ว")).toHaveCount(0);
    await expect(evaluatorPage.getByRole("button", { name: /ดูตัวอย่างหลักฐาน|บันทึกฉบับร่าง|ล็อกหลักฐาน|เปิดใช้งาน/iu })).toHaveCount(0);
    await expect(evaluatorPage.getByText("หลักฐานที่บันทึกไว้")).toHaveCount(0);
    await evaluatorContext.close();

    await page.reload();
    const reloadedReceipt = page.locator(`[data-testid="sampling-run-receipt"][data-run-id="${createdRunId}"]`);
    await expect(reloadedReceipt.locator('[data-status="active"]')).toBeVisible();
    await expect(reloadedReceipt).toContainText("121 ราย");
    await expect(reloadedReceipt).toContainText("0.05");
    await expect(reloadedReceipt).toContainText("93 ราย");
    await expect(reloadedReceipt).toContainText("palmtrack-acceptance-seed-v1");
    await expect(reloadedReceipt).toContainText("sha256-mulberry32-fy-v1");
    await expect(reloadedReceipt).toContainText("ordered result hash");
    await expect(reloadedReceipt.getByRole("heading", { name: "หลักฐานที่บันทึกไว้" })).toBeVisible();
    await expect(page.getByText("ข้อมูลสังเคราะห์เท่านั้น")).toBeVisible();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);

    const mainHeading = page.getByRole("heading", { name: "สร้างการสุ่มตัวอย่าง" });
    await mainHeading.focus();
    await expect(mainHeading).toBeFocused();
    const skipLink = page.locator('a[href="#main-content"]');
    const skipLinkBox = await skipLink.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { bottom: rect.bottom, transform: style.transform, visibility: style.visibility, opacity: style.opacity, pointerEvents: style.pointerEvents };
    });
    expect(skipLinkBox.bottom).toBeLessThanOrEqual(0);
    expect(skipLinkBox.transform).not.toBe("none");
    expect(skipLinkBox.visibility).toBe("hidden");
    expect(skipLinkBox.opacity).toBe("0");
    expect(skipLinkBox.pointerEvents).toBe("none");

    if (testInfo.project.name === "mobile") {
      const allocationRegion = page.getByRole("region", { name: "ตารางการจัดสรรตามชั้นพื้นที่" }).last();
      const firstAllocationRow = allocationRegion.locator("tbody tr").first();
      await expect(firstAllocationRow.locator('[data-label="เศษเหลือ"]')).toBeVisible();
      await expect(firstAllocationRow.locator('[data-label="จัดสรรจริง"]')).toBeVisible();
      await expect(allocationRegion.locator('tfoot [data-label="จัดสรรจริง"]')).toHaveText("93");
      const allocationLabels = await firstAllocationRow.locator("[data-label]").evaluateAll((cells) => cells.map((cell) => ({
        label: getComputedStyle(cell, "::before").content.replace(/^"|"$/gu, ""),
        right: cell.getBoundingClientRect().right,
        left: cell.getBoundingClientRect().left,
      })));
      expect(allocationLabels.map(({ label }) => label)).toEqual(["ชั้นพื้นที่", "N_h", "quota", "floor", "เศษเหลือ", "จัดสรรจริง"]);
      const viewportWidth = page.viewportSize()?.width ?? 360;
      expect(allocationLabels.every(({ left, right }) => left >= 0 && right <= viewportWidth)).toBe(true);
      await expect(allocationRegion).toHaveJSProperty("scrollWidth", await allocationRegion.evaluate((element) => element.clientWidth));
    }

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

});
