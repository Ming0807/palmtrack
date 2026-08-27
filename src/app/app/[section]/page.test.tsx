import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Role } from "@/modules/identity/domain/roles";
import { PENDING_SECTIONS, type PendingSectionKey } from "@/modules/navigation/module-status";

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/modules/identity/server/session", () => ({
  resolveIdentitySession: mocks.resolveSession,
}));

import ApplicationSectionPage from "@/app/app/[section]/page";

describe("ApplicationSectionPage ([section])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  describe("Session boundary handling", () => {
    it("redirects anonymous users to /sign-in", async () => {
      mocks.resolveSession.mockResolvedValue({ status: "anonymous" });

      await expect(
        ApplicationSectionPage({ params: Promise.resolve({ section: "settings" }) }),
      ).rejects.toThrow("NEXT_REDIRECT:/sign-in");
      expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
    });

    it("renders unconfigured state when session is unconfigured", async () => {
      mocks.resolveSession.mockResolvedValue({ status: "unconfigured" });

      const page = await ApplicationSectionPage({
        params: Promise.resolve({ section: "settings" }),
      });
      render(page);

      expect(screen.getByRole("heading", { name: "ยังไม่ได้เชื่อมต่อระบบยืนยันตัวตน" })).toBeInTheDocument();
    });

    it("renders configuration error state when session is configuration_error", async () => {
      mocks.resolveSession.mockResolvedValue({ status: "configuration_error" });

      const page = await ApplicationSectionPage({
        params: Promise.resolve({ section: "settings" }),
      });
      render(page);

      expect(screen.getByRole("heading", { name: "การเชื่อมต่อระบบไม่สมบูรณ์" })).toBeInTheDocument();
    });

    it("renders forbidden state when session is inactive", async () => {
      mocks.resolveSession.mockResolvedValue({ status: "inactive" });

      const page = await ApplicationSectionPage({
        params: Promise.resolve({ section: "settings" }),
      });
      render(page);

      expect(screen.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeInTheDocument();
    });

    it("renders forbidden state when session is forbidden", async () => {
      mocks.resolveSession.mockResolvedValue({ status: "forbidden" });

      const page = await ApplicationSectionPage({
        params: Promise.resolve({ section: "settings" }),
      });
      render(page);

      expect(screen.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeInTheDocument();
    });

    it("triggers notFound for unknown section slug", async () => {
      await expect(
        ApplicationSectionPage({ params: Promise.resolve({ section: "unknown-section" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });

  describe("Role-based authorization and truthful module status rendering", () => {
    const mockUserForRole = (role: Role) => ({
      status: "authorized",
      userId: `user-${role}`,
      profile: {
        id: `profile-${role}`,
        workspaceId: "ws-test",
        role,
      },
    });

    it.each([
      ["admin", "settings", true],
      ["admin", "audit", true],
      ["admin", "my-work", false],
      ["admin", "reports", false],
      ["admin", "evaluation", false],
      ["research_manager", "settings", false],
      ["research_manager", "audit", false],
      ["research_manager", "my-work", false],
      ["research_manager", "reports", true],
      ["research_manager", "evaluation", false],
      ["field_collector", "settings", false],
      ["field_collector", "audit", false],
      ["field_collector", "my-work", true],
      ["field_collector", "reports", false],
      ["field_collector", "evaluation", false],
      ["farmer", "settings", false],
      ["farmer", "audit", false],
      ["farmer", "my-work", false],
      ["farmer", "reports", false],
      ["farmer", "evaluation", false],
      ["evaluator_readonly", "settings", false],
      ["evaluator_readonly", "audit", false],
      ["evaluator_readonly", "my-work", false],
      ["evaluator_readonly", "reports", false],
      ["evaluator_readonly", "evaluation", true],
    ] as const)(
      "role '%s' on section '%s' results in allowed=%s",
      async (role, section, isAllowed) => {
        mocks.resolveSession.mockResolvedValue(mockUserForRole(role as Role));

        const page = await ApplicationSectionPage({
          params: Promise.resolve({ section }),
        });
        const { unmount } = render(page);

        if (isAllowed) {
          const meta = PENDING_SECTIONS[section as PendingSectionKey];
          expect(screen.getByRole("heading", { level: 1, name: meta.title })).toBeInTheDocument();
          expect(screen.getByRole("status")).toHaveTextContent("ยังไม่เปิดใช้งาน");
          expect(screen.getByText(meta.description)).toBeInTheDocument();
          expect(screen.getByText(meta.statusReason)).toBeInTheDocument();
          expect(screen.getByRole("heading", { level: 2, name: "สิ่งที่โมดูลจะรองรับ" })).toBeInTheDocument();
          expect(screen.getByRole("heading", { level: 2, name: "ขั้นตอนและแผนงานถัดไป" })).toBeInTheDocument();
          expect(screen.getByRole("link", { name: "กลับสู่หน้าหลัก" })).toHaveAttribute("href", "/app");
        } else {
          expect(screen.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeInTheDocument();
          expect(screen.queryByRole("status")).not.toBeInTheDocument();
        }

        unmount();
      },
    );
  });
});
