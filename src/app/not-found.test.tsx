import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("Global NotFound Fallback Component", () => {
  it("renders 404 heading and working link to home/dashboard", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "ไม่พบหน้าที่ต้องการ (404)" })).toBeDefined();
    expect(
      screen.getByText("หน้าที่คุณกำลังค้นหาไม่มีอยู่ ถูกย้าย หรือที่อยู่เว็บไซต์ไม่ถูกต้อง"),
    ).toBeDefined();

    const homeLink = screen.getByRole("link", { name: "กลับสู่หน้าหลัก" });
    expect(homeLink.getAttribute("href")).toBe("/app");
  });
});
