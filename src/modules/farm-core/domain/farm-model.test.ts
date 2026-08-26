import { describe, expect, it } from "vitest";

import {
  createFarmSchema,
  createPlotSchema,
  deleteFarmSchema,
  deletePlotSchema,
  updateFarmSchema,
  updatePlotSchema,
} from "./farm-model";

const testFarmId = "11111111-1111-4111-8111-111111111111";
const testPlotId = "22222222-2222-4222-8222-222222222222";

describe("Farm Model Schemas", () => {
  it("validates createFarmSchema", () => {
    const valid = createFarmSchema.safeParse({
      name: "สวนปาล์มสมหวัง",
      locationLabel: "อ่าวลึก กระบี่",
      totalArea: "25.500",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.totalArea).toBe("25.500");
    }

    const invalid = createFarmSchema.safeParse({
      name: "",
      locationLabel: null,
      totalArea: "-5.000",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates updateFarmSchema and deleteFarmSchema", () => {
    const updateRes = updateFarmSchema.safeParse({
      farmId: testFarmId,
      name: "สวนปาล์มปรับปรุง",
      locationLabel: null,
      totalArea: "30.000",
    });
    expect(updateRes.success).toBe(true);

    const deleteRes = deleteFarmSchema.safeParse({
      farmId: testFarmId,
      reason: "ขายที่ดินแปลงนี้",
    });
    expect(deleteRes.success).toBe(true);
  });

  it("validates plot schemas", () => {
    const createPlotRes = createPlotSchema.safeParse({
      farmId: testFarmId,
      code: "P-01",
      name: "แปลงริมนิมิต",
      area: "12.000",
    });
    expect(createPlotRes.success).toBe(true);

    const updatePlotRes = updatePlotSchema.safeParse({
      plotId: testPlotId,
      code: "P-01-A",
      name: "แปลงริมนิมิต A",
      area: "12.500",
    });
    expect(updatePlotRes.success).toBe(true);

    const deletePlotRes = deletePlotSchema.safeParse({
      plotId: testPlotId,
      reason: "ยุบรวมแปลง",
    });
    expect(deletePlotRes.success).toBe(true);
  });
});
