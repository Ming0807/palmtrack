"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSignInCredentials } from "@/modules/identity/domain/sign-in";

export async function signIn(formData: FormData): Promise<never> {
  const parsed = parseSignInCredentials({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/sign-in?error=invalid");
  }

  const clientResult = await createSupabaseServerClient();
  if (clientResult.status !== "configured") {
    redirect("/sign-in?error=configuration");
  }

  const { error } = await clientResult.client.auth.signInWithPassword(
    parsed.credentials,
  );

  if (error) {
    redirect("/sign-in?error=invalid");
  }

  redirect("/app");
}
