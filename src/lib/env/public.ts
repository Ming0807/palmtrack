import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
});

export type PublicEnvironment =
  | { status: "unconfigured" }
  | {
      status: "configured";
      supabaseUrl: string;
      supabaseAnonKey: string;
    }
  | {
      status: "invalid";
      fields: readonly (
        | "NEXT_PUBLIC_SUPABASE_URL"
        | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
      )[];
      message: string;
    };

export function parsePublicEnv(
  input: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): PublicEnvironment {
  const url = input.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = input.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url && !anonKey) {
    return { status: "unconfigured" };
  }

  const parsed = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  });

  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path[0])
      .filter(
        (
          field,
        ): field is
          | "NEXT_PUBLIC_SUPABASE_URL"
          | "NEXT_PUBLIC_SUPABASE_ANON_KEY" =>
          field === "NEXT_PUBLIC_SUPABASE_URL" ||
          field === "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );

    return {
      status: "invalid",
      fields: [...new Set(fields)],
      message: "Supabase public environment configuration is invalid.",
    };
  }

  return {
    status: "configured",
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
