import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import {
  createSupabaseIdentityGateway,
  ROLES,
  type IdentityGateway,
  resolveIdentitySession,
} from "./session";

const identity = { userId: "auth-user-1" };

function gatewayFor(
  profile: Record<string, unknown> | null,
): IdentityGateway {
  return {
    getVerifiedIdentity: async () => identity,
    getOwnProfile: async () => profile,
  };
}

describe("resolveIdentitySession", () => {
  it("returns anonymous for a missing or expired verified identity", async () => {
    await expect(
      resolveIdentitySession({
        getVerifiedIdentity: async () => null,
        getOwnProfile: async () => null,
      }),
    ).resolves.toEqual({ status: "anonymous" });
  });

  it("returns forbidden for a missing profile without revealing profile existence", async () => {
    await expect(resolveIdentitySession(gatewayFor(null))).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("returns inactive for an inactive own profile", async () => {
    await expect(
      resolveIdentitySession(
        gatewayFor({
          id: "profile-1",
          workspaceId: "workspace-1",
          role: "farmer",
          status: "inactive",
        }),
      ),
    ).resolves.toEqual({ status: "inactive" });
  });

  it("returns forbidden for an invalid role without enumerating a profile", async () => {
    await expect(
      resolveIdentitySession(
        gatewayFor({
          id: "profile-1",
          workspaceId: "workspace-1",
          role: "service_role",
          status: "active",
        }),
      ),
    ).resolves.toEqual({ status: "forbidden" });
  });

  it.each(ROLES.map((role) => [role]))(
    "authorizes the exact approved role %s",
    async (role) => {
    await expect(
      resolveIdentitySession(
        gatewayFor({
          id: "profile-1",
          workspaceId: "workspace-1",
          role,
          status: "active",
          auth_user_id: "must-not-be-projected",
          secret_field: "must-not-be-projected",
        }),
      ),
    ).resolves.toEqual({
      status: "authorized",
      userId: identity.userId,
      profile: {
        id: "profile-1",
        workspaceId: "workspace-1",
        role,
      },
    });
    },
  );

  it("authorizes the exact profile_id field returned by get_current_profile", async () => {
    await expect(
      resolveIdentitySession(
        gatewayFor({
          profile_id: "profile-from-rpc",
          workspace_id: "workspace-1",
          role: "admin",
          status: "active",
        }),
      ),
    ).resolves.toMatchObject({
      status: "authorized",
      profile: { id: "profile-from-rpc" },
    });
  });

  it("sanitizes gateway failures to a stable configuration error", async () => {
    const secret = "provider-token-that-must-not-leak";
    const result = await resolveIdentitySession({
      getVerifiedIdentity: async () => {
        throw new Error(secret);
      },
      getOwnProfile: async () => null,
    });

    expect(result).toEqual({ status: "configuration_error" });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("verifies Auth identity through getUser and queries the fixed own-profile projection", async () => {
    const getUser = async () => ({
      data: { user: { id: "verified-user" } },
      error: null,
    });
    const maybeSingle = async () => ({
      data: {
        profile_id: "profile-1",
        workspace_id: "workspace-1",
        role: "farmer",
        status: "active",
        auth_user_id: "must-not-be-returned",
      },
      error: null,
    });
    const rpc = vi.fn(() => ({ maybeSingle }));
    const client = {
      auth: { getUser },
      rpc,
    } as unknown as Pick<SupabaseClient, "auth" | "rpc">;

    const gateway = createSupabaseIdentityGateway(client);
    await expect(gateway.getVerifiedIdentity()).resolves.toEqual({
      userId: "verified-user",
    });
    await expect(gateway.getOwnProfile()).resolves.toMatchObject({
      profile_id: "profile-1",
      workspace_id: "workspace-1",
      role: "farmer",
      status: "active",
    });
    expect(rpc).toHaveBeenCalledWith("get_current_profile");
  });

  it("accepts the gateway through the explicit resolver options boundary", async () => {
    await expect(
      resolveIdentitySession({ gateway: gatewayFor(null) }),
    ).resolves.toEqual({ status: "forbidden" });
  });
});
