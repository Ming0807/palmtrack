import { describe, expect, it, vi } from "vitest";

import type { Role } from "@/modules/identity/domain/roles";
import type { IdentitySession } from "@/modules/identity/server/session";
import type {
  SamplingGateway,
  SamplingRunReceipt,
} from "@/modules/research/population/server/sampling-gateway";
import { SamplingGatewayError } from "@/modules/research/population/server/sampling-gateway";
import {
  activateSamplingRun,
  cancelSamplingRun,
  createSamplingDraft,
  listSamplingRuns,
  lockSamplingRun,
} from "@/modules/research/population/server/sampling-service";

const receipt: SamplingRunReceipt = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  populationImportId: "22222222-2222-4222-8222-222222222222",
  populationSize: 2,
  targetN: 2,
  status: "draft",
  seedDigestHex: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  candidateHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  lockedAt: null,
};

function session(role: Role): IdentitySession {
  return {
    status: "authorized",
    userId: "user-1",
    profile: { id: "33333333-3333-4333-8333-333333333333", workspaceId: "workspace-1", role },
  };
}

function setup(role: Role = "research_manager") {
  const gateway: SamplingGateway = {
    draft: vi.fn().mockResolvedValue(receipt),
    lock: vi.fn().mockResolvedValue({ ...receipt, status: "locked" as const, lockedAt: "2026-08-26T12:00:00.000Z" }),
    activate: vi.fn().mockResolvedValue({ ...receipt, status: "active" as const }),
    cancel: vi.fn().mockResolvedValue({ ...receipt, status: "cancelled" as const }),
    list: vi.fn().mockResolvedValue([receipt]),
    listPopulationMembers: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({
      ...receipt,
      marginOfError: 0.05,
      formulaVersion: "yamane-v1",
      seedText: "palmtrack-acceptance-seed-v1",
      seedNormalized: "palmtrack-acceptance-seed-v1",
      seedU32: 0,
      algorithmVersion: "sha256-mulberry32-fy-v1",
      allocations: [{ stratumCode: "NORTH", finalAllocation: 2 }],
      cancelReason: null,
      createdAt: "2026-08-26T11:00:00.000Z",
    }),
    listMembers: vi.fn().mockResolvedValue([]),
  };
  return { session: session(role), gateway };
}

const validInput = {
  populationImportId: receipt.populationImportId,
  marginOfError: 0.05,
  seedText: "palmtrack-acceptance-seed-v1",
  seedNormalized: "palmtrack-acceptance-seed-v1",
  seedDigestHex: receipt.seedDigestHex,
  seedU32: 0,
  candidateHash: receipt.candidateHash,
  allocations: [
    { stratumCode: "NORTH", finalAllocation: 1 },
    { stratumCode: "SOUTH", finalAllocation: 1 },
  ],
  members: [
    {
      populationMemberId: "44444444-4444-4434-8444-444444444444",
      stratumCode: "NORTH",
      selectionOrder: 1,
    },
    {
      populationMemberId: "55555555-5555-4535-8555-555555555555",
      stratumCode: "SOUTH",
      selectionOrder: 2,
    },
  ],
};

describe("sampling service", () => {
  it("[INT-02] allows research_manager through the gateway", async () => {
    const deps = setup("research_manager");
    await expect(createSamplingDraft(validInput, deps)).resolves.toMatchObject({
      status: "draft",
      runId: receipt.id,
    });
    expect(deps.gateway.draft).toHaveBeenCalledTimes(1);
  });

  it.each(["admin", "field_collector", "farmer", "evaluator_readonly"] as const)(
    "[RLS-09] denies %s before gateway access",
    async (role) => {
      const deps = setup(role);
      await expect(createSamplingDraft(validInput, deps)).resolves.toEqual({ status: "forbidden" });
      expect(deps.gateway.draft).not.toHaveBeenCalled();
    },
  );

  it("[INT-02] rejects mismatched allocation evidence without persistence", async () => {
    const deps = setup("research_manager");
    await expect(
      createSamplingDraft(
        { ...validInput, allocations: [{ stratumCode: "NORTH", finalAllocation: 1 }] },
        deps,
      ),
    ).resolves.toMatchObject({ status: "invalid" });
    expect(deps.gateway.draft).not.toHaveBeenCalled();
  });

  it("[INT-02] locks, activates and cancels through exact transitions", async () => {
    const deps = setup("research_manager");
    await expect(
      lockSamplingRun(receipt.id, { candidateHash: receipt.candidateHash, seedDigestHex: receipt.seedDigestHex }, deps),
    ).resolves.toMatchObject({ status: "locked" });
    await expect(activateSamplingRun(receipt.id, deps)).resolves.toMatchObject({ status: "active" });
    await expect(cancelSamplingRun(receipt.id, "ยุติรอบทดสอบสังเคราะห์", deps)).resolves.toMatchObject({
      status: "cancelled",
    });
  });

  it("[INT-02] maps gateway conflicts without provider detail", async () => {
    const deps = setup("research_manager");
    deps.gateway.draft = vi.fn().mockRejectedValue(new SamplingGatewayError("CONFLICT"));
    await expect(createSamplingDraft(validInput, deps)).resolves.toEqual({ status: "conflict" });
  });

  it("[INT-02] lists runs for admin, manager and evaluator only", async () => {
    await expect(listSamplingRuns(setup("admin"))).resolves.toMatchObject({ status: "ready" });
    await expect(listSamplingRuns(setup("evaluator_readonly"))).resolves.toMatchObject({ status: "ready" });
    await expect(listSamplingRuns(setup("field_collector"))).resolves.toEqual({ status: "forbidden" });
  });
});
