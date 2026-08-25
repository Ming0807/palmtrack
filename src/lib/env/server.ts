import "server-only";

import { z } from "zod";

const supabaseUrlSchema = z.string().trim().url();
const supabaseKeySchema = z.string().trim().min(1);

type ServerEnvironmentField =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

export type ServerEnvironment =
  | {
      status: "unconfigured";
    }
  | {
      status: "configured";
      supabaseUrl: string;
      supabaseKey: string;
      serviceRoleKey?: string;
    }
  | {
      status: "invalid";
      fields: readonly ServerEnvironmentField[];
      message: string;
    };

export function parseServerEnv(
  input: Record<string, string | undefined> = process.env,
): ServerEnvironment {
  const url = input.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const legacyAnonKey = input.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = publishableKey || legacyAnonKey;
  const serviceRoleKey = input.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url && !key && !serviceRoleKey) {
    return { status: "unconfigured" };
  }

  const parsedUrl = supabaseUrlSchema.safeParse(url);
  const parsedKey = supabaseKeySchema.safeParse(key);

  if (!parsedUrl.success || !parsedKey.success) {
    const fields: ServerEnvironmentField[] = [];
    if (!parsedUrl.success) fields.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!parsedKey.success) {
      fields.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }

    return {
      status: "invalid",
      fields,
      message: "Supabase environment configuration is incomplete or invalid.",
    };
  }

  return {
    status: "configured",
    supabaseUrl: parsedUrl.data,
    supabaseKey: parsedKey.data,
    ...(serviceRoleKey ? { serviceRoleKey } : {}),
  };
}
