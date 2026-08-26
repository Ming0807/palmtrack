import { z } from "zod";

import type { IdentitySession } from "@/modules/identity/server/session";
import {
  buildSamplingEvidence,
  replaySamplingEvidence,
  type SamplingEvidence,
} from "@/modules/research/sampling/domain/deterministic-sampling";
import {
  SamplingGatewayError,
  type SamplingGateway,
  type SamplingRun,
  type SamplingRunSummary,
} from "@/modules/research/sampling/server/sampling-gateway";

export type SamplingActionState<T extends object = Record<never, never>> =
  | ({ status: "ready" } & T)
  | { status: "invalid" }
  | { status: "forbidden" }
  | { status: "conflict" }
  | { status: "replay_mismatch" }
  | { status: "service_unavailable" };

export type SamplingPreviewState = SamplingActionState<{ evidence: SamplingEvidence }>;
export type SamplingRunState = SamplingActionState<{ run: SamplingRun }>;
export type SamplingListState = SamplingActionState<{ runs: SamplingRunSummary[] }>;
export type SamplingReceiptListState = SamplingActionState<{ runs: SamplingRun[] }>;

export type SamplingDraftInput = {
  populationImportId: string;
  seedText: string;
  marginOfError: number;
  stratumDefinitionVersion: string;
  idempotencyKey: string;
};

type Dependencies = { session: IdentitySession; gateway: SamplingGateway };

const uuid = z.uuid();
const previewInputSchema = z.object({
  populationImportId: uuid,
  seedText: z.string().min(1).max(200),
  marginOfError: z.number().finite().gt(0).lt(1),
  stratumDefinitionVersion: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/u),
});
const draftInputSchema = previewInputSchema.extend({ idempotencyKey: uuid });
const runIdSchema = uuid;
const cancellationSchema = z.object({
  runId: uuid,
  reason: z.string().trim().min(3).max(500),
});

function canRead(session: IdentitySession): boolean {
  return (
    session.status === "authorized" &&
    (session.profile.role === "admin" ||
      session.profile.role === "research_manager" ||
      session.profile.role === "evaluator_readonly")
  );
}

function canMutate(session: IdentitySession): boolean {
  return session.status === "authorized" && session.profile.role === "research_manager";
}

function failure(error: unknown): Exclude<SamplingActionState, { status: "ready" | "invalid" | "forbidden" }> {
  if (!(error instanceof SamplingGatewayError)) return { status: "service_unavailable" };
  if (error.code === "CONFLICT") return { status: "conflict" };
  if (error.code === "REPLAY_MISMATCH") return { status: "replay_mismatch" };
  return { status: "service_unavailable" };
}

async function trustedEvidence(
  input: z.infer<typeof previewInputSchema>,
  gateway: SamplingGateway,
): Promise<SamplingEvidence | SamplingActionState> {
  try {
    const candidates = await gateway.getPopulationCandidates(input.populationImportId);
    return await buildSamplingEvidence({
      populationSize: candidates.length,
      marginOfError: input.marginOfError,
      seedText: input.seedText,
      candidates,
    });
  } catch (error) {
    if (error instanceof SamplingGatewayError) return failure(error);
    // Domain validation failures are intentionally collapsed to the safe
    // input state. No algorithm/provider detail crosses this boundary.
    return { status: "invalid" };
  }
}

export async function previewSampling(
  input: SamplingDraftInput | Omit<SamplingDraftInput, "idempotencyKey">,
  deps: Dependencies,
): Promise<SamplingPreviewState> {
  if (!canMutate(deps.session)) return { status: "forbidden" };
  const parsed = previewInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const evidence = await trustedEvidence(parsed.data, deps.gateway);
  if (!isEvidence(evidence)) return evidence as SamplingPreviewState;
  return { status: "ready", evidence };
}

export async function createSamplingDraft(
  input: SamplingDraftInput,
  deps: Dependencies,
): Promise<SamplingRunState> {
  if (!canMutate(deps.session)) return { status: "forbidden" };
  const parsed = draftInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const evidence = await trustedEvidence(parsed.data, deps.gateway);
  if (!isEvidence(evidence)) return evidence as SamplingRunState;
  try {
    const run = await deps.gateway.createDraft({
      populationImportId: parsed.data.populationImportId,
      stratumDefinitionVersion: parsed.data.stratumDefinitionVersion,
      idempotencyKey: parsed.data.idempotencyKey,
      evidence,
    });
    return { status: "ready", run };
  } catch (error) {
    return failure(error) as SamplingRunState;
  }
}

export async function listSamplingRuns(
  deps: Dependencies,
): Promise<SamplingListState> {
  if (!canRead(deps.session)) return { status: "forbidden" };
  try {
    return { status: "ready", runs: await deps.gateway.listRuns() };
  } catch (error) {
    return failure(error) as SamplingListState;
  }
}

/**
 * Loads detailed receipts only for the research-manager workbench. The route
 * intentionally does not call this for admin/evaluator sessions, so summary
 * rows remain the only evidence exposed to those roles.
 */
export async function loadSamplingRunEvidence(
  runs: SamplingRunSummary[],
  deps: Dependencies,
): Promise<SamplingReceiptListState> {
  if (!canMutate(deps.session)) return { status: "ready", runs: [] };
  if (runs.length === 0) return { status: "ready", runs: [] };
  if (!deps.gateway.getEvidence) return { status: "service_unavailable" };
  try {
    return { status: "ready", runs: await Promise.all(runs.map((run) => deps.gateway.getEvidence!(run.id))) };
  } catch (error) {
    return failure(error) as SamplingReceiptListState;
  }
}

export async function lockSamplingRun(
  runId: string,
  deps: Dependencies,
): Promise<SamplingRunState> {
  if (!canMutate(deps.session)) return { status: "forbidden" };
  if (!runIdSchema.safeParse(runId).success) return { status: "invalid" };
  if (!deps.gateway.getEvidence) return { status: "service_unavailable" };

  try {
    // Both reads happen before the transition RPC. The lock RPC is never used
    // as proof of replay; it only freezes evidence already verified here.
    const persisted = await deps.gateway.getEvidence(runId);
    const candidates = await deps.gateway.getPopulationCandidates(persisted.populationImportId);
    const persistedEvidence = persisted.evidence ?? persisted.resultEvidence;
    if (!persistedEvidence) return { status: "replay_mismatch" };
    if (!matchesTopLevelEvidence(persisted, persistedEvidence)) {
      return { status: "replay_mismatch" };
    }
    const replayInput = {
      populationSize: persisted.populationSize,
      marginOfError: persisted.marginOfError,
      seedText: persisted.seedText,
      candidates,
      strata: persisted.allocationEvidence.map((row) => ({
        stratumCode: row.stratumCode,
        eligibleCount: row.eligibleCount,
      })),
      targetN: persisted.targetN,
    };
    const replayed = await replaySamplingEvidence(replayInput, {
      ...persistedEvidence,
    });
    if (!replayed) return { status: "replay_mismatch" };
    return { status: "ready", run: await deps.gateway.lock(runId, persisted.updatedAt) };
  } catch (error) {
    return failure(error) as SamplingRunState;
  }
}

export async function activateSamplingRun(
  runId: string,
  deps: Dependencies,
): Promise<SamplingRunState> {
  if (!canMutate(deps.session)) return { status: "forbidden" };
  if (!runIdSchema.safeParse(runId).success) return { status: "invalid" };
  try {
    return { status: "ready", run: await deps.gateway.activate(runId) };
  } catch (error) {
    return failure(error) as SamplingRunState;
  }
}

export async function cancelSamplingRun(
  input: { runId: string; reason: string },
  deps: Dependencies,
): Promise<SamplingRunState> {
  if (!canMutate(deps.session)) return { status: "forbidden" };
  const parsed = cancellationSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    return {
      status: "ready",
      run: await deps.gateway.cancel(parsed.data.runId, parsed.data.reason),
    };
  } catch (error) {
    return failure(error) as SamplingRunState;
  }
}

function isEvidence(value: SamplingEvidence | SamplingActionState): value is SamplingEvidence {
  return !("status" in value);
}

function matchesTopLevelEvidence(
  run: SamplingRun,
  evidence: SamplingEvidence,
): boolean {
  return (
    run.populationSize === evidence.populationSize &&
    run.marginOfError === evidence.marginOfError &&
    run.unroundedResult === evidence.unrounded &&
    run.roundingRule === evidence.roundingRule &&
    run.targetN === evidence.targetN &&
    run.formulaVersion === evidence.formulaVersion &&
    run.seedNormalized === evidence.seedNormalized &&
    run.seedNormalizedUtf8Hex === evidence.seedNormalizedUtf8Hex &&
    run.seedDigestHex === evidence.seedDigestHex &&
    run.seedU32 === evidence.seedU32 &&
    run.algorithmVersion === evidence.algorithmVersion &&
    run.orderedCandidateSetHash === evidence.orderedCandidateSetHash &&
    JSON.stringify(run.allocationEvidence) === JSON.stringify(evidence.allocationRows)
  );
}
