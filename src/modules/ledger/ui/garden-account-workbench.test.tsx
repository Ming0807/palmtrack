import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../server/actions", () => ({
  deleteExpenseAction: vi.fn().mockResolvedValue({ status: "success" }),
  deleteSaleAction: vi.fn().mockResolvedValue({ status: "success" }),
  createExpenseAction: vi.fn().mockResolvedValue({ status: "success" }),
  createSaleAction: vi.fn().mockResolvedValue({ status: "success" }),
}));

import { GardenAccountWorkbench } from "./garden-account-workbench";

const mockSummary = {
  netIncome: "12500.50",
  expenseTotal: "3500.25",
  cashResult: "9000.25",
  saleCount: 2,
  expenseCount: 2,
  hasRecords: true,
};

const mockFarms = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    farmerId: "22222222-2222-4222-8222-222222222222",
    name: "สวนปาล์มสมหวัง",
    locationLabel: "อ่าวลึก กระบี่",
    totalArea: "25.500",
    plotCount: 1,
    createdAt: "2026-08-25T10:00:00Z",
  },
];

const mockSales = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    farmId: "11111111-1111-4111-8111-111111111111",
    farmName: "สวนปาล์มสมหวัง",
    plotId: null,
    plotCode: null,
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
];

const mockExpenses = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    farmId: "11111111-1111-4111-8111-111111111111",
    farmName: "สวนปาล์มสมหวัง",
    plotId: null,
    plotCode: null,
    category: "ปุ๋ย 15-15-15",
    amount: "3000.25",
    expenseDate: "2026-08-01",
    notes: null,
    isDeleted: false,
    deleteReason: null,
    createdAt: "2026-08-01T10:00:00Z",
  },
];

describe("GardenAccountWorkbench Component", () => {
  it("renders summary cards with exact fixture amounts and cash result", () => {
    render(
      <GardenAccountWorkbench
        summary={mockSummary}
        expenses={mockExpenses}
        sales={mockSales}
        farms={mockFarms}
        plotsByFarm={{}}
        status="ready"
      />,
    );

    expect(screen.getByText("฿12,500.50")).toBeDefined();
    expect(screen.getByText("฿3,500.25")).toBeDefined();
    expect(screen.getByText("+฿9,000.25")).toBeDefined();
  });

  it("renders transactions in drilldown table", () => {
    render(
      <GardenAccountWorkbench
        summary={mockSummary}
        expenses={mockExpenses}
        sales={mockSales}
        farms={mockFarms}
        plotsByFarm={{}}
        status="ready"
      />,
    );

    expect(screen.getByText("ขายผลผลิต (ลานเทสมบูรณ์)")).toBeDefined();
    expect(screen.getByText("ปุ๋ย 15-15-15")).toBeDefined();
    expect(screen.getByText("15 ส.ค. 2569")).toBeDefined();
    expect(screen.getByText("1 ส.ค. 2569")).toBeDefined();
    expect(screen.getByText("+฿10,000.00")).toBeDefined();
    expect(screen.getByText("-฿3,000.25")).toBeDefined();
  });

  it("renders empty state when no farms exist", () => {
    render(
      <GardenAccountWorkbench
        summary={{
          netIncome: "0.00",
          expenseTotal: "0.00",
          cashResult: "0.00",
          saleCount: 0,
          expenseCount: 0,
          hasRecords: false,
        }}
        expenses={[]}
        sales={[]}
        farms={[]}
        plotsByFarm={{}}
        status="ready"
      />,
    );

    expect(
      screen.getByText("คุณต้องสร้างข้อมูลสวนปาล์มก่อน จึงจะสามารถบันทึกรายรับและค่าใช้จ่ายได้"),
    ).toBeDefined();
  });
});
