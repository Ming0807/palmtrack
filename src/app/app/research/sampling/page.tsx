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
import { createSupabasePopulationGateway } from "@/modules/research/population/server/population-gateway";
import { listPopulationImports } from "@/modules/research/population/server/population-service";
import {
  activateSamplingRunAction,
  cancelSamplingRunAction,
  createSamplingDraftAction,
  lockSamplingRunAction,
} from "@/modules/research/population/server/sampling-actions";
import { createSupabaseSamplingGateway } from "@/modules/research/population/server/sampling-gateway";
import {
  getSamplingRunDetail,
  listPopulationSnapshotMembers,
  listSamplingRuns,
} from "@/modules/research/population/server/sampling-service";
import {
  SamplingRunFlow,
  type AcceptedSnapshot,
} from "@/modules/research/population/ui/sampling-run-flow";

export default async function SamplingPage() {
  const clientResult = await createSupabaseServerClient();
  if (clientResult.status === "unconfigured") return <UnconfiguredState />;
  if (clientResult.status === "configuration_error") return <ConfigurationErrorState />;

  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(clientResult.client),
  });
  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status !== "authorized") return <ForbiddenState />;

  const samplingGateway = createSupabaseSamplingGateway(clientResult.client);
  const runsResult = await listSamplingRuns({ session, gateway: samplingGateway });
  if (runsResult.status === "forbidden") return <ForbiddenState />;
  if (runsResult.status === "service_unavailable") return <ConfigurationErrorState />;

  const details = (
    await Promise.all(
      runsResult.runs.map((run) => getSamplingRunDetail(run.id, { session, gateway: samplingGateway })),
    )
  ).flatMap((result) => (result.status === "ready" ? [{ detail: result.detail, members: result.members }] : []));

  const canManage = session.profile.role === "research_manager";
  let acceptedSnapshots: AcceptedSnapshot[] = [];
  if (canManage) {
    const importsResult = await listPopulationImports({
      session,
      gateway: createSupabasePopulationGateway(clientResult.client),
    });
    if (importsResult.status === "ready") {
      const accepted = importsResult.imports.filter((item) => item.status === "accepted");
      acceptedSnapshots = (
        await Promise.all(
          accepted.map(async (item) => {
            const membersResult = await listPopulationSnapshotMembers(item.id, {
              session,
              gateway: samplingGateway,
            });
            if (membersResult.status !== "ready") return null;
            return {
              id: item.id,
              sourceLabel: item.sourceLabel,
              eligibleCount: item.eligibleCount,
              inputDigest: item.inputDigest,
              members: membersResult.members,
            } satisfies AcceptedSnapshot;
          }),
        )
      ).flatMap((snapshot) => (snapshot ? [snapshot] : []));
    }
  }

  return (
    <SamplingRunFlow
      initialRuns={details}
      acceptedSnapshots={acceptedSnapshots}
      canManage={canManage}
      draftAction={createSamplingDraftAction}
      lockAction={lockSamplingRunAction}
      activateAction={activateSamplingRunAction}
      cancelAction={cancelSamplingRunAction}
    />
  );
}
