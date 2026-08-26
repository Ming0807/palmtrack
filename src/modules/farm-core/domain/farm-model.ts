import { z } from "zod";

import { parseDecimal } from "./decimal";

export type Farmer = {
  id: string;
  workspaceId: string;
  profileId: string;
  fullName: string;
  phoneNumber: string | null;
  status: "active" | "inactive";
  createdAt: string;
};

export type FarmSummary = {
  id: string;
  farmerId: string;
  name: string;
  locationLabel: string | null;
  /** Area in rai/units as canonical decimal string with 3 places (e.g. "25.500") */
  totalArea: string;
  plotCount: number;
  createdAt: string;
};

export type PlotSummary = {
  id: string;
  farmId: string;
  code: string;
  name: string;
  /** Area in rai/units as canonical decimal string with 3 places (e.g. "12.000") */
  area: string;
  createdAt: string;
};

export const createFarmSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "กรุณาระบุชื่อสวน")
    .max(120, "ชื่อสวนต้องไม่เกิน 120 ตัวอักษร"),
  locationLabel: z
    .string()
    .trim()
    .max(200, "ที่ตั้งต้องไม่เกิน 200 ตัวอักษร")
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  totalArea: z
    .string()
    .trim()
    .refine((val) => parseDecimal(val, 3) !== null, {
      message: "ขนาดพื้นที่ต้องเป็นตัวเลขทศนิยมไม่เกิน 3 ตำแหน่ง",
    })
    .transform((val) => parseDecimal(val, 3)!),
});

export type CreateFarmInput = z.infer<typeof createFarmSchema>;

export const updateFarmSchema = createFarmSchema.extend({
  farmId: z.string().uuid("รหัสสวนไม่ถูกต้อง"),
});

export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;

export const deleteFarmSchema = z.object({
  farmId: z.string().uuid("รหัสสวนไม่ถูกต้อง"),
  reason: z
    .string()
    .trim()
    .min(3, "กรุณาระบุเหตุผลการลบอย่างน้อย 3 ตัวอักษร")
    .max(500, "เหตุผลการลบต้องไม่เกิน 500 ตัวอักษร"),
});

export type DeleteFarmInput = z.infer<typeof deleteFarmSchema>;

export const createPlotSchema = z.object({
  farmId: z.string().uuid("รหัสสวนไม่ถูกต้อง"),
  code: z
    .string()
    .trim()
    .min(1, "กรุณาระบุรหัสแปลง เช่น P-01")
    .max(40, "รหัสแปลงต้องไม่เกิน 40 ตัวอักษร"),
  name: z
    .string()
    .trim()
    .min(1, "กรุณาระบุชื่อแปลง")
    .max(120, "ชื่อแปลงต้องไม่เกิน 120 ตัวอักษร"),
  area: z
    .string()
    .trim()
    .refine((val) => parseDecimal(val, 3) !== null, {
      message: "ขนาดพื้นที่แปลงต้องเป็นตัวเลขทศนิยมไม่เกิน 3 ตำแหน่ง",
    })
    .transform((val) => parseDecimal(val, 3)!),
});

export type CreatePlotInput = z.infer<typeof createPlotSchema>;

export const updatePlotSchema = z.object({
  plotId: z.string().uuid("รหัสแปลงไม่ถูกต้อง"),
  code: z
    .string()
    .trim()
    .min(1, "กรุณาระบุรหัสแปลง")
    .max(40, "รหัสแปลงต้องไม่เกิน 40 ตัวอักษร"),
  name: z
    .string()
    .trim()
    .min(1, "กรุณาระบุชื่อแปลง")
    .max(120, "ชื่อแปลงต้องไม่เกิน 120 ตัวอักษร"),
  area: z
    .string()
    .trim()
    .refine((val) => parseDecimal(val, 3) !== null, {
      message: "ขนาดพื้นที่แปลงต้องเป็นตัวเลขทศนิยมไม่เกิน 3 ตำแหน่ง",
    })
    .transform((val) => parseDecimal(val, 3)!),
});

export type UpdatePlotInput = z.infer<typeof updatePlotSchema>;

export const deletePlotSchema = z.object({
  plotId: z.string().uuid("รหัสแปลงไม่ถูกต้อง"),
  reason: z
    .string()
    .trim()
    .min(3, "กรุณาระบุเหตุผลการลบอย่างน้อย 3 ตัวอักษร")
    .max(500, "เหตุผลการลบต้องไม่เกิน 500 ตัวอักษร"),
});

export type DeletePlotInput = z.infer<typeof deletePlotSchema>;
