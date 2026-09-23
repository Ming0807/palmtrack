"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import { createSupabaseSamplingGateway } from "@/modules/research/population/server/sampling-gateway";
import {
  activateSamplingRun,
  cancelSamplingRun,
  createSamplingDraft,
  lockSamplingRun,
  type SamplingActionState,
} from "@/modules/research/population/server/sampling-service";

function invalid(reasonCode: string): SamplingActionState {
  return { status: "invalid", reasonCode };
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

function parseJsonArray(value: FormDataEntryValue | null): unknown[] | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const SAMPLING_ROUTE = "/app/research/sampling";

export async function createSamplingDraftAction(
  _previous: SamplingActionState,
  formData: FormData,
): Promise<SamplingActionState> {
  const allocations = parseJsonArray(formData.get("allocationsJson"));
  const members = parseJsonArray(formData.get("membersJson"));
  if (!allocations || !members) return invalid("INVALID_SAMPLING_EVIDENCE");
  const seedU32 = Number(formData.get("seedU32"));
  const input = {
    populationImportId: String(formData.get("populationImportId") ?? ""),
    marginOfError: Number(formData.get("marginOfError")),
    seedText: String(formData.get("seedText") ?? ""),
    seedNormalized: String(formData.get("seedNormalized") ?? ""),
    seedDigestHex: String(formData.get("seedDigestHex") ?? ""),
    seedU32: Number.isInteger(seedU32) ? seedU32 : Number.NaN,
    candidateHash: String(formData.get("candidateHash") ?? ""),
    allocations: allocations as never[],
    members: members as never[],
  };

  const deps = await productionDependencies();
  if (!deps) return { status: "service_unavailable" };
  const state = await createSamplingDraft(
    {
      ...input,
      allocations: input.allocations as unknown as {
        stratumCode: string;
        finalAllocation: number;
      }[],
      members: input.members as unknown as {
        populationMemberId: string;
        stratumCode: string;
        selectionOrder: number;
      }[],
    },
    deps,
  );
  if (state.status === "draft") revalidatePath(SAMPLING_ROUTE);
  return state;
}

export async function lockSamplingRunAction(
  _previous: SamplingActionState,
  formData: FormData,
): Promise<SamplingActionState> {
  const deps = await productionDependencies();
  if (!deps) return { status: "service_unavailable" };
  const state = await lockSamplingRun(
    String(formData.get("runId") ?? ""),
    {
      candidateHash: String(formData.get("candidateHash") ?? ""),
      seedDigestHex: String(formData.get("seedDigestHex") ?? ""),
    },
    deps,
  );
  if (state.status === "locked") revalidatePath(SAMPLING_ROUTE);
  return state;
}

export async function activateSamplingRunAction(
  _previous: SamplingActionState,
  formData: FormData,
): Promise<SamplingActionState> {
  const deps = await productionDependencies();
  if (!deps) return { status: "service_unavailable" };
  const state = await activateSamplingRun(String(formData.get("runId") ?? ""), deps);
  if (state.status === "active") revalidatePath(SAMPLING_ROUTE);
  return state;
}

export async function cancelSamplingRunAction(
  _previous: SamplingActionState,
  formData: FormData,
): Promise<SamplingActionState> {
  const deps = await productionDependencies();
  if (!deps) return { status: "service_unavailable" };
  const state = await cancelSamplingRun(
    String(formData.get("runId") ?? ""),
    String(formData.get("reason") ?? ""),
    deps,
  );
  if (state.status === "cancelled") revalidatePath(SAMPLING_ROUTE);
  return state;
}
