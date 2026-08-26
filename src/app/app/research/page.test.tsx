import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/modules/identity/server/session", () => ({
  resolveIdentitySession: mocks.resolveSession,
}));

import ResearchPage from "@/app/app/research/page";

describe("research landing sampling card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSession.mockResolvedValue({
      status: "authorized",
      userId: "user-1",
      profile: { id: "profile-1", workspaceId: "workspace-1", role: "research_manager" },
    });
  });

  it("describes the Task 4 sampling route as a run list only", async () => {
    render(await ResearchPage());

    expect(screen.getByText("ดูรายการ sampling run ของพื้นที่ทำงาน")).toBeInTheDocument();
    expect(screen.queryByText(/หลักฐานการคำนวณ|workbench/u)).not.toBeInTheDocument();
  });
});
