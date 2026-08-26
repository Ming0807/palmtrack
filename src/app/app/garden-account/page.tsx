import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import { ConfigurationErrorState, ForbiddenState, UnconfiguredState } from "@/modules/identity/ui";
import { createSupabaseFarmGateway } from "@/modules/farm-core/server/farm-gateway";
import { listFarms, listPlots } from "@/modules/farm-core/server/farm-service";
import type { PlotSummary } from "@/modules/farm-core/domain/farm-model";
import { createSupabaseLedgerGateway } from "@/modules/ledger/server/ledger-gateway";
import { getWorkbenchData } from "@/modules/ledger/server/ledger-service";
import { GardenAccountWorkbench } from "@/modules/ledger/ui/garden-account-workbench";

export default async function GardenAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ farmId?: string; fromDate?: string; toDate?: string }>;
}) {
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

  const { farmId, fromDate, toDate } = await searchParams;

  const farmGateway = createSupabaseFarmGateway(clientResult.client);
  const ledgerGateway = createSupabaseLedgerGateway(clientResult.client);

  const [farmListResult, workbenchResult] = await Promise.all([
    listFarms({ session, gateway: farmGateway }),
    getWorkbenchData({
      session,
      gateway: ledgerGateway,
      filter: { farmId, fromDate, toDate },
    }),
  ]);

  if (workbenchResult.status === "forbidden" || farmListResult.status === "forbidden") {
    return <ForbiddenState />;
  }

  const farms = farmListResult.status === "ready" ? farmListResult.farms : [];

  // Load plots by farm for selectors
  const plotsByFarm: Record<string, PlotSummary[]> = {};
  await Promise.all(
    farms.map(async (farm) => {
      const plotRes = await listPlots({ session, gateway: farmGateway, farmId: farm.id });
      plotsByFarm[farm.id] = plotRes.status === "ready" ? plotRes.plots : [];
    }),
  );

  if (workbenchResult.status === "error") {
    return (
      <GardenAccountWorkbench
        summary={{
          netIncome: "0.00",
          expenseTotal: "0.00",
          cashResult: "0.00",
          saleCount: 0,
          expenseCount: 0,
          hasRecords: false,
        }}
        expenses={[]}
        sales={[]}
        farms={farms}
        plotsByFarm={plotsByFarm}
        selectedFarmId={farmId}
        fromDate={fromDate}
        toDate={toDate}
        status="error"
        errorMessage={workbenchResult.message}
      />
    );
  }

  return (
    <GardenAccountWorkbench
      summary={workbenchResult.summary}
      expenses={workbenchResult.expenses}
      sales={workbenchResult.sales}
      farms={farms}
      plotsByFarm={plotsByFarm}
      selectedFarmId={farmId}
      fromDate={fromDate}
      toDate={toDate}
      status="ready"
    />
  );
}
