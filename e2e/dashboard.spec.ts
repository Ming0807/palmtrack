import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("presents farm operations first with truthful states and visual evidence", async ({ page }, testInfo) => {
  await page.goto("/prototype/dashboard?role=research_manager&scenario=typical");

  await expect(page.getByRole("heading", { name: "ภาพรวมสวนและข้อมูล" })).toBeVisible();
  await expect(page.getByText("ข้อมูลสังเคราะห์", { exact: true })).toBeVisible();
  const sectionHeadings = await page.locator("main h2").allTextContents();
  expect(sectionHeadings).toEqual([
    "สรุปการดำเนินงาน",
    "แนวโน้มการเงินและผลผลิต",
    "งานที่ควรทำต่อ",
    "หลักฐานสนับสนุนงานวิจัย",
  ]);

  await page.getByText("ดูตัวเลขในรูปแบบตาราง").click();
  await expect(page.getByRole("table", { name: "ข้อมูลแนวโน้มรายเดือน" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);

  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: `docs/assets/dashboard/${testInfo.project.name}.png`,
  });

  await page.getByRole("link", { name: "กำลังโหลด" }).click();
  await expect(page.getByText("กำลังโหลดข้อมูล").first()).toBeVisible();
  await expect(page.getByText("฿259,400.00")).toHaveCount(0);
});
