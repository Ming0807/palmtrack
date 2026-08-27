import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/app" }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/modules/identity/server/actions", () => ({
  signOutAction: vi.fn(),
}));

import { ProtectedShell } from "./protected-shell";

describe("authorized protected shell", () => {
  beforeEach(() => {
    mocks.pathname = "/app";
  });

  it("uses the browser pathname to mark the real dashboard active", () => {
    render(<ProtectedShell role="farmer"><h1>ภาพรวม</h1></ProtectedShell>);
    expect(screen.getByRole("link", { name: "ภาพรวม" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "สวนของฉัน" })).not.toHaveAttribute("aria-current");
  });

  it("renders a semantic header and exact role navigation", () => {
    render(
      <ProtectedShell role="farmer" currentPath="/app/gardens">
        <h1>สวนของฉัน</h1>
      </ProtectedShell>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PalmTrack" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("navigation", { name: "เมนูหลัก" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "สวนของฉัน" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "บัญชีสวน" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { name: "สวนของฉัน" }));
    expect(screen.queryByText(/prototype/i)).not.toBeInTheDocument();
  });

  it("marks only the current destination and keeps nav keyboard reachable", () => {
    render(
      <ProtectedShell role="admin" currentPath="/app/audit">
        <p>เนื้อหาสังเคราะห์</p>
      </ProtectedShell>,
    );

    expect(screen.getByRole("link", { name: "ตรวจสอบเหตุการณ์" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "ตั้งค่าระบบ" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "ภาพรวม" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("keeps the skip link in the keyboard order with a focusable main target", () => {
    render(
      <ProtectedShell role="research_manager" currentPath="/app/research/sampling">
        <h1>การสุ่มตัวอย่าง</h1>
      </ProtectedShell>,
    );

    expect(screen.getByRole("link", { name: "ข้ามไปยังเนื้อหาหลัก" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("[UNIT-12] renders keyboard-accessible sign-out button in the header for all roles", () => {
    render(
      <ProtectedShell role="farmer" currentPath="/app">
        <h1>ภาพรวม</h1>
      </ProtectedShell>,
    );

    const signOutButton = screen.getByRole("button", { name: "ออกจากระบบ" });
    expect(signOutButton).toBeInTheDocument();
    expect(signOutButton).toBeEnabled();
    expect(signOutButton).toHaveAttribute("type", "submit");
    expect(signOutButton).not.toHaveAttribute("tabindex", "-1");
  });
});
