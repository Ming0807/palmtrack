import { describe, expect, it } from "vitest";

import {
  getModuleStatus,
  isPendingSectionKey,
  isRoleAllowedForSection,
  PENDING_SECTIONS,
  type PendingSectionKey,
} from "./module-status";
import { getRoleNavigation } from "./role-navigation";

describe("module-status metadata & authorization", () => {
  const expectedSections: readonly PendingSectionKey[] = [
    "settings",
    "audit",
    "my-work",
    "reports",
    "evaluation",
  ];

  it("contains all 5 expected pending sections", () => {
    expect(Object.keys(PENDING_SECTIONS).sort()).toEqual([...expectedSections].sort());
  });

  it.each(expectedSections)("provides truthful Thai copy and metadata for section '%s'", (sectionKey) => {
    const meta = getModuleStatus(sectionKey);
    expect(meta).toBeDefined();
    expect(meta?.status).toBe("ยังไม่เปิดใช้งาน");
    expect(meta?.title).toBeTruthy();
    expect(meta?.eyebrow).toBeTruthy();
    expect(meta?.description).toBeTruthy();
    expect(meta?.statusReason).toBeTruthy();
    expect(meta?.capabilities.length).toBeGreaterThanOrEqual(2);
    expect(meta?.nextSteps.length).toBeGreaterThanOrEqual(1);
    expect(meta?.allowedRoles.length).toBeGreaterThanOrEqual(1);
  });

  it("returns null for unknown section slugs", () => {
    expect(getModuleStatus("non-existent-module")).toBeNull();
    expect(getModuleStatus("")).toBeNull();
    expect(isPendingSectionKey("random-slug")).toBe(false);
  });

  describe("exact role authorization matrix", () => {
    const allRoles = [
      "admin",
      "research_manager",
      "field_collector",
      "farmer",
      "evaluator_readonly",
    ] as const;

    it("verifies admin can only access settings and audit", () => {
      expect(isRoleAllowedForSection("admin", "settings")).toBe(true);
      expect(isRoleAllowedForSection("admin", "audit")).toBe(true);
      expect(isRoleAllowedForSection("admin", "my-work")).toBe(false);
      expect(isRoleAllowedForSection("admin", "reports")).toBe(false);
      expect(isRoleAllowedForSection("admin", "evaluation")).toBe(false);
    });

    it("verifies research_manager can only access reports", () => {
      expect(isRoleAllowedForSection("research_manager", "settings")).toBe(false);
      expect(isRoleAllowedForSection("research_manager", "audit")).toBe(false);
      expect(isRoleAllowedForSection("research_manager", "my-work")).toBe(false);
      expect(isRoleAllowedForSection("research_manager", "reports")).toBe(true);
      expect(isRoleAllowedForSection("research_manager", "evaluation")).toBe(false);
    });

    it("verifies field_collector can only access my-work", () => {
      expect(isRoleAllowedForSection("field_collector", "settings")).toBe(false);
      expect(isRoleAllowedForSection("field_collector", "audit")).toBe(false);
      expect(isRoleAllowedForSection("field_collector", "my-work")).toBe(true);
      expect(isRoleAllowedForSection("field_collector", "reports")).toBe(false);
      expect(isRoleAllowedForSection("field_collector", "evaluation")).toBe(false);
    });

    it("verifies farmer has no access to unimplemented sections", () => {
      for (const section of expectedSections) {
        expect(isRoleAllowedForSection("farmer", section)).toBe(false);
      }
    });

    it("verifies evaluator_readonly can only access evaluation", () => {
      expect(isRoleAllowedForSection("evaluator_readonly", "settings")).toBe(false);
      expect(isRoleAllowedForSection("evaluator_readonly", "audit")).toBe(false);
      expect(isRoleAllowedForSection("evaluator_readonly", "my-work")).toBe(false);
      expect(isRoleAllowedForSection("evaluator_readonly", "reports")).toBe(false);
      expect(isRoleAllowedForSection("evaluator_readonly", "evaluation")).toBe(true);
    });

    it("denies invalid/unknown roles on all sections", () => {
      for (const section of expectedSections) {
        expect(isRoleAllowedForSection("anonymous", section)).toBe(false);
        expect(isRoleAllowedForSection("service_role", section)).toBe(false);
        expect(isRoleAllowedForSection(null, section)).toBe(false);
        expect(isRoleAllowedForSection(undefined, section)).toBe(false);
      }
    });

    it("matches the exact navigation destinations exposed in role-navigation.ts", () => {
      for (const role of allRoles) {
        const navItems = getRoleNavigation(role);
        for (const section of expectedSections) {
          const route = `/app/${section}`;
          const isNavExposed = navItems.some((item) => item.href === route);
          expect(isRoleAllowedForSection(role, section)).toBe(isNavExposed);
        }
      }
    });
  });
});
