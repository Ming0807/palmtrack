"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import { Check, Clipboard, LockKeyhole, Play, RefreshCw, X } from "lucide-react";
import Link from "next/link";

import type { PopulationReceipt } from "@/modules/research/population/server/population-gateway";
import type { SamplingEvidence } from "@/modules/research/sampling/domain/deterministic-sampling";
import type { SamplingRun, SamplingRunSummary } from "@/modules/research/sampling/server/sampling-gateway";
import type { SamplingPreviewState, SamplingRunState } from "@/modules/research/sampling/server/sampling-service";

import styles from "./sampling-workbench.module.css";

type IdleState = { status: "idle" };
type PreviewAction = (previous: SamplingPreviewState, formData: FormData) => Promise<SamplingPreviewState>;
type RunAction = (previous: SamplingRunState, formData: FormData) => Promise<SamplingRunState>;
type PreviewInputSnapshot = { populationImportId: string; marginOfError: string; seedText: string; stratumDefinitionVersion: string };

export type SamplingWorkbenchProps = {
  initialImports: PopulationReceipt[];
  initialRuns: SamplingRunSummary[];
  initialRunDetails?: SamplingRun[];
  canMutate?: boolean;
  previewAction: PreviewAction;
  createDraftAction: RunAction;
  lockAction: RunAction;
  activateAction: RunAction;
  cancelAction: RunAction;
};

const initialPreview: IdleState = { status: "idle" };
const initialRun: IdleState = { status: "idle" };
const STRATUM_DEFINITION_VERSION = "synthetic-strata-v1";

const statusLabels: Record<SamplingRunSummary["status"], string> = {
  draft: "ฉบับร่าง · รอการล็อก",
  locked: "ล็อกแล้ว · แก้ไขไม่ได้",
  active: "กำลังใช้งาน · เป็นชุดปัจจุบัน",
  superseded: "แทนที่แล้ว · หลักฐานย้อนหลัง",
  cancelled: "ยกเลิกแล้ว · เลือกใช้ไม่ได้",
};

function thaiDate(value: string): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function number(value: number, maximumFractionDigits = 12): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits });
}

function stateMessage(state: SamplingPreviewState | SamplingRunState | IdleState): string | null {
  if (state.status === "idle" || state.status === "ready") return null;
  if (state.status === "invalid") return "ตรวจข้อมูลที่กรอกอีกครั้ง แล้วลองใหม่";
  if (state.status === "forbidden") return "บัญชีนี้ไม่มีสิทธิ์ดำเนินการสุ่มตัวอย่าง";
  if (state.status === "conflict") return "ข้อมูลเปลี่ยนไปแล้ว โปรดลองอีกครั้งด้วยหลักฐานล่าสุด";
  if (state.status === "replay_mismatch") return "หลักฐานไม่ตรงกัน ระบบจึงหยุดการดำเนินการไว้ก่อน";
  return "ระบบยังไม่พร้อม โปรดลองอีกครั้งภายหลัง";
}

function DigestValue({ label, value }: { label: string; value: string }) {
  const short = `${value.slice(0, 16)}…${value.slice(-8)}`;
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "failure">("idle");
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopyStatus("success");
    } catch {
      setCopyStatus("failure");
    }
  };
  return (
    <div className={styles.digestValue}>
      <code title={value}>{short}</code>
      <button type="button" className={styles.iconButton} onClick={copy} aria-label={`คัดลอก ${label} แบบเต็ม`}><Clipboard size={16} aria-hidden="true" /></button>
      <details className={styles.digestDetails}><summary>แสดงค่าเต็ม</summary><code>{value}</code></details>
      <span className={styles.copyFeedback} role="status" aria-live="polite">{copyStatus === "success" ? "คัดลอกแล้ว" : copyStatus === "failure" ? "คัดลอกไม่สำเร็จ · เลือกค่าเต็มด้านล่างเพื่อคัดลอก" : ""}</span>
    </div>
  );
}

function StateNotice({ state }: { state: SamplingPreviewState | SamplingRunState | IdleState }) {
  const message = stateMessage(state);
  return message ? <p className={styles.feedbackError} role="alert" aria-live="polite">{message}</p> : null;
}

function EvidencePreview({ evidence, context = "preview", title, titleId = "sampling-evidence-title" }: { evidence: SamplingEvidence; context?: "preview" | "persisted"; title?: string; titleId?: string }) {
  const isPersisted = context === "persisted";
  return (
    <section className={styles.evidenceSection} aria-labelledby={titleId}>
      <div className={styles.sectionHeading}>
        <div><h2 id={titleId}>{title ?? (isPersisted ? "หลักฐานที่บันทึกไว้" : "ผลคำนวณเบื้องต้น")}</h2><p>คำนวณจาก snapshot ที่รับรองแล้วด้วยกติกาเดียวกันทุกครั้ง</p>{!isPersisted && <p className={styles.feedbackSuccess} role="status" aria-live="polite">ผลคำนวณเบื้องต้นพร้อมตรวจสอบ</p>}</div>
        <span className={styles.evidenceMark}><Check size={16} aria-hidden="true" />ตรวจสูตรแล้ว</span>
      </div>
      <dl className={styles.formula}>
        <div><dt>สูตร</dt><dd>Yamane · {evidence.formulaVersion}</dd></div>
        <div><dt>ประชากร N</dt><dd>{number(evidence.populationSize, 0)} ราย</dd></div>
        <div><dt>ค่าคลาดเคลื่อน e</dt><dd>{number(evidence.marginOfError)}</dd></div>
        <div><dt>ผลก่อนปัด</dt><dd>{number(evidence.unrounded)}</dd></div>
        <div><dt>กติกาปัด</dt><dd>ceil</dd></div>
        <div><dt>ตัวอย่าง n</dt><dd className={styles.emphasis}>{number(evidence.targetN, 0)} ราย</dd></div>
      </dl>
      <div className={styles.tableWrap} role="region" aria-label="ตารางการจัดสรรตามชั้นพื้นที่" tabIndex={0}>
        <table className={styles.evidenceTable}>
          <caption>การจัดสรรตามชั้นพื้นที่ · รวม {number(evidence.targetN, 0)} ราย</caption>
          <thead><tr><th scope="col">ชั้นพื้นที่</th><th scope="col">N<sub>h</sub></th><th scope="col">quota</th><th scope="col">floor</th><th scope="col">เศษเหลือ</th><th scope="col">จัดสรรจริง</th></tr></thead>
          <tbody>{evidence.allocationRows.map((row) => <tr key={row.stratumCode}><th scope="row">{row.stratumCode}</th><td>{number(row.eligibleCount, 0)}</td><td>{number(row.quota)}</td><td>{number(row.floorAllocation, 0)}</td><td>{number(row.remainder)}</td><td className={styles.emphasis}>{number(row.finalAllocation, 0)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row">รวม</th><td>{number(evidence.populationSize, 0)}</td><td colSpan={3}>—</td><td>{number(evidence.targetN, 0)}</td></tr></tfoot>
        </table>
      </div>
      <dl className={styles.receiptGrid}>
        <div><dt>seed ที่ normalize แล้ว</dt><dd><code>{evidence.seedNormalized}</code></dd></div>
        <div><dt>seed digest · SHA-256</dt><dd><DigestValue label="seed digest" value={evidence.seedDigestHex} /></dd></div>
        <div><dt>algorithm</dt><dd><code>{evidence.algorithmVersion}</code></dd></div>
        <div><dt>ordered candidate-set hash</dt><dd><DigestValue label="candidate-set hash" value={evidence.orderedCandidateSetHash} /></dd></div>
        <div><dt>ordered result hash · {evidence.orderedResultDigestVersion}</dt><dd><DigestValue label="ordered result hash" value={evidence.orderedResultHash} /></dd></div>
      </dl>
      <div className={styles.resultEvidence}>
        <h3>ผลลัพธ์ที่เรียงลำดับแล้ว</h3><p>เลือกแล้ว {number(evidence.orderedSelectedMembers.length, 0)} ราย · ลำดับและชั้นพื้นที่ถูกบันทึกเป็นหลักฐาน</p>
        <div className={styles.tableWrap} role="region" aria-label="ตารางผลลัพธ์ที่เรียงลำดับแล้ว" tabIndex={0}>
          <table className={styles.selectedTable}><caption>รายการตัวอย่างแบบไม่เปิดเผยข้อมูลติดต่อ</caption><thead><tr><th scope="col">ลำดับ</th><th scope="col">ชั้นพื้นที่</th></tr></thead><tbody>{evidence.orderedSelectedMembers.slice(0, 20).map((member) => <tr key={`${member.selectionOrder}-${member.stratumCode}`}><th scope="row">{member.selectionOrder}</th><td>{member.stratumCode}</td></tr>)}</tbody></table>
        </div>
        {evidence.orderedSelectedMembers.length > 20 && <p className={styles.muted}>แสดง 20 ลำดับแรก · หลักฐานฉบับเต็มถูกเก็บบนเซิร์ฟเวอร์แบบตรวจสอบย้อนหลังได้</p>}
      </div>
    </section>
  );
}

type Confirmation = { kind: "lock" | "activate" | "cancel"; run: SamplingRunSummary };

function ConfirmationDialog({ confirmation, pending, cancelReason, setCancelReason, submitLock, submitActivate, submitCancel, onDismiss, restoreFocusRef, restoreFocusOnClose }: { confirmation: Confirmation; pending: boolean; cancelReason: string; setCancelReason: (value: string) => void; submitLock: (formData: FormData) => void; submitActivate: (formData: FormData) => void; submitCancel: (formData: FormData) => void; onDismiss: () => void; restoreFocusRef: RefObject<HTMLElement | null>; restoreFocusOnClose: boolean }) {
  const { kind, run } = confirmation;
  const isCancel = kind === "cancel";
  const title = kind === "lock" ? "ยืนยันการล็อกหลักฐาน" : kind === "activate" ? "ยืนยันการเปิดใช้งาน" : "ยืนยันการยกเลิก";
  const description = kind === "lock" ? "เมื่อล็อกแล้ว input, seed, candidate hash และผลลัพธ์จะแก้ไขไม่ได้" : kind === "activate" ? "run นี้จะเป็นชุดตัวอย่างปัจจุบัน และ active เดิมจะถูกแทนที่ตามกติกา" : "การยกเลิกเป็นสถานะสิ้นสุด และ run นี้จะเลือกใช้กับการวิเคราะห์ไม่ได้";
  const action = kind === "lock" ? submitLock : kind === "activate" ? submitActivate : submitCancel;
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstControlRef = useRef<HTMLInputElement | HTMLButtonElement>(null);
  const dismissRef = useRef(onDismiss);
  const restoreFocusOnCloseRef = useRef(restoreFocusOnClose);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    restoreFocusOnCloseRef.current = restoreFocusOnClose;
  }, [restoreFocusOnClose]);
  useEffect(() => {
    const previousFocus = restoreFocusRef.current ?? document.activeElement as HTMLElement | null;
    firstControlRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismissRef.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); if (restoreFocusOnCloseRef.current && previousFocus?.isConnected) previousFocus.focus(); };
  }, [restoreFocusRef]);
  return (
    <div className={styles.dialogScrim}>
      <div ref={dialogRef} className={styles.confirmation} role="dialog" aria-modal="true" aria-labelledby="sampling-confirm-title" aria-describedby="sampling-confirm-description">
        <form action={action} className={styles.confirmForm}>
          <h3 id="sampling-confirm-title">{title}</h3><p id="sampling-confirm-description">{description}</p>
          {isCancel && <><label className={styles.confirmReason} htmlFor="sampling-cancel-reason">เหตุผลการยกเลิก<input ref={firstControlRef as RefObject<HTMLInputElement>} id="sampling-cancel-reason" name="reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} minLength={3} maxLength={500} required aria-describedby="sampling-cancel-reason-help" /></label><small id="sampling-cancel-reason-help" className={styles.confirmReasonHelp}>อย่างน้อย 3 ตัวอักษร</small></>}
          <input type="hidden" name="runId" value={run.id} />
          <div className={styles.confirmActions}>
            <button ref={!isCancel ? firstControlRef as RefObject<HTMLButtonElement> : undefined} type="button" className={styles.secondaryButton} onClick={onDismiss} disabled={pending}>กลับไปตรวจสอบ</button>
            <button type="submit" className={isCancel ? styles.dangerButton : styles.primaryButton} disabled={pending || (isCancel && cancelReason.trim().length < 3)}>{pending ? "กำลังบันทึก…" : kind === "lock" ? "ล็อกหลักฐาน" : kind === "activate" ? "เปิดใช้งาน" : "ยืนยันยกเลิก"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RunReceipt({ run, detail, isLatest, focusOnSuccess, onConfirm, disabled }: { run: SamplingRunSummary; detail?: SamplingRun; isLatest: boolean; focusOnSuccess: boolean; onConfirm: (kind: Confirmation["kind"], run: SamplingRunSummary, trigger: HTMLElement) => void; disabled: boolean }) {
  const statusClass = styles[`status_${run.status}` as keyof typeof styles];
  const detailEvidence = detail?.evidence ?? detail?.resultEvidence;
  const receiptHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnSuccess) receiptHeadingRef.current?.focus();
  }, [focusOnSuccess]);
  return (
    <li className={styles.runReceipt}>
      <div className={styles.runHeader}><div><h3 ref={receiptHeadingRef} tabIndex={-1}>Sampling run <span>v{run.version}</span></h3><p>สร้างเมื่อ {thaiDate(run.createdAt)}</p></div><span className={`${styles.status} ${statusClass}`} data-status={run.status}>สถานะ: {statusLabels[run.status]}</span></div>
      <dl className={styles.runFacts}><div><dt>ประชากร</dt><dd>{number(run.populationSize, 0)} ราย</dd></div><div><dt>e</dt><dd>{number(run.marginOfError)}</dd></div><div><dt>ตัวอย่าง n</dt><dd>{number(run.targetN, 0)} ราย</dd></div><div><dt>สูตร</dt><dd>{run.formulaVersion}</dd></div><div><dt>การจัดสรร</dt><dd>{run.allocationEvidence.length} ชั้นพื้นที่</dd></div><div><dt>ordered result hash</dt><dd><DigestValue label="ordered result hash" value={run.orderedResultHash} /></dd></div></dl>
      {detailEvidence && <details className={styles.persistedEvidence} open={isLatest || run.status === "active"}><summary>เปิดดูหลักฐานที่บันทึกไว้</summary><EvidencePreview context="persisted" evidence={detailEvidence} titleId={`sampling-run-evidence-${run.id}`} /></details>}
      <div className={styles.runActions}>
        {run.status === "draft" && <button type="button" className={styles.primaryButton} onClick={(event) => onConfirm("lock", run, event.currentTarget)} disabled={disabled}><LockKeyhole size={16} aria-hidden="true" />ล็อกหลักฐาน</button>}
        {run.status === "locked" && <button type="button" className={styles.primaryButton} onClick={(event) => onConfirm("activate", run, event.currentTarget)} disabled={disabled}><Play size={16} aria-hidden="true" />เปิดใช้งาน</button>}
        {(run.status === "draft" || run.status === "locked") && <button type="button" className={styles.dangerButton} onClick={(event) => onConfirm("cancel", run, event.currentTarget)} disabled={disabled}><X size={16} aria-hidden="true" />ยกเลิก run</button>}
        {run.status === "active" && <span className={styles.terminalNote}><Check size={16} aria-hidden="true" />ชุดปัจจุบัน</span>}
        {(run.status === "superseded" || run.status === "cancelled") && <span className={styles.terminalNote}><LockKeyhole size={16} aria-hidden="true" />อ่านอย่างเดียว</span>}
      </div>
    </li>
  );
}

function makeIdempotencyKey(): string { return globalThis.crypto?.randomUUID?.() ?? "33333333-3333-4333-8333-333333333333"; }
function snapshotFromForm(formData: FormData): PreviewInputSnapshot { return { populationImportId: String(formData.get("populationImportId") ?? ""), marginOfError: String(formData.get("marginOfError") ?? ""), seedText: String(formData.get("seedText") ?? ""), stratumDefinitionVersion: String(formData.get("stratumDefinitionVersion") ?? STRATUM_DEFINITION_VERSION) }; }
function sameSnapshot(left: PreviewInputSnapshot | null, right: PreviewInputSnapshot): boolean { return left !== null && left.populationImportId === right.populationImportId && left.marginOfError === right.marginOfError && left.seedText === right.seedText && left.stratumDefinitionVersion === right.stratumDefinitionVersion; }
function mergeRunResult(initialRuns: SamplingRunSummary[], result: SamplingRun, kind: "create" | "lock" | "activate" | "cancel"): SamplingRunSummary[] {
  const existing = initialRuns.find((run) => run.id === result.id);
  if (existing && Date.parse(result.updatedAt) < Date.parse(existing.updatedAt)) return initialRuns;
  const serverAlreadyHasResult = initialRuns.some((run) => run.id === result.id && run.status === result.status && run.version === result.version && run.lockedAt === result.lockedAt && run.activatedAt === result.activatedAt && run.supersededAt === result.supersededAt && run.cancelledAt === result.cancelledAt);
  let current = [...initialRuns];
  if (kind === "create") { if (!serverAlreadyHasResult) current = [result, ...current.filter((run) => run.id !== result.id)]; return current; }
  if (!serverAlreadyHasResult) current = current.some((run) => run.id === result.id) ? current.map((run) => run.id === result.id ? result : run) : [result, ...current];
  if (kind === "activate") current = current.map((run) => run.id !== result.id && run.status === "active" ? { ...run, status: "superseded", supersededAt: result.activatedAt ?? run.supersededAt } : run);
  return current;
}
function inputErrors(populationImportId: string, acceptedImportCount: number, marginOfError: string, seedText: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (acceptedImportCount === 0 || !populationImportId) errors.population = "เลือก snapshot ที่รับรองแล้ว";
  const margin = Number(marginOfError);
  if (!marginOfError.trim() || !Number.isFinite(margin) || margin <= 0 || margin >= 1) errors.margin = "ระบุค่า e ระหว่าง 0 ถึง 1";
  if (!seedText.trim()) errors.seed = "ระบุ seed สำหรับการสุ่ม";
  return errors;
}

export function SamplingWorkbench({ initialImports, initialRuns, initialRunDetails = [], canMutate = true, previewAction, createDraftAction, lockAction, activateAction, cancelAction }: SamplingWorkbenchProps) {
  const acceptedImports = useMemo(() => initialImports.filter((item) => item.status === "accepted"), [initialImports]);
  const [populationImportId, setPopulationImportId] = useState(acceptedImports[0]?.id ?? "");
  const [marginOfError, setMarginOfError] = useState("0.05");
  const [seedText, setSeedText] = useState("palmtrack-acceptance-seed-v1");
  const [idempotencyKey, setIdempotencyKey] = useState(makeIdempotencyKey);
  const [submittedPreview, setSubmittedPreview] = useState<PreviewInputSnapshot | null>(null);
  const [createdInput, setCreatedInput] = useState<PreviewInputSnapshot | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [previewState, submitPreview, previewPending] = useActionState<SamplingPreviewState | IdleState, FormData>((_, formData) => previewAction({ status: "invalid" }, formData), initialPreview);
  const [createState, submitCreate, createPending] = useActionState<SamplingRunState | IdleState, FormData>(async (_, formData) => { const result = await createDraftAction({ status: "invalid" }, formData); if (result.status === "ready") { setCreatedInput(snapshotFromForm(formData)); setIdempotencyKey(makeIdempotencyKey()); } return result; }, initialRun);
  const [lockState, submitLock, lockPending] = useActionState<SamplingRunState | IdleState, FormData>((_, formData) => lockAction({ status: "invalid" }, formData), initialRun);
  const [activateState, submitActivate, activatePending] = useActionState<SamplingRunState | IdleState, FormData>((_, formData) => activateAction({ status: "invalid" }, formData), initialRun);
  const [cancelState, submitCancel, cancelPending] = useActionState<SamplingRunState | IdleState, FormData>((_, formData) => cancelAction({ status: "invalid" }, formData), initialRun);
  const selectedPopulationId = acceptedImports.some((item) => item.id === populationImportId) ? populationImportId : acceptedImports[0]?.id ?? "";
  const selectedSnapshot = acceptedImports.find((item) => item.id === selectedPopulationId);
  const currentInput: PreviewInputSnapshot = { populationImportId: selectedPopulationId, marginOfError, seedText, stratumDefinitionVersion: STRATUM_DEFINITION_VERSION };
  const errors = inputErrors(selectedPopulationId, acceptedImports.length, marginOfError, seedText);
  const hasFreshPreview = previewState.status === "ready" && sameSnapshot(submittedPreview, currentInput);
  const mutationPending = previewPending || createPending || lockPending || activatePending || cancelPending;
  const showDraftSuccess = createState.status === "ready" && sameSnapshot(createdInput, currentInput);
  const runs = useMemo(() => { let current = initialRuns; if (createState.status === "ready") current = mergeRunResult(current, createState.run, "create"); if (lockState.status === "ready") current = mergeRunResult(current, lockState.run, "lock"); if (activateState.status === "ready") current = mergeRunResult(current, activateState.run, "activate"); if (cancelState.status === "ready") current = mergeRunResult(current, cancelState.run, "cancel"); return current; }, [activateState, cancelState, createState, initialRuns, lockState]);
  const detailById = useMemo(() => new Map(initialRunDetails.map((run) => [run.id, run])), [initialRunDetails]);
  const latestRunVersion = runs[0]?.version ?? 0;
  const confirmationComplete = confirmation !== null && ((confirmation.kind === "lock" && lockState.status === "ready" && lockState.run.id === confirmation.run.id) || (confirmation.kind === "activate" && activateState.status === "ready" && activateState.run.id === confirmation.run.id) || (confirmation.kind === "cancel" && cancelState.status === "ready" && cancelState.run.id === confirmation.run.id));
  const modalOpen = Boolean(confirmation && !confirmationComplete && canMutate);
  const focusReceiptId = confirmationComplete ? confirmation?.run.id : null;
  const capturePreviewInput = (event: FormEvent<HTMLFormElement>) => { setValidationAttempted(true); if (Object.keys(errors).length > 0) { event.preventDefault(); return; } setSubmittedPreview(snapshotFromForm(new FormData(event.currentTarget))); };
  return (
    <section className={styles.workbench} aria-labelledby="sampling-workbench-title">
      <header className={styles.pageHeading}><div><p className={styles.path}>งานวิจัย · การสุ่มตัวอย่าง</p><h1 id="sampling-workbench-title">สร้างการสุ่มตัวอย่าง</h1><p className={styles.intro}>ตรวจตัวเลขและหลักฐานใน worksheet เดียว ตั้งแต่ snapshot ที่รับรองจนถึงการเปิดใช้งาน</p></div><span className={styles.syntheticBoundary}>ข้อมูลสังเคราะห์เท่านั้น</span></header>
      {canMutate && acceptedImports.length === 0 && <section className={styles.emptyState} aria-labelledby="sampling-empty-title"><h2 id="sampling-empty-title">ยังไม่มี snapshot ที่รับรอง</h2><p>ต้องยืนยัน snapshot จากงานประชากรก่อน จึงจะคำนวณหลักฐานการสุ่มได้</p><Link className={styles.secondaryButton} href="/app/research/population">ไปงานประชากร</Link></section>}
      {!canMutate && <p className={styles.readonlyIntro} role="status">บัญชีนี้อ่านใบเสร็จหลักฐานได้เท่านั้น · ไม่มีฟอร์มหรือปุ่มเปลี่ยนสถานะ</p>}
      <div className={styles.worksheet} aria-hidden={modalOpen ? "true" : undefined} inert={modalOpen}>
        {canMutate && acceptedImports.length > 0 && <form className={styles.inputSection} action={submitPreview} onSubmit={capturePreviewInput} onInvalid={() => setValidationAttempted(true)} aria-describedby="sampling-input-note">
          <div className={styles.sectionHeading}><div><h2>กำหนดชุดตัวอย่าง</h2><p id="sampling-input-note">เลือกเฉพาะ snapshot ที่รับรองแล้ว ระบบจะคำนวณจากข้อมูลที่อนุญาตเท่านั้น</p></div><span className={styles.stepMark}>INPUT</span></div>
          <div className={styles.fields}>
            <label htmlFor="sampling-population">ประชากรที่รับรองแล้ว<select id="sampling-population" name="populationImportId" value={selectedPopulationId} onChange={(event) => setPopulationImportId(event.target.value)} required disabled={mutationPending} aria-invalid={validationAttempted && Boolean(errors.population)} aria-describedby={validationAttempted && errors.population ? "sampling-population-error" : undefined}>{acceptedImports.map((item) => <option value={item.id} key={item.id}>{item.sourceLabel} · {number(item.eligibleCount, 0)} ราย</option>)}</select>{validationAttempted && errors.population && <small id="sampling-population-error" className={styles.fieldError}>{errors.population}</small>}</label>
            <label htmlFor="sampling-margin">ค่าความคลาดเคลื่อน (e)<input id="sampling-margin" name="marginOfError" type="number" value={marginOfError} onChange={(event) => setMarginOfError(event.target.value)} required disabled={mutationPending} aria-invalid={validationAttempted && Boolean(errors.margin)} aria-describedby={`sampling-margin-help${validationAttempted && errors.margin ? " sampling-margin-error" : ""}`} /><small id="sampling-margin-help">ค่ามากกว่า 0 และน้อยกว่า 1 เช่น 0.05</small>{validationAttempted && errors.margin && <small id="sampling-margin-error" className={styles.fieldError}>{errors.margin}</small>}</label>
            <label htmlFor="sampling-seed">seed สำหรับการสุ่ม<input id="sampling-seed" name="seedText" type="text" maxLength={200} value={seedText} onChange={(event) => setSeedText(event.target.value)} required disabled={mutationPending} aria-invalid={validationAttempted && Boolean(errors.seed)} aria-describedby={validationAttempted && errors.seed ? "sampling-seed-error" : undefined} /><small>ข้อความนี้ไม่ใช่รหัสลับ แต่จะถูกบันทึกเป็นหลักฐาน</small>{validationAttempted && errors.seed && <small id="sampling-seed-error" className={styles.fieldError}>{errors.seed}</small>}</label>
          </div>
          <input type="hidden" name="stratumDefinitionVersion" value={STRATUM_DEFINITION_VERSION} />
          <div className={styles.formFooter}>{selectedSnapshot ? <p className={styles.receiptHint}>snapshot · <code>{selectedSnapshot.inputDigest.slice(0, 16)}…</code> · {selectedSnapshot.referenceDate}</p> : <p className={styles.feedbackWarning} role="status">ยืนยัน snapshot จากงานประชากรก่อนเริ่มสุ่ม</p>}<button type="submit" className={styles.primaryButton} disabled={mutationPending}>{previewPending ? <><RefreshCw size={16} className={styles.spin} aria-hidden="true" />กำลังตรวจหลักฐาน…</> : "ดูตัวอย่างหลักฐาน"}</button></div>
        </form>}
        <StateNotice state={previewState} />
        {previewState.status === "ready" && !hasFreshPreview && <p className={styles.feedbackWarning} role="status">ข้อมูลเปลี่ยนแล้ว · ดูตัวอย่างหลักฐานใหม่ก่อนบันทึก</p>}
        {hasFreshPreview && <><EvidencePreview evidence={previewState.evidence} />{canMutate && !showDraftSuccess && <form className={styles.draftFooter} action={submitCreate}><input type="hidden" name="populationImportId" value={currentInput.populationImportId} /><input type="hidden" name="seedText" value={currentInput.seedText} /><input type="hidden" name="marginOfError" value={currentInput.marginOfError} /><input type="hidden" name="stratumDefinitionVersion" value={STRATUM_DEFINITION_VERSION} /><input type="hidden" name="idempotencyKey" value={idempotencyKey} /><div><strong>{createState.status === "conflict" ? "บันทึกไม่สำเร็จ · ลองอีกครั้งได้" : "พร้อมบันทึกฉบับร่าง"}</strong><p>{createState.status === "conflict" ? "ระบบยังเก็บหลักฐานเดิมไว้เพื่อให้ลองซ้ำอย่างปลอดภัย" : "สร้างหลักฐานบนเซิร์ฟเวอร์เพื่อเข้าสู่ขั้นตอน lock"}</p></div><button type="submit" className={styles.primaryButton} disabled={mutationPending}>{createPending ? "กำลังบันทึก…" : createState.status === "conflict" ? "บันทึกฉบับร่างอีกครั้ง" : "บันทึกฉบับร่าง"}</button></form>}{canMutate && showDraftSuccess && <p className={styles.feedbackSuccessBlock} role="status" aria-live="polite">บันทึกฉบับร่างแล้ว · รอการล็อก</p>}</>}
        <StateNotice state={createState} />
        <section className={styles.runsSection} aria-labelledby="sampling-runs-title"><div className={styles.sectionHeading}><div><h2 id="sampling-runs-title">หลักฐานและสถานะ run</h2><p>ทุกสถานะมีข้อความกำกับ ไม่ใช้สีอย่างเดียว</p></div><span className={styles.stepMark}>RECEIPTS · {runs.length}</span></div>{!canMutate && <p className={styles.feedbackWarning} role="status">บัญชีนี้อ่านหลักฐานได้ แต่ไม่มีสิทธิ์เปลี่ยนสถานะ run</p>}{canMutate && initialRuns.length > initialRunDetails.length && <p className={styles.feedbackWarning} role="status">แสดงรายละเอียดหลักฐานล่าสุดไม่เกิน 10 run · run เก่ากว่านี้ยังดูสถานะและข้อมูลสรุปได้</p>}{runs.length === 0 ? <p className={styles.empty}>ยังไม่มี sampling run ในพื้นที่ทำงานนี้</p> : <ol className={styles.runList}>{runs.map((run) => <RunReceipt key={`${run.id}-${run.version}`} run={run} detail={canMutate ? detailById.get(run.id) : undefined} isLatest={run.version === latestRunVersion} focusOnSuccess={focusReceiptId === run.id} onConfirm={(kind, selectedRun, trigger) => { restoreFocusRef.current = trigger; setCancelReason(""); setConfirmation({ kind, run: selectedRun }); }} disabled={!canMutate || mutationPending} />)}</ol>}</section>
        {!mutationPending && activateState.status === "ready" && <p className={styles.feedbackSuccessBlock} role="status" aria-live="polite">เปิดใช้งานสำเร็จ · run นี้เป็นชุดปัจจุบัน</p>}
        {!mutationPending && activateState.status !== "ready" && cancelState.status === "ready" && <p className={styles.feedbackSuccessBlock} role="status" aria-live="polite">ยกเลิก run สำเร็จ · หลักฐานนี้เลือกใช้ไม่ได้</p>}
        {!mutationPending && activateState.status !== "ready" && cancelState.status !== "ready" && lockState.status === "ready" && <p className={styles.feedbackSuccessBlock} role="status" aria-live="polite">ล็อกหลักฐานสำเร็จ · run รอการเปิดใช้งาน</p>}
        <StateNotice state={lockState} /><StateNotice state={activateState} /><StateNotice state={cancelState} />
      </div>
      {modalOpen && confirmation && <ConfirmationDialog confirmation={confirmation} pending={mutationPending} cancelReason={cancelReason} setCancelReason={setCancelReason} submitLock={submitLock} submitActivate={submitActivate} submitCancel={submitCancel} onDismiss={() => setConfirmation(null)} restoreFocusRef={restoreFocusRef} restoreFocusOnClose={!confirmationComplete} />}
    </section>
  );
}
