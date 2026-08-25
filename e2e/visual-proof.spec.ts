import { expect, test } from "@playwright/test";

const views = [
  ["a-queue", "/prototype/field?variant=A"],
  ["b-receipt", "/prototype/field?variant=B"],
  ["c-route", "/prototype/field?variant=C"],
  ["assignment-route", "/prototype/field/SSK-024?variant=C"],
] as const;

for (const [name, href] of views) {
  test(`captures ${name}`, async ({ page }, testInfo) => {
    await page.goto(href);
    await expect(page.getByText("ข้อมูลตัวอย่าง", { exact: true })).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `output/playwright/${testInfo.project.name}-${name}.png`,
    });
  });
}
