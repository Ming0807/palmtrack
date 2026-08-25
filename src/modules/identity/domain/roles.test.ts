import { isRole, ROLES, type Role } from "./roles";

describe("RLS-01/RLS-09/SEC-01 exact runtime role allowlist", () => {
  it("defines exactly the five approved roles", () => {
    expect(ROLES).toEqual([
      "admin",
      "research_manager",
      "field_collector",
      "farmer",
      "evaluator_readonly",
    ]);
  });

  it.each([
    "admin",
    "research_manager",
    "field_collector",
    "farmer",
    "evaluator_readonly",
  ])("accepts approved runtime role %s", (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each(["owner", "service_role", "", null, undefined, 42, {}, []])(
    "rejects unknown runtime role %j",
    (role) => {
      expect(isRole(role)).toBe(false);
    },
  );

  it("keeps the role type assignable to each approved value", () => {
    const roles: Role[] = [...ROLES];

    expect(roles).toHaveLength(5);
  });
});
