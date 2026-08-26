import { z } from "zod";

import { parseDecimal } from "@/modules/farm-core/domain/decimal";
import { calculateSaleGross, calculateSaleNet } from "./sale-formula";

export const EXPENSE_CATEGORIES = [
  "ปุ๋ยและธาตุอาหาร",
  "สารกำจัดวัชพืช/ศัตรูพืช",
  "แรงงานตัดแต่ง/เก็บเกี่ยว",
  "ค่าน้ำมันและค่าขนส่ง",
  "อุปกรณ์และเครื่องจักร",
  "ซ่อมแซมและบำรุงรักษา",
  "ค่าธรรมเนียม/เบ็ดเตล็ด",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseItem = {
  id: string;
  farmId: string;
  farmName: string;
  plotId: string | null;
  plotCode: string | null;
  category: string;
  /** Amount in THB as canonical decimal string with 2 places (e.g. "3000.25") */
  amount: string;
  /** Gregorian date YYYY-MM-DD */
  expenseDate: string;
  notes: string | null;
  isDeleted: boolean;
  deleteReason: string | null;
  createdAt: string;
};

export type SaleItem = {
  id: string;
  farmId: string;
  farmName: string;
  plotId: string | null;
  plotCode: string | null;
  /** Gregorian date YYYY-MM-DD */
  saleDate: string;
  buyerName: string | null;
  /** Quantity in tons/units with 3 decimal places (e.g. "10.000") */
  quantity: string;
  /** Unit price in THB with 2 decimal places (e.g. "1000.00") */
  unitPrice: string;
  /** Gross amount in THB with 2 decimal places (e.g. "10000.00") */
  grossAmount: string;
  /** Deductions in THB with 2 decimal places (e.g. "0.00") */
  deductions: string;
  /** Net amount in THB with 2 decimal places (e.g. "10000.00") */
  netAmount: string;
  notes: string | null;
  isDeleted: boolean;
  deleteReason: string | null;
  createdAt: string;
};

export type CashLedgerSummary = {
  netIncome: string;
  expenseTotal: string;
  cashResult: string;
  saleCount: number;
  expenseCount: number;
  hasRecords: boolean;
};

export const createExpenseSchema = z.object({
  farmId: z.string().uuid("กรุณาเลือกสวน"),
  plotId: z
    .string()
    .uuid("รหัสแปลงไม่ถูกต้อง")
    .optional()
    .nullable()
    .transform((val) => (val ? val : null)),
  category: z
    .string()
    .trim()
    .min(1, "กรุณาเลือกหรือระบุหมวดหมู่ค่าใช้จ่าย")
    .max(60, "หมวดหมู่ต้องไม่เกิน 60 ตัวอักษร"),
  amount: z
    .string()
    .trim()
    .refine((val) => parseDecimal(val, 2) !== null, {
      message: "จำนวนเงินต้องเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่ง",
    })
    .transform((val) => parseDecimal(val, 2)!),
  expenseDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD"),
  notes: z
    .string()
    .trim()
    .max(500, "บันทึกเพิ่มเติมต้องไม่เกิน 500 ตัวอักษร")
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const deleteExpenseSchema = z.object({
  expenseId: z.string().uuid("รหัสค่าใช้จ่ายไม่ถูกต้อง"),
  reason: z
    .string()
    .trim()
    .min(3, "กรุณาระบุเหตุผลการลบอย่างน้อย 3 ตัวอักษร")
    .max(500, "เหตุผลการลบต้องไม่เกิน 500 ตัวอักษร"),
});

export type DeleteExpenseInput = z.infer<typeof deleteExpenseSchema>;

export const createSaleSchema = z
  .object({
    farmId: z.string().uuid("กรุณาเลือกสวน"),
    plotId: z
      .string()
      .uuid("รหัสแปลงไม่ถูกต้อง")
      .optional()
      .nullable()
      .transform((val) => (val ? val : null)),
    saleDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD"),
    buyerName: z
      .string()
      .trim()
      .max(120, "ชื่อผู้รับซื้อต้องไม่เกิน 120 ตัวอักษร")
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : null)),
    quantity: z
      .string()
      .trim()
      .refine(
        (val) => {
          const parsed = parseDecimal(val, 3);
          return parsed !== null && Number(parsed) > 0;
        },
        {
          message: "ปริมาณผลผลิตต้องเป็นตัวเลขมากกว่า 0 (ทศนิยมไม่เกิน 3 ตำแหน่ง)",
        },
      )
      .transform((val) => parseDecimal(val, 3)!),
    unitPrice: z
      .string()
      .trim()
      .refine(
        (val) => {
          const parsed = parseDecimal(val, 2);
          return parsed !== null && Number(parsed) >= 0;
        },
        {
          message: "ราคาต่อหน่วยต้องไม่ติดลบ (ทศนิยมไม่เกิน 2 ตำแหน่ง)",
        },
      )
      .transform((val) => parseDecimal(val, 2)!),
    deductions: z
      .string()
      .trim()
      .default("0.00")
      .refine(
        (val) => {
          const parsed = parseDecimal(val, 2);
          return parsed !== null && Number(parsed) >= 0;
        },
        {
          message: "ค่าหัก ณ ที่จ่ายต้องไม่ติดลบ (ทศนิยมไม่เกิน 2 ตำแหน่ง)",
        },
      )
      .transform((val) => parseDecimal(val, 2)!),
    notes: z
      .string()
      .trim()
      .max(500, "บันทึกเพิ่มเติมต้องไม่เกิน 500 ตัวอักษร")
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : null)),
  })
  .refine(
    (data) => {
      const gross = calculateSaleGross(data.quantity, data.unitPrice);
      const net = calculateSaleNet(gross, data.deductions);
      return Number(net) >= 0;
    },
    {
      message: "ค่าหัก ณ ที่จ่ายต้องไม่เกินมูลค่ารวมผลผลิต",
      path: ["deductions"],
    },
  );

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const deleteSaleSchema = z.object({
  saleId: z.string().uuid("รหัสรายการขายไม่ถูกต้อง"),
  reason: z
    .string()
    .trim()
    .min(3, "กรุณาระบุเหตุผลการลบอย่างน้อย 3 ตัวอักษร")
    .max(500, "เหตุผลการลบต้องไม่เกิน 500 ตัวอักษร"),
});

export type DeleteSaleInput = z.infer<typeof deleteSaleSchema>;

export const periodFilterSchema = z.object({
  farmId: z.string().uuid().optional().nullable(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional()
    .nullable(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional()
    .nullable(),
});

export type PeriodFilterInput = z.infer<typeof periodFilterSchema>;
