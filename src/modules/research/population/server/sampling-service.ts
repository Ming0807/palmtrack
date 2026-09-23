import { z } from "zod";

import type { IdentitySession } from "@/modules/identity/server/session";
import { SAMPLING_ALGORITHM_VERSION } from "@/modules/research/population/domain/sampling-deterministic";
import { YAMANE_FORMULA_VERSION } from "@/modules/research/population/domain/sampling-yamane";
import {
  SamplingGatewayError,
  type SamplingDraftInput,
  type SamplingGateway,
  type SamplingMember,
  type SamplingRunDetail,
  type SamplingRunReceipt,
} from "@/modules/research/population/server/sampling-gateway";

export type SamplingActionState =
  | { status: "idle" }
  | { status: "invalid"; reasonCode: string }
  | { status: "forbidden" }
  | { status: "conflict" }
  | { status: "service_unavailable" }
  | { status: "draft"; runId: string; receipt: SamplingRunReceipt }
  | { status: "locked"; runId: string; receipt: SamplingRunReceipt }
  | { status: "active"; runId: string; receipt: SamplingRunReceipt }
  | { status: "cancelled"; runId: string; receipt: SamplingRunReceipt };

export type SamplingListState =
  | { status: "ready"; runs: SamplingRunReceipt[] }
  | { status: "forbidden" }
  | { status: "service_unavailable" };

type Dependencies = { session: IdentitySession; gateway: SamplingGateway };

const hex64 = z.string().regex(/^[0-9a-f]{64}$/u);

const draftSchema = z.object({
  populationImportId: z.uuid(),
  marginOfError: z.number().gt(0).lt(1),
  seedText: z.string().min(1).max(200),
  seedNormalized: z.string().min(1).max(200),
  seedDigestHex: hex64,
  seedU32: z.number().int().min(0).max(4294967295),
  candidateHash: hex64,
  allocations: z.array(
    z.object({
      stratumCode: z.string().regex(/^[A-Z0-9_-]{1,24}$/u),
      finalAllocation: z.number().int().positive(),
    }),
  ).min(1),
  members: z.array(
    z.object({
      populationMemberId: z.uuid(),
      stratumCode: z.string().regex(/^[A-Z0-9_-]{1,24}$/u),
      selectionOrder: z.number().int().positive(),
    }),
  ).min(1),
});

function canManageSampling(session: IdentitySession): boolean {
  return session.status === "authorized" && session.profile.role === "research_manager";
}

function canViewSampling(session: IdentitySession): boolean {
  return (
    session.status === "authorized" &&
    (session.profile.role === "admin" ||
      session.profile.role === "research_manager" ||
      session.profile.role === "evaluator_readonly")
  );
}

function gatewayFailure(error: unknown): SamplingActionState {
  return error instanceof SamplingGatewayError && error.code === "CONFLICT"
    ? { status: "conflict" }
    : { status: "service_unavailable" };
}

function draftEvidenceValid(input: SamplingDraftInput): boolean {
  const allocationTotal = input.allocations.reduce((sum, item) => sum + item.finalAllocation, 0);
  if (allocationTotal !== input.members.length) return false;
  const orders = input.members.map((item) => item.selectionOrder).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i += 1) {
    if (orders[i] !== i + 1) return false;
  }
  const memberIds = new Set(input.members.map((item) => item.populationMemberId));
  if (memberIds.size !== input.members.length) return false;
  const quota = new Map(input.allocations.map((item) => [item.stratumCode, item.finalAllocation]));
  const counted = new Map<string, number>();
  for (const member of input.members) {
    const limit = quota.get(member.stratumCode);
    if (limit === undefined) return false;
    const used = (counted.get(member.stratumCode) ?? 0) + 1;
    if (used > limit) return false;
    counted.set(member.stratumCode, used);
  }
  return true;
}

export async function createSamplingDraft(
  input: SamplingDraftInput,
  deps: Dependencies,
): Promise<SamplingActionState> {
  if (!canManageSampling(deps.session)) return { status: "forbidden" };
  if (!draftSchema.safeParse(input).success || !draftEvidenceValid(input)) {
    return { status: "invalid", reasonCode: "INVALID_SAMPLING_EVIDENCE" };
  }
  try {
    const receipt = await deps.gateway.draft(input);
    return { status: "draft", runId: receipt.id, receipt };
  } catch (error) {
    return gatewayFailure(error);
  }
}

export async function lockSamplingRun(
  runId: string,
  evidence: { candidateHash: string; seedDigestHex: string },
  deps: Dependencies,
): Promise<SamplingActionState> {
  if (!canManageSampling(deps.session)) return { status: "forbidden" };
  if (
    !z.uuid().safeParse(runId).success ||
    !hex64.safeParse(evidence.candidateHash).success ||
    !hex64.safeParse(evidence.seedDigestHex).success
  ) {
    return { status: "invalid", reasonCode: "INVALID_LOCK_EVIDENCE" };
  }
  try {
    const receipt = await deps.gateway.lock(runId, evidence.candidateHash, evidence.seedDigestHex);
    return { status: "locked", runId: receipt.id, receipt };
  } catch (error) {
    return gatewayFailure(error);
  }
}

export async function activateSamplingRun(
  runId: string,
  deps: Dependencies,
): Promise<SamplingActionState> {
  if (!canManageSampling(deps.session)) return { status: "forbidden" };
  if (!z.uuid().safeParse(runId).success) return { status: "conflict" };
  try {
    const receipt = await deps.gateway.activate(runId);
    return { status: "active", runId: receipt.id, receipt };
  } catch (error) {
    return gatewayFailure(error);
  }
}

export async function cancelSamplingRun(
  runId: string,
  reason: string,
  deps: Dependencies,
): Promise<SamplingActionState> {
  if (!canManageSampling(deps.session)) return { status: "forbidden" };
  if (!z.uuid().safeParse(runId).success) return { status: "conflict" };
  if (reason.trim().length < 1 || reason.trim().length > 200) {
    return { status: "invalid", reasonCode: "INVALID_CANCEL_REASON" };
  }
  try {
    const receipt = await deps.gateway.cancel(runId, reason.trim());
    return { status: "cancelled", runId: receipt.id, receipt };
  } catch (error) {
    return gatewayFailure(error);
  }
}

export async function listSamplingRuns(deps: Dependencies): Promise<SamplingListState> {
  if (!canViewSampling(deps.session)) return { status: "forbidden" };
  try {
    return { status: "ready", runs: await deps.gateway.list() };
  } catch {
    return { status: "service_unavailable" };
  }
}

export type SamplingDetailState =
  | { status: "ready"; detail: SamplingRunDetail; members: SamplingMember[] }
  | { status: "forbidden" }
  | { status: "conflict" }
  | { status: "service_unavailable" };

export type PopulationSnapshotState =
  | { status: "ready"; members: import("@/modules/research/population/server/sampling-gateway").PopulationSnapshotMember[] }
  | { status: "forbidden" }
  | { status: "conflict" }
  | { status: "service_unavailable" };

export async function getSamplingRunDetail(
  runId: string,
  deps: Dependencies,
): Promise<SamplingDetailState> {
  if (!canViewSampling(deps.session)) return { status: "forbidden" };
  if (!z.uuid().safeParse(runId).success) return { status: "conflict" };
  try {
    const [detail, members] = await Promise.all([
      deps.gateway.get(runId),
      deps.gateway.listMembers(runId),
    ]);
    return { status: "ready", detail, members };
  } catch (error) {
    return error instanceof SamplingGatewayError && error.code === "CONFLICT"
      ? { status: "conflict" }
      : { status: "service_unavailable" };
  }
}

export async function listPopulationSnapshotMembers(
  importId: string,
  deps: Dependencies,
): Promise<PopulationSnapshotState> {
  if (!canViewSampling(deps.session)) return { status: "forbidden" };
  if (!z.uuid().safeParse(importId).success) return { status: "conflict" };
  try {
    return { status: "ready", members: await deps.gateway.listPopulationMembers(importId) };
  } catch (error) {
    return error instanceof SamplingGatewayError && error.code === "CONFLICT"
      ? { status: "conflict" }
      : { status: "service_unavailable" };
  }
}

export const SAMPLING_CONTRACT_IDS = {
  algorithmVersion: SAMPLING_ALGORITHM_VERSION,
  formulaVersion: YAMANE_FORMULA_VERSION,
} as const;
