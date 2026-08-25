"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parsePublicEnv,
  type PublicEnvironment,
} from "@/lib/env/public";

export type SupabaseBrowserClientResult =
  | { status: "unconfigured" }
  | {
      status: "configuration_error";
      fields: Extract<PublicEnvironment, { status: "invalid" }>["fields"];
    }
  | {
      status: "configured";
      client: SupabaseClient;
    };

export type SupabaseBrowserClientOptions = {
  environment?: Record<string, string | undefined>;
};

/** Creates the browser client with public URL and publishable credentials only. */
export function createSupabaseBrowserClient(
  options: SupabaseBrowserClientOptions = {},
): SupabaseBrowserClientResult {
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

  return {
    status: "configured",
    client: createBrowserClient(
      environment.supabaseUrl,
      environment.supabaseKey,
    ),
  };
}

export const createBrowserSupabaseClient = createSupabaseBrowserClient;
