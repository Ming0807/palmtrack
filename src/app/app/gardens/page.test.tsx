import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  identityGateway: vi.fn(),
  resolveSession: vi.fn(),
  farmGateway: vi.fn(),
  listFarms: vi.fn(),
  listPlots: vi.fn(),
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
vi.mock("@/modules/farm-core/ui/farm-core-view", () => ({
  FarmCoreView: ({ status, errorMessage }: { status: string; errorMessage?: string }) => (
    <div>{status}:{errorMessage}</div>
  ),
}));

import GardensPage from "./page";

describe("gardens page error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ status: "configured", client: {} });
    mocks.identityGateway.mockReturnValue({});
    mocks.farmGateway.mockReturnValue({});
    mocks.resolveSession.mockResolvedValue({
      status: "authorized",
      userId: "user-1",
      profile: { id: "profile-1", workspaceId: "workspace-1", role: "farmer" },
    });
  });

  it("shows an error instead of an empty plot list when a plot query fails", async () => {
    mocks.listFarms.mockResolvedValue({
      status: "ready",
      farms: [{ id: "farm-1", name: "สวนทดสอบ" }],
    });
    mocks.listPlots.mockResolvedValue({ status: "error", message: "โหลดแปลงไม่สำเร็จ" });

    render(await GardensPage());

    expect(screen.getByText("error:โหลดแปลงไม่สำเร็จ")).toBeInTheDocument();
  });
});
