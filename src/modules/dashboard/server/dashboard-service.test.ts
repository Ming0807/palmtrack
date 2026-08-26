import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { IdentitySession } from "@/modules/identity/server/session";

import { buildDashboardModel } from "./dashboard-service";

function session(
  role: Extract<IdentitySession, { status: "authorized" }>["profile"]["role"],
): Extract<IdentitySession, { status: "authorized" }> {
  return {
    status: "authorized",
    userId: "user-1",
    profile: {
      id: "profile-1",
      workspaceId: "workspace-1",
      role,
    },
  };
}

function gateways() {
  return {
    populationGateway: {
      create: vi.fn(),
      accept: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
    },
    samplingGateway: {
      getCandidates: vi.fn(),
      getPopulationCandidates: vi.fn(),
      createDraft: vi.fn(),
      listRuns: vi.fn().mockResolvedValue([]),
      lock: vi.fn(),
      activate: vi.fn(),
      cancel: vi.fn(),
    },
    ledgerGateway: {
      listExpenses: vi.fn().mockResolvedValue([]),
      createExpense: vi.fn().mockResolvedValue("exp-1"),
      softDeleteExpense: vi.fn().mockResolvedValue(undefined),
      listSales: vi.fn().mockResolvedValue([]),
      createSale: vi.fn().mockResolvedValue("sale-1"),
      softDeleteSale: vi.fn().mockResolvedValue(undefined),
      getSummary: vi.fn().mockResolvedValue({
        netIncome: "0.00",
        expenseTotal: "0.00",
        cashResult: "0.00",
        saleCount: 0,
        expenseCount: 0,
        hasRecords: false,
      }),
    },
  };
}

describe("buildDashboardModel", () => {
  it("never reads research gateways for a farmer and reports empty ledger metrics when no records", async () => {
    const deps = gateways();
    const model = await buildDashboardModel({
      ...deps,
      session: session("farmer"),
      now: new Date("2026-08-26T07:05:00Z"),
    });

    expect(model.research.status).toBe("not_enabled");
    expect(deps.populationGateway.list).not.toHaveBeenCalled();
    expect(deps.samplingGateway.listRuns).not.toHaveBeenCalled();
    expect(deps.ledgerGateway.getSummary).toHaveBeenCalled();
    expect(model.operational.find((m) => m.key === "net_income")?.status).toBe("empty");
    expect(model.operational.find((m) => m.key === "harvest_volume")?.status).toBe("not_enabled");
  });

  it("loads real operational metrics for a farmer with active ledger records", async () => {
    const deps = gateways();
    deps.ledgerGateway.getSummary.mockResolvedValue({
      netIncome: "12500.50",
      expenseTotal: "3500.25",
      cashResult: "9000.25",
      saleCount: 2,
      expenseCount: 2,
      hasRecords: true,
    });

    const model = await buildDashboardModel({
      ...deps,
      session: session("farmer"),
      now: new Date("2026-08-26T07:05:00Z"),
    });

    const netIncome = model.operational.find((m) => m.key === "net_income");
    expect(netIncome?.status).toBe("available");
    if (netIncome?.status === "available") {
      expect(netIncome.value).toBe("฿12,500.50");
    }

    const cashResult = model.operational.find((m) => m.key === "cash_result");
    expect(cashResult?.status).toBe("available");
    if (cashResult?.status === "available") {
      expect(cashResult.value).toBe("+฿9,000.25");
      expect(cashResult.tone).toBe("positive");
    }
  });

  it("loads aggregate research evidence for a research manager", async () => {
    const deps = gateways();
    deps.samplingGateway.listRuns.mockResolvedValue([
      { status: "active", populationSize: 121, targetN: 93 },
    ]);
    deps.populationGateway.list.mockResolvedValue([{ status: "accepted" }]);

    const model = await buildDashboardModel({
      ...deps,
      session: session("research_manager"),
    });
    expect(model.research).toMatchObject({
      status: "available",
      activeRun: { populationSize: 121, targetN: 93 },
      runCount: 1,
      acceptedSnapshotCount: 1,
    });
    expect(deps.ledgerGateway.getSummary).not.toHaveBeenCalled();
    expect(model.operational.every((m) => m.status === "not_enabled")).toBe(true);
  });
});
