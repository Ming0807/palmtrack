import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { AllocationChart } from "./allocation-chart";

const rows = [
  { stratumCode: "NORTH", allocated: 3, eligible: 4 },
  { stratumCode: "SOUTH", allocated: 1, eligible: 2 },
];

describe("AllocationChart", () => {
  it("shows the Thai title and a summarized accessible chart region", () => {
    render(<AllocationChart title="การจัดสรรต่อชั้นภูมิ" rows={rows} emptyLabel="ยังไม่มีข้อมูล" />);

    expect(screen.getByText("การจัดสรรต่อชั้นภูมิ")).toBeInTheDocument();
    const region = screen.getByTestId("allocation-chart");
    expect(region).toHaveAttribute(
      "aria-label",
      "ชั้นภูมิ NORTH จัดสรร ๓ จาก ๔; ชั้นภูมิ SOUTH จัดสรร ๑ จาก ๒",
    );
  });

  it("always renders a visible data table with Thai counts", () => {
    render(<AllocationChart title="การจัดสรรต่อชั้นภูมิ" rows={rows} emptyLabel="ยังไม่มีข้อมูล" />);

    const table = screen.getByRole("table", { name: "ตารางการจัดสรรต่อชั้นภูมิ" });
    const body = within(table).getAllByRole("row");
    expect(body).toHaveLength(3);
    expect(within(table).getByRole("row", { name: "NORTH ๔ ๓" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "SOUTH ๒ ๑" })).toBeInTheDocument();
  });

  it("hides the eligible column when no row carries it", () => {
    render(
      <AllocationChart
        title="การจัดสรรที่ล็อก"
        rows={[{ stratumCode: "NORTH", allocated: 40 }]}
        emptyLabel="ยังไม่มีข้อมูล"
      />,
    );

    const table = screen.getByRole("table", { name: "ตารางการจัดสรรที่ล็อก" });
    expect(within(table).queryByRole("columnheader", { name: "N_h" })).not.toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "NORTH ๔๐" })).toBeInTheDocument();
  });

  it("shows the empty label without a chart when rows are missing", () => {
    render(<AllocationChart title="การจัดสรรต่อชั้นภูมิ" rows={[]} emptyLabel="ยังไม่มีข้อมูล" />);

    expect(screen.getByText("ยังไม่มีข้อมูล")).toBeInTheDocument();
    expect(screen.queryByTestId("allocation-chart")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
