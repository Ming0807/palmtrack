import { describe, expect, it } from "vitest";

import {
  calculatePeriodCashResult,
  calculateSale,
  calculateSaleGross,
  calculateSaleNet,
  validateSaleCalculation,
} from "./sale-formula";

describe("Sale Formula & Period Cash Result", () => {
  describe("calculateSaleGross & calculateSaleNet", () => {
    it("calculates gross amount from quantity and unit price with half-up rounding", () => {
      expect(calculateSaleGross("10.000", "1000.00")).toBe("10000.00");
      expect(calculateSaleGross("5.000", "510.10")).toBe("2550.50");
      expect(calculateSaleGross("1.000", "1000.00")).toBe("1000.00");
      expect(calculateSaleGross("2.500", "1.55")).toBe("3.88");
    });

    it("calculates net amount by subtracting deductions", () => {
      expect(calculateSaleNet("10000.00", "0.00")).toBe("10000.00");
      expect(calculateSaleNet("2550.50", "50.00")).toBe("2500.50");
      expect(calculateSaleNet("1000.00", "1.00")).toBe("999.00");
    });

    it("calculates full sale breakdown and flags invalid inputs", () => {
      const valid = calculateSale("5.000", "510.10", "50.00");
      expect(valid.grossAmount).toBe("2550.50");
      expect(valid.netAmount).toBe("2500.50");
      expect(valid.isValid).toBe(true);

      const invalidDeductions = calculateSale("1.000", "100.00", "150.00");
      expect(invalidDeductions.isValid).toBe(false);
      expect(invalidDeductions.error).toBe("ค่าหัก ณ ที่จ่ายต้องไม่เกินมูลค่ารวม");

      const negativeQty = calculateSale("-1.000", "100.00", "0.00");
      expect(negativeQty.isValid).toBe(false);
    });

    it("validates server-client consistency of gross and net amounts", () => {
      expect(
        validateSaleCalculation({
          quantity: "5.000",
          unitPrice: "510.10",
          grossAmount: "2550.50",
          deductions: "50.00",
          netAmount: "2500.50",
        }),
      ).toBe(true);

      // Inconsistent gross
      expect(
        validateSaleCalculation({
          quantity: "5.000",
          unitPrice: "510.10",
          grossAmount: "2500.00",
          deductions: "50.00",
          netAmount: "2450.00",
        }),
      ).toBe(false);

      // Inconsistent net
      expect(
        validateSaleCalculation({
          quantity: "5.000",
          unitPrice: "510.10",
          grossAmount: "2550.50",
          deductions: "50.00",
          netAmount: "2500.00",
        }),
      ).toBe(false);
    });
  });

  describe("calculatePeriodCashResult (Fixture Reconciliation)", () => {
    it("[REP-01] calculates cash profit matching fixture target 9,000.25", () => {
      // Acceptance fixture finance data from TEST_PLAN.md:
      // active sales net: 10,000.00 + 2,500.50
      // deleted sale: 999.00
      // active expenses: 3,000.25 + 500.00
      // deleted expense: 100.00
      const sales = [
        { netAmount: "10000.00", isDeleted: false },
        { netAmount: "2500.50", isDeleted: false },
        { netAmount: "999.00", isDeleted: true },
      ];

      const expenses = [
        { amount: "3000.25", isDeleted: false },
        { amount: "500.00", isDeleted: false },
        { amount: "100.00", isDeleted: true },
      ];

      const result = calculatePeriodCashResult(sales, expenses);
      expect(result.netIncome).toBe("12500.50");
      expect(result.expenseTotal).toBe("3500.25");
      expect(result.cashResult).toBe("9000.25");
      expect(result.activeSaleCount).toBe(2);
      expect(result.activeExpenseCount).toBe(2);
    });

    it("handles empty periods gracefully", () => {
      const result = calculatePeriodCashResult([], []);
      expect(result.netIncome).toBe("0.00");
      expect(result.expenseTotal).toBe("0.00");
      expect(result.cashResult).toBe("0.00");
      expect(result.activeSaleCount).toBe(0);
      expect(result.activeExpenseCount).toBe(0);
    });
  });
});
