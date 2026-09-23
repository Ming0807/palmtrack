import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SamplingMember, SamplingRunDetail } from "@/modules/research/population/server/sampling-gateway";
import type { SamplingActionState } from "@/modules/research/population/server/sampling-service";
import { SamplingRunFlow } from "./sampling-run-flow";

const detail: SamplingRunDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  populationImportId: "22222222-2222-4222-8222-222222222222",
  populationSize: 121,
  targetN: 93,
  status: "locked",
  seedDigestHex: "a".repeat(64),
  candidateHash: "b".repeat(64),
  lockedAt: "2026-08-26T12:00:00.000Z",
  marginOfError: 0.05,
  formulaVersion: "yamane-v1",
  seedText: "palmtrack-acceptance-seed-v1",
  seedNormalized: "palmtrack-acceptance-seed-v1",
  seedU32: 123456789,
  algorithmVersion: "sha256-mulberry32-fy-v1",
  allocations: [
    { stratumCode: "NORTH", finalAllocation: 40 },
    { stratumCode: "SOUTH", finalAllocation: 53 },
  ],
  cancelReason: null,
  createdAt: "2026-08-26T11:00:00.000Z",
};

const members: SamplingMember[] = [
  { populationMemberId: "33333333-3333-4333-8333-333333333333", farmerCode: "SYN-001", stratumCode: "NORTH", selectionOrder: 1 },
];

function renderFlow(
  runs: { detail: SamplingRunDetail; members: SamplingMember[] }[] = [{ detail, members }],
  state: SamplingActionState = { status: "idle" },
) {
  return render(
    <SamplingRunFlow
      initialRuns={runs}
      canManage
      actionState={state}
      draftAction={vi.fn()}
      lockAction={vi.fn()}
      activateAction={vi.fn()}
      cancelAction={vi.fn()}
    />,
  );
}

describe("sampling run flow", () => {
  it("[E2E-03] shows the synthetic boundary and evidence-route steps", () => {
    renderFlow([]);
    expect(screen.getByText("ข้อมูลสังเคราะห์เท่านั้น")).toBeVisible();
    expect(screen.getByRole("heading", { name: "สุ่มตัวอย่าง" })).toBeVisible();
    expect(screen.getByText("เลือก snapshot")).toBeVisible();
    expect(screen.getByText("ตรวจสูตร")).toBeVisible();
    expect(screen.getByText("ล็อก")).toBeVisible();
    expect(screen.getByText("เปิดใช้")).toBeVisible();
    expect(screen.queryByText(/แบบสอบถาม|ความยินยอม|คำตอบ/u)).not.toBeInTheDocument();
  });

  it("[E2E-03] keeps unavailable future operations out of the action surface", () => {
    renderFlow();
    expect(screen.queryByRole("button", { name: /มอบหมาย|ส่งออก|เก็บข้อมูล/u })).not.toBeInTheDocument();
  });

  it.each([
    ["service_unavailable", "ระบบฐานข้อมูลยังไม่พร้อม"],
    ["conflict", "ข้อมูลชุดนี้เปลี่ยนไปแล้ว"],
  ])("[SEC-02] announces %s without exposing provider detail", (status, copy) => {
    renderFlow([], { status } as SamplingActionState);
    expect(screen.getByRole("status")).toHaveTextContent(copy);
    expect(screen.queryByText(/postgres|supabase|sqlstate|auth\.uid/iu)).not.toBeInTheDocument();
  });

  it("[E2E-03] shows the locked evidence with algorithm and immutable receipt", () => {
    renderFlow();
    expect(screen.getByText("sha256-mulberry32-fy-v1")).toBeVisible();
    expect(screen.getByText("NORTH")).toBeVisible();
    expect(screen.getByLabelText("คัดลอก candidate hash แบบเต็ม")).toBeEnabled();
    expect(screen.queryByRole("button", { name: /แก้ไขผลสุ่ม/u })).not.toBeInTheDocument();
  });

  it("[NFR-05/NFR-06] keeps allocation evidence readable without the chart bundle", () => {
    renderFlow();
    expect(screen.getAllByText("กำลังโหลดกราฟ…").length).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: "การจัดสรรที่ล็อก รวม 93" });
    expect(within(table).getByRole("row", { name: "NORTH 40" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "SOUTH 53" })).toBeInTheDocument();
  });
});
