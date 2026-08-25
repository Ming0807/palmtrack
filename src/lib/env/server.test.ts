import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseServerEnv } from "./server";

describe("parseServerEnv", () => {
  it("[NFR-01] returns unconfigured when no Supabase environment is provided", () => {
    expect(parseServerEnv({})).toEqual({
      status: "unconfigured",
    });
  });

  it("[NFR-01] rejects a partial public configuration without echoing values", () => {
    const secret = "synthetic-service-role-value";
    const result = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: secret,
    });

    expect(result).toMatchObject({
      status: "invalid",
      fields: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("[NFR-01] rejects an invalid Supabase URL", () => {
    const result = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(result).toMatchObject({
      status: "invalid",
      fields: ["NEXT_PUBLIC_SUPABASE_URL"],
    });
  });

  it("[NFR-01] returns configured values and keeps the optional service role server-side", () => {
    const result = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role-value",
    });

    expect(result).toEqual({
      status: "configured",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      serviceRoleKey: "synthetic-service-role-value",
    });
  });

  it("[NFR-01] treats a service-role-only environment as invalid without exporting the secret", () => {
    const secret = "synthetic-service-role-value";
    const result = parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: secret });

    expect(result).toMatchObject({
      status: "invalid",
      fields: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("[NFR-01] does not export a service-role value for public configuration", () => {
    const result = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(result).toEqual({
      status: "configured",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    });
    expect("serviceRoleKey" in result).toBe(false);
  });
});
