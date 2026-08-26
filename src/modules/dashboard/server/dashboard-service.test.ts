import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { IdentitySession } from "@/modules/identity/server/session";

import { buildDashboardModel } from "./dashboard-service";

function session(role: Extract<IdentitySession, { status: "authorized" }>["profile"]["role"]): Extract<IdentitySession, { status: "authorized" }> {
  return {
    status: "authorized",
    userId: "user-1",
    profile: { id: "profile-1", workspaceId: "workspace-1", role },
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
  };
}

describe("buildDashboardModel", () => {
  it("never reads research gateways for a farmer", async () => {
    const deps = gateways();
    const model = await buildDashboardModel({ ...deps, session: session("farmer"), now: new Date("2026-08-26T07:05:00Z") });

    expect(model.research.status).toBe("not_enabled");
    expect(deps.populationGateway.list).not.toHaveBeenCalled();
    expect(deps.samplingGateway.listRuns).not.toHaveBeenCalled();
    expect(model.operational.every((metric) => metric.status === "not_enabled")).toBe(true);
  });

  it("loads aggregate research evidence for a research manager", async () => {
    const deps = gateways();
    deps.samplingGateway.listRuns.mockResolvedValue([
      { status: "active", populationSize: 121, targetN: 93 },
    ]);
    deps.populationGateway.list.mockResolvedValue([{ status: "accepted" }]);

    const model = await buildDashboardModel({ ...deps, session: session("research_manager") });
    expect(model.research).toMatchObject({
      status: "available",
      activeRun: { populationSize: 121, targetN: 93 },
      runCount: 1,
      acceptedSnapshotCount: 1,
    });
  });
});
