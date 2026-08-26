import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDashboardModel } from "@/modules/dashboard/server/dashboard-service";
import { DashboardOverview } from "@/modules/dashboard/ui/dashboard-overview";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import {
  ConfigurationErrorState,
  ForbiddenState,
  UnconfiguredState,
} from "@/modules/identity/ui";
import { createSupabasePopulationGateway } from "@/modules/research/population/server/population-gateway";
import { createSupabaseSamplingGateway } from "@/modules/research/sampling/server/sampling-gateway";

import styles from "./app-shell.module.css";

export default async function ApplicationHomePage() {
  const clientResult = await createSupabaseServerClient();
  if (clientResult.status === "unconfigured") return <UnconfiguredState />;
  if (clientResult.status === "configuration_error") return <ConfigurationErrorState />;

  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(clientResult.client),
  });
  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status === "unconfigured") return <UnconfiguredState />;
  if (session.status === "configuration_error") return <ConfigurationErrorState />;
  if (session.status !== "authorized") return <ForbiddenState />;

  const model = await buildDashboardModel({
    session,
    populationGateway: createSupabasePopulationGateway(clientResult.client),
    samplingGateway: createSupabaseSamplingGateway(clientResult.client),
  });

  return (
    <section className={styles.contentWide}>
      <DashboardOverview model={model} />
    </section>
  );
}
