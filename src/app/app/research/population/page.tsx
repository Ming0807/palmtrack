import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import {
  ConfigurationErrorState,
  ForbiddenState,
  UnconfiguredState,
} from "@/modules/identity/ui";
import {
  acceptPopulationImportAction,
  createPopulationImportAction,
} from "@/modules/research/population/server/actions";
import { createSupabasePopulationGateway } from "@/modules/research/population/server/population-gateway";
import { listPopulationImports } from "@/modules/research/population/server/population-service";
import { PopulationImportFlow } from "@/modules/research/population/ui/population-import-flow";

export default async function PopulationPage() {
  const clientResult = await createSupabaseServerClient();
  if (clientResult.status === "unconfigured") return <UnconfiguredState />;
  if (clientResult.status === "configuration_error") return <ConfigurationErrorState />;

  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(clientResult.client),
  });
  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status !== "authorized") return <ForbiddenState />;

  const result = await listPopulationImports({
    session,
    gateway: createSupabasePopulationGateway(clientResult.client),
  });
  if (result.status === "forbidden") return <ForbiddenState />;
  if (result.status === "service_unavailable") return <ConfigurationErrorState />;

  return (
    <PopulationImportFlow
      initialImports={result.imports}
      createAction={createPopulationImportAction}
      acceptAction={acceptPopulationImportAction}
    />
  );
}
