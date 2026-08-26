import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  AllocationRow,
  SamplingCandidate,
  SamplingEvidence,
  SwapTraceRow,
} from "@/modules/research/sampling/domain/deterministic-sampling";

export type SamplingRunStatus =
  | "draft"
  | "locked"
  | "active"
  | "superseded"
  | "cancelled";

export type SamplingDraftCommand = {
  populationImportId: string;
  stratumDefinitionVersion: string;
  idempotencyKey: string;
  evidence: SamplingEvidence;
};

export type SamplingRun = {
  id: string;
  version: number;
  populationImportId: string;
  populationSize: number;
  marginOfError: number;
  unroundedResult: number;
  roundingRule: "ceil";
  targetN: number;
  formulaVersion: "yamane-v1";
  stratumDefinitionVersion: string;
  seedText: string;
  seedNormalized: string;
  seedNormalizedUtf8Hex: string;
  seedDigestHex: string;
  seedU32: number;
  algorithmVersion: "sha256-mulberry32-fy-v1";
  orderedCandidateSetHash: string;
  status: SamplingRunStatus;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  activatedAt: string | null;
  supersededAt: string | null;
  cancelledAt: string | null;
  cancellationReasonDigest: string | null;
  allocationEvidence: AllocationRow[];
  resultEvidence: SamplingEvidence | null;
  /** Present when the run was loaded through getEvidence. */
  evidence?: SamplingEvidence;
};

export type SamplingRunSummary = Pick<
  SamplingRun,
  | "id"
  | "version"
  | "populationSize"
  | "marginOfError"
  | "unroundedResult"
  | "roundingRule"
  | "targetN"
  | "formulaVersion"
  | "stratumDefinitionVersion"
  | "algorithmVersion"
  | "status"
  | "createdAt"
  | "lockedAt"
  | "activatedAt"
  | "supersededAt"
  | "cancelledAt"
> & { allocationEvidence: AllocationRow[] };

export interface SamplingGateway {
  /** Reads trusted candidate rows for a snapshot/run. */
  getCandidates(id: string): Promise<SamplingCandidate[]>;
  /** Reads all eligible rows from an accepted current-workspace snapshot. */
  getPopulationCandidates(populationImportId: string): Promise<SamplingCandidate[]>;
  /** Reads the complete persisted evidence needed for a lock replay. */
  getEvidence?(runId: string): Promise<SamplingRun>;
  createDraft(input: SamplingDraftCommand): Promise<SamplingRun>;
  listRuns(): Promise<SamplingRunSummary[]>;
  lock(runId: string, expectedUpdatedAt: string): Promise<SamplingRun>;
  activate(runId: string): Promise<SamplingRun>;
  cancel(runId: string, reason: string): Promise<SamplingRun>;
}

export class SamplingGatewayError extends Error {
  constructor(readonly code: "CONFLICT" | "REPLAY_MISMATCH" | "UNAVAILABLE") {
    super("sampling gateway failed");
    this.name = "SamplingGatewayError";
  }
}

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const status = z.enum(["draft", "locked", "active", "superseded", "cancelled"]);
const canonicalDecimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const canonicalIntegerPattern = /^-?(?:0|[1-9]\d*)$/u;
const safeFiniteNumeric = (value: number): boolean =>
  Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));

function normalizedDecimal(value: string): string | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/u.exec(value);
  if (!match) return null;
  const sign = match[1] === "-" ? "-" : "";
  const integerPart = match[2];
  const fractionPart = match[3] ?? "";
  const exponent = Number(match[4] ?? "0");
  const digits = `${integerPart}${fractionPart}`;
  const decimalPosition = integerPart.length + exponent;
  let expanded: string;
  if (decimalPosition <= 0) {
    expanded = `0.${"0".repeat(-decimalPosition)}${digits}`;
  } else if (decimalPosition >= digits.length) {
    expanded = `${digits}${"0".repeat(decimalPosition - digits.length)}`;
  } else {
    expanded = `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }
  const [whole, fraction = ""] = expanded.split(".");
  const canonicalWhole = whole.replace(/^0+(?=\d)/u, "");
  const canonicalFraction = fraction.replace(/0+$/u, "");
  if (canonicalWhole === "0" && canonicalFraction.length === 0) return "0";
  return canonicalFraction.length === 0
    ? `${sign}${canonicalWhole}`
    : `${sign}${canonicalWhole}.${canonicalFraction}`;
}

const roundTripSafeDecimal = (value: string): boolean => {
  const numericValue = Number(value);
  return (
    safeFiniteNumeric(numericValue) &&
    normalizedDecimal(value) === normalizedDecimal(numericValue.toString())
  );
};

const numeric = z
  .union([
    z.number().refine(safeFiniteNumeric),
    z
      .string()
      .regex(canonicalDecimalPattern)
      .refine(roundTripSafeDecimal),
  ])
  .transform((value) => (typeof value === "string" ? Number(value) : value));
const integer = z
  .union([
    z.number().refine((value) => Number.isSafeInteger(value)),
    z
      .string()
      .regex(canonicalIntegerPattern)
      .refine((value) => Number.isSafeInteger(Number(value))),
  ])
  .transform((value) => (typeof value === "string" ? Number(value) : value));
const hash = z.string().regex(/^[0-9a-f]{64}$/u);

const allocationRowSchema = z.object({
  stratum_code: z.string().min(1),
  eligible_count: integer,
  quota: numeric,
  floor_allocation: integer,
  remainder: numeric,
  final_allocation: integer,
});

const selectedMemberSchema = z.object({
  member_id: uuid,
  stratum_code: z.string().min(1),
  selection_order: integer,
});

const resultEvidenceSchema = z.object({
  formula_version: z.literal("yamane-v1"),
  population_size: integer,
  margin_of_error: numeric,
  unrounded: numeric,
  rounding_rule: z.literal("ceil"),
  target_n: integer,
  seed_normalized: z.string(),
  seed_normalized_utf8_hex: z.string().regex(/^[0-9a-f]*$/u),
  seed_digest_hex: hash,
  seed_u32: integer,
  ordered_candidate_set_byte_stream_hex: z.string().regex(/^[0-9a-f]*$/u),
  ordered_candidate_set_hash: hash,
  initial_candidate_member_ids: z.array(uuid),
  swap_trace: z.array(z.object({ i: integer, j: integer })),
  shuffled_member_ids: z.array(uuid),
  ordered_selected_members: z.array(selectedMemberSchema),
  ordered_selected_member_ids: z.array(uuid),
});

const fullRunRowSchema = z.object({
  id: uuid,
  version: integer,
  population_import_id: uuid,
  population_size: integer,
  margin_of_error: numeric,
  unrounded_result: numeric,
  rounding_rule: z.literal("ceil"),
  target_n: integer,
  formula_version: z.literal("yamane-v1"),
  stratum_definition_version: z.string().min(1),
  seed_text: z.string().min(1),
  seed_normalized: z.string(),
  seed_normalized_utf8_hex: z.string().regex(/^[0-9a-f]*$/u),
  seed_digest_hex: hash,
  seed_u32: integer,
  algorithm_version: z.literal("sha256-mulberry32-fy-v1"),
  ordered_candidate_set_hash: hash,
  status,
  created_at: timestamp,
  updated_at: timestamp,
  locked_at: timestamp.nullable(),
  activated_at: timestamp.nullable(),
  superseded_at: timestamp.nullable(),
  cancelled_at: timestamp.nullable(),
  cancellation_reason_digest: hash.nullable(),
  allocation_evidence: z.array(allocationRowSchema),
  result_evidence: resultEvidenceSchema,
});

const listRunRowSchema = z.object({
  id: uuid,
  version: integer,
  population_size: integer,
  margin_of_error: numeric,
  unrounded_result: numeric,
  rounding_rule: z.literal("ceil"),
  target_n: integer,
  formula_version: z.literal("yamane-v1"),
  stratum_definition_version: z.string().min(1),
  algorithm_version: z.literal("sha256-mulberry32-fy-v1"),
  status,
  created_at: timestamp,
  locked_at: timestamp.nullable(),
  activated_at: timestamp.nullable(),
  superseded_at: timestamp.nullable(),
  cancelled_at: timestamp.nullable(),
  allocation_evidence: z.array(allocationRowSchema),
});

const candidateRowSchema = z.object({
  population_member_id: uuid,
  farmer_code: z.string().min(1),
  stratum_code: z.string().min(1),
});

type FullRunRow = z.infer<typeof fullRunRowSchema>;
type ResultEvidenceRow = z.infer<typeof resultEvidenceSchema>;

function rpcFailure(error: { code?: string } | null): never {
  if (error?.code === "23505" || error?.code === "40001" || error?.code === "42501") {
    throw new SamplingGatewayError("CONFLICT");
  }
  if (error?.code === "22023") {
    throw new SamplingGatewayError("REPLAY_MISMATCH");
  }
  throw new SamplingGatewayError("UNAVAILABLE");
}

function malformed(): never {
  throw new SamplingGatewayError("UNAVAILABLE");
}

function mapAllocation(row: z.infer<typeof allocationRowSchema>): AllocationRow {
  return {
    stratumCode: row.stratum_code,
    eligibleCount: row.eligible_count,
    quota: row.quota,
    floorAllocation: row.floor_allocation,
    remainder: row.remainder,
    finalAllocation: row.final_allocation,
  };
}

function mapResultEvidence(
  row: ResultEvidenceRow,
  run: Pick<FullRunRow, "algorithm_version" | "seed_text" | "stratum_definition_version" | "population_import_id" | "allocation_evidence">,
): SamplingEvidence {
  const allocationRows = run.allocation_evidence.map(mapAllocation);
  return {
    algorithmVersion: run.algorithm_version,
    formulaVersion: row.formula_version,
    formula: {
      populationSize: row.population_size,
      marginOfError: row.margin_of_error,
      unrounded: row.unrounded,
      roundingRule: row.rounding_rule,
      targetN: row.target_n,
    },
    populationSize: row.population_size,
    marginOfError: row.margin_of_error,
    unrounded: row.unrounded,
    roundingRule: row.rounding_rule,
    targetN: row.target_n,
    seedText: run.seed_text,
    seedNormalized: row.seed_normalized,
    seedNormalizedUtf8Hex: row.seed_normalized_utf8_hex,
    seedDigestHex: row.seed_digest_hex,
    seedU32: row.seed_u32,
    orderedCandidateSetByteStreamHex: row.ordered_candidate_set_byte_stream_hex,
    orderedCandidateSetHash: row.ordered_candidate_set_hash,
    initialCandidateMemberIds: row.initial_candidate_member_ids,
    swapTrace: row.swap_trace as SwapTraceRow[],
    shuffledMemberIds: row.shuffled_member_ids,
    allocationRows,
    orderedSelectedMembers: row.ordered_selected_members.map((member) => ({
      memberId: member.member_id,
      stratumCode: member.stratum_code,
      selectionOrder: member.selection_order,
    })),
    orderedSelectedMemberIds: row.ordered_selected_member_ids,
  };
}

function mapFullRun(row: unknown): SamplingRun {
  const parsed = fullRunRowSchema.safeParse(row);
  if (!parsed.success) return malformed();
  const value = parsed.data;
  return {
    id: value.id,
    version: value.version,
    populationImportId: value.population_import_id,
    populationSize: value.population_size,
    marginOfError: value.margin_of_error,
    unroundedResult: value.unrounded_result,
    roundingRule: value.rounding_rule,
    targetN: value.target_n,
    formulaVersion: value.formula_version,
    stratumDefinitionVersion: value.stratum_definition_version,
    seedText: value.seed_text,
    seedNormalized: value.seed_normalized,
    seedNormalizedUtf8Hex: value.seed_normalized_utf8_hex,
    seedDigestHex: value.seed_digest_hex,
    seedU32: value.seed_u32,
    algorithmVersion: value.algorithm_version,
    orderedCandidateSetHash: value.ordered_candidate_set_hash,
    status: value.status,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    lockedAt: value.locked_at,
    activatedAt: value.activated_at,
    supersededAt: value.superseded_at,
    cancelledAt: value.cancelled_at,
    cancellationReasonDigest: value.cancellation_reason_digest,
    allocationEvidence: value.allocation_evidence.map(mapAllocation),
    resultEvidence: mapResultEvidence(value.result_evidence, value),
  };
}

function mapListRun(row: unknown): SamplingRunSummary {
  const parsed = listRunRowSchema.safeParse(row);
  if (!parsed.success) return malformed();
  const value = parsed.data;
  return {
    id: value.id,
    version: value.version,
    populationSize: value.population_size,
    marginOfError: value.margin_of_error,
    unroundedResult: value.unrounded_result,
    roundingRule: value.rounding_rule,
    targetN: value.target_n,
    formulaVersion: value.formula_version,
    stratumDefinitionVersion: value.stratum_definition_version,
    algorithmVersion: value.algorithm_version,
    status: value.status,
    createdAt: value.created_at,
    lockedAt: value.locked_at,
    activatedAt: value.activated_at,
    supersededAt: value.superseded_at,
    cancelledAt: value.cancelled_at,
    allocationEvidence: value.allocation_evidence.map(mapAllocation),
  };
}

function mapCandidates(rows: unknown): SamplingCandidate[] {
  const parsed = z.array(candidateRowSchema).safeParse(rows);
  if (!parsed.success) return malformed();
  return parsed.data.map((row) => ({
    memberId: row.population_member_id,
    farmerCode: row.farmer_code,
    stratumCode: row.stratum_code,
  }));
}

function allocationPayload(evidence: SamplingEvidence) {
  return evidence.allocationRows.map((row) => ({
    stratum_code: row.stratumCode,
    eligible_count: row.eligibleCount,
    quota: row.quota,
    floor_allocation: row.floorAllocation,
    remainder: row.remainder,
    final_allocation: row.finalAllocation,
  }));
}

function resultPayload(evidence: SamplingEvidence) {
  return {
    formula_version: evidence.formulaVersion,
    population_size: evidence.populationSize,
    margin_of_error: evidence.marginOfError,
    unrounded: evidence.unrounded,
    rounding_rule: evidence.roundingRule,
    target_n: evidence.targetN,
    seed_normalized: evidence.seedNormalized,
    seed_normalized_utf8_hex: evidence.seedNormalizedUtf8Hex,
    seed_digest_hex: evidence.seedDigestHex,
    seed_u32: evidence.seedU32,
    ordered_candidate_set_byte_stream_hex: evidence.orderedCandidateSetByteStreamHex,
    ordered_candidate_set_hash: evidence.orderedCandidateSetHash,
    initial_candidate_member_ids: evidence.initialCandidateMemberIds,
    swap_trace: evidence.swapTrace,
    shuffled_member_ids: evidence.shuffledMemberIds,
    ordered_selected_members: evidence.orderedSelectedMembers.map((member) => ({
      member_id: member.memberId,
      stratum_code: member.stratumCode,
      selection_order: member.selectionOrder,
    })),
    ordered_selected_member_ids: evidence.orderedSelectedMemberIds,
  };
}

type RpcClient = Pick<SupabaseClient, "rpc">;

async function singleRpc(client: RpcClient, name: string, args: Record<string, unknown>) {
  try {
    const response = await client.rpc(name, args).single();
    if (response.error) rpcFailure(response.error);
    return response.data;
  } catch (error) {
    if (error instanceof SamplingGatewayError) throw error;
    return rpcFailure(null);
  }
}

async function listRpc(client: RpcClient, name: string, args?: Record<string, unknown>) {
  try {
    const response = await client.rpc(name, args);
    if (response.error) rpcFailure(response.error);
    return response.data;
  } catch (error) {
    if (error instanceof SamplingGatewayError) throw error;
    return rpcFailure(null);
  }
}

export function createSupabaseSamplingGateway(client: RpcClient): SamplingGateway {
  return {
    async getCandidates(id) {
      return mapCandidates(await listRpc(client, "get_sampling_candidates", { p_run_id: id }));
    },
    async getPopulationCandidates(populationImportId) {
      return mapCandidates(
        await listRpc(client, "get_sampling_population_candidates", {
          p_population_import_id: populationImportId,
        }),
      );
    },
    async getEvidence(runId) {
      const run = mapFullRun(
        await singleRpc(client, "get_sampling_run_evidence", { p_run_id: runId }),
      );
      if (!run.resultEvidence) return malformed();
      return { ...run, evidence: run.resultEvidence };
    },
    async createDraft(input) {
      return mapFullRun(
        await singleRpc(client, "create_sampling_draft", {
          p_population_import_id: input.populationImportId,
          p_seed_text: input.evidence.seedText,
          p_margin_of_error: input.evidence.marginOfError,
          p_stratum_definition_version: input.stratumDefinitionVersion,
          p_algorithm_version: input.evidence.algorithmVersion,
          p_target_n: input.evidence.targetN,
          p_ordered_candidate_set_hash: input.evidence.orderedCandidateSetHash,
          p_allocation_evidence: allocationPayload(input.evidence),
          p_result_evidence: resultPayload(input.evidence),
          p_idempotency_key: input.idempotencyKey,
        }),
      );
    },
    async listRuns() {
      const rows = await listRpc(client, "list_sampling_runs");
      const parsed = z.array(listRunRowSchema).safeParse(rows);
      if (!parsed.success) return malformed();
      return parsed.data.map(mapListRun);
    },
    async lock(runId, expectedUpdatedAt) {
      return mapFullRun(
        await singleRpc(client, "lock_sampling_run", {
          p_run_id: runId,
          p_expected_updated_at: expectedUpdatedAt,
        }),
      );
    },
    async activate(runId) {
      return mapFullRun(await singleRpc(client, "activate_sampling_run", { p_run_id: runId }));
    },
    async cancel(runId, reason) {
      return mapFullRun(
        await singleRpc(client, "cancel_sampling_run", {
          p_run_id: runId,
          p_reason: reason,
        }),
      );
    },
  };
}
