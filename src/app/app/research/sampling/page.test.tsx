import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  identityGateway: vi.fn(),
  resolveSession: vi.fn(),
  redirect: vi.fn(),
  samplingGateway: vi.fn(),
  listRuns: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("next/link", () => ({
  default: (props: { href: string; children: unknown }) => ({
    type: "a",
    props: { href: props.href, children: props.children },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createClient,
}));
vi.mock("@/modules/identity/server/session", () => ({
  createSupabaseIdentityGateway: mocks.identityGateway,
  resolveIdentitySession: mocks.resolveSession,
}));
vi.mock("@/modules/research/sampling/server/sampling-gateway", () => ({
  createSupabaseSamplingGateway: mocks.samplingGateway,
}));
vi.mock("@/modules/research/sampling/server/sampling-service", () => ({
  listSamplingRuns: mocks.listRuns,
}));

import SamplingPage from "@/app/app/research/sampling/page";

describe("sampling route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ status: "configured", client: {} });
    mocks.identityGateway.mockReturnValue({});
    mocks.samplingGateway.mockReturnValue({});
    mocks.listRuns.mockResolvedValue({ status: "ready", runs: [] });
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it("redirects anonymous visitors to sign-in before loading sampling data", async () => {
    mocks.resolveSession.mockResolvedValue({ status: "anonymous" });
    await expect(SamplingPage()).rejects.toThrow("redirect:/sign-in");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });

  it.each(["admin", "evaluator_readonly"] as const)("links %s back to the app home", async (role) => {
    mocks.resolveSession.mockResolvedValue({
      status: "authorized",
      profile: { role, id: "profile-1", workspaceId: "workspace-1" },
    });
    const page = await SamplingPage();
    const serialized = JSON.stringify(page);
    expect(serialized).toContain("/app");
    expect(serialized).not.toContain("/app/research");
  });

  it("keeps the research manager link within the research area", async () => {
    mocks.resolveSession.mockResolvedValue({
      status: "authorized",
      profile: { role: "research_manager", id: "profile-1", workspaceId: "workspace-1" },
    });
    const page = await SamplingPage();
    expect(JSON.stringify(page)).toContain("/app/research");
  });

  it.each([
    ["conflict", "ไม่สามารถโหลดรายการ sampling run ได้ในขณะนี้"],
    ["replay_mismatch", "หลักฐานของ sampling run ไม่ตรงกัน จึงหยุดการทำงานไว้ก่อน"],
  ] as const)("renders a safe %s state", async (status, message) => {
    mocks.resolveSession.mockResolvedValue({
      status: "authorized",
      profile: { role: "research_manager", id: "profile-1", workspaceId: "workspace-1" },
    });
    mocks.listRuns.mockResolvedValue({ status });
    render(await SamplingPage());
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("renders configuration error when identity resolution fails", async () => {
    mocks.resolveSession.mockResolvedValue({ status: "configuration_error" });
    render(await SamplingPage());
    expect(screen.getByText("ระบบยังตรวจสอบการเข้าสู่ระบบไม่ได้ในขณะนี้ โปรดลองอีกครั้งหรือติดต่อผู้ดูแลระบบ")).toBeInTheDocument();
  });
});
