import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorFallback from "./error";

describe("Global Error Fallback Component", () => {
  it("renders sanitized Thai error state with alert role without leaking error message or stack trace", () => {
    const error = new Error("FATAL_SECRET_DATABASE_CONNECTION_ERROR_0x992384918239");
    const reset = vi.fn();

    render(<ErrorFallback error={error} reset={reset} />);

    const alertRegion = screen.getByRole("alert");
    expect(alertRegion).toBeDefined();
    expect(alertRegion.getAttribute("aria-live")).toBe("assertive");

    expect(screen.getByRole("heading", { name: "เกิดข้อผิดพลาดในการโหลดข้อมูล" })).toBeDefined();
    expect(
      screen.getByText("ระบบไม่สามารถแสดงผลหน้านี้ได้ในขณะนี้ โปรดลองใหม่อีกครั้ง หรือกลับสู่หน้าหลัก"),
    ).toBeDefined();

    // MUST NOT leak secret error message
    expect(screen.queryByText(/FATAL_SECRET_DATABASE_CONNECTION_ERROR/u)).toBeNull();
    expect(screen.queryByText(/0x992384918239/u)).toBeNull();

    // Try again button triggers reset
    const retryButton = screen.getByRole("button", { name: "ลองใหม่อีกครั้ง" });
    fireEvent.click(retryButton);
    expect(reset).toHaveBeenCalledTimes(1);

    // Return to home link exists
    const homeLink = screen.getByRole("link", { name: "กลับหน้าหลัก" });
    expect(homeLink.getAttribute("href")).toBe("/app");
  });
});
