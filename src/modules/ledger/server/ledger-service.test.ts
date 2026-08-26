import { describe, expect, it, vi } from "vitest";

import type { IdentitySession } from "@/modules/identity/server/session";
import type { LedgerGateway } from "./ledger-gateway";
import {
  createExpense,
  createSale,
  deleteExpense,
  deleteSale,
  getWorkbenchData,
} from "./ledger-service";

const testFarmId = "11111111-1111-4111-8111-111111111111";
const testPlotId = "22222222-2222-4222-8222-222222222222";
const testExpenseId = "33333333-3333-4333-8333-333333333333";
const testSaleId = "44444444-4444-4444-8444-444444444444";

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

function createMockLedgerGateway(): LedgerGateway {
  return {
    listExpenses: vi.fn().mockResolvedValue([
      {
        id: testExpenseId,
        farmId: testFarmId,
        farmName: "สวนปาล์มสมหวัง",
        plotId: testPlotId,
        plotCode: "P-01",
        category: "ปุ๋ย 15-15-15",
        amount: "3000.25",
        expenseDate: "2026-08-01",
        notes: null,
        isDeleted: false,
        deleteReason: null,
        createdAt: "2026-08-01T10:00:00Z",
      },
    ]),
    createExpense: vi.fn().mockResolvedValue(testExpenseId),
    softDeleteExpense: vi.fn().mockResolvedValue(undefined),
    listSales: vi.fn().mockResolvedValue([
      {
        id: testSaleId,
        farmId: testFarmId,
        farmName: "สวนปาล์มสมหวัง",
        plotId: testPlotId,
        plotCode: "P-01",
        saleDate: "2026-08-15",
        buyerName: "ลานเทสมบูรณ์",
        quantity: "10.000",
        unitPrice: "1000.00",
        grossAmount: "10000.00",
        deductions: "0.00",
        netAmount: "10000.00",
        notes: null,
        isDeleted: false,
        deleteReason: null,
        createdAt: "2026-08-15T10:00:00Z",
      },
    ]),
    createSale: vi.fn().mockResolvedValue(testSaleId),
    softDeleteSale: vi.fn().mockResolvedValue(undefined),
    getSummary: vi.fn().mockResolvedValue({
      netIncome: "12500.50",
      expenseTotal: "3500.25",
      cashResult: "9000.25",
      saleCount: 2,
      expenseCount: 2,
      hasRecords: true,
    }),
  };
}

describe("LedgerService", () => {
  describe("Role Authorization", () => {
    it("denies non-farmer roles from viewing workbench or recording transactions", async () => {
      const gateway = createMockLedgerGateway();

      const workbenchRes = await getWorkbenchData({
        session: authorizedAdminSession,
        gateway,
      });
      expect(workbenchRes.status).toBe("forbidden");

      const expenseRes = await createExpense({
        session: authorizedAdminSession,
        gateway,
        input: {
          farmId: testFarmId,
          plotId: null,
          category: "ปุ๋ย",
          amount: "1000.00",
          expenseDate: "2026-08-01",
          notes: null,
        },
      });
      expect(expenseRes.status).toBe("forbidden");
      expect(gateway.createExpense).not.toHaveBeenCalled();
    });
  });

  describe("Expense Operations", () => {
    it("creates an expense with valid decimal input", async () => {
      const gateway = createMockLedgerGateway();
      const result = await createExpense({
        session: authorizedFarmerSession,
        gateway,
        input: {
          farmId: testFarmId,
          plotId: testPlotId,
          category: "ปุ๋ย 15-15-15",
          amount: "3000.25",
          expenseDate: "2026-08-01",
          notes: "ใส่ปุ๋ยรอบแรก",
        },
      });
      expect(result.status).toBe("success");
      expect(gateway.createExpense).toHaveBeenCalledWith({
        farmId: testFarmId,
        plotId: testPlotId,
        category: "ปุ๋ย 15-15-15",
        amount: "3000.25",
        expenseDate: "2026-08-01",
        notes: "ใส่ปุ๋ยรอบแรก",
      });
    });

    it("soft deletes an expense with required reason", async () => {
      const gateway = createMockLedgerGateway();
      const result = await deleteExpense({
        session: authorizedFarmerSession,
        gateway,
        input: {
          expenseId: testExpenseId,
          reason: "บันทึกซ้ำซ้อน",
        },
      });
      expect(result.status).toBe("success");
      expect(gateway.softDeleteExpense).toHaveBeenCalledWith({
        expenseId: testExpenseId,
        reason: "บันทึกซ้ำซ้อน",
      });
    });
  });

  describe("Sale Operations", () => {
    it("creates a sale with verified formula", async () => {
      const gateway = createMockLedgerGateway();
      const result = await createSale({
        session: authorizedFarmerSession,
        gateway,
        input: {
          farmId: testFarmId,
          plotId: null,
          saleDate: "2026-08-15",
          buyerName: "ลานเท",
          quantity: "5.000",
          unitPrice: "510.10",
          deductions: "50.00",
          notes: null,
        },
      });
      expect(result.status).toBe("success");
      expect(gateway.createSale).toHaveBeenCalledWith({
        farmId: testFarmId,
        plotId: null,
        saleDate: "2026-08-15",
        buyerName: "ลานเท",
        quantity: "5.000",
        unitPrice: "510.10",
        deductions: "50.00",
        notes: null,
      });
    });

    it("rejects sale where deductions exceed gross amount", async () => {
      const gateway = createMockLedgerGateway();
      const result = await createSale({
        session: authorizedFarmerSession,
        gateway,
        input: {
          farmId: testFarmId,
          plotId: null,
          saleDate: "2026-08-15",
          buyerName: "ลานเท",
          quantity: "1.000",
          unitPrice: "100.00",
          deductions: "150.00",
          notes: null,
        },
      });
      expect(result.status).toBe("validation_error");
      expect(gateway.createSale).not.toHaveBeenCalled();
    });

    it("soft deletes a sale with required reason", async () => {
      const gateway = createMockLedgerGateway();
      const result = await deleteSale({
        session: authorizedFarmerSession,
        gateway,
        input: {
          saleId: testSaleId,
          reason: "ยกเลิกใบเสร็จเดิม",
        },
      });
      expect(result.status).toBe("success");
      expect(gateway.softDeleteSale).toHaveBeenCalledWith({
        saleId: testSaleId,
        reason: "ยกเลิกใบเสร็จเดิม",
      });
    });
  });

  describe("Workbench Data", () => {
    it("loads summary, expenses, and sales together", async () => {
      const gateway = createMockLedgerGateway();
      const result = await getWorkbenchData({
        session: authorizedFarmerSession,
        gateway,
      });
      expect(result.status).toBe("ready");
      if (result.status === "ready") {
        expect(result.summary.cashResult).toBe("9000.25");
        expect(result.expenses).toHaveLength(1);
        expect(result.sales).toHaveLength(1);
      }
    });
  });
});
