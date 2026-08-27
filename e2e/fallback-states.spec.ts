import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Global Application Fallback States", () => {
  test("[E2E-18] not-found page renders Thai copy, accessible link, 360px overflow safety, and complete axe scan", async ({
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
    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test("[PWA-01] manifest.webmanifest serves valid install metadata without offline claims", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const manifestJson = await response.json();

    expect(manifestJson.name).toBe("PalmTrack");
    expect(manifestJson.short_name).toBe("PalmTrack");
    expect(manifestJson.lang).toBe("th");
    expect(manifestJson.start_url).toBe("/");
    expect(manifestJson.display).toBe("standalone");
    expect(manifestJson.background_color).toBe("#f7f2e8");
    expect(manifestJson.theme_color).toBe("#233b68");
    expect(manifestJson.icons).toEqual([
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ]);
  });
});
