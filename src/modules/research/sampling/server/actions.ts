"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import { createSupabaseSamplingGateway } from "@/modules/research/sampling/server/sampling-gateway";
import {
  activateSamplingRun,
  cancelSamplingRun,
  createSamplingDraft,
  lockSamplingRun,
  previewSampling,
  type SamplingPreviewState,
  type SamplingRunState,
} from "@/modules/research/sampling/server/sampling-service";

const SAMPLING_PATH = "/app/research/sampling";

type ProductionDependencies = Awaited<ReturnType<typeof productionDependencies>>;

function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

function finiteNumberField(formData: FormData, name: string): number | null {
  const value = textField(formData, name);
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function productionDependencies() {
  const result = await createSupabaseServerClient();
  if (result.status !== "configured") return null;
  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(result.client),
  });
  return {
    session,
    gateway: createSupabaseSamplingGateway(result.client),
  };
}

async function dependenciesOrUnavailable(): Promise<
  | { status: "service_unavailable" }
  | NonNullable<ProductionDependencies>
> {
  const dependencies = await productionDependencies();
  return dependencies ?? { status: "service_unavailable" };
}

function revalidateOnSuccess(state: SamplingRunState): SamplingRunState {
  if (state.status === "ready") revalidatePath(SAMPLING_PATH);
  return state;
}

export async function previewSamplingAction(
  _previous: SamplingPreviewState,
  formData: FormData,
): Promise<SamplingPreviewState> {
  const populationImportId = textField(formData, "populationImportId");
  const seedText = textField(formData, "seedText");
  const marginOfError = finiteNumberField(formData, "marginOfError");
  const stratumDefinitionVersion = textField(formData, "stratumDefinitionVersion");
  if (
    populationImportId === null ||
    seedText === null ||
    marginOfError === null ||
    stratumDefinitionVersion === null
  ) {
    return { status: "invalid" };
  }

  const dependencies = await dependenciesOrUnavailable();
  if (!("gateway" in dependencies)) return dependencies;
  return previewSampling(
    { populationImportId, seedText, marginOfError, stratumDefinitionVersion },
    dependencies,
  );
}

export async function createSamplingDraftAction(
  _previous: SamplingRunState,
  formData: FormData,
): Promise<SamplingRunState> {
  const populationImportId = textField(formData, "populationImportId");
  const seedText = textField(formData, "seedText");
  const marginOfError = finiteNumberField(formData, "marginOfError");
  const stratumDefinitionVersion = textField(formData, "stratumDefinitionVersion");
  const idempotencyKey = textField(formData, "idempotencyKey");
  if (
    populationImportId === null ||
    seedText === null ||
    marginOfError === null ||
    stratumDefinitionVersion === null ||
    idempotencyKey === null
  ) {
    return { status: "invalid" };
  }

  const dependencies = await dependenciesOrUnavailable();
  if (!("gateway" in dependencies)) return dependencies;
  return revalidateOnSuccess(
    await createSamplingDraft(
      { populationImportId, seedText, marginOfError, stratumDefinitionVersion, idempotencyKey },
      dependencies,
    ),
  );
}

export async function lockSamplingRunAction(
  _previous: SamplingRunState,
  formData: FormData,
): Promise<SamplingRunState> {
  const runId = textField(formData, "runId");
  if (runId === null) return { status: "invalid" };
  const dependencies = await dependenciesOrUnavailable();
  if (!("gateway" in dependencies)) return dependencies;
  return revalidateOnSuccess(await lockSamplingRun(runId, dependencies));
}

export async function activateSamplingRunAction(
  _previous: SamplingRunState,
  formData: FormData,
): Promise<SamplingRunState> {
  const runId = textField(formData, "runId");
  if (runId === null) return { status: "invalid" };
  const dependencies = await dependenciesOrUnavailable();
  if (!("gateway" in dependencies)) return dependencies;
  return revalidateOnSuccess(await activateSamplingRun(runId, dependencies));
}

export async function cancelSamplingRunAction(
  _previous: SamplingRunState,
  formData: FormData,
): Promise<SamplingRunState> {
  const runId = textField(formData, "runId");
  const reason = textField(formData, "reason");
  if (runId === null || reason === null) return { status: "invalid" };
  const dependencies = await dependenciesOrUnavailable();
  if (!("gateway" in dependencies)) return dependencies;
  return revalidateOnSuccess(await cancelSamplingRun({ runId, reason }, dependencies));
}
