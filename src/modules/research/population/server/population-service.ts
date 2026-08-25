import { z } from "zod";

import type { IdentitySession } from "@/modules/identity/server/session";
import {
  POPULATION_SCHEMA_VERSION,
  validatePopulationCsv,
  type PopulationValidationError,
} from "@/modules/research/population/domain/population-import";
import {
  PopulationGatewayError,
  type PopulationGateway,
  type PopulationReceipt,
} from "@/modules/research/population/server/population-gateway";

export type PopulationActionState =
  | { status: "idle" }
  | { status: "invalid"; errors: PopulationValidationError[] }
  | { status: "forbidden" }
  | { status: "conflict" }
  | { status: "service_unavailable" }
  | { status: "validated"; importId: string; receipt: PopulationReceipt }
  | { status: "accepted"; importId: string; receipt: PopulationReceipt };

export type PopulationListState =
  | { status: "ready"; imports: PopulationReceipt[] }
  | { status: "forbidden" }
  | { status: "service_unavailable" };

type Dependencies = { session: IdentitySession; gateway: PopulationGateway };

const metadataSchema = z.object({
  sourceLabel: z.string().trim().min(1).max(120),
  sourceAuthorizationRef: z.string().regex(/^SYN-[A-Z0-9_-]{3,40}$/u),
  referenceDate: z.iso.date(),
  idempotencyKey: z.uuid(),
});

function canManagePopulation(session: IdentitySession): boolean {
  return (
    session.status === "authorized" &&
    (session.profile.role === "admin" ||
      session.profile.role === "research_manager")
  );
}

function gatewayFailure(error: unknown): PopulationActionState {
  return error instanceof PopulationGatewayError && error.code === "CONFLICT"
    ? { status: "conflict" }
    : { status: "service_unavailable" };
}

export async function createPopulationImport(
  input: {
    fileBytes: Uint8Array;
    sourceLabel: string;
    sourceAuthorizationRef: string;
    referenceDate: string;
    idempotencyKey: string;
  },
  deps: Dependencies,
): Promise<PopulationActionState> {
  if (!canManagePopulation(deps.session)) return { status: "forbidden" };

  const metadata = metadataSchema.safeParse(input);
  if (!metadata.success) {
    return {
      status: "invalid",
      errors: [
        { rowNumber: null, fieldCode: "file", reasonCode: "INVALID_METADATA" },
      ],
    };
  }

  const validation = await validatePopulationCsv(input.fileBytes);
  if (validation.status === "invalid") return validation;

  try {
    const receipt = await deps.gateway.create({
      ...metadata.data,
      schemaVersion: POPULATION_SCHEMA_VERSION,
      eligibilityRuleVersion: "synthetic-eligibility-v1",
      digest: validation.digest,
      rows: validation.rows,
    });
    return { status: "validated", importId: receipt.id, receipt };
  } catch (error) {
    return gatewayFailure(error);
  }
}

export async function acceptPopulationImport(
  importId: string,
  deps: Dependencies,
): Promise<PopulationActionState> {
  if (!canManagePopulation(deps.session)) return { status: "forbidden" };
  if (!z.uuid().safeParse(importId).success) return { status: "conflict" };
  try {
    const receipt = await deps.gateway.accept(importId);
    return { status: "accepted", importId: receipt.id, receipt };
  } catch (error) {
    return gatewayFailure(error);
  }
}

export async function listPopulationImports(
  deps: Dependencies,
): Promise<PopulationListState> {
  if (!canManagePopulation(deps.session)) return { status: "forbidden" };
  try {
    return { status: "ready", imports: await deps.gateway.list() };
  } catch {
    return { status: "service_unavailable" };
  }
}
