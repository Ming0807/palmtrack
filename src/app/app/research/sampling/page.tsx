import Link from "next/link";
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
  activateSamplingRunAction,
  cancelSamplingRunAction,
  createSamplingDraftAction,
  lockSamplingRunAction,
  previewSamplingAction,
} from "@/modules/research/sampling/server/actions";
import { createSupabasePopulationGateway } from "@/modules/research/population/server/population-gateway";
import type { PopulationReceipt } from "@/modules/research/population/server/population-gateway";
import { listPopulationImports } from "@/modules/research/population/server/population-service";
import { createSupabaseSamplingGateway } from "@/modules/research/sampling/server/sampling-gateway";
import type { SamplingRun } from "@/modules/research/sampling/server/sampling-gateway";
import { listSamplingRuns, loadSamplingRunEvidence } from "@/modules/research/sampling/server/sampling-service";
import { SamplingWorkbench } from "@/modules/research/sampling/ui/sampling-workbench";
import styles from "../../app-shell.module.css";

function SamplingListState({ status }: { status: "conflict" | "replay_mismatch" }) {
  return (
    <section className={styles.content} aria-live="polite">
      <h1>การสุ่มตัวอย่าง</h1>
      {status === "conflict" ? (
        <p role="alert">ไม่สามารถโหลดรายการ sampling run ได้ในขณะนี้ โปรดลองอีกครั้ง</p>
      ) : (
        <p role="alert">หลักฐานของ sampling run ไม่ตรงกัน จึงหยุดการทำงานไว้ก่อน</p>
      )}
    </section>
  );
}

export default async function SamplingPage() {
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

  const samplingGateway = createSupabaseSamplingGateway(clientResult.client);
  const result = await listSamplingRuns({
    session,
    gateway: samplingGateway,
  });
  if (result.status === "forbidden") return <ForbiddenState />;
  if (result.status === "conflict" || result.status === "replay_mismatch") {
    return <SamplingListState status={result.status} />;
  }
  if (result.status !== "ready") return <ConfigurationErrorState />;

  const backHref = session.profile.role === "research_manager" ? "/app/research" : "/app";
  const canManageSampling = session.profile.role === "research_manager";
  let initialRunDetails: SamplingRun[] = [];
  if (canManageSampling) {
    const evidenceResult = await loadSamplingRunEvidence(result.runs, {
      session,
      gateway: samplingGateway,
    });
    if (evidenceResult.status === "forbidden") return <ForbiddenState />;
    if (evidenceResult.status === "conflict" || evidenceResult.status === "replay_mismatch") {
      return <SamplingListState status={evidenceResult.status} />;
    }
    if (evidenceResult.status !== "ready") return <ConfigurationErrorState />;
    initialRunDetails = evidenceResult.runs;
  }
  let initialImports: PopulationReceipt[] = [];
  if (session.profile.role === "research_manager" || session.profile.role === "admin") {
    const populationResult = await listPopulationImports({
      session,
      gateway: createSupabasePopulationGateway(clientResult.client),
    });
    if (populationResult.status === "forbidden") return <ForbiddenState />;
    if (populationResult.status === "service_unavailable") return <ConfigurationErrorState />;
    initialImports = populationResult.imports;
  }

  return (
    <section className={styles.contentWide}>
      <p>
        <Link href={backHref}>{session.profile.role === "research_manager" ? "กลับไปงานวิจัย" : "กลับหน้าหลัก"}</Link>
      </p>
      <SamplingWorkbench
        initialImports={initialImports}
        initialRuns={result.runs}
        initialRunDetails={initialRunDetails}
        canMutate={canManageSampling}
        previewAction={previewSamplingAction}
        createDraftAction={createSamplingDraftAction}
        lockAction={lockSamplingRunAction}
        activateAction={activateSamplingRunAction}
        cancelAction={cancelSamplingRunAction}
      />
    </section>
  );
}
