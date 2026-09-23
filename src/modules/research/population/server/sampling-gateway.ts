import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SAMPLING_ALGORITHM_VERSION } from "@/modules/research/population/domain/sampling-deterministic";
import { YAMANE_FORMULA_VERSION } from "@/modules/research/population/domain/sampling-yamane";

export type SamplingRunStatus = "draft" | "locked" | "active" | "superseded" | "cancelled";

export type SamplingRunReceipt = {
  id: string;
  version: number;
  populationImportId: string;
  populationSize: number;
  targetN: number;
  status: SamplingRunStatus;
  seedDigestHex: string;
  candidateHash: string;
  lockedAt: string | null;
};

export type SamplingRunDetail = SamplingRunReceipt & {
  marginOfError: number;
  formulaVersion: "yamane-v1";
  seedText: string;
  seedNormalized: string;
  seedU32: number;
  algorithmVersion: "sha256-mulberry32-fy-v1";
  allocations: { stratumCode: string; finalAllocation: number }[];
  cancelReason: string | null;
  createdAt: string;
};

export type SamplingMember = {
  populationMemberId: string;
  farmerCode: string;
  stratumCode: string;
  selectionOrder: number;
};

export type SamplingDraftInput = {
  populationImportId: string;
  marginOfError: number;
  seedText: string;
  seedNormalized: string;
  seedDigestHex: string;
  seedU32: number;
  candidateHash: string;
  allocations: { stratumCode: string; finalAllocation: number }[];
  members: { populationMemberId: string; stratumCode: string; selectionOrder: number }[];
};

export interface SamplingGateway {
  draft(input: SamplingDraftInput): Promise<SamplingRunReceipt>;
  lock(runId: string, candidateHash: string, seedDigestHex: string): Promise<SamplingRunReceipt>;
  activate(runId: string): Promise<SamplingRunReceipt>;
  cancel(runId: string, reason: string): Promise<SamplingRunReceipt>;
  list(): Promise<SamplingRunReceipt[]>;
  get(runId: string): Promise<SamplingRunDetail>;
  listMembers(runId: string): Promise<SamplingMember[]>;
  listPopulationMembers(importId: string): Promise<PopulationSnapshotMember[]>;
}

export type PopulationSnapshotMember = {
  id: string;
  rowNumber: number;
  farmerCode: string;
  stratumCode: string;
  eligible: boolean;
};

export class SamplingGatewayError extends Error {
  constructor(readonly code: "CONFLICT" | "UNAVAILABLE") {
    super("sampling gateway failed");
    this.name = "SamplingGatewayError";
  }
}

const runRowSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  population_import_id: z.uuid(),
  population_size: z.number().int().positive(),
  target_n: z.number().int().positive(),
  status: z.enum(["draft", "locked", "active", "superseded", "cancelled"]),
  seed_digest_hex: z.string().regex(/^[0-9a-f]{64}$/u),
  ordered_candidate_set_hash: z.string().regex(/^[0-9a-f]{64}$/u),
  locked_at: z.iso.datetime({ offset: true }).nullable(),
});

const detailRowSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  population_import_id: z.uuid(),
  population_size: z.number().int().positive(),
  margin_of_error: z.number().gt(0).lt(1),
  target_n: z.number().int().positive(),
  formula_version: z.literal("yamane-v1"),
  seed_text: z.string().min(1).max(200),
  seed_normalized: z.string().min(1).max(200),
  seed_digest_hex: z.string().regex(/^[0-9a-f]{64}$/u),
  seed_u32: z.number().int().min(0).max(4294967295),
  algorithm_version: z.literal("sha256-mulberry32-fy-v1"),
  ordered_candidate_set_hash: z.string().regex(/^[0-9a-f]{64}$/u),
  allocation: z.array(
    z.object({
      stratum_code: z.string().regex(/^[A-Z0-9_-]{1,24}$/u),
      final_allocation: z.number().int().positive(),
    }),
  ),
  status: z.enum(["draft", "locked", "active", "superseded", "cancelled"]),
  locked_at: z.iso.datetime({ offset: true }).nullable(),
  cancel_reason: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

const snapshotMemberRowSchema = z.object({
  id: z.uuid(),
  row_number: z.number().int().positive(),
  farmer_code: z.string().regex(/^SYN-[0-9]{3,6}$/u),
  stratum_code: z.string().regex(/^[A-Z0-9_-]{1,24}$/u),
  eligible: z.boolean(),
});

const memberRowSchema = z.object({
  population_member_id: z.uuid(),
  farmer_code: z.string().regex(/^SYN-[0-9]{3,6}$/u),
  stratum_code: z.string().regex(/^[A-Z0-9_-]{1,24}$/u),
  selection_order: z.number().int().positive(),
});

function mapDetail(row: z.infer<typeof detailRowSchema>): SamplingRunDetail {
  return {
    id: row.id,
    version: row.version,
    populationImportId: row.population_import_id,
    populationSize: row.population_size,
    targetN: row.target_n,
    status: row.status,
    seedDigestHex: row.seed_digest_hex,
    candidateHash: row.ordered_candidate_set_hash,
    lockedAt: row.locked_at,
    marginOfError: row.margin_of_error,
    formulaVersion: row.formula_version,
    seedText: row.seed_text,
    seedNormalized: row.seed_normalized,
    seedU32: row.seed_u32,
    algorithmVersion: row.algorithm_version,
    allocations: row.allocation.map((item) => ({
      stratumCode: item.stratum_code,
      finalAllocation: item.final_allocation,
    })),
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
  };
}

function mapRun(row: z.infer<typeof runRowSchema>): SamplingRunReceipt {
  return {
    id: row.id,
    version: row.version,
    populationImportId: row.population_import_id,
    populationSize: row.population_size,
    targetN: row.target_n,
    status: row.status,
    seedDigestHex: row.seed_digest_hex,
    candidateHash: row.ordered_candidate_set_hash,
    lockedAt: row.locked_at,
  };
}

function rpcError(error: { code?: string } | null): never {
  throw new SamplingGatewayError(
    error?.code === "23505" || error?.code === "40001" ? "CONFLICT" : "UNAVAILABLE",
  );
}

export function createSupabaseSamplingGateway(
  client: Pick<SupabaseClient, "rpc">,
): SamplingGateway {
  return {
    async draft(input) {
      const response = await client.rpc("create_sampling_draft", {
        p_population_import_id: input.populationImportId,
        p_margin_of_error: input.marginOfError,
        p_seed_text: input.seedText,
        p_seed_normalized: input.seedNormalized,
        p_seed_digest_hex: input.seedDigestHex,
        p_seed_u32: input.seedU32,
        p_candidate_hash: input.candidateHash,
        p_allocations: input.allocations.map((item) => ({
          stratum_code: item.stratumCode,
          final_allocation: item.finalAllocation,
        })),
        p_members: input.members.map((item) => ({
          population_member_id: item.populationMemberId,
          stratum_code: item.stratumCode,
          selection_order: item.selectionOrder,
        })),
      }).single();
      if (response.error) rpcError(response.error);
      const draftParsed = runRowSchema.safeParse(response.data);
      if (!draftParsed.success) rpcError(null);
      return mapRun(draftParsed.data);
    },
    async lock(runId, candidateHash, seedDigestHex) {
      const response = await client.rpc("lock_sampling_run", {
        p_run_id: runId,
        p_candidate_hash: candidateHash,
        p_seed_digest_hex: seedDigestHex,
      }).single();
      if (response.error) rpcError(response.error);
      const parsed = runRowSchema.safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return mapRun(parsed.data);
    },
    async activate(runId) {
      const response = await client.rpc("activate_sampling_run", { p_run_id: runId }).single();
      if (response.error) rpcError(response.error);
      const parsed = runRowSchema.safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return mapRun(parsed.data);
    },
    async cancel(runId, reason) {
      const response = await client.rpc("cancel_sampling_run", {
        p_run_id: runId,
        p_reason: reason,
      }).single();
      if (response.error) rpcError(response.error);
      const parsed = runRowSchema.safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return mapRun(parsed.data);
    },
    async list() {
      const response = await client.rpc("list_sampling_runs");
      if (response.error) rpcError(response.error);
      const parsed = z.array(runRowSchema).safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return parsed.data.map(mapRun);
    },
    async get(runId) {
      const response = await client.rpc("get_sampling_run", { p_run_id: runId }).single();
      if (response.error) rpcError(response.error);
      const parsed = detailRowSchema.safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return mapDetail(parsed.data);
    },
    async listMembers(runId) {
      const response = await client.rpc("list_sampling_members", { p_run_id: runId });
      if (response.error) rpcError(response.error);
      const parsed = z.array(memberRowSchema).safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return parsed.data.map((row) => ({
        populationMemberId: row.population_member_id,
        farmerCode: row.farmer_code,
        stratumCode: row.stratum_code,
        selectionOrder: row.selection_order,
      }));
    },
    async listPopulationMembers(importId) {
      const response = await client.rpc("list_population_members", { p_import_id: importId });
      if (response.error) rpcError(response.error);
      const parsed = z.array(snapshotMemberRowSchema).safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return parsed.data.map((row) => ({
        id: row.id,
        rowNumber: row.row_number,
        farmerCode: row.farmer_code,
        stratumCode: row.stratum_code,
        eligible: row.eligible,
      }));
    },
  };
}

export const SAMPLING_EVIDENCE_CONTRACT = {
  algorithmVersion: SAMPLING_ALGORITHM_VERSION,
  formulaVersion: YAMANE_FORMULA_VERSION,
} as const;
