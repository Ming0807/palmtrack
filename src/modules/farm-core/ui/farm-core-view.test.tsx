import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("../server/actions", () => ({
  deleteFarmAction: vi.fn().mockResolvedValue({ status: "success" }),
  deletePlotAction: vi.fn().mockResolvedValue({ status: "success" }),
  createFarmAction: vi.fn().mockResolvedValue({ status: "success" }),
  updateFarmAction: vi.fn().mockResolvedValue({ status: "success" }),
  createPlotAction: vi.fn().mockResolvedValue({ status: "success" }),
  updatePlotAction: vi.fn().mockResolvedValue({ status: "success" }),
}));

import { FarmCoreView } from "./farm-core-view";

const mockFarms = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    farmerId: "22222222-2222-4222-8222-222222222222",
    name: "สวนปาล์มสมหวัง",
    locationLabel: "อ่าวลึก กระบี่",
    totalArea: "25.500",
    plotCount: 1,
    createdAt: "2026-08-25T10:00:00Z",
    plots: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        farmId: "11111111-1111-4111-8111-111111111111",
        code: "P-01",
        name: "แปลงต้นน้ำ",
        area: "12.000",
        createdAt: "2026-08-25T10:00:00Z",
      },
    ],
  },
];

describe("FarmCoreView UI Component", () => {
  it("renders empty state when no farms exist", () => {
    render(<FarmCoreView farms={[]} status="ready" />);
    expect(screen.getByText("ยังไม่มีข้อมูลสวนปาล์ม")).toBeDefined();
    expect(screen.getByText("+ เพิ่มสวนปาล์มแห่งแรก")).toBeDefined();
  });

  it("renders farms and plots with 3-decimal formatted area", () => {
    render(<FarmCoreView farms={mockFarms} status="ready" />);
    expect(screen.getByText("สวนปาล์มสมหวัง")).toBeDefined();
    expect(screen.getByText("25.500 ไร่")).toBeDefined();
    expect(screen.getByText("P-01")).toBeDefined();
    expect(screen.getByText("แปลงต้นน้ำ")).toBeDefined();
    expect(screen.getByText("(12.000 ไร่)")).toBeDefined();
  });

  it("renders forbidden state when user is not authorized", () => {
    render(<FarmCoreView farms={[]} status="forbidden" />);
    expect(
      screen.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะบทบาทเกษตรกรเท่านั้น)"),
    ).toBeDefined();
  });
});
