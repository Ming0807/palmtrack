import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createClient,
}));

import { signOutAction } from "./actions";

describe("[UNIT-12] signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      status: "configured",
      client: {
        auth: {
          signOut: mocks.signOut,
        },
      },
    });
  });

  it("successfully signs out and redirects to /sign-in when configured", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(mocks.createClient).toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("handles unconfigured client securely without exposing provider details", async () => {
    mocks.createClient.mockResolvedValue({
      status: "unconfigured",
    });

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/sign-in?error=configuration");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in?error=configuration");
  });

  it("handles configuration error securely without exposing provider details", async () => {
    mocks.createClient.mockResolvedValue({
      status: "configuration_error",
      fields: ["NEXT_PUBLIC_SUPABASE_URL"],
    });

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/sign-in?error=configuration");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in?error=configuration");
  });

  it("handles a thrown client-configuration failure without leaking raw error details", async () => {
    mocks.createClient.mockRejectedValue(
      new Error("Cookie configuration failed secret-token-24680"),
    );

    await expect(signOutAction()).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?error=configuration",
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/sign-in?error=configuration",
    );
  });

  it("handles provider signOut error safely without leaking raw error message or secret", async () => {
    mocks.signOut.mockResolvedValue({
      error: new Error("PostgREST network timeout secret-token-12345"),
    });

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/sign-in?error=invalid");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in?error=invalid");
  });

  it("handles a thrown provider failure without leaking raw error details", async () => {
    mocks.signOut.mockRejectedValue(
      new Error("Auth transport failed secret-token-67890"),
    );

    await expect(signOutAction()).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?error=invalid",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in?error=invalid");
  });
});
