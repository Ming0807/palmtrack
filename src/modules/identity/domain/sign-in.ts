import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email();
const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/);
const passwordSchema = z.string().min(1).max(1024);

export type SignInCredentials =
  | { email: string; password: string }
  | { phone: string; password: string };

export type SignInCredentialResult =
  | { success: true; credentials: SignInCredentials }
  | { success: false };

export function parseSignInCredentials(input: {
  identifier: unknown;
  password: unknown;
}): SignInCredentialResult {
  const password = passwordSchema.safeParse(input.password);
  if (!password.success || typeof input.identifier !== "string") {
    return { success: false };
  }

  if (input.identifier.includes("@")) {
    const email = emailSchema.safeParse(input.identifier);
    return email.success
      ? {
          success: true,
          credentials: { email: email.data, password: password.data },
        }
      : { success: false };
  }

  const phone = phoneSchema.safeParse(input.identifier);
  return phone.success
    ? {
        success: true,
        credentials: { phone: phone.data, password: password.data },
      }
    : { success: false };
}
