import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildPrototypeDashboardModel } from "@/modules/dashboard/domain/dashboard-fixtures";

import { DashboardOverview } from "./dashboard-overview";

describe("DashboardOverview", () => {
  it("leads with farm operations and keeps research support secondary", () => {
    render(
      <DashboardOverview
        model={buildPrototypeDashboardModel("research_manager", "typical")}
        synthetic
      />,
    );

    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings).toEqual([
      "ภาพรวมสวนและข้อมูล",
      "สรุปการดำเนินงาน",
      "แนวโน้มการเงินและผลผลิต",
      "งานที่ควรทำต่อ",
      "หลักฐานสนับสนุนงานวิจัย",
    ]);
    expect(screen.getByText("ข้อมูลสังเคราะห์")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "ข้อมูลแนวโน้มรายเดือน" })).toBeInTheDocument();
  });

  it("renders truthful loading state without fabricated values", () => {
    render(<DashboardOverview model={buildPrototypeDashboardModel("farmer", "loading")} synthetic />);
    expect(screen.getAllByText("กำลังโหลดข้อมูล").length).toBeGreaterThan(0);
    expect(screen.queryByText("฿259,400.00")).not.toBeInTheDocument();
  });

  it("keeps pending reasons visible and announces unavailable states", () => {
    render(<DashboardOverview model={buildPrototypeDashboardModel("farmer", "unavailable")} synthetic />);
    expect(screen.getAllByText("โมดูลการเก็บเกี่ยวยังไม่เปิดใช้งาน").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });
});
