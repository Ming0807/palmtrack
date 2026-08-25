import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PopulationReceipt } from "@/modules/research/population/server/population-gateway";
import type { PopulationActionState } from "@/modules/research/population/server/population-service";

import { PopulationImportFlow } from "./population-import-flow";

const idleAction = vi.fn(async (): Promise<PopulationActionState> => ({ status: "idle" }));

const acceptedReceipt: PopulationReceipt = {
  id: "11111111-1111-4111-8111-111111111111",
  sourceLabel: "ชุดทดสอบ FX-BASE",
  sourceAuthorizationRef: "SYN-FX_BASE",
  referenceDate: "2026-08-25",
  schemaVersion: "synthetic-population-v1",
  eligibilityRuleVersion: "synthetic-eligibility-v1",
  inputDigest: "eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b",
  totalCount: 3,
  eligibleCount: 2,
  excludedCount: 1,
  status: "accepted",
  createdByProfileId: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-08-25T05:00:00.000Z",
  acceptedByProfileId: "33333333-3333-4333-8333-333333333333",
  acceptedAt: "2026-08-25T06:00:00.000Z",
};

describe("PopulationImportFlow", () => {
  it("[E2E-02] shows the synthetic boundary and evidence-route steps", () => {
    render(<PopulationImportFlow initialImports={[]} createAction={idleAction} acceptAction={idleAction} />);
    expect(screen.getByText("ข้อมูลสังเคราะห์เท่านั้น")).toBeVisible();
    expect(screen.getByRole("heading", { name: "นำเข้าประชากร" })).toBeVisible();
    expect(screen.getByText("เลือกไฟล์")).toBeVisible();
    expect(screen.getByText("ตรวจทั้งชุด")).toBeVisible();
    expect(screen.queryByText(/แบบสอบถาม|ความยินยอม|คำตอบ/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /สร้างการสุ่ม|มอบหมาย|ส่งออก/u })).not.toBeInTheDocument();
  });

  it("[SEC-02] renders sanitized errors and their safe CSV projection", async () => {
    const invalidAction = vi.fn(async (): Promise<PopulationActionState> => ({
      status: "invalid",
      errors: [{ rowNumber: 2, fieldCode: "farmer_code", reasonCode: "DUPLICATE_FARMER_CODE" }],
    }));
    render(<PopulationImportFlow initialImports={[]} createAction={invalidAction} acceptAction={idleAction} />);
    fireEvent.submit(screen.getByRole("button", { name: "ตรวจและนำเข้า" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("พบข้อมูลที่ต้องแก้ไข");
    expect(screen.getByText("แถว 2 · farmer_code · DUPLICATE_FARMER_CODE")).toBeVisible();
    expect(screen.queryByText("SYN-001")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "ดาวน์โหลดรายการที่ต้องแก้" });
    expect(link).toHaveAttribute("download", "population-import-errors.csv");
    expect(decodeURIComponent(link.getAttribute("href")!.split(",")[1]!)).toBe(
      "row_number,reason_code,field_code\n2,DUPLICATE_FARMER_CODE,farmer_code\n",
    );
  });

  it.each([
    ["service_unavailable", "ระบบฐานข้อมูลยังไม่พร้อม"],
    ["conflict", "ข้อมูลชุดนี้เปลี่ยนไปแล้ว"],
  ] as const)("[SEC-02] announces %s without provider detail", async (status, copy) => {
    const action = vi.fn(async (): Promise<PopulationActionState> => ({ status }));
    render(<PopulationImportFlow initialImports={[]} createAction={action} acceptAction={idleAction} />);
    fireEvent.submit(screen.getByRole("button", { name: "ตรวจและนำเข้า" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy));
    expect(screen.queryByText(/postgres|supabase|sqlstate|auth\.uid/iu)).not.toBeInTheDocument();
  });

  it("[E2E-02] shows immutable accepted provenance", () => {
    render(<PopulationImportFlow initialImports={[acceptedReceipt]} createAction={idleAction} acceptAction={idleAction} />);
    expect(screen.getByText("synthetic-eligibility-v1")).toBeVisible();
    expect(screen.getByText("SYN-FX_BASE")).toBeVisible();
    expect(screen.getByLabelText("คัดลอก SHA-256 digest แบบเต็ม")).toBeEnabled();
    expect(screen.getByText(/ผู้รับ snapshot · โปรไฟล์ 33333333/u)).toBeVisible();
    expect(screen.getByText(/25 ส\.ค\. 2569.*เวลาไทย/u)).toBeVisible();
    expect(screen.queryByRole("button", { name: /แก้ไข snapshot/u })).not.toBeInTheDocument();
  });
});
