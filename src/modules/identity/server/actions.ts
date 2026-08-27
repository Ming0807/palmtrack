"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server action to securely terminate the current Supabase session.
 *
 * Safe boundary:
 * - Uses request-scoped Supabase server client (no service-role key).
 * - Redirects to /sign-in on success.
 * - Handles unconfigured / provider failure without leaking secrets or raw provider error messages.
 */
export async function signOutAction(): Promise<never> {
  const clientResult = await createSupabaseServerClient();

  if (clientResult.status !== "configured") {
    redirect("/sign-in?error=configuration");
  }

  const { error } = await clientResult.client.auth.signOut();

  if (error) {
    redirect("/sign-in?error=invalid");
  }

  redirect("/sign-in");
}

export const signOut = signOutAction;
