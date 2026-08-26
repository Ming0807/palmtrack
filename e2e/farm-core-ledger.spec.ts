import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { signInAs } from "./support/local-supabase";

test.describe("Farm Core and Cash Ledger E2E", () => {
  test("[E2E-04] farmer creates farm, plots, records expenses & sales, soft-deletes and checks dashboard profit 9,000.25", async ({
    page,
  }, testInfo) => {
    test.slow();
    const farmName = `สวนปาล์มสมหวัง (${testInfo.project.name})`;

    // 1. Farmer Sign In
    await signInAs(page, "farmer");
    await expect(page).toHaveURL(/\/app/u);

    // 2. Navigate to /app/gardens and create a farm
    await page.goto("/app/gardens");
    await expect(page.getByRole("heading", { name: "สวนปาล์มของฉัน" })).toBeVisible();

    // Click Add Farm
    const addFarmButton = page.locator('[data-testid="add-farm-button"], [data-testid="add-first-farm-button"]').first();
    await addFarmButton.click();

    const farmModal = page.getByTestId("farm-form-modal");
    await expect(farmModal).toBeVisible();
    await farmModal.locator('input[name="name"]').fill(farmName);
    await farmModal.locator('input[name="locationLabel"]').fill("อ.อ่าวลึก จ.กระบี่");
    await farmModal.locator('input[name="totalArea"]').fill("25.500");
    await farmModal.getByRole("button", { name: "บันทึกสวนใหม่" }).click();

    await expect(farmModal).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert").filter({ hasText: "บันทึกสวนใหม่สำเร็จ" })).toBeVisible();
    await expect(page.locator(`h2:has-text("${farmName}")`)).toBeVisible();
    await expect(page.getByText("25.500 ไร่").first()).toBeVisible();

    const farmCard = page.locator(`article:has-text("${farmName}")`).first();
    await expect(farmCard).toBeVisible();

    // 3. Add Plots to the Farm
    const addPlotButton = farmCard.getByRole("button", { name: "+ เพิ่มแปลงย่อย" });
    await addPlotButton.click();

    const plotModal = page.getByTestId("plot-form-modal");
    await expect(plotModal).toBeVisible();
    await plotModal.locator('input[name="code"]').fill("P-01");
    await plotModal.locator('input[name="name"]').fill("แปลงต้นน้ำ");
    await plotModal.locator('input[name="area"]').fill("12.000");
    await plotModal.getByRole("button", { name: "บันทึกแปลง" }).click();

    await expect(plotModal).not.toBeVisible({ timeout: 15_000 });
    await expect(farmCard.getByText("P-01")).toBeVisible();
    await expect(farmCard.getByText("แปลงต้นน้ำ")).toBeVisible();

    await addPlotButton.click();
    await expect(plotModal).toBeVisible();
    await plotModal.locator('input[name="code"]').fill("P-02");
    await plotModal.locator('input[name="name"]').fill("แปลงเชิงเขา");
    await plotModal.locator('input[name="area"]').fill("13.500");
    await plotModal.getByRole("button", { name: "บันทึกแปลง" }).click();

    await expect(plotModal).not.toBeVisible({ timeout: 15_000 });
    await expect(farmCard.getByText("P-02")).toBeVisible();
    await expect(farmCard.getByText("แปลงเชิงเขา")).toBeVisible();

    // Run Axe scan on /app/gardens
    const gardensAxe = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(gardensAxe.violations).toEqual([]);

    // 4. Navigate to /app/garden-account
    await page.goto("/app/garden-account");
    await expect(page.getByRole("heading", { name: /สมุดบัญชีสวน/u })).toBeVisible();

    // Select our created farm in filter to isolate if needed
    const farmFilter = page.locator("#filter-farm-select");
    if (await farmFilter.isVisible()) {
      await farmFilter.selectOption({ label: farmName });
    }

    // Record Expense 1: 3,000.25 (plot P-01)
    await page.getByTestId("record-expense-button").click();
    const expenseModal = page.getByTestId("expense-form-modal");
    await expect(expenseModal).toBeVisible();
    await expenseModal.locator('select[name="farmId"]').selectOption({ label: farmName });
    await expenseModal.locator('select[name="plotId"]').selectOption({ label: "P-01 - แปลงต้นน้ำ" });
    await expenseModal.locator('select[name="category"]').selectOption("ปุ๋ยและธาตุอาหาร");
    await expenseModal.locator('input[name="amount"]').fill("3000.25");
    await expenseModal.locator('input[name="expenseDate"]').fill("2026-08-01");
    await expenseModal.getByRole("button", { name: "บันทึกรายจ่าย" }).click();
    await expect(expenseModal).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert").filter({ hasText: "บันทึกรายจ่ายสำเร็จ" })).toBeVisible();

    // Record Expense 2: 500.00 (general farm)
    await page.getByTestId("record-expense-button").click();
    await expect(expenseModal).toBeVisible();
    await expenseModal.locator('select[name="farmId"]').selectOption({ label: farmName });
    await expenseModal.locator('select[name="category"]').selectOption("แรงงานตัดแต่ง/เก็บเกี่ยว");
    await expenseModal.locator('input[name="amount"]').fill("500.00");
    await expenseModal.locator('input[name="expenseDate"]').fill("2026-08-05");
    await expenseModal.getByRole("button", { name: "บันทึกรายจ่าย" }).click();
    await expect(expenseModal).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert").filter({ hasText: "บันทึกรายจ่ายสำเร็จ" })).toBeVisible();

    // Record Sale 1: qty 10.000 @ 1000.00 = 10,000.00 net
    await page.getByTestId("record-sale-button").click();
    const saleModal = page.getByTestId("sale-form-modal");
    await expect(saleModal).toBeVisible();
    await saleModal.locator('select[name="farmId"]').selectOption({ label: farmName });
    await saleModal.locator('select[name="plotId"]').selectOption({ label: "P-01 - แปลงต้นน้ำ" });
    await saleModal.locator('input[name="buyerName"]').fill("ลานเทสมบูรณ์");
    await saleModal.locator('input[name="quantity"]').fill("10.000");
    await saleModal.locator('input[name="unitPrice"]').fill("1000.00");
    await saleModal.locator('input[name="deductions"]').fill("0.00");
    await saleModal.locator('input[name="saleDate"]').fill("2026-08-15");
    await saleModal.getByRole("button", { name: "บันทึกการขาย" }).click();
    await expect(saleModal).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert").filter({ hasText: "บันทึกการขายสำเร็จ" })).toBeVisible();

    // Record Sale 2: qty 5.000 @ 510.10, deductions 50.00 = 2,500.50 net
    await page.getByTestId("record-sale-button").click();
    await expect(saleModal).toBeVisible();
    await saleModal.locator('select[name="farmId"]').selectOption({ label: farmName });
    await saleModal.locator('input[name="buyerName"]').fill("ลานเทสมบูรณ์");
    await saleModal.locator('input[name="quantity"]').fill("5.000");
    await saleModal.locator('input[name="unitPrice"]').fill("510.10");
    await saleModal.locator('input[name="deductions"]').fill("50.00");
    await saleModal.locator('input[name="saleDate"]').fill("2026-08-20");
    await saleModal.getByRole("button", { name: "บันทึกการขาย" }).click();
    await expect(saleModal).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert").filter({ hasText: "บันทึกการขายสำเร็จ" })).toBeVisible();

    // 5. Verify Exact Acceptance Profit Fixture for this farm: 9,000.25
    await expect(page.getByTestId("net-income-card")).toContainText("฿12,500.50");
    await expect(page.getByTestId("expense-total-card")).toContainText("฿3,500.25");
    await expect(page.getByTestId("cash-result-card")).toContainText("+฿9,000.25");

    // 6. Test Soft Delete with Reason
    // Add extra expense of 100.00
    await page.getByTestId("record-expense-button").click();
    await expect(expenseModal).toBeVisible();
    await expenseModal.locator('select[name="farmId"]').selectOption({ label: farmName });
    await expenseModal.locator('select[name="category"]').selectOption("ซ่อมแซมและบำรุงรักษา");
    await expenseModal.locator('input[name="amount"]').fill("100.00");
    await expenseModal.locator('input[name="expenseDate"]').fill("2026-08-10");
    await expenseModal.getByRole("button", { name: "บันทึกรายจ่าย" }).click();
    await expect(expenseModal).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert").filter({ hasText: "บันทึกรายจ่ายสำเร็จ" })).toBeVisible();
    await expect(page.getByTestId("cash-result-card")).toContainText("+฿8,900.25");

    // Delete the 100.00 expense
    const expenseRow = page.locator('tr:has-text("ซ่อมแซมและบำรุงรักษา")').first();
    await expenseRow.getByRole("button", { name: /ลบรายการ/u }).click();

    const deleteDialog = page.getByTestId("delete-dialog-modal");
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.locator('textarea[name="reason"]').fill("บันทึกซ้ำซ้อน");
    await deleteDialog.getByRole("button", { name: "ยืนยันการลบ" }).click();

    await expect(deleteDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert").filter({ hasText: "ลบรายการรายจ่ายสำเร็จ" })).toBeVisible();
    // Summary must immediately recalculate back to 9,000.25
    await expect(page.getByTestId("cash-result-card")).toContainText("+฿9,000.25");
    await expect(page.locator('tr:has-text("ซ่อมแซมและบำรุงรักษา")').first()).toContainText("ยกเลิกแล้ว");

    // Run Axe scan on /app/garden-account
    const ledgerAxe = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(ledgerAxe.violations).toEqual([]);

    // 7. Check Dashboard /app Integration
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "ภาพรวมสวนและข้อมูล" })).toBeVisible();
    const opSection = page.getByRole("region", { name: "สรุปการดำเนินงาน" });
    await expect(opSection).toBeVisible();
    await expect(opSection.getByText("รายรับสุทธิ", { exact: true })).toBeVisible();
    await expect(opSection.getByText("ค่าใช้จ่าย", { exact: true })).toBeVisible();
    await expect(opSection.getByText("กำไร/ขาดทุนเงินสด", { exact: true })).toBeVisible();
    await expect(opSection.locator('text=/฿[0-9,]+\\.[0-9]{2}/u').first()).toBeVisible();

    // 8. Test Non-Farmer Role Isolation
    const managerContext = await page.context().browser()!.newContext({
      baseURL: testInfo.project.use.baseURL as string,
      viewport: page.viewportSize(),
    });
    const managerPage = await managerContext.newPage();
    await signInAs(managerPage, "research_manager");

    // Manager visiting /app/gardens must be forbidden
    await managerPage.goto("/app/gardens");
    await expect(managerPage.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeVisible();

    // Manager visiting /app/garden-account must be forbidden
    await managerPage.goto("/app/garden-account");
    await expect(managerPage.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeVisible();

    // Manager on /app must NOT see farmer's financial aggregates
    await managerPage.goto("/app");
    await expect(managerPage.locator('text="฿12,500.50"')).not.toBeVisible();
    await expect(managerPage.locator('text="+฿9,000.25"')).not.toBeVisible();

    await managerContext.close();
  });
});
