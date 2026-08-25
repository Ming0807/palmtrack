import {
  can,
  isPermission,
  type Permission,
} from "./permissions";
import { isRole, type Role } from "./roles";

export interface AuthorizationContext {
  session?: {
    userId?: unknown;
  } | null;
  profile?: {
    id?: unknown;
    workspaceId?: unknown;
    role?: unknown;
    status?: unknown;
  } | null;
  workspaceId?: unknown;
}

export type AuthorizationDenyReason =
  | "missing_session"
  | "missing_profile"
  | "missing_workspace"
  | "inactive_profile"
  | "unknown_role"
  | "cross_workspace"
  | "unknown_permission"
  | "forbidden";

export type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: AuthorizationDenyReason };

export function authorize(
  context: AuthorizationContext | null | undefined,
  permission: unknown,
): AuthorizationResult {
  if (!isPermission(permission)) {
    return { allowed: false, reason: "unknown_permission" };
  }

  if (
    !context?.session ||
    typeof context.session.userId !== "string" ||
    context.session.userId.length === 0
  ) {
    return { allowed: false, reason: "missing_session" };
  }

  const profile = context.profile;
  if (!profile) {
    return { allowed: false, reason: "missing_profile" };
  }

  if (profile.status !== "active") {
    return { allowed: false, reason: "inactive_profile" };
  }

  if (!isRole(profile.role)) {
    return { allowed: false, reason: "unknown_role" };
  }

  if (
    typeof context.workspaceId !== "string" ||
    context.workspaceId.length === 0 ||
    typeof profile.workspaceId !== "string" ||
    profile.workspaceId.length === 0
  ) {
    return { allowed: false, reason: "missing_workspace" };
  }

  if (profile.workspaceId !== context.workspaceId) {
    return { allowed: false, reason: "cross_workspace" };
  }

  return can(profile.role, permission)
    ? { allowed: true }
    : { allowed: false, reason: "forbidden" };
}

export type { Permission, Role };
