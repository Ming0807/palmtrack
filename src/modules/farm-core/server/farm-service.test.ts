import { describe, expect, it, vi } from "vitest";

import type { IdentitySession } from "@/modules/identity/server/session";
import type { FarmGateway } from "./farm-gateway";
import {
  createFarm,
  createPlot,
  deleteFarm,
  deletePlot,
  listFarms,
  listPlots,
  updateFarm,
  updatePlot,
} from "./farm-service";

const testFarmId = "11111111-1111-4111-8111-111111111111";
const testPlotId = "22222222-2222-4222-8222-222222222222";

const authorizedFarmerSession: Extract<IdentitySession, { status: "authorized" }> = {
  status: "authorized",
  userId: "00000000-0000-0000-0000-000000000001",
  profile: {
    id: "00000000-0000-0000-0000-000000000002",
    workspaceId: "00000000-0000-0000-0000-000000000003",
    role: "farmer",
  },
};

const authorizedAdminSession: Extract<IdentitySession, { status: "authorized" }> = {
  ...authorizedFarmerSession,
  profile: { ...authorizedFarmerSession.profile, role: "admin" },
};

function createMockFarmGateway(): FarmGateway {
  return {
    ensureFarmerProfile: vi.fn().mockResolvedValue("fmr-123"),
    listFarms: vi.fn().mockResolvedValue([
      {
        id: testFarmId,
        farmerId: "fmr-123",
        name: "สวนปาล์มสมหวัง",
        locationLabel: "กระบี่",
        totalArea: "25.500",
        plotCount: 2,
        createdAt: "2026-08-25T10:00:00Z",
      },
    ]),
    createFarm: vi.fn().mockResolvedValue(testFarmId),
    updateFarm: vi.fn().mockResolvedValue(undefined),
    softDeleteFarm: vi.fn().mockResolvedValue(undefined),
    listPlots: vi.fn().mockResolvedValue([
      {
        id: testPlotId,
        farmId: testFarmId,
        code: "P-01",
        name: "แปลงต้นน้ำ",
        area: "12.000",
        createdAt: "2026-08-25T10:00:00Z",
      },
    ]),
    createPlot: vi.fn().mockResolvedValue(testPlotId),
    updatePlot: vi.fn().mockResolvedValue(undefined),
    softDeletePlot: vi.fn().mockResolvedValue(undefined),
  };
}

describe("FarmService", () => {
  describe("Role authorization", () => {
    it("denies non-farmer roles from listing or mutating farms", async () => {
      const gateway = createMockFarmGateway();

      const listRes = await listFarms({ session: authorizedAdminSession, gateway });
      expect(listRes.status).toBe("forbidden");

      const createRes = await createFarm({
        session: authorizedAdminSession,
        gateway,
        input: { name: "สวนใหม่", locationLabel: null, totalArea: "10.000" },
      });
      expect(createRes.status).toBe("forbidden");
      expect(gateway.createFarm).not.toHaveBeenCalled();
    });
  });

  describe("Farm CRUD operations", () => {
    it("lists farms for authorized farmer", async () => {
      const gateway = createMockFarmGateway();
      const result = await listFarms({ session: authorizedFarmerSession, gateway });
      expect(result.status).toBe("ready");
      if (result.status === "ready") {
        expect(result.farms).toHaveLength(1);
        expect(result.farms[0].name).toBe("สวนปาล์มสมหวัง");
        expect(result.farms[0].totalArea).toBe("25.500");
      }
    });

    it("creates farm with valid canonical input", async () => {
      const gateway = createMockFarmGateway();
      const result = await createFarm({
        session: authorizedFarmerSession,
        gateway,
        input: { name: "สวนใหม่", locationLabel: "อ่าวลึก", totalArea: "15.000" },
      });
      expect(result.status).toBe("success");
      expect(gateway.createFarm).toHaveBeenCalledWith({
        name: "สวนใหม่",
        locationLabel: "อ่าวลึก",
        totalArea: "15.000",
      });
    });

    it("validates farm input schema and rejects invalid areas", async () => {
      const gateway = createMockFarmGateway();
      const result = await createFarm({
        session: authorizedFarmerSession,
        gateway,
        input: { name: "", locationLabel: null, totalArea: "invalid" },
      });
      expect(result.status).toBe("validation_error");
      expect(gateway.createFarm).not.toHaveBeenCalled();
    });

    it("updates farm and soft-deletes with required reason", async () => {
      const gateway = createMockFarmGateway();
      const updateRes = await updateFarm({
        session: authorizedFarmerSession,
        gateway,
        input: { farmId: testFarmId, name: "สวนแก้ใหม่", locationLabel: null, totalArea: "30.000" },
      });
      expect(updateRes.status).toBe("success");

      const deleteRes = await deleteFarm({
        session: authorizedFarmerSession,
        gateway,
        input: { farmId: testFarmId, reason: "ยกเลิกการดำเนินงาน" },
      });
      expect(deleteRes.status).toBe("success");
    });
  });

  describe("Plot CRUD operations", () => {
    it("creates, lists, updates, and soft-deletes plots", async () => {
      const gateway = createMockFarmGateway();
      const listRes = await listPlots({
        session: authorizedFarmerSession,
        gateway,
        farmId: testFarmId,
      });
      expect(listRes.status).toBe("ready");

      const createRes = await createPlot({
        session: authorizedFarmerSession,
        gateway,
        input: {
          farmId: testFarmId,
          code: "P-02",
          name: "แปลงเนินเขา",
          area: "13.500",
        },
      });
      expect(createRes.status).toBe("success");

      const updateRes = await updatePlot({
        session: authorizedFarmerSession,
        gateway,
        input: {
          plotId: testPlotId,
          code: "P-02-B",
          name: "แปลงเนินเขาใหม่",
          area: "14.000",
        },
      });
      expect(updateRes.status).toBe("success");

      const deleteRes = await deletePlot({
        session: authorizedFarmerSession,
        gateway,
        input: {
          plotId: testPlotId,
          reason: "รวมแปลงกับ P-01",
        },
      });
      expect(deleteRes.status).toBe("success");
    });
  });
});
