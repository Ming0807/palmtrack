import {
  can,
  PERMISSIONS,
  permissionsForRole,
  ROLE_PERMISSIONS,
  type Permission,
} from "./permissions";
import { ROLES } from "./roles";

const expected: Record<(typeof ROLES)[number], readonly Permission[]> = {
  admin: [
    "view_role_destinations",
    "view_profile",
    "view_workspace_config",
    "view_audit",
  ],
  research_manager: ["view_role_destinations", "view_profile"],
  field_collector: ["view_role_destinations", "view_profile"],
  farmer: ["view_role_destinations", "view_profile"],
  evaluator_readonly: ["view_role_destinations", "view_profile"],
};

describe("RLS-01/RLS-09/SEC-01 narrow shell permission matrix", () => {
  it("defines only the permissions needed by the first protected shell", () => {
    expect(PERMISSIONS).toEqual([
      "view_role_destinations",
      "view_profile",
      "view_workspace_config",
      "view_audit",
    ]);
  });

  it.each(ROLES)("matches every allow/deny cell for %s", (role) => {
    for (const permission of PERMISSIONS) {
      const allowed = expected[role].includes(permission);

      expect(can(role, permission)).toBe(allowed);
      expect(permissionsForRole(role).includes(permission)).toBe(allowed);
    }
  });

  it("does not provide a broad admin override", () => {
    expect(ROLE_PERMISSIONS.admin).toEqual(expected.admin);
    expect(can("admin", "capture_consent")).toBe(false);
    expect(can("admin", "edit_response")).toBe(false);
    expect(can("admin", "write_farm_ledger")).toBe(false);
  });

  it.each([
    ["unknown_role", "view_profile"],
    ["admin", "unknown_permission"],
    ["service_role", "view_workspace_config"],
  ])("denies unknown role/permission cell %s/%s", (role, permission) => {
    expect(can(role, permission)).toBe(false);
  });
});
