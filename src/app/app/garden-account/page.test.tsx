import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  identityGateway: vi.fn(),
  resolveSession: vi.fn(),
  farmGateway: vi.fn(),
  ledgerGateway: vi.fn(),
  listFarms: vi.fn(),
  listPlots: vi.fn(),
  getWorkbenchData: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createClient }));
vi.mock("@/modules/identity/server/session", () => ({
  createSupabaseIdentityGateway: mocks.identityGateway,
  resolveIdentitySession: mocks.resolveSession,
}));
vi.mock("@/modules/farm-core/server/farm-gateway", () => ({
  createSupabaseFarmGateway: mocks.farmGateway,
}));
vi.mock("@/modules/farm-core/server/farm-service", () => ({
  listFarms: mocks.listFarms,
  listPlots: mocks.listPlots,
}));
vi.mock("@/modules/ledger/server/ledger-gateway", () => ({
  createSupabaseLedgerGateway: mocks.ledgerGateway,
}));
vi.mock("@/modules/ledger/server/ledger-service", () => ({
  getWorkbenchData: mocks.getWorkbenchData,
}));
vi.mock("@/modules/ledger/ui/garden-account-workbench", () => ({
  GardenAccountWorkbench: ({ status, errorMessage }: { status: string; errorMessage?: string }) => (
    <div>{status}:{errorMessage}</div>
  ),
}));

import GardenAccountPage from "./page";

describe("garden account page error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ status: "configured", client: {} });
    mocks.identityGateway.mockReturnValue({});
    mocks.farmGateway.mockReturnValue({});
    mocks.ledgerGateway.mockReturnValue({});
    mocks.resolveSession.mockResolvedValue({
      status: "authorized",
      userId: "user-1",
      profile: { id: "profile-1", workspaceId: "workspace-1", role: "farmer" },
    });
    mocks.getWorkbenchData.mockResolvedValue({
      status: "ready",
      summary: {},
      expenses: [],
      sales: [],
    });
  });

  it("shows a farm query error instead of a ready empty account", async () => {
    mocks.listFarms.mockResolvedValue({ status: "error", message: "โหลดสวนไม่สำเร็จ" });

    render(await GardenAccountPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("error:โหลดสวนไม่สำเร็จ")).toBeInTheDocument();
    expect(mocks.listPlots).not.toHaveBeenCalled();
  });
});
