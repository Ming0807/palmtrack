import { describe, expect, it, vi } from "vitest";

import type { Role } from "@/modules/identity/domain/roles";
import type { IdentitySession } from "@/modules/identity/server/session";
import { FarmGatewayError, type FarmGateway, type FarmReceipt } from "./farm-gateway";
import { createFarm, deleteFarm, listFarms } from "./farm-service";

const receipt: FarmReceipt = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "สวนปาล์มเหนือ",
  areaRai: 12.5,
  createdAt: "2026-08-26T11:00:00.000Z",
};

function session(role: Role): IdentitySession {
  return {
    status: "authorized",
    userId: "user-1",
    profile: { id: "33333333-3333-4333-8333-333333333333", workspaceId: "workspace-1", role },
  };
}

function setup(role: Role = "farmer") {
  const gateway: FarmGateway = {
    createFarm: vi.fn().mockResolvedValue(receipt),
    listFarms: vi.fn().mockResolvedValue([receipt]),
    deleteFarm: vi.fn().mockResolvedValue({ id: receipt.id }),
  };
  return { session: session(role), gateway };
}

describe("createFarm", () => {
  it("[INT-07] creates an owner farm for farmers", async () => {
    const { session: farmer, gateway } = setup();
    const result = await createFarm({ name: "สวนปาล์มเหนือ", areaRai: 12.5 }, { session: farmer, gateway });

    expect(result).toEqual({ status: "created", farm: receipt });
    expect(gateway.createFarm).toHaveBeenCalledWith({ name: "สวนปาล์มเหนือ", areaRai: 12.5 });
  });

  it("[RLS-05] denies research managers before gateway access", async () => {
    const { session: manager, gateway } = setup("research_manager");
    const result = await createFarm({ name: "สวนของผู้จัดการ", areaRai: 10 }, { session: manager, gateway });

    expect(result).toEqual({ status: "forbidden" });
    expect(gateway.createFarm).not.toHaveBeenCalled();
  });

  it("[INT-07] rejects non-positive areas without gateway access", async () => {
    const { session: farmer, gateway } = setup();
    const result = await createFarm({ name: "สวนซ้ำ", areaRai: 0 }, { session: farmer, gateway });

    expect(result).toEqual({ status: "invalid", reasonCode: "INVALID_FARM_AREA" });
    expect(gateway.createFarm).not.toHaveBeenCalled();
  });
});

describe("listFarms", () => {
  it("[INT-07] lists owner farms", async () => {
    const { session: farmer, gateway } = setup();
    const result = await listFarms({ session: farmer, gateway });

    expect(result).toEqual({ status: "ready", farms: [receipt] });
  });
});

describe("deleteFarm", () => {
  it("[AUD-03] deletes with a required reason", async () => {
    const { session: farmer, gateway } = setup();
    const result = await deleteFarm(receipt.id, "รวมแปลงกับสวนข้างเคียง", { session: farmer, gateway });

    expect(result).toEqual({ status: "deleted", farmId: receipt.id });
  });

  it("[AUD-03] rejects blank reasons without gateway access", async () => {
    const { session: farmer, gateway } = setup();
    const result = await deleteFarm(receipt.id, "   ", { session: farmer, gateway });

    expect(result).toEqual({ status: "invalid", reasonCode: "INVALID_DELETE_REASON" });
    expect(gateway.deleteFarm).not.toHaveBeenCalled();
  });

  it("[RLS-05] maps gateway conflicts without leaking detail", async () => {
    const { session: farmer, gateway } = setup();
    vi.mocked(gateway.deleteFarm).mockRejectedValueOnce(new FarmGatewayError("CONFLICT"));
    const result = await deleteFarm(receipt.id, "เหตุผล", { session: farmer, gateway });

    expect(result).toEqual({ status: "conflict" });
  });
});
