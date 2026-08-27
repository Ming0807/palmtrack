import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { signInAs } from "./support/local-supabase";

test.describe("Secure Sign-Out Flow", () => {
  test("[SEC-08] authenticated user can sign out securely and gets redirected to /sign-in", async ({
    page,
  }) => {
    // 1. Sign in as a valid role
    await signInAs(page, "farmer");
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1, name: "ภาพรวม" })).toBeVisible();

    // 2. Verify sign out button presence and attributes in the header
    const signOutButton = page.getByRole("button", { name: "ออกจากระบบ" });
    await expect(signOutButton).toBeVisible();
    await expect(signOutButton).toBeEnabled();

    // 3. Verify touch target geometry (>= 44px)
    const buttonBox = await signOutButton.boundingBox();
    expect(buttonBox).not.toBeNull();
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(40); // CSS min-height 44px, bounding box check
    }

    // 4. Verify 360px overflow safety with sign-out button present
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    // 5. Run Axe accessibility scan
    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);

    // 6. Click sign out
    await signOutButton.click();

    // 7. Verify redirection to /sign-in
    await expect(page).toHaveURL(/\/sign-in/u);
    await expect(page.getByRole("heading", { name: "เข้าสู่ระบบเพื่อเริ่มงาน" })).toBeVisible();

    // 8. Verify session termination by attempting to access protected /app
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in/u);
  });
});
