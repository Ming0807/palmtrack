import "server-only";

import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
});

export type ServerEnvironment =
  | {
      status: "unconfigured";
    }
  | {
      status: "configured";
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey?: string;
    }
  | {
      status: "invalid";
      fields: readonly ("NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY")[];
      message: string;
    };

export function parseServerEnv(
  input: Record<string, string | undefined> = process.env,
): ServerEnvironment {
  const url = input.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = input.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = input.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url && !anonKey && !serviceRoleKey) {
    return { status: "unconfigured" };
  }

  const parsedPublic = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  });

  if (!parsedPublic.success) {
    const fields = parsedPublic.error.issues
      .map((issue) => issue.path[0])
      .filter(
        (field): field is "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" =>
          field === "NEXT_PUBLIC_SUPABASE_URL" || field === "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );

    return {
      status: "invalid",
      fields: [...new Set(fields)],
      message: "Supabase environment configuration is incomplete or invalid.",
    };
  }

  return {
    status: "configured",
    supabaseUrl: parsedPublic.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsedPublic.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ...(serviceRoleKey ? { serviceRoleKey } : {}),
  };
}
