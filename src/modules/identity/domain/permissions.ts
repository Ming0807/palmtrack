import { isRole, type Role } from "./roles";

export const PERMISSIONS = [
  "view_role_destinations",
  "view_profile",
  "view_workspace_config",
  "view_audit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const permissionSet = new Set<string>(PERMISSIONS);

export const ROLE_PERMISSIONS = {
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
} as const satisfies Record<Role, readonly Permission[]>;

const noPermissions: readonly Permission[] = [];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && permissionSet.has(value);
}

export function permissionsForRole(role: unknown): readonly Permission[] {
  return isRole(role) ? ROLE_PERMISSIONS[role] : noPermissions;
}

export function can(role: unknown, permission: unknown): boolean {
  return isPermission(permission) && permissionsForRole(role).includes(permission);
}
