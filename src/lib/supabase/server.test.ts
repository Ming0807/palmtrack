import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn((url, key, options) => ({
    kind: "synthetic-supabase-client",
    url,
    key,
    options,
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { createSupabaseServerClient } from "./server";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
};

describe("createSupabaseServerClient", () => {
  beforeEach(() => {
    createServerClientMock.mockClear();
  });

  it("does not construct a client when public configuration is absent", async () => {
    await expect(
      createSupabaseServerClient({ environment: {} }),
    ).resolves.toEqual({ status: "unconfigured" });
  });

  it("does not construct a client when public configuration is invalid", async () => {
    await expect(
      createSupabaseServerClient({
        environment: {
          NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
        },
      }),
    ).resolves.toMatchObject({
      status: "configuration_error",
      fields: ["NEXT_PUBLIC_SUPABASE_URL"],
    });
  });

  it("passes only public credentials and safe cookie adapters to the SSR client", async () => {
    const set = vi.fn();
    const cookieStore = {
      getAll: vi.fn(() => [{ name: "sb-session", value: "synthetic-cookie" }]),
      set,
    };

    const result = await createSupabaseServerClient({
      environment,
      cookieStore,
    });

    expect(result.status).toBe("configured");
    if (result.status !== "configured") return;

    expect(result.client).toBeDefined();
    expect(createServerClientMock).toHaveBeenCalledWith(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      expect.objectContaining({ cookies: expect.any(Object) }),
    );

    const options = createServerClientMock.mock.calls[0]?.[2];
    if (!options || typeof options !== "object" || !("cookies" in options)) {
      throw new Error("server client cookie methods were not configured");
    }
    expect(options.cookies.getAll()).toEqual([
      { name: "sb-session", value: "synthetic-cookie" },
    ]);
    await options.cookies.setAll([
      { name: "sb-session", value: "new-value", options: {} },
    ], {});
    expect(set).toHaveBeenCalledWith("sb-session", "new-value", {});
    expect(cookieStore.getAll).toHaveBeenCalledTimes(1);
  });

  it("swallows cookie writes that are forbidden in a Server Component", async () => {
    const cookieStore = {
      getAll: vi.fn(() => []),
      set: vi.fn(() => {
        throw new Error("cookies can only be modified in a Server Action");
      }),
    };

    const result = await createSupabaseServerClient({
      environment,
      cookieStore,
    });
    expect(result.status).toBe("configured");
    if (result.status !== "configured") return;

    await expect(
      (createServerClientMock.mock.calls[0]?.[2] as {
        cookies: {
          setAll: (
            cookies: Array<{ name: string; value: string; options: unknown }>,
            headers: Record<string, string>,
          ) => Promise<void>;
        };
      }).cookies.setAll([
        { name: "sb-session", value: "new-value", options: {} },
      ], {}),
    ).resolves.toBeUndefined();
  });

  it("swallows asynchronous cookie write failures as well", async () => {
    const cookieStore = {
      getAll: vi.fn(() => []),
      set: vi.fn(async () => {
        throw new Error("immutable response");
      }),
    };

    const result = await createSupabaseServerClient({
      environment,
      cookieStore,
    });
    expect(result.status).toBe("configured");
    if (result.status !== "configured") return;

    const options = createServerClientMock.mock.calls[0]?.[2];
    if (!options || typeof options !== "object" || !("cookies" in options)) {
      throw new Error("server client cookie methods were not configured");
    }
    await expect(
      options.cookies.setAll([
        { name: "sb-session", value: "new-value", options: {} },
      ], {}),
    ).resolves.toBeUndefined();
  });
});
