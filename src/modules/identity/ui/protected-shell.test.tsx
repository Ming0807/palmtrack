import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProtectedShell } from "./protected-shell";

describe("authorized protected shell", () => {
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
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("tabindex", "-1");
    }
  });
});
