import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseSamplingGateway,
  SamplingGatewayError,
} from "@/modules/research/population/server/sampling-gateway";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  population_import_id: "22222222-2222-4222-8222-222222222222",
  population_size: 2,
  target_n: 2,
  status: "draft",
  seed_digest_hex: "a".repeat(64),
  ordered_candidate_set_hash: "b".repeat(64),
  locked_at: null,
};

function clientFor(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn((name: string) =>
    name === "list_sampling_runs" ||
    name === "list_sampling_members" ||
    name === "list_population_members"
      ? Promise.resolve({ data, error })
      : { single },
  );
  return { rpc, single };
}

const draftInput = {
  populationImportId: row.population_import_id,
  marginOfError: 0.05,
  seedText: "palmtrack-acceptance-seed-v1",
  seedNormalized: "palmtrack-acceptance-seed-v1",
  seedDigestHex: row.seed_digest_hex,
  seedU32: 0,
  candidateHash: row.ordered_candidate_set_hash,
  allocations: [{ stratumCode: "NORTH", finalAllocation: 2 }],
  members: [
    {
      populationMemberId: "33333333-3333-4333-8333-333333333333",
      stratumCode: "NORTH",
      selectionOrder: 1,
    },
    {
      populationMemberId: "44444444-4444-4434-8444-444444444444",
      stratumCode: "NORTH",
      selectionOrder: 2,
    },
  ],
};

describe("Supabase sampling gateway", () => {
  it("[INT-02] maps draft RPC arguments and returns a draft receipt", async () => {
    const client = clientFor(row);
    const gateway = createSupabaseSamplingGateway(client as never);
    await expect(gateway.draft(draftInput)).resolves.toMatchObject({
      id: row.id,
      version: 1,
      status: "draft",
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "create_sampling_draft",
      expect.objectContaining({
        p_population_import_id: row.population_import_id,
        p_seed_u32: 0,
      }),
    );
  });

  it("[INT-02] maps lock, activate, cancel and list RPCs", async () => {
    const locked = { ...row, status: "locked", locked_at: "2026-08-26T12:00:00.000Z" };
    await expect(
      createSupabaseSamplingGateway(clientFor(locked) as never).lock(row.id, row.ordered_candidate_set_hash, row.seed_digest_hex),
    ).resolves.toMatchObject({ status: "locked", lockedAt: locked.locked_at });
    const active = { ...row, status: "active", locked_at: "2026-08-26T12:00:00.000Z" };
    await expect(
      createSupabaseSamplingGateway(clientFor(active) as never).activate(row.id),
    ).resolves.toMatchObject({ status: "active" });
    const cancelled = { ...row, status: "cancelled" };
    await expect(
      createSupabaseSamplingGateway(clientFor(cancelled) as never).cancel(row.id, "เหตุผลสังเคราะห์"),
    ).resolves.toMatchObject({ status: "cancelled" });
    await expect(
      createSupabaseSamplingGateway(clientFor([row]) as never).list(),
    ).resolves.toHaveLength(1);
  });

  it.each(["23505", "40001"])("[SEC-02] maps %s to a conflict without provider detail", async (code) => {
    const client = clientFor(null, { code, message: "raw provider detail" });
    await expect(
      createSupabaseSamplingGateway(client as never).activate(row.id),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "sampling gateway failed" });
  });

  it("[SEC-02] treats malformed provider data as unavailable", async () => {
    const client = clientFor({ ...row, id: "bad-id" });
    await expect(
      createSupabaseSamplingGateway(client as never).draft(draftInput),
    ).rejects.toBeInstanceOf(SamplingGatewayError);
  });

  it("[INT-02] maps run detail and ordered members", async () => {
    const detail = {
      ...row,
      margin_of_error: 0.05,
      formula_version: "yamane-v1",
      seed_text: "palmtrack-acceptance-seed-v1",
      seed_normalized: "palmtrack-acceptance-seed-v1",
      seed_u32: 0,
      algorithm_version: "sha256-mulberry32-fy-v1",
      allocation: [{ stratum_code: "NORTH", final_allocation: 2 }],
      cancel_reason: null,
      created_at: "2026-08-26T11:00:00.000Z",
    };
    await expect(
      createSupabaseSamplingGateway(clientFor(detail) as never).get(row.id),
    ).resolves.toMatchObject({ id: row.id, targetN: 2 });
    const members = [
      {
        population_member_id: "33333333-3333-4333-8333-333333333333",
        farmer_code: "SYN-001",
        stratum_code: "NORTH",
        selection_order: 1,
      },
    ];
    await expect(
      createSupabaseSamplingGateway(clientFor(members) as never).listMembers(row.id),
    ).resolves.toHaveLength(1);
  });

  it("[INT-02] maps accepted snapshot members for preview", async () => {
    const snapshot = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        row_number: 1,
        farmer_code: "SYN-001",
        stratum_code: "NORTH",
        eligible: true,
      },
    ];
    const client = clientFor(snapshot);
    await expect(
      createSupabaseSamplingGateway(client as never).listPopulationMembers(row.population_import_id),
    ).resolves.toEqual([
      {
        id: "33333333-3333-4333-8333-333333333333",
        rowNumber: 1,
        farmerCode: "SYN-001",
        stratumCode: "NORTH",
        eligible: true,
      },
    ]);
    expect(client.rpc).toHaveBeenCalledWith(
      "list_population_members",
      expect.objectContaining({ p_import_id: row.population_import_id }),
    );
  });
});
