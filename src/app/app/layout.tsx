import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { resolveIdentitySession } from "@/modules/identity/server/session";
import {
  ConfigurationErrorState,
  ForbiddenState,
  ProtectedShell,
  UnconfiguredState,
} from "@/modules/identity/ui";

import styles from "./app-shell.module.css";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  await connection();
  const session = await resolveIdentitySession();

  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status === "unconfigured") return <main className={styles.boundary}><UnconfiguredState /></main>;
  if (session.status === "configuration_error") return <main className={styles.boundary}><ConfigurationErrorState /></main>;
  if (session.status === "inactive" || session.status === "forbidden") return <main className={styles.boundary}><ForbiddenState /></main>;

  return <ProtectedShell role={session.profile.role}>{children}</ProtectedShell>;
}
