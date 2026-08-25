import { describe, expect, it, vi } from "vitest";

const { createBrowserClientMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn((url, key) => ({
    kind: "synthetic-browser-client",
    url,
    key,
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

import { createSupabaseBrowserClient } from "./browser";

describe("createSupabaseBrowserClient", () => {
  it("returns an explicit unconfigured state instead of a fake client", () => {
    expect(createSupabaseBrowserClient({ environment: {} })).toEqual({
      status: "unconfigured",
    });
  });

  it("returns an explicit configuration error instead of constructing with invalid values", () => {
    expect(
      createSupabaseBrowserClient({
        environment: {
          NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
        },
      }),
    ).toMatchObject({
      status: "configuration_error",
      fields: ["NEXT_PUBLIC_SUPABASE_URL"],
    });
  });

  it("constructs only with the public URL and publishable key", () => {
    const result = createSupabaseBrowserClient({
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
      },
    });

    expect(result.status).toBe("configured");
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_synthetic",
    );
  });
});
