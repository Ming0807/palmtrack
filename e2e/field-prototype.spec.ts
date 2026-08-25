import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("switches structurally between A, B, and C with the keyboard", async ({
  page,
}) => {
  await page.goto("/prototype/field?variant=A");

  const switcher = page.getByRole("radiogroup", {
    name: "เปรียบเทียบโครงหน้าจอ",
  });
  await switcher.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/variant=B/u);
  await expect(page.getByRole("heading", { name: "งานของฉัน" })).toBeVisible();
  await expect(page.getByText("หลักฐานงานแบบใบรับ–ส่ง")).toBeVisible();

  await page.getByRole("radio", { name: /C เส้นทางหลักฐาน/u }).click();
  await expect(page).toHaveURL(/variant=C/u);
  await expect(page.getByText("ติดตามตำแหน่งงานบนเส้นทางหลักฐาน")).toBeVisible();
});

test("follows the canonical A to C handoff and keeps the instrument locked", async ({
  page,
}) => {
  await page.goto("/prototype/field?variant=A");
  await page.getByRole("link", { name: /เริ่มเก็บข้อมูล/u }).click();
  await expect(page).toHaveURL(
    /\/prototype\/field\/SSK-024\?variant=C$/u,
  );

  const consent = page.getByText("แจ้งข้อมูลและยินยอม", { exact: true });
  const baseline = page.getByText("ข้อมูลพื้นฐาน", { exact: true }).first();
  await expect(consent).toBeVisible();
  await expect(baseline).toBeVisible();
  const [consentBox, baselineBox] = await Promise.all([
    consent.boundingBox(),
    baseline.boundingBox(),
  ]);
  expect(consentBox?.y).toBeLessThan(baselineBox?.y ?? 0);
  await expect(page.getByText("รออนุมัติเครื่องมือวิจัย", { exact: true })).toBeVisible();
  await expect(page.locator("form, input, textarea, select")).toHaveCount(0);
});

test("requires explicit resume for returned work", async ({ page }) => {
  await page.goto("/prototype/field/SSK-024?variant=C&state=returned");
  await expect(page.getByText("ผู้ตรวจส่งคืนรายการนี้")).toBeVisible();
  const resume = page.getByRole("button", { name: "กลับมาแก้ไข" });
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect(page.getByRole("button", { name: "แก้ไขได้แล้ว" })).toBeDisabled();
});

test("stores a synthetic offline checkpoint locally without a response form", async ({
  page,
}) => {
  await page.goto("/prototype/field/SSK-024?variant=C&state=offline");
  await expect(page.getByText(/บันทึกร่างไว้ในเครื่อง/u)).toBeVisible();
  await page.getByRole("button", { name: "บันทึกร่างในเครื่อง" }).click();
  await expect(page.getByText("บันทึกร่างในเครื่องแล้ว")).toBeVisible();
  const databaseNames = await page.evaluate(async () =>
    (await indexedDB.databases()).map((database) => database.name),
  );
  expect(databaseNames).toContain("palmtrack-prototype");
  await expect(page.locator("form, input, textarea, select")).toHaveCount(0);
});

test("exposes every local state and has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/prototype/field?variant=A");
  await page.locator("summary").filter({ hasText: "ทดลองสถานะ" }).click();
  await expect(page.getByLabel("สถานะหน้าจอตัวอย่าง").getByRole("button")).toHaveCount(12);

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
  ).toEqual([]);

  await page.goto("/prototype/field/SSK-024?variant=C");
  const assignmentResults = await new AxeBuilder({ page }).analyze();
  expect(
    assignmentResults.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    ),
  ).toEqual([]);
});

test("keeps the 360px layout within the viewport and primary actions touch-safe", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile");
  await page.goto("/prototype/field?variant=A");
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);

  for (const action of await page.locator(".pt-row-action").all()) {
    const box = await action.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
