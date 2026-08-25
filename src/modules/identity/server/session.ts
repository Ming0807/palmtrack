import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  type SupabaseServerClientResult,
} from "@/lib/supabase/server";
import { isRole, type Role } from "@/modules/identity/domain/roles";

export { ROLES } from "@/modules/identity/domain/roles";

export type VerifiedIdentity = {
  userId: string;
};

/** The gateway returns only fields needed for the own-profile projection. */
export type IdentityProfileRecord = {
  id?: unknown;
  profileId?: unknown;
  profile_id?: unknown;
  workspaceId?: unknown;
  workspace_id?: unknown;
  role?: unknown;
  status?: unknown;
};

export interface IdentityGateway {
  getVerifiedIdentity: () => Promise<VerifiedIdentity | null>;
  getOwnProfile: () => Promise<IdentityProfileRecord | null>;
}

export type IdentitySession =
  | { status: "unconfigured" }
  | { status: "configuration_error" }
  | { status: "anonymous" }
  | { status: "inactive" }
  | { status: "forbidden" }
  | {
      status: "authorized";
      userId: string;
      profile: {
        id: string;
        workspaceId: string;
        role: Role;
      };
    };

export type ResolveIdentitySessionInput =
  | IdentityGateway
  | {
      gateway?: IdentityGateway;
    };

type SupabaseIdentityClient = Pick<SupabaseClient, "auth" | "rpc">;

type SupabaseUserResponse = {
  data?: {
    user?: { id?: unknown } | null;
  };
  error?: unknown | null;
};

type SupabaseProfileResponse = {
  data?: IdentityProfileRecord | null;
  error?: unknown | null;
};

/**
 * Builds the production gateway. Auth identity is verified by Supabase's
 * `getUser` endpoint; profile access is constrained to the fixed own-profile
 * projection and the caller's verified Auth UID.
 */
export function createSupabaseIdentityGateway(
  client: SupabaseIdentityClient,
): IdentityGateway {
  return {
    async getVerifiedIdentity() {
      const response = (await client.auth.getUser()) as SupabaseUserResponse;

      // An invalid, missing, or expired Auth cookie is anonymous. We do not
      // expose provider error details to the application boundary.
      if (response.error || !response.data?.user) {
        return null;
      }

      const userId = response.data.user.id;
      return typeof userId === "string" && userId.trim().length > 0
        ? { userId }
        : null;
    },

    async getOwnProfile() {
      const response = (await client
        .rpc("get_current_profile")
        .maybeSingle()) as SupabaseProfileResponse;

      if (response.error) {
        throw new Error("identity profile lookup failed");
      }

      return response.data ?? null;
    },
  };
}

function isIdentityGateway(
  input: ResolveIdentitySessionInput,
): input is IdentityGateway {
  return (
    typeof input === "object" &&
    input !== null &&
    "getVerifiedIdentity" in input &&
    typeof input.getVerifiedIdentity === "function" &&
    "getOwnProfile" in input &&
    typeof input.getOwnProfile === "function"
  );
}

async function defaultGateway(): Promise<
  | { status: "ready"; gateway: IdentityGateway }
  | Extract<SupabaseServerClientResult, { status: "unconfigured" }>
  | Extract<SupabaseServerClientResult, { status: "configuration_error" }>
> {
  const clientResult = await createSupabaseServerClient();

  if (clientResult.status !== "configured") {
    return clientResult;
  }

  return {
    status: "ready",
    gateway: createSupabaseIdentityGateway(clientResult.client),
  };
}

/** Resolves verified Auth identity and its own stable profile projection. */
export async function resolveIdentitySession(
  input?: ResolveIdentitySessionInput,
): Promise<IdentitySession> {
  let gateway: IdentityGateway;

  try {
    const injectedGateway = input
      ? isIdentityGateway(input)
        ? input
        : input.gateway
      : undefined;

    if (injectedGateway) {
      gateway = injectedGateway;
    } else {
      const result = await defaultGateway();
      if (result.status !== "ready") {
        return result;
      }
      gateway = result.gateway;
    }

    const identity = await gateway.getVerifiedIdentity();
    if (
      !identity ||
      typeof identity.userId !== "string" ||
      identity.userId.trim().length === 0
    ) {
      return { status: "anonymous" };
    }

    const profile = await gateway.getOwnProfile();
    if (!profile) {
      return { status: "forbidden" };
    }

    if (profile.status === "inactive") {
      return { status: "inactive" };
    }

    const profileId = profile.id ?? profile.profileId ?? profile.profile_id;
    const workspaceId = profile.workspaceId ?? profile.workspace_id;
    if (
      typeof profileId !== "string" ||
      profileId.trim().length === 0 ||
      typeof workspaceId !== "string" ||
      workspaceId.trim().length === 0 ||
      !isRole(profile.role) ||
      profile.status !== "active"
    ) {
      // Missing profile and invalid profile data intentionally share this
      // non-enumerating result.
      return { status: "forbidden" };
    }

    return {
      status: "authorized",
      userId: identity.userId,
      profile: {
        id: profileId,
        workspaceId,
        role: profile.role,
      },
    };
  } catch {
    // Keep provider/network/database details out of the user-visible boundary.
    return { status: "configuration_error" };
  }
}

export const resolveSession = resolveIdentitySession;
