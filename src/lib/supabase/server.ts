import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies as nextCookies } from "next/headers";

import {
  parsePublicEnv,
  type PublicEnvironment,
} from "@/lib/env/public";

export type ServerCookieStore = {
  getAll: () => Array<{ name: string; value: string }>;
  set: (name: string, value: string, options: unknown) => unknown;
};

export type SupabaseServerClientResult =
  | { status: "unconfigured" }
  | {
      status: "configuration_error";
      fields: Extract<PublicEnvironment, { status: "invalid" }>["fields"];
    }
  | {
      status: "configured";
      client: SupabaseClient;
    };

export type SupabaseServerClientOptions = {
  environment?: Record<string, string | undefined>;
  cookieStore?: ServerCookieStore;
};

type SupabaseSetCookie = {
  name: string;
  value: string;
  options: unknown;
};

/**
 * Creates a request-scoped Supabase client using only the public anon key.
 *
 * `setAll` intentionally tolerates Next Server Component cookie immutability.
 * Middleware or a Route Handler remains responsible for persisting refreshes
 * when the current request context permits response mutation.
 */
export async function createSupabaseServerClient(
  options: SupabaseServerClientOptions = {},
): Promise<SupabaseServerClientResult> {
  const environment = parsePublicEnv(options.environment);

  if (environment.status === "unconfigured") {
    return environment;
  }

  if (environment.status === "invalid") {
    return {
      status: "configuration_error",
      fields: environment.fields,
    };
  }

  const cookieStore =
    options.cookieStore ??
    ((await nextCookies()) as unknown as ServerCookieStore);

  const cookieMethods = {
    getAll: () => cookieStore.getAll(),
    setAll: async (cookiesToSet: SupabaseSetCookie[]) => {
      try {
        for (const { name, value, options: cookieOptions } of cookiesToSet) {
          await cookieStore.set(name, value, cookieOptions);
        }
      } catch {
        // Server Components can read cookies but cannot mutate the response.
        // Supabase must not turn that expected limitation into an application
        // error or expose framework/provider details to the caller.
      }
    },
  };

  const client = createServerClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    { cookies: cookieMethods },
  );

  return { status: "configured", client };
}

export const createServerSupabaseClient = createSupabaseServerClient;
