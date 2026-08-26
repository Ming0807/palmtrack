import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

describe("Global Loading Fallback Component", () => {
  it("renders screen reader status and Thai loading copy", () => {
    render(<Loading />);

    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toBeDefined();
    expect(statusRegion.getAttribute("aria-live")).toBe("polite");

    expect(screen.getByRole("heading", { name: "กำลังโหลดข้อมูล..." })).toBeDefined();
    expect(
      screen.getByText("ระบบกำลังเตรียมข้อมูล โปรดรอสักครู่"),
    ).toBeDefined();
  });
});
