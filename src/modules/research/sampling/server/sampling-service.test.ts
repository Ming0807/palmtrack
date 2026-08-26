import { describe, expect, it, vi } from "vitest";

import type { Role } from "@/modules/identity/domain/roles";
import type { IdentitySession } from "@/modules/identity/server/session";
import {
  buildSamplingEvidence,
  type SamplingEvidence,
} from "@/modules/research/sampling/domain/deterministic-sampling";
import {
  SamplingGatewayError,
  type SamplingGateway,
  type SamplingRun,
} from "@/modules/research/sampling/server/sampling-gateway";
import {
  activateSamplingRun,
  cancelSamplingRun,
  createSamplingDraft,
  listSamplingRuns,
  lockSamplingRun,
  loadSamplingRunEvidence,
  previewSampling,
} from "@/modules/research/sampling/server/sampling-service";

const importId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";
const candidates = [
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
  "77777777-7777-4777-8777-777777777777",
  "88888888-8888-4888-8888-888888888888",
].map((memberId, index) => ({
  memberId,
  farmerCode: `SYN-${String(index + 1).padStart(3, "0")}`,
  stratumCode: index < 2 ? "NORTH" : index < 4 ? "SOUTH" : "EAST",
}));

const input = {
  populationImportId: importId,
  seedText: "sampling-seed-v1",
  marginOfError: 0.5,
  stratumDefinitionVersion: "synthetic-strata-v1",
  idempotencyKey,
};

function session(role: Role): IdentitySession {
  return {
    status: "authorized",
    userId: "99999999-9999-4999-8999-999999999999",
    profile: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      workspaceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      role,
    },
  };
}

function run(evidence: SamplingEvidence): SamplingRun {
  return {
    id: runId,
    version: 1,
    populationImportId: importId,
    populationSize: evidence.populationSize,
    marginOfError: evidence.marginOfError,
    unroundedResult: evidence.unrounded,
    roundingRule: evidence.roundingRule,
    targetN: evidence.targetN,
    formulaVersion: evidence.formulaVersion,
    stratumDefinitionVersion: input.stratumDefinitionVersion,
    seedText: evidence.seedText,
    seedNormalized: evidence.seedNormalized,
    seedNormalizedUtf8Hex: evidence.seedNormalizedUtf8Hex,
    seedDigestHex: evidence.seedDigestHex,
    seedU32: evidence.seedU32,
    algorithmVersion: evidence.algorithmVersion,
    orderedCandidateSetHash: evidence.orderedCandidateSetHash,
    orderedResultHash: evidence.orderedResultHash,
    status: "draft",
    createdAt: "2026-08-26T01:00:00.000Z",
    updatedAt: "2026-08-26T01:00:01.000Z",
    lockedAt: null,
    activatedAt: null,
    supersededAt: null,
    cancelledAt: null,
    cancellationReasonDigest: null,
    allocationEvidence: evidence.allocationRows,
    resultEvidence: evidence,
  };
}

async function setup(role: Role = "research_manager") {
  const evidence = await buildSamplingEvidence({
    populationSize: candidates.length,
    marginOfError: input.marginOfError,
    seedText: input.seedText,
    candidates,
  });
  const receipt = run(evidence);
  const gateway: SamplingGateway = {
    getCandidates: vi.fn().mockResolvedValue(candidates),
    getPopulationCandidates: vi.fn().mockResolvedValue(candidates),
    getEvidence: vi.fn().mockResolvedValue(receipt),
    createDraft: vi.fn().mockResolvedValue(receipt),
    listRuns: vi.fn().mockResolvedValue([receipt]),
    lock: vi.fn().mockResolvedValue({ ...receipt, status: "locked" }),
    activate: vi.fn().mockResolvedValue({ ...receipt, status: "active" }),
    cancel: vi.fn().mockResolvedValue({ ...receipt, status: "cancelled" }),
  };
  return { session: session(role), gateway, evidence, receipt };
}

describe("sampling service", () => {
  it("keeps the canonical margin text through trusted evidence before gateway persistence", async () => {
    const deps = await setup();
    const textInput = {
      ...input,
      marginOfError: undefined,
      marginOfErrorText: "0.500",
    };

    await expect(createSamplingDraft(textInput, deps)).resolves.toMatchObject({ status: "ready" });
    expect(deps.gateway.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      evidence: expect.objectContaining({ marginOfErrorText: "0.5" }),
    }));
  });

  it("recomputes trusted candidate evidence before preview and create", async () => {
    const deps = await setup();
    await expect(previewSampling(input, deps)).resolves.toMatchObject({
      status: "ready",
      evidence: { orderedCandidateSetHash: deps.evidence.orderedCandidateSetHash },
    });
    await expect(createSamplingDraft(input, deps)).resolves.toMatchObject({
      status: "ready",
      run: { id: runId },
    });
    expect(deps.gateway.getPopulationCandidates).toHaveBeenCalledWith(importId);
    expect(deps.gateway.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        populationImportId: importId,
        evidence: expect.objectContaining({ targetN: deps.evidence.targetN }),
      }),
    );
  });

  it.each(["admin", "evaluator_readonly"] as const)(
    "forbids %s from candidate preview while retaining aggregate read access",
    async (role) => {
      const deps = await setup(role);
      await expect(previewSampling(input, deps)).resolves.toEqual({
        status: "forbidden",
      });
      expect(deps.gateway.getPopulationCandidates).not.toHaveBeenCalled();
      await expect(listSamplingRuns(deps)).resolves.toMatchObject({ status: "ready" });
    },
  );

  it("loads detailed receipts per run only for a research manager", async () => {
    const manager = await setup("research_manager");
    await expect(loadSamplingRunEvidence([manager.receipt], manager)).resolves.toMatchObject({
      status: "ready",
      runs: [{ id: runId, seedDigestHex: manager.evidence.seedDigestHex }],
    });
    expect(manager.gateway.getEvidence!).toHaveBeenCalledWith(runId);

    const admin = await setup("admin");
    await expect(loadSamplingRunEvidence([admin.receipt], admin)).resolves.toEqual({ status: "ready", runs: [] });
    expect(admin.gateway.getEvidence!).not.toHaveBeenCalled();
  });

  it("bounds persisted evidence detail loads to the latest ten runs", async () => {
    const manager = await setup("research_manager");
    const runs = Array.from({ length: 12 }, (_, index) => ({
      ...manager.receipt,
      id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
      version: 12 - index,
    }));
    vi.mocked(manager.gateway.getEvidence!).mockImplementation(async (id) => ({
      ...manager.receipt,
      id,
    }));

    const result = await loadSamplingRunEvidence(runs, manager);

    expect(result.status).toBe("ready");
    expect(result.status === "ready" ? result.runs : []).toHaveLength(10);
    expect(manager.gateway.getEvidence).toHaveBeenCalledTimes(10);
    expect(manager.gateway.getEvidence).toHaveBeenNthCalledWith(1, runs[0].id);
    expect(manager.gateway.getEvidence).toHaveBeenNthCalledWith(10, runs[9].id);
  });

  it.each(["admin", "field_collector", "farmer", "evaluator_readonly"] as const)(
    "forbids %s from mutation before gateway access",
    async (role) => {
      const deps = await setup(role);
      await expect(createSamplingDraft(input, deps)).resolves.toEqual({
        status: "forbidden",
      });
      expect(deps.gateway.getPopulationCandidates).not.toHaveBeenCalled();
      expect(deps.gateway.createDraft).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid UUID, bounds, empty/overlong seed and malformed snapshot before access", async () => {
    const deps = await setup();
    await expect(
      createSamplingDraft({ ...input, populationImportId: "not-a-uuid" }, deps),
    ).resolves.toEqual({ status: "invalid" });
    await expect(
      createSamplingDraft({ ...input, marginOfError: 1 }, deps),
    ).resolves.toEqual({ status: "invalid" });
    await expect(
      createSamplingDraft({ ...input, seedText: "" }, deps),
    ).resolves.toEqual({ status: "invalid" });
    await expect(
      createSamplingDraft({ ...input, seedText: "a".repeat(201) }, deps),
    ).resolves.toEqual({ status: "invalid" });
    expect(deps.gateway.getPopulationCandidates).not.toHaveBeenCalled();
  });

  it("replays persisted evidence and fetches candidates before lock", async () => {
    const deps = await setup();
    await expect(lockSamplingRun(runId, deps)).resolves.toMatchObject({
      status: "ready",
      run: { status: "locked" },
    });
    expect(deps.gateway.getEvidence!).toHaveBeenCalledWith(runId);
    expect(deps.gateway.getPopulationCandidates).toHaveBeenCalledWith(importId);
    expect(deps.gateway.lock).toHaveBeenCalledWith(runId, deps.receipt.updatedAt);
    expect(
      vi.mocked(deps.gateway.getEvidence!).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(deps.gateway.lock).mock.invocationCallOrder[0]);
  });

  it("fails closed on replay mismatch and never calls lock", async () => {
    const deps = await setup();
    const tampered = { ...deps.receipt, resultEvidence: { ...deps.evidence, seedText: "tampered" } };
    vi.mocked(deps.gateway.getEvidence!).mockResolvedValue(tampered);
    await expect(lockSamplingRun(runId, deps)).resolves.toEqual({
      status: "replay_mismatch",
    });
    expect(deps.gateway.lock).not.toHaveBeenCalled();
  });

  it.each([
    ["populationSize", 4],
    ["marginOfError", 0.25],
    ["unroundedResult", 99],
    ["roundingRule", "floor"],
    ["targetN", 2],
    ["formulaVersion", "other-v1"],
    ["seedText", "other-seed"],
    ["seedNormalized", "other-seed"],
    ["seedNormalizedUtf8Hex", "00"],
    ["seedDigestHex", "a".repeat(64)],
    ["seedU32", 7],
    ["algorithmVersion", "other-algorithm"],
    ["orderedCandidateSetHash", "b".repeat(64)],
  ] as const)("rejects tampered persisted top-level %s before lock", async (field, value) => {
    const deps = await setup();
    vi.mocked(deps.gateway.getEvidence!).mockResolvedValue({
      ...deps.receipt,
      [field]: value,
    });
    await expect(lockSamplingRun(runId, deps)).resolves.toEqual({
      status: "replay_mismatch",
    });
    expect(deps.gateway.lock).not.toHaveBeenCalled();
  });

  it("rejects tampered top-level allocation evidence before lock", async () => {
    const deps = await setup();
    vi.mocked(deps.gateway.getEvidence!).mockResolvedValue({
      ...deps.receipt,
      allocationEvidence: deps.receipt.allocationEvidence.map((row, index) =>
        index === 0 ? { ...row, finalAllocation: row.finalAllocation + 1 } : row,
      ),
    });
    await expect(lockSamplingRun(runId, deps)).resolves.toEqual({
      status: "replay_mismatch",
    });
    expect(deps.gateway.lock).not.toHaveBeenCalled();
  });

  it("maps candidate load failures to safe replay/unavailable states", async () => {
    const mismatch = await setup();
    vi.mocked(mismatch.gateway.getPopulationCandidates).mockRejectedValue(
      new SamplingGatewayError("REPLAY_MISMATCH"),
    );
    await expect(lockSamplingRun(runId, mismatch)).resolves.toEqual({
      status: "replay_mismatch",
    });

    const unavailable = await setup();
    vi.mocked(unavailable.gateway.getPopulationCandidates).mockRejectedValue(
      new Error("raw provider details"),
    );
    await expect(lockSamplingRun(runId, unavailable)).resolves.toEqual({
      status: "service_unavailable",
    });
  });

  it("rejects malformed lifecycle inputs before gateway access", async () => {
    const deps = await setup();
    await expect(lockSamplingRun("not-a-uuid", deps)).resolves.toEqual({ status: "invalid" });
    await expect(activateSamplingRun("not-a-uuid", deps)).resolves.toEqual({ status: "invalid" });
    await expect(cancelSamplingRun({ runId: "not-a-uuid", reason: "x" }, deps)).resolves.toEqual({
      status: "invalid",
    });
    expect(deps.gateway.lock).not.toHaveBeenCalled();
    expect(deps.gateway.activate).not.toHaveBeenCalled();
    expect(deps.gateway.cancel).not.toHaveBeenCalled();
  });

  it("maps gateway failures to safe states and permits aggregate reads to readonly roles", async () => {
    const conflict = await setup();
    vi.mocked(conflict.gateway.createDraft).mockRejectedValue(
      new SamplingGatewayError("CONFLICT"),
    );
    await expect(createSamplingDraft(input, conflict)).resolves.toEqual({
      status: "conflict",
    });

    const unavailable = await setup();
    vi.mocked(unavailable.gateway.listRuns).mockRejectedValue(
      new Error("postgres secret token"),
    );
    await expect(listSamplingRuns({ ...unavailable, session: session("evaluator_readonly") })).resolves.toEqual({
      status: "service_unavailable",
    });
    expect(JSON.stringify(await listSamplingRuns({ ...unavailable, session: session("evaluator_readonly") }))).not.toMatch(
      /postgres|secret|token/u,
    );
  });
});
