import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  identityGateway: vi.fn(),
  resolveSession: vi.fn(),
  populationGateway: vi.fn(),
  samplingGateway: vi.fn(),
  buildModel: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createClient }));
vi.mock("@/modules/identity/server/session", () => ({
  createSupabaseIdentityGateway: mocks.identityGateway,
  resolveIdentitySession: mocks.resolveSession,
}));
vi.mock("@/modules/research/population/server/population-gateway", () => ({ createSupabasePopulationGateway: mocks.populationGateway }));
vi.mock("@/modules/research/sampling/server/sampling-gateway", () => ({ createSupabaseSamplingGateway: mocks.samplingGateway }));
vi.mock("@/modules/dashboard/server/dashboard-service", () => ({ buildDashboardModel: mocks.buildModel }));

import ApplicationHomePage from "./page";

describe("application dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ status: "configured", client: {} });
    mocks.identityGateway.mockReturnValue({});
    mocks.populationGateway.mockReturnValue({});
    mocks.samplingGateway.mockReturnValue({});
    mocks.resolveSession.mockResolvedValue({
      status: "authorized",
      userId: "user-1",
      profile: { id: "profile-1", workspaceId: "workspace-1", role: "farmer" },
    });
    mocks.buildModel.mockResolvedValue({
      role: "farmer",
      heading: "ภาพรวมสวนและข้อมูล",
      dataAsOf: "26 ส.ค. 2569 14:05 น. เวลาไทย",
      operational: [],
      analytics: { status: "not_enabled", message: "ยังไม่เปิดใช้งาน" },
      workQueue: [],
      research: { status: "not_enabled", message: "ไม่แสดงสำหรับบทบาทนี้" },
    });
  });

  it("wires an authorized session to the production dashboard provider", async () => {
    render(await ApplicationHomePage());
    expect(screen.getByRole("heading", { name: "ภาพรวมสวนและข้อมูล" })).toBeInTheDocument();
    expect(mocks.buildModel).toHaveBeenCalledWith(expect.objectContaining({
      session: expect.objectContaining({ status: "authorized" }),
      populationGateway: {},
      samplingGateway: {},
    }));
    expect(screen.queryByText("Safety Skeleton")).not.toBeInTheDocument();
  });
});
