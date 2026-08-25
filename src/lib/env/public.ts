import { z } from "zod";

const supabaseUrlSchema = z.string().trim().url();
const supabaseKeySchema = z.string().trim().min(1);

type PublicEnvironmentField =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

export type PublicEnvironment =
  | { status: "unconfigured" }
  | {
      status: "configured";
      supabaseUrl: string;
      supabaseKey: string;
    }
  | {
      status: "invalid";
      fields: readonly PublicEnvironmentField[];
      message: string;
    };

export function parsePublicEnv(
  input: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): PublicEnvironment {
  const url = input.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const legacyAnonKey = input.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = publishableKey || legacyAnonKey;

  if (!url && !key) {
    return { status: "unconfigured" };
  }

  const parsedUrl = supabaseUrlSchema.safeParse(url);
  const parsedKey = supabaseKeySchema.safeParse(key);

  if (!parsedUrl.success || !parsedKey.success) {
    const fields: PublicEnvironmentField[] = [];
    if (!parsedUrl.success) fields.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!parsedKey.success) {
      fields.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }

    return {
      status: "invalid",
      fields,
      message: "Supabase public environment configuration is invalid.",
    };
  }

  return {
    status: "configured",
    supabaseUrl: parsedUrl.data,
    supabaseKey: parsedKey.data,
  };
}
