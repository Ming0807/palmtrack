import { describe, expect, it, vi } from "vitest";

import {
  createSupabasePopulationGateway,
  PopulationGatewayError,
} from "@/modules/research/population/server/population-gateway";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  source_label: "บัญชีสังเคราะห์รอบ 1",
  source_authorization_ref: "SYN-AUTH_001",
  reference_date: "2026-08-25",
  schema_version: "synthetic-population-v1",
  eligibility_rule_version: "synthetic-eligibility-v1",
  input_digest: "a".repeat(64),
  total_count: 3,
  eligible_count: 2,
  excluded_count: 1,
  status: "validated",
  created_by_profile_id: "22222222-2222-4222-8222-222222222222",
  created_at: "2026-08-25T12:00:00.000Z",
  accepted_by_profile_id: null,
  accepted_at: null,
};

function clientFor(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn((name: string) =>
    name === "list_population_imports"
      ? Promise.resolve({ data, error })
      : { single },
  );
  return { rpc, single };
}

describe("Supabase population gateway", () => {
  it("maps create RPC arguments and returns a validated receipt", async () => {
    const client = clientFor(row);
    const gateway = createSupabasePopulationGateway(client as never);
    await expect(
      gateway.create({
        sourceLabel: row.source_label,
        sourceAuthorizationRef: row.source_authorization_ref,
        referenceDate: row.reference_date,
        schemaVersion: "synthetic-population-v1",
        eligibilityRuleVersion: "synthetic-eligibility-v1",
        digest: row.input_digest,
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
        rows: [
          {
            rowNumber: 1,
            farmerCode: "SYN-001",
            stratumCode: "NORTH",
            eligible: true,
            exclusionReasonCode: null,
          },
        ],
      }),
    ).resolves.toMatchObject({ id: row.id, sourceLabel: row.source_label });
    expect(client.rpc).toHaveBeenCalledWith(
      "create_population_import",
      expect.objectContaining({
        p_source_authorization_ref: row.source_authorization_ref,
        p_rows: [expect.objectContaining({ farmer_code: "SYN-001" })],
      }),
    );
  });

  it("maps accept and list RPCs", async () => {
    const accepted = { ...row, status: "accepted" };
    const acceptClient = clientFor(accepted);
    await expect(
      createSupabasePopulationGateway(acceptClient as never).accept(row.id),
    ).resolves.toMatchObject({ status: "accepted" });

    const listClient = clientFor([row]);
    await expect(
      createSupabasePopulationGateway(listClient as never).list(),
    ).resolves.toHaveLength(1);
  });

  it.each(["23505", "40001"])("maps %s to a conflict", async (code) => {
    const client = clientFor(null, { code, message: "raw provider detail" });
    await expect(
      createSupabasePopulationGateway(client as never).accept(row.id),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "population gateway failed" });
  });

  it("treats malformed provider data as unavailable", async () => {
    const client = clientFor({ ...row, id: "bad-id" });
    await expect(
      createSupabasePopulationGateway(client as never).accept(row.id),
    ).rejects.toEqual(new PopulationGatewayError("UNAVAILABLE"));
  });
});
