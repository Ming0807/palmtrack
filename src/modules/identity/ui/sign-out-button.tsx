"use client";

import { useFormStatus } from "react-dom";
import { Loader2, LogOut } from "lucide-react";

import { signOutAction } from "@/modules/identity/server/actions";

import styles from "./protected-shell.module.css";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={styles.signOutButton}
      aria-disabled={pending}
    >
      {pending ? (
        <Loader2 size={16} className={styles.spinning} aria-hidden="true" />
      ) : (
        <LogOut size={16} aria-hidden="true" />
      )}
      <span className={styles.signOutLabel} aria-live="polite">
        {pending ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
      </span>
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction} className={styles.signOutForm}>
      <SubmitButton />
    </form>
  );
}
