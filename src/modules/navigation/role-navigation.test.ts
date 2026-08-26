import { describe, expect, it } from "vitest";

import { getRoleNavigation } from "./role-navigation";

describe("protected role navigation", () => {
  it.each([
    ["admin", ["ภาพรวม", "นำเข้าประชากร", "ตั้งค่าระบบ", "ตรวจสอบเหตุการณ์"]],
    ["research_manager", ["ภาพรวม", "งานวิจัย", "ประชากร", "การสุ่ม", "รายงาน"]],
    ["field_collector", ["ภาพรวม", "งานของฉัน"]],
    ["farmer", ["ภาพรวม", "สวนของฉัน", "บัญชีสวน"]],
    ["evaluator_readonly", ["ภาพรวม", "ภาพรวมประเมิน"]],
  ] as const)("keeps the exact Thai destinations for %s", (role, labels) => {
    expect(getRoleNavigation(role).map((item) => item.label)).toEqual(labels);
  });

  it("does not expose prototype destinations in production navigation", () => {
    const allDestinations = [
      ...getRoleNavigation("admin"),
      ...getRoleNavigation("research_manager"),
      ...getRoleNavigation("field_collector"),
      ...getRoleNavigation("farmer"),
      ...getRoleNavigation("evaluator_readonly"),
    ];

    expect(allDestinations.some((item) => item.href.startsWith("/prototype"))).toBe(
      false,
    );
  });

  it("denies unknown roles by returning no destinations", () => {
    expect(getRoleNavigation("service_role")).toEqual([]);
  });

  it("exposes population import to the two authorized roles only", () => {
    for (const role of ["admin", "research_manager"] as const) {
      expect(getRoleNavigation(role).some((item) => item.href === "/app/research/population")).toBe(true);
    }
    for (const role of ["field_collector", "farmer", "evaluator_readonly"] as const) {
      expect(getRoleNavigation(role).some((item) => item.href === "/app/research/population")).toBe(false);
    }
  });

  it.each(["admin", "research_manager", "field_collector", "farmer", "evaluator_readonly"] as const)(
    "places the product dashboard first for %s",
    (role) => {
      expect(getRoleNavigation(role)[0]).toMatchObject({ label: "ภาพรวม", href: "/app" });
    },
  );

  it("exposes sampling only to research managers", () => {
    expect(getRoleNavigation("research_manager").some((item) => item.href === "/app/research/sampling")).toBe(true);
    for (const role of ["admin", "field_collector", "farmer", "evaluator_readonly"] as const) {
      expect(getRoleNavigation(role).some((item) => item.href === "/app/research/sampling")).toBe(false);
    }
  });
});
