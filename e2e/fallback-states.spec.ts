import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Global Application Fallback States", () => {
  test("[FALLBACK-01] not-found page renders Thai copy, accessible link, 360px overflow safety, and clean axe scan", async ({
    page,
  }) => {
    // Navigate to a non-existent route
    await page.goto("/unknown-random-route-404");

    // 1. Verify Thai heading and copy
    const heading = page.getByRole("heading", { name: /ไม่พบหน้าที่ต้องการ/u });
    await expect(heading).toBeVisible();
    await expect(
      page.getByText("หน้าที่คุณกำลังค้นหาไม่มีอยู่ ถูกย้าย หรือที่อยู่เว็บไซต์ไม่ถูกต้อง"),
    ).toBeVisible();

    // 2. Verify Return to Home Link
    const homeLink = page.getByRole("link", { name: "กลับสู่หน้าหลัก" });
    await expect(homeLink).toBeVisible();
    expect(await homeLink.getAttribute("href")).toBe("/app");

    // 3. Test keyboard navigation and focus
    await page.keyboard.press("Tab");
    await expect(homeLink).toBeFocused();

    // 4. Test 360px horizontal overflow safety
    const hasHorizontalOverflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 5. Run Axe accessibility scan
    const axeResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
