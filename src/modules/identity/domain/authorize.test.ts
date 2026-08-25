import { authorize, type AuthorizationContext } from "./authorize";
import { PERMISSIONS } from "./permissions";
import { ROLES } from "./roles";

const activeContext = (role: unknown, workspaceId = "workspace-a"): AuthorizationContext => ({
  session: { userId: "user-1" },
  profile: {
    id: "profile-1",
    workspaceId,
    role,
    status: "active",
  },
  workspaceId,
});

describe("RLS-01/RLS-09/SEC-01 deny-by-default authorization", () => {
  it.each(ROLES)("allows only the exact permission cells for %s", (role) => {
    const allowed = new Set(
      role === "admin"
        ? PERMISSIONS
        : ["view_role_destinations", "view_profile"],
    );

    for (const permission of PERMISSIONS) {
      expect(authorize(activeContext(role), permission)).toEqual({
        allowed: allowed.has(permission),
        ...(allowed.has(permission) ? {} : { reason: "forbidden" }),
      });
    }
  });

  it("denies a missing session", () => {
    expect(
      authorize(
        { ...activeContext("admin"), session: null },
        "view_profile",
      ),
    ).toEqual({ allowed: false, reason: "missing_session" });
  });

  it("denies an inactive profile", () => {
    expect(
      authorize(
        {
          ...activeContext("admin"),
          profile: { ...activeContext("admin").profile, status: "inactive" },
        },
        "view_profile",
      ),
    ).toEqual({ allowed: false, reason: "inactive_profile" });
  });

  it("denies an unknown runtime role", () => {
    expect(authorize(activeContext("unknown_role"), "view_profile")).toEqual({
      allowed: false,
      reason: "unknown_role",
    });
  });

  it("denies a cross-workspace context", () => {
    expect(
      authorize(
        {
          ...activeContext("admin", "workspace-a"),
          workspaceId: "workspace-b",
        },
        "view_profile",
      ),
    ).toEqual({ allowed: false, reason: "cross_workspace" });
  });

  it("denies an unknown permission", () => {
    expect(authorize(activeContext("admin"), "view_everything")).toEqual({
      allowed: false,
      reason: "unknown_permission",
    });
  });

  it("denies missing profile and malformed context", () => {
    expect(authorize({ session: { userId: "user-1" } }, "view_profile")).toEqual({
      allowed: false,
      reason: "missing_profile",
    });
    expect(authorize(null, "view_profile")).toEqual({
      allowed: false,
      reason: "missing_session",
    });
  });
});
