import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  POPULATION_SCHEMA_VERSION,
  type PopulationRow,
} from "@/modules/research/population/domain/population-import";

export type PopulationReceipt = {
  id: string;
  sourceLabel: string;
  sourceAuthorizationRef: string;
  referenceDate: string;
  schemaVersion: typeof POPULATION_SCHEMA_VERSION;
  eligibilityRuleVersion: "synthetic-eligibility-v1";
  inputDigest: string;
  totalCount: number;
  eligibleCount: number;
  excludedCount: number;
  status: "validated" | "accepted";
  createdByProfileId: string;
  createdAt: string;
  acceptedByProfileId: string | null;
  acceptedAt: string | null;
};

export interface PopulationGateway {
  create(input: {
    sourceLabel: string;
    sourceAuthorizationRef: string;
    referenceDate: string;
    schemaVersion: typeof POPULATION_SCHEMA_VERSION;
    eligibilityRuleVersion: "synthetic-eligibility-v1";
    digest: string;
    rows: PopulationRow[];
    idempotencyKey: string;
  }): Promise<PopulationReceipt>;
  accept(importId: string): Promise<PopulationReceipt>;
  list(): Promise<PopulationReceipt[]>;
}

export class PopulationGatewayError extends Error {
  constructor(readonly code: "CONFLICT" | "UNAVAILABLE") {
    super("population gateway failed");
    this.name = "PopulationGatewayError";
  }
}

const receiptRowSchema = z.object({
  id: z.uuid(),
  source_label: z.string().min(1).max(120),
  source_authorization_ref: z.string().regex(/^SYN-[A-Z0-9_-]{3,40}$/u),
  reference_date: z.iso.date(),
  schema_version: z.literal(POPULATION_SCHEMA_VERSION),
  eligibility_rule_version: z.literal("synthetic-eligibility-v1"),
  input_digest: z.string().regex(/^[0-9a-f]{64}$/u),
  total_count: z.number().int().positive(),
  eligible_count: z.number().int().nonnegative(),
  excluded_count: z.number().int().nonnegative(),
  status: z.enum(["validated", "accepted"]),
  created_by_profile_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  accepted_by_profile_id: z.uuid().nullable(),
  accepted_at: z.iso.datetime({ offset: true }).nullable(),
});

function mapReceipt(row: z.infer<typeof receiptRowSchema>): PopulationReceipt {
  return {
    id: row.id,
    sourceLabel: row.source_label,
    sourceAuthorizationRef: row.source_authorization_ref,
    referenceDate: row.reference_date,
    schemaVersion: row.schema_version,
    eligibilityRuleVersion: row.eligibility_rule_version,
    inputDigest: row.input_digest,
    totalCount: row.total_count,
    eligibleCount: row.eligible_count,
    excludedCount: row.excluded_count,
    status: row.status,
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
    acceptedByProfileId: row.accepted_by_profile_id,
    acceptedAt: row.accepted_at,
  };
}

function rpcError(error: { code?: string } | null): never {
  throw new PopulationGatewayError(
    error?.code === "23505" || error?.code === "40001"
      ? "CONFLICT"
      : "UNAVAILABLE",
  );
}

export function createSupabasePopulationGateway(
  client: Pick<SupabaseClient, "rpc">,
): PopulationGateway {
  return {
    async create(input) {
      const response = await client
        .rpc("create_population_import", {
          p_source_label: input.sourceLabel,
          p_source_authorization_ref: input.sourceAuthorizationRef,
          p_reference_date: input.referenceDate,
          p_schema_version: input.schemaVersion,
          p_eligibility_rule_version: input.eligibilityRuleVersion,
          p_input_digest: input.digest,
          p_rows: input.rows.map((row) => ({
            row_number: row.rowNumber,
            farmer_code: row.farmerCode,
            stratum_code: row.stratumCode,
            eligible: row.eligible,
            exclusion_reason_code: row.exclusionReasonCode,
          })),
          p_idempotency_key: input.idempotencyKey,
        })
        .single();
      if (response.error) rpcError(response.error);
      const parsed = receiptRowSchema.safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return mapReceipt(parsed.data);
    },
    async accept(importId) {
      const response = await client
        .rpc("accept_population_import", { p_import_id: importId })
        .single();
      if (response.error) rpcError(response.error);
      const parsed = receiptRowSchema.safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return mapReceipt(parsed.data);
    },
    async list() {
      const response = await client.rpc("list_population_imports");
      if (response.error) rpcError(response.error);
      const parsed = z.array(receiptRowSchema).safeParse(response.data);
      if (!parsed.success) rpcError(null);
      return parsed.data.map(mapReceipt);
    },
  };
}
