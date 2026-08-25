import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "./public";

describe("parsePublicEnv", () => {
  it("returns an explicit unconfigured state when public Supabase values are absent", () => {
    expect(parsePublicEnv({})).toEqual({ status: "unconfigured" });
  });

  it("returns only the public URL and anon key when configured", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: " anon-key ",
      }),
    ).toEqual({
      status: "configured",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    });
  });

  it("returns an explicit invalid state without echoing environment values", () => {
    const secret = "synthetic-anon-secret";
    const result = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
    });

    expect(result).toMatchObject({
      status: "invalid",
      fields: ["NEXT_PUBLIC_SUPABASE_URL"],
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
