import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PopulationReceipt } from "@/modules/research/population/server/population-gateway";
import type { SamplingEvidence } from "@/modules/research/sampling/domain/deterministic-sampling";
import type { SamplingRun } from "@/modules/research/sampling/server/sampling-gateway";
import type {
  SamplingPreviewState,
  SamplingRunState,
} from "@/modules/research/sampling/server/sampling-service";

import { SamplingWorkbench } from "./sampling-workbench";

vi.setConfig({ testTimeout: 15000 });

const importId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";

const acceptedSnapshot: PopulationReceipt = {
  id: importId,
  sourceLabel: "ชุดสังเคราะห์ FX-BASE",
  sourceAuthorizationRef: "SYN-FX_BASE",
  referenceDate: "2026-08-25",
  schemaVersion: "synthetic-population-v1",
  eligibilityRuleVersion: "synthetic-eligibility-v1",
  inputDigest: "eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b",
  totalCount: 121,
  eligibleCount: 121,
  excludedCount: 0,
  status: "accepted",
  createdByProfileId: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-08-25T05:00:00.000Z",
  acceptedByProfileId: "44444444-4444-4444-8444-444444444444",
  acceptedAt: "2026-08-25T06:00:00.000Z",
};

const evidence = {
  algorithmVersion: "sha256-mulberry32-fy-v1",
  formulaVersion: "yamane-v1",
  formula: {
    populationSize: 121,
    marginOfError: 0.05,
    unrounded: 92.897644445,
    roundingRule: "ceil",
    targetN: 93,
  },
  populationSize: 121,
  marginOfError: 0.05,
  unrounded: 92.897644445,
  roundingRule: "ceil",
  targetN: 93,
  seedText: "palmtrack-acceptance-seed-v1",
  seedNormalized: "palmtrack-acceptance-seed-v1",
  seedNormalizedUtf8Hex: "70616c6d747261636b2d616363657074616e63652d736565642d7631",
  seedDigestHex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  seedU32: 19088743,
  orderedCandidateSetByteStreamHex: "00",
  orderedCandidateSetHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  initialCandidateMemberIds: ["55555555-5555-4555-8555-555555555555"],
  swapTrace: [],
  shuffledMemberIds: ["55555555-5555-4555-8555-555555555555"],
  allocationRows: [
    { stratumCode: "NORTH", eligibleCount: 61, quota: 46.983, floorAllocation: 46, remainder: 0.983, finalAllocation: 47 },
    { stratumCode: "SOUTH", eligibleCount: 60, quota: 46.016, floorAllocation: 46, remainder: 0.016, finalAllocation: 46 },
  ],
  orderedSelectedMembers: [
    { memberId: "55555555-5555-4555-8555-555555555555", stratumCode: "NORTH", selectionOrder: 1 },
  ],
  orderedSelectedMemberIds: ["55555555-5555-4555-8555-555555555555"],
  orderedResultDigestVersion: "ordered-result-sha256-v1",
  orderedResultHash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
} satisfies SamplingEvidence;

const initialRun: SamplingRun = {
  id: runId,
  version: 1,
  populationImportId: importId,
  populationSize: 121,
  marginOfError: 0.05,
  unroundedResult: 92.897644445,
  roundingRule: "ceil",
  targetN: 93,
  formulaVersion: "yamane-v1",
  stratumDefinitionVersion: "synthetic-strata-v1",
  seedText: evidence.seedText,
  seedNormalized: evidence.seedNormalized,
  seedNormalizedUtf8Hex: evidence.seedNormalizedUtf8Hex,
  seedDigestHex: evidence.seedDigestHex,
  seedU32: evidence.seedU32,
  algorithmVersion: evidence.algorithmVersion,
  orderedCandidateSetHash: evidence.orderedCandidateSetHash,
  orderedResultHash: evidence.orderedResultHash,
  status: "draft",
  createdAt: "2026-08-26T01:00:00.000Z",
  updatedAt: "2026-08-26T01:00:01.000Z",
  lockedAt: null,
  activatedAt: null,
  supersededAt: null,
  cancelledAt: null,
  cancellationReasonDigest: null,
  allocationEvidence: evidence.allocationRows,
  resultEvidence: evidence,
};

const idlePreview = vi.fn(async (): Promise<SamplingPreviewState> => ({ status: "invalid" }));
const idleRun = vi.fn(async (): Promise<SamplingRunState> => ({ status: "invalid" }));

function renderWorkbench(overrides: Partial<React.ComponentProps<typeof SamplingWorkbench>> = {}) {
  return render(
    <SamplingWorkbench
      initialImports={[acceptedSnapshot]}
      initialRuns={[]}
      previewAction={idlePreview}
      createDraftAction={idleRun}
      lockAction={idleRun}
      activateAction={idleRun}
      cancelAction={idleRun}
      {...overrides}
    />,
  );
}

describe("SamplingWorkbench", () => {
  it("starts with one Thai worksheet and accepted snapshot inputs", () => {
    renderWorkbench();

    expect(screen.getByRole("heading", { name: "สร้างการสุ่มตัวอย่าง" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "สร้างการสุ่มตัวอย่าง" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("ข้อมูลสังเคราะห์เท่านั้น")).toBeVisible();
    expect(screen.getByLabelText("ประชากรที่รับรองแล้ว")).toHaveValue(importId);
    expect(screen.getByLabelText(/ค่าความคลาดเคลื่อน \(e\)/u)).toHaveValue(0.05);
    expect(screen.getByLabelText(/seed สำหรับการสุ่ม/u)).toHaveValue("palmtrack-acceptance-seed-v1");
    expect(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" })).toBeEnabled();
  });

  it("previews Yamane and allocation evidence from the selected inputs", async () => {
    let submitted: FormData | null = null;
    const preview = vi.fn(async (_previous: SamplingPreviewState, form: FormData): Promise<SamplingPreviewState> => {
      submitted = form;
      return { status: "ready", evidence };
    });
    renderWorkbench({ previewAction: preview });

    fireEvent.click(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "ผลคำนวณเบื้องต้น" })).toBeVisible(), { timeout: 5000 });
    expect(screen.getByText("Yamane · yamane-v1")).toBeVisible();
    expect(screen.getByText("92.897644445")).toBeVisible();
    expect(screen.getByText("การจัดสรรตามชั้นพื้นที่ · รวม 93 ราย")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "quota" })).toBeVisible();
    expect(screen.getByText("sha256-mulberry32-fy-v1")).toBeVisible();
    expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง" })).toBeVisible();
    expect((submitted as FormData | null)?.get("populationImportId")).toBe(importId);
    expect((submitted as FormData | null)?.get("marginOfError")).toBe("0.05");
    expect((submitted as FormData | null)?.get("seedText")).toBe("palmtrack-acceptance-seed-v1");
  });

  it("exposes all allocation fields as labeled cells and a stable receipt hook", async () => {
    renderWorkbench({
      initialRuns: [initialRun],
      previewAction: vi.fn(async (): Promise<SamplingPreviewState> => ({ status: "ready", evidence })),
    });

    const receipt = screen.getByTestId("sampling-run-receipt");
    expect(receipt).toHaveAttribute("data-run-id", runId);
    expect(receipt).toHaveAttribute("data-run-version", "1");

    fireEvent.click(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "ผลคำนวณเบื้องต้น" })).toBeVisible(), { timeout: 5000 });

    const previewRegion = screen.getByRole("region", { name: "ผลคำนวณเบื้องต้น" });
    const allocationTable = within(previewRegion)
      .getByRole("region", { name: "ตารางการจัดสรรตามชั้นพื้นที่" })
      .querySelector("table");
    expect(allocationTable).not.toBeNull();
    const firstRowLabels = Array.from(allocationTable!.querySelectorAll("tbody tr:first-child [data-label]"), (cell) => cell.getAttribute("data-label"));
    expect(firstRowLabels).toEqual(["ชั้นพื้นที่", "N_h", "quota", "floor", "เศษเหลือ", "จัดสรรจริง"]);
    expect(allocationTable!.querySelector('tfoot [data-label="จัดสรรจริง"]')).toHaveTextContent("93");
  });

  it("shows safe validation copy and keeps full digests available as text", async () => {
    let attempts = 0;
    const preview = vi.fn(async (): Promise<SamplingPreviewState> => {
      attempts += 1;
      return attempts === 1 ? { status: "invalid" } : { status: "ready", evidence };
    });
    renderWorkbench({ previewAction: preview });
    fireEvent.click(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("ตรวจข้อมูลที่กรอกอีกครั้ง แล้วลองใหม่"), { timeout: 5000 });
    expect(screen.queryByText(/database|supabase|SQL|ข้อผิดพลาดภายใน/iu)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }));
    await waitFor(() => expect(screen.getByText(evidence.seedDigestHex)).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText(evidence.orderedCandidateSetHash)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "คัดลอก seed digest แบบเต็ม" })).toBeVisible();
  });

  it("saves a reviewed preview as a draft through the server action boundary", async () => {
    let submitted: FormData | null = null;
    const create = vi.fn(async (_previous: SamplingRunState, form: FormData): Promise<SamplingRunState> => {
      submitted = form;
      return { status: "ready", run: initialRun };
    });
    renderWorkbench({
      previewAction: vi.fn(async (): Promise<SamplingPreviewState> => ({ status: "ready", evidence })),
      createDraftAction: create,
    });

    fireEvent.click(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง" })).toBeVisible(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกฉบับร่าง" }));
    await waitFor(() => expect(screen.getByText(/ฉบับร่าง · รอการล็อก/u)).toBeVisible(), { timeout: 5000 });
    expect((submitted as FormData | null)?.get("populationImportId")).toBe(importId);
    expect((submitted as FormData | null)?.get("stratumDefinitionVersion")).toBe("synthetic-strata-v1");
  });

  it("locks then activates a draft through explicit confirmations", async () => {
    const lockedRun = { ...initialRun, status: "locked" as const, lockedAt: "2026-08-26T02:00:00.000Z" };
    const activeRun = { ...lockedRun, status: "active" as const, activatedAt: "2026-08-26T02:05:00.000Z" };
    let lockedForm: FormData | null = null;
    let activatedForm: FormData | null = null;
    const lock = vi.fn(async (_previous: SamplingRunState, form: FormData): Promise<SamplingRunState> => {
      lockedForm = form;
      return { status: "ready", run: lockedRun };
    });
    const activate = vi.fn(async (_previous: SamplingRunState, form: FormData): Promise<SamplingRunState> => {
      activatedForm = form;
      return { status: "ready", run: activeRun };
    });
    renderWorkbench({ initialRuns: [initialRun], lockAction: lock, activateAction: activate });

    fireEvent.click(screen.getByRole("button", { name: "ล็อกหลักฐาน" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("เมื่อล็อกแล้ว input, seed, candidate hash และผลลัพธ์จะแก้ไขไม่ได้");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "ล็อกหลักฐาน" }));
    await waitFor(() => expect(screen.getByText(/ล็อกแล้ว · แก้ไขไม่ได้/u)).toBeVisible(), { timeout: 5000 });
    expect(screen.getByRole("button", { name: "เปิดใช้งาน" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "เปิดใช้งาน" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("active เดิมจะถูกแทนที่");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "เปิดใช้งาน" }));
    await waitFor(() => expect(screen.getByText(/กำลังใช้งาน · เป็นชุดปัจจุบัน/u)).toBeVisible(), { timeout: 5000 });
    expect(screen.getByText(/สถานะ: กำลังใช้งาน/u)).toHaveAttribute("data-status", "active");
    expect((lockedForm as FormData | null)?.get("runId")).toBe(runId);
    expect((activatedForm as FormData | null)?.get("runId")).toBe(runId);
  });

  it("requires a reason before destructive cancellation and keeps controls locked while loading", async () => {
    let resolveCancel!: (state: SamplingRunState) => void;
    const cancel = vi.fn(() => new Promise<SamplingRunState>((resolve) => { resolveCancel = resolve; }));
    renderWorkbench({ initialRuns: [initialRun], cancelAction: cancel });

    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก run" }));
    const dialog = screen.getByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "ยืนยันยกเลิก" });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("เหตุผลการยกเลิก"), { target: { value: "ทดสอบเหตุผล" } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "ยกเลิก run", hidden: true })).toBeDisabled();

    resolveCancel({ status: "ready", run: { ...initialRun, status: "cancelled" as const, cancelledAt: "2026-08-26T02:10:00.000Z" } });
    await waitFor(() => expect(screen.getByText(/ยกเลิกแล้ว · เลือกใช้ไม่ได้/u)).toBeVisible(), { timeout: 5000 });
    expect(screen.getByText(/สถานะ: ยกเลิกแล้ว/u)).toHaveAttribute("data-status", "cancelled");
  });

  it("invalidates a preview when any input changes and keeps e as the submitted string", async () => {
    let submitted: FormData | null = null;
    const preview = vi.fn(async (_previous: SamplingPreviewState, form: FormData): Promise<SamplingPreviewState> => {
      submitted = form;
      return { status: "ready", evidence };
    });
    renderWorkbench({ previewAction: preview });

    fireEvent.click(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }));
    await waitFor(() => expect(screen.getByText("ผลคำนวณเบื้องต้นพร้อมตรวจสอบ")).toBeVisible(), { timeout: 5000 });
    expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/ค่าความคลาดเคลื่อน \(e\)/u), { target: { value: "0.050" } });
    expect(screen.queryByRole("button", { name: "บันทึกฉบับร่าง" })).not.toBeInTheDocument();
    expect(screen.getByText("ข้อมูลเปลี่ยนแล้ว · ดูตัวอย่างหลักฐานใหม่ก่อนบันทึก")).toBeVisible();
    expect(preview).toHaveBeenCalledTimes(1);
    expect((submitted as FormData | null)?.get("marginOfError")).toBe("0.05");
  });

  it("keeps the idempotency key stable across retry and rotates only after success", async () => {
    const keys: string[] = [];
    let attempts = 0;
    const create = vi.fn(async (_previous: SamplingRunState, form: FormData): Promise<SamplingRunState> => {
      keys.push(String(form.get("idempotencyKey")));
      attempts += 1;
      return attempts === 1 ? { status: "conflict" } : { status: "ready", run: initialRun };
    });
    renderWorkbench({
      previewAction: vi.fn(async (): Promise<SamplingPreviewState> => ({ status: "ready", evidence })),
      createDraftAction: create,
    });
    fireEvent.click(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง" })).toBeVisible(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกฉบับร่าง" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลเปลี่ยนไปแล้ว"), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกฉบับร่างอีกครั้ง" }));
    await waitFor(() => expect(screen.getByText(/บันทึกฉบับร่างแล้ว/u)).toBeVisible(), { timeout: 5000 });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("supersedes the prior active run in the local receipt immediately", async () => {
    const priorActive = { ...initialRun, id: "66666666-6666-4666-8666-666666666666", status: "active" as const };
    const lockedRun = { ...initialRun, status: "locked" as const, lockedAt: "2026-08-26T02:00:00.000Z" };
    const activeRun = { ...lockedRun, status: "active" as const, activatedAt: "2026-08-26T02:05:00.000Z" };
    renderWorkbench({
      initialRuns: [priorActive, lockedRun],
      activateAction: vi.fn(async (): Promise<SamplingRunState> => ({ status: "ready", run: activeRun })),
    });
    fireEvent.click(screen.getByRole("button", { name: "เปิดใช้งาน" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "เปิดใช้งาน" }));
    await waitFor(() => expect(screen.getByText(/แทนที่แล้ว · หลักฐานย้อนหลัง/u)).toBeVisible(), { timeout: 5000 });
    expect(screen.getByText(/สถานะ: กำลังใช้งาน/u)).toHaveAttribute("data-status", "active");
  });

  it("does not let a stale lifecycle response overwrite newer server props", async () => {
    const newerDraft = { ...initialRun, updatedAt: "2026-08-26T03:00:00.000Z" };
    const lock = vi.fn(async (): Promise<SamplingRunState> => ({
      status: "ready",
      run: { ...initialRun, status: "locked", lockedAt: "2026-08-26T02:00:00.000Z" },
    }));
    renderWorkbench({ initialRuns: [newerDraft], lockAction: lock });

    fireEvent.click(screen.getByRole("button", { name: "ล็อกหลักฐาน" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "ล็อกหลักฐาน" }));

    await waitFor(() => expect(screen.getByText(/สถานะ: ฉบับร่าง/u)).toBeVisible(), { timeout: 5000 });
    expect(screen.queryByText(/สถานะ: ล็อกแล้ว/u)).not.toBeInTheDocument();
  });

  it("gives read-only users receipts without a disabled mutation form", () => {
    renderWorkbench({ canMutate: false, initialRuns: [initialRun] });
    expect(screen.queryByLabelText("ประชากรที่รับรองแล้ว")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ดูตัวอย่างหลักฐาน|บันทึกฉบับร่าง/u })).not.toBeInTheDocument();
    expect(screen.getByText("บัญชีนี้อ่านหลักฐานได้ แต่ไม่มีสิทธิ์เปลี่ยนสถานะ run")).toBeVisible();
    expect(screen.getByText(/สถานะ: ฉบับร่าง/u)).toBeVisible();
  });

  it("shows a linked field error before dispatching an invalid preview", () => {
    const preview = vi.fn(async (): Promise<SamplingPreviewState> => ({ status: "ready", evidence }));
    renderWorkbench({ previewAction: preview });
    fireEvent.change(screen.getByLabelText(/ค่าความคลาดเคลื่อน \(e\)/u), { target: { value: "" } });
    fireEvent.submit(screen.getByRole("button", { name: "ดูตัวอย่างหลักฐาน" }).closest("form") as HTMLFormElement);
    expect(screen.getByText("ระบุค่า e ระหว่าง 0 ถึง 1")).toBeVisible();
    expect(screen.getByLabelText(/ค่าความคลาดเคลื่อน \(e\)/u)).toHaveAttribute("aria-describedby", expect.stringContaining("sampling-margin-error"));
    expect(preview).not.toHaveBeenCalled();
  });

  it("dismisses confirmation with Escape and restores focus to the trigger", () => {
    renderWorkbench({ initialRuns: [initialRun] });
    const trigger = screen.getByRole("button", { name: "ล็อกหลักฐาน" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
