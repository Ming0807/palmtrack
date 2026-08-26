import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import { ConfigurationErrorState, ForbiddenState, UnconfiguredState } from "@/modules/identity/ui";
import { createSupabaseFarmGateway } from "@/modules/farm-core/server/farm-gateway";
import { listFarms, listPlots } from "@/modules/farm-core/server/farm-service";
import { FarmCoreView, type FarmWithPlots } from "@/modules/farm-core/ui/farm-core-view";

export default async function GardensPage() {
  const clientResult = await createSupabaseServerClient();
  if (clientResult.status === "unconfigured") return <UnconfiguredState />;
  if (clientResult.status === "configuration_error") return <ConfigurationErrorState />;

  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(clientResult.client),
  });

  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status === "unconfigured") return <UnconfiguredState />;
  if (session.status === "configuration_error") return <ConfigurationErrorState />;
  if (session.status !== "authorized" || session.profile.role !== "farmer") {
    return <ForbiddenState />;
  }

  const farmGateway = createSupabaseFarmGateway(clientResult.client);
  const farmListResult = await listFarms({ session, gateway: farmGateway });

  if (farmListResult.status === "forbidden") {
    return <ForbiddenState />;
  }

  if (farmListResult.status === "error") {
    return <FarmCoreView farms={[]} status="error" errorMessage={farmListResult.message} />;
  }

  // Load plots for each farm
  const plotResults = await Promise.all(
    farmListResult.farms.map(async (farm) => {
      const plotResult = await listPlots({ session, gateway: farmGateway, farmId: farm.id });
      return {
        farm,
        plotResult,
      };
    }),
  );

  const failedPlotResult = plotResults.find(({ plotResult }) => plotResult.status === "error");
  if (failedPlotResult?.plotResult.status === "error") {
    return (
      <FarmCoreView
        farms={[]}
        status="error"
        errorMessage={failedPlotResult.plotResult.message}
      />
    );
  }

  const farmsWithPlots: FarmWithPlots[] = plotResults.map(({ farm, plotResult }) => ({
    ...farm,
    plots: plotResult.status === "ready" ? plotResult.plots : [],
  }));

  return <FarmCoreView farms={farmsWithPlots} status="ready" />;
}
