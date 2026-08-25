import { describe, expect, it, vi } from "vitest";

import type { Role } from "@/modules/identity/domain/roles";
import type { IdentitySession } from "@/modules/identity/server/session";
import { FX_POPULATION_CSV } from "@/modules/research/population/domain/fixtures";
import {
  PopulationGatewayError,
  type PopulationGateway,
  type PopulationReceipt,
} from "@/modules/research/population/server/population-gateway";
import {
  acceptPopulationImport,
  createPopulationImport,
  listPopulationImports,
} from "@/modules/research/population/server/population-service";

const receipt: PopulationReceipt = {
  id: "11111111-1111-4111-8111-111111111111",
  sourceLabel: "บัญชีสังเคราะห์รอบ 1",
  sourceAuthorizationRef: "SYN-AUTH_001",
  referenceDate: "2026-08-25",
  schemaVersion: "synthetic-population-v1",
  eligibilityRuleVersion: "synthetic-eligibility-v1",
  inputDigest: "eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b",
  totalCount: 3,
  eligibleCount: 2,
  excludedCount: 1,
  status: "validated",
  createdByProfileId: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-08-25T12:00:00.000Z",
  acceptedByProfileId: null,
  acceptedAt: null,
};

function session(role: Role): IdentitySession {
  return {
    status: "authorized",
    userId: "user-1",
    profile: { id: receipt.createdByProfileId, workspaceId: "workspace-1", role },
  };
}

function setup(role: Role = "admin") {
  const gateway: PopulationGateway = {
    create: vi.fn().mockResolvedValue(receipt),
    accept: vi.fn().mockResolvedValue({
      ...receipt,
      status: "accepted",
      acceptedByProfileId: receipt.createdByProfileId,
      acceptedAt: "2026-08-25T13:00:00.000Z",
    }),
    list: vi.fn().mockResolvedValue([receipt]),
  };
  return { session: session(role), gateway };
}

const validInput = {
  fileBytes: new TextEncoder().encode(FX_POPULATION_CSV),
  sourceLabel: "บัญชีสังเคราะห์รอบ 1",
  sourceAuthorizationRef: "SYN-AUTH_001",
  referenceDate: "2026-08-25",
  idempotencyKey: "33333333-3333-4333-8333-333333333333",
};

describe("population service", () => {
  it.each(["admin", "research_manager"] as const)(
    "[INT-01] allows %s through the gateway",
    async (role) => {
      const deps = setup(role);
      await expect(createPopulationImport(validInput, deps)).resolves.toMatchObject({
        status: "validated",
        importId: receipt.id,
      });
      expect(deps.gateway.create).toHaveBeenCalledWith(
        expect.objectContaining({ digest: receipt.inputDigest, rows: expect.any(Array) }),
      );
    },
  );

  it.each(["field_collector", "farmer", "evaluator_readonly"] as const)(
    "[RLS-09] denies %s before gateway access",
    async (role) => {
      const deps = setup(role);
      await expect(createPopulationImport(validInput, deps)).resolves.toEqual({
        status: "forbidden",
      });
      expect(deps.gateway.create).not.toHaveBeenCalled();
    },
  );

  it("rejects strict metadata and invalid CSV before persistence", async () => {
    const deps = setup();
    await expect(
      createPopulationImport({ ...validInput, sourceAuthorizationRef: "real-list" }, deps),
    ).resolves.toMatchObject({ status: "invalid" });
    await expect(
      createPopulationImport({ ...validInput, fileBytes: new Uint8Array() }, deps),
    ).resolves.toMatchObject({ status: "invalid" });
    expect(deps.gateway.create).not.toHaveBeenCalled();
  });

  it("maps only known provider conflicts and suppresses raw messages", async () => {
    const conflict = setup();
    vi.mocked(conflict.gateway.create).mockRejectedValue(
      new PopulationGatewayError("CONFLICT"),
    );
    await expect(createPopulationImport(validInput, conflict)).resolves.toEqual({
      status: "conflict",
    });

    const unavailable = setup();
    vi.mocked(unavailable.gateway.create).mockRejectedValue(
      new Error("postgresql://secret raw csv SYN-001"),
    );
    const state = await createPopulationImport(validInput, unavailable);
    expect(state).toEqual({ status: "service_unavailable" });
    expect(JSON.stringify(state)).not.toMatch(/postgres|SYN-001|secret/u);
  });

  it("accepts and lists only for an authorized research role", async () => {
    const deps = setup("research_manager");
    await expect(acceptPopulationImport(receipt.id, deps)).resolves.toMatchObject({
      status: "accepted",
    });
    await expect(listPopulationImports(deps)).resolves.toEqual({
      status: "ready",
      imports: [receipt],
    });
  });

  it("rejects malformed acceptance ids without gateway access", async () => {
    const deps = setup();
    await expect(acceptPopulationImport("not-an-id", deps)).resolves.toEqual({
      status: "conflict",
    });
    expect(deps.gateway.accept).not.toHaveBeenCalled();
  });
});
