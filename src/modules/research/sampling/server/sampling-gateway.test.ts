import { describe, expect, it, vi } from "vitest";

import { buildSamplingEvidence } from "@/modules/research/sampling/domain/deterministic-sampling";
import {
  SamplingGatewayError,
  createSupabaseSamplingGateway,
} from "@/modules/research/sampling/server/sampling-gateway";

const importId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";
const candidateIds = [
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
  "77777777-7777-4777-8777-777777777777",
  "88888888-8888-4888-8888-888888888888",
];

const evidenceInput = {
  populationSize: candidateIds.length,
  marginOfError: 0.5,
  seedText: "sampling-seed-v1",
  candidates: candidateIds.map((memberId, index) => ({
    memberId,
    farmerCode: `SYN-${String(index + 1).padStart(3, "0")}`,
    stratumCode: index < 2 ? "NORTH" : index < 4 ? "SOUTH" : "EAST",
  })),
};

async function fixture() {
  return buildSamplingEvidence(evidenceInput);
}

function clientFor(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn((name: string) =>
    name === "list_sampling_runs" || name === "get_sampling_candidates"
      ? Promise.resolve({ data, error })
      : { single },
  );
  return { rpc, single };
}

function runRow(evidence: Awaited<ReturnType<typeof fixture>>) {
  return {
    id: runId,
    version: 1,
    population_import_id: importId,
    population_size: evidence.populationSize,
    margin_of_error: evidence.marginOfError,
    unrounded_result: evidence.unrounded,
    rounding_rule: evidence.roundingRule,
    target_n: evidence.targetN,
    formula_version: evidence.formulaVersion,
    stratum_definition_version: "synthetic-strata-v1",
    seed_text: evidence.seedText,
    seed_normalized: evidence.seedNormalized,
    seed_normalized_utf8_hex: evidence.seedNormalizedUtf8Hex,
    seed_digest_hex: evidence.seedDigestHex,
    seed_u32: evidence.seedU32,
    algorithm_version: evidence.algorithmVersion,
    ordered_candidate_set_hash: evidence.orderedCandidateSetHash,
    ordered_result_hash: evidence.orderedResultHash,
    status: "draft",
    created_at: "2026-08-26T01:00:00.000Z",
    updated_at: "2026-08-26T01:00:01.000Z",
    locked_at: null,
    activated_at: null,
    superseded_at: null,
    cancelled_at: null,
    cancellation_reason_digest: null,
    allocation_evidence: evidence.allocationRows.map((row) => ({
      stratum_code: row.stratumCode,
      eligible_count: row.eligibleCount,
      quota: row.quota,
      floor_allocation: row.floorAllocation,
      remainder: row.remainder,
      final_allocation: row.finalAllocation,
    })),
    result_evidence: {
      formula_version: evidence.formulaVersion,
      population_size: evidence.populationSize,
      margin_of_error: evidence.marginOfError,
      unrounded: evidence.unrounded,
      target_n: evidence.targetN,
      rounding_rule: evidence.roundingRule,
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
      ordered_result_digest_version: evidence.orderedResultDigestVersion,
      ordered_result_hash: evidence.orderedResultHash,
    },
  };
}

describe("Supabase sampling gateway", () => {
  it("maps canonical draft evidence to the snake_case create RPC contract", async () => {
    const evidence = await fixture();
    const row = runRow(evidence);
    const client = clientFor(row);
    const gateway = createSupabaseSamplingGateway(client as never);

    await expect(
      gateway.createDraft({
        populationImportId: importId,
        stratumDefinitionVersion: "synthetic-strata-v1",
        idempotencyKey,
        evidence,
      }),
    ).resolves.toMatchObject({ id: runId, populationImportId: importId });

    expect(client.rpc).toHaveBeenCalledWith(
      "create_sampling_draft",
      expect.objectContaining({
        p_population_import_id: importId,
        p_seed_text: evidence.seedText,
        p_margin_of_error: evidence.marginOfError,
        p_target_n: evidence.targetN,
        p_ordered_candidate_set_hash: evidence.orderedCandidateSetHash,
        p_allocation_evidence: expect.arrayContaining([
          expect.objectContaining({ stratum_code: "EAST" }),
        ]),
        p_result_evidence: expect.objectContaining({
          ordered_selected_member_ids: evidence.orderedSelectedMemberIds,
          swap_trace: evidence.swapTrace,
        }),
        p_idempotency_key: idempotencyKey,
      }),
    );
  });

  it("maps candidates, persisted evidence, lifecycle RPCs and list projections", async () => {
    const evidence = await fixture();
    const row = runRow(evidence);
    const candidateRows = evidenceInput.candidates.map((candidate) => ({
      sample_member_id: "99999999-9999-4999-8999-999999999999",
      population_member_id: candidate.memberId,
      farmer_code: candidate.farmerCode,
      stratum_code: candidate.stratumCode,
      selection_order: 1,
    }));
    const client = clientFor(row);
    client.rpc.mockImplementation((name: string) => {
      if (name === "get_sampling_candidates" || name === "get_sampling_population_candidates") {
        return Promise.resolve({ data: candidateRows, error: null });
      }
      if (name === "list_sampling_runs") {
        return Promise.resolve({ data: [row], error: null });
      }
      return { single: vi.fn().mockResolvedValue({ data: row, error: null }) };
    });
    const gateway = createSupabaseSamplingGateway(client as never);

    await expect(gateway.getCandidates(runId)).resolves.toEqual(
      evidenceInput.candidates,
    );
    await expect(gateway.getPopulationCandidates(importId)).resolves.toEqual(
      evidenceInput.candidates,
    );
    await expect(gateway.getEvidence!(runId)).resolves.toMatchObject({
      id: runId,
      evidence: expect.objectContaining({
        orderedSelectedMemberIds: evidence.orderedSelectedMemberIds,
      }),
    });
    await expect(gateway.listRuns()).resolves.toHaveLength(1);
    await expect(gateway.lock(runId, row.updated_at)).resolves.toMatchObject({ status: "draft" });
    await expect(gateway.activate(runId)).resolves.toMatchObject({ status: "draft" });
    await expect(gateway.cancel(runId, "เหตุผลสังเคราะห์")).resolves.toMatchObject({
      status: "draft",
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "get_sampling_candidates",
      { p_run_id: runId },
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "get_sampling_population_candidates",
      { p_population_import_id: importId },
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "get_sampling_run_evidence",
      { p_run_id: runId },
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "cancel_sampling_run",
      { p_run_id: runId, p_reason: "เหตุผลสังเคราะห์" },
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "lock_sampling_run",
      { p_run_id: runId, p_expected_updated_at: row.updated_at },
    );
  });

  it.each(["23505", "40001"])("maps %s to conflict without leaking provider details", async (code) => {
    const client = clientFor(null, { code, message: "postgres secret" });
    await expect(
      createSupabaseSamplingGateway(client as never).lock(runId, "2026-08-26T01:00:01.000Z"),
    ).rejects.toEqual(new SamplingGatewayError("CONFLICT"));
  });

  it("maps evidence rejection to replay_mismatch and malformed rows to unavailable", async () => {
    const evidenceError = clientFor(null, { code: "22023", message: "raw details" });
    await expect(
      createSupabaseSamplingGateway(evidenceError as never).lock(runId, "2026-08-26T01:00:01.000Z"),
    ).rejects.toEqual(new SamplingGatewayError("REPLAY_MISMATCH"));

    const malformed = clientFor({ ...runRow(await fixture()), id: "not-a-uuid" });
    await expect(
      createSupabaseSamplingGateway(malformed as never).lock(runId, "2026-08-26T01:00:01.000Z"),
    ).rejects.toEqual(new SamplingGatewayError("UNAVAILABLE"));
  });

  it("rejects result evidence with an unallowlisted key", async () => {
    const row = runRow(await fixture());
    const malformedRow = {
      ...row,
      result_evidence: { ...row.result_evidence, accidental_detail: "must not persist" },
    };
    await expect(
      createSupabaseSamplingGateway(clientFor(malformedRow) as never).lock(
        runId,
        "2026-08-26T01:00:01.000Z",
      ),
    ).rejects.toEqual(new SamplingGatewayError("UNAVAILABLE"));
  });

  it.each([
    ["population_size", null],
    ["target_n", true],
    ["version", Number.MAX_SAFE_INTEGER + 1],
    ["unrounded_result", Number.MAX_SAFE_INTEGER + 1],
    ["margin_of_error", "Infinity"],
  ])("rejects malformed numeric field %s without coercing it", async (field, value) => {
    const row = runRow(await fixture());
    const malformedRow = { ...row, [field]: value };
    const client = clientFor(malformedRow);
    await expect(
      createSupabaseSamplingGateway(client as never).lock(runId, "2026-08-26T01:00:01.000Z"),
    ).rejects.toEqual(new SamplingGatewayError("UNAVAILABLE"));
  });

  it("accepts canonical database numeric strings", async () => {
    const row = runRow(await fixture());
    const numericRow = {
      ...row,
      version: "1",
      population_size: "5",
      margin_of_error: "0.05",
      unrounded_result: "2.2222222222222223",
      target_n: "3",
      seed_u32: String((await fixture()).seedU32),
      result_evidence: {
        ...row.result_evidence,
        margin_of_error: "0.05",
      },
      allocation_evidence: row.allocation_evidence.map((allocation) => ({
        ...allocation,
        eligible_count: String(allocation.eligible_count),
        quota: String(allocation.quota),
        floor_allocation: String(allocation.floor_allocation),
        remainder: String(allocation.remainder),
        final_allocation: String(allocation.final_allocation),
      })),
    };
    await expect(
      createSupabaseSamplingGateway(clientFor(numericRow) as never).lock(runId, "2026-08-26T01:00:01.000Z"),
    ).resolves.toMatchObject({ populationSize: 5, marginOfError: 0.05, targetN: 3 });
  });

  it("accepts canonical small decimal strings emitted by database numerics", async () => {
    const row = runRow(await fixture());
    const numericRow = {
      ...row,
      margin_of_error: "0.0000001",
      result_evidence: {
        ...row.result_evidence,
        margin_of_error: "0.0000001",
      },
    };
    await expect(
      createSupabaseSamplingGateway(clientFor(numericRow) as never).lock(
        runId,
        "2026-08-26T01:00:01.000Z",
      ),
    ).resolves.toMatchObject({ marginOfError: 0.0000001 });
  });

  it("rejects decimal strings that lose precision when parsed as numbers", async () => {
    const row = runRow(await fixture());
    const malformedRow = {
      ...row,
      unrounded_result: "2.222222222222222222222222",
    };
    await expect(
      createSupabaseSamplingGateway(clientFor(malformedRow) as never).lock(
        runId,
        "2026-08-26T01:00:01.000Z",
      ),
    ).rejects.toEqual(new SamplingGatewayError("UNAVAILABLE"));
  });
});
