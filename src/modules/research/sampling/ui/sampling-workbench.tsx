"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Clipboard, LockKeyhole, Play, RefreshCw, X } from "lucide-react";

import type { PopulationReceipt } from "@/modules/research/population/server/population-gateway";
import type { SamplingEvidence } from "@/modules/research/sampling/domain/deterministic-sampling";
import type { SamplingRunSummary } from "@/modules/research/sampling/server/sampling-gateway";
import type {
  SamplingPreviewState,
  SamplingRunState,
} from "@/modules/research/sampling/server/sampling-service";

import styles from "./sampling-workbench.module.css";

type IdleState = { status: "idle" };

type PreviewAction = (
  previous: SamplingPreviewState,
  formData: FormData,
) => Promise<SamplingPreviewState>;

type RunAction = (
  previous: SamplingRunState,
  formData: FormData,
) => Promise<SamplingRunState>;

export type SamplingWorkbenchProps = {
  initialImports: PopulationReceipt[];
  initialRuns: SamplingRunSummary[];
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
  draft: "ฉบับร่าง · แก้ไขได้",
  locked: "ล็อกแล้ว · แก้ไขไม่ได้",
  active: "กำลังใช้งาน · เป็นชุดปัจจุบัน",
  superseded: "แทนที่แล้ว · หลักฐานย้อนหลัง",
  cancelled: "ยกเลิกแล้ว · เลือกใช้ไม่ได้",
};

function thaiDate(value: string): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function number(value: number, maximumFractionDigits = 3): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits });
}

function stateMessage(state: SamplingPreviewState | SamplingRunState | IdleState): string | null {
  if (state.status === "idle" || state.status === "ready") return null;
  if (state.status === "invalid") return "ตรวจข้อมูลที่กรอกอีกครั้ง แล้วลองใหม่";
  if (state.status === "forbidden") return "บัญชีนี้ไม่มีสิทธิ์ดำเนินการสุ่มตัวอย่าง";
  if (state.status === "conflict") return "ข้อมูลเปลี่ยนไปแล้ว โปรดโหลดหน้าใหม่ก่อนทำต่อ";
  if (state.status === "replay_mismatch") return "หลักฐานไม่ตรงกัน ระบบจึงหยุดการดำเนินการไว้ก่อน";
  return "ระบบยังไม่พร้อม โปรดลองอีกครั้งภายหลัง";
}

function DigestValue({ label, value }: { label: string; value: string }) {
  const short = `${value.slice(0, 16)}…${value.slice(-8)}`;
  const copy = () => {
    void navigator.clipboard?.writeText(value);
  };

  return (
    <div className={styles.digestValue}>
      <code title={value}>{short}</code>
      <button type="button" className={styles.iconButton} onClick={copy} aria-label={`คัดลอก ${label} แบบเต็ม`}>
        <Clipboard size={16} aria-hidden="true" />
      </button>
      <details className={styles.digestDetails}>
        <summary>แสดงค่าเต็ม</summary>
        <code>{value}</code>
      </details>
    </div>
  );
}

function StateNotice({ state }: { state: SamplingPreviewState | SamplingRunState | IdleState }) {
  const message = stateMessage(state);
  if (!message) return null;
  return <p className={styles.feedbackError} role="alert" aria-live="polite">{message}</p>;
}

function EvidencePreview({ evidence }: { evidence: SamplingEvidence }) {
  return (
    <section className={styles.evidenceSection} aria-labelledby="sampling-evidence-title">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="sampling-evidence-title">หลักฐานจากตัวอย่าง</h2>
          <p>คำนวณจาก snapshot ที่รับรองแล้วด้วยกติกาเดียวกันทุกครั้ง</p>
        </div>
        <span className={styles.evidenceMark}><Check size={16} aria-hidden="true" />ตรวจสูตรแล้ว</span>
      </div>

      <dl className={styles.formula}>
        <div><dt>สูตร</dt><dd>Yamane · {evidence.formulaVersion}</dd></div>
        <div><dt>ประชากร N</dt><dd>{number(evidence.populationSize, 0)} ราย</dd></div>
        <div><dt>ค่าคลาดเคลื่อน e</dt><dd>{number(evidence.marginOfError, 3)}</dd></div>
        <div><dt>ผลก่อนปัด</dt><dd>{number(evidence.unrounded, 6)}</dd></div>
        <div><dt>กติกาปัด</dt><dd>ceil</dd></div>
        <div><dt>ตัวอย่าง n</dt><dd className={styles.emphasis}>{number(evidence.targetN, 0)} ราย</dd></div>
      </dl>

      <div className={styles.tableWrap}>
        <table className={styles.evidenceTable}>
          <caption>การจัดสรรตามชั้นพื้นที่ · รวม {number(evidence.targetN, 0)} ราย</caption>
          <thead>
            <tr>
              <th scope="col">ชั้นพื้นที่</th>
              <th scope="col">N<sub>h</sub></th>
              <th scope="col">quota</th>
              <th scope="col">floor</th>
              <th scope="col">เศษเหลือ</th>
              <th scope="col">จัดสรรจริง</th>
            </tr>
          </thead>
          <tbody>
            {evidence.allocationRows.map((row) => (
              <tr key={row.stratumCode}>
                <th scope="row">{row.stratumCode}</th>
                <td>{number(row.eligibleCount, 0)}</td>
                <td>{number(row.quota)}</td>
                <td>{number(row.floorAllocation, 0)}</td>
                <td>{number(row.remainder)}</td>
                <td className={styles.emphasis}>{number(row.finalAllocation, 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row">รวม</th><td>{number(evidence.populationSize, 0)}</td><td colSpan={3}>—</td><td>{number(evidence.targetN, 0)}</td></tr>
          </tfoot>
        </table>
      </div>

      <dl className={styles.receiptGrid}>
        <div><dt>seed ที่ normalize แล้ว</dt><dd><code>{evidence.seedNormalized}</code></dd></div>
        <div><dt>seed digest · SHA-256</dt><dd><DigestValue label="seed digest" value={evidence.seedDigestHex} /></dd></div>
        <div><dt>algorithm</dt><dd><code>{evidence.algorithmVersion}</code></dd></div>
        <div><dt>ordered candidate-set hash</dt><dd><DigestValue label="candidate-set hash" value={evidence.orderedCandidateSetHash} /></dd></div>
      </dl>

      <div className={styles.resultEvidence}>
        <h3>ผลลัพธ์ที่เรียงลำดับแล้ว</h3>
        <p>เลือกแล้ว {number(evidence.orderedSelectedMembers.length, 0)} ราย · ลำดับและชั้นพื้นที่ถูกบันทึกเป็นหลักฐาน</p>
        <div className={styles.tableWrap}>
          <table className={styles.selectedTable}>
            <caption>รายการตัวอย่างแบบไม่เปิดเผยข้อมูลติดต่อ</caption>
            <thead><tr><th scope="col">ลำดับ</th><th scope="col">ชั้นพื้นที่</th></tr></thead>
            <tbody>
              {evidence.orderedSelectedMembers.slice(0, 20).map((member) => (
                <tr key={`${member.selectionOrder}-${member.stratumCode}`}>
                  <th scope="row">{member.selectionOrder}</th><td>{member.stratumCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {evidence.orderedSelectedMembers.length > 20 && <p className={styles.muted}>แสดง 20 ลำดับแรก · หลักฐานฉบับเต็มถูกเก็บบนเซิร์ฟเวอร์แบบตรวจสอบย้อนหลังได้</p>}
      </div>
    </section>
  );
}

type Confirmation = { kind: "lock" | "activate" | "cancel"; run: SamplingRunSummary };

function ConfirmationDialog({
  confirmation,
  pending,
  cancelReason,
  setCancelReason,
  submitLock,
  submitActivate,
  submitCancel,
  onDismiss,
}: {
  confirmation: Confirmation;
  pending: boolean;
  cancelReason: string;
  setCancelReason: (value: string) => void;
  submitLock: (formData: FormData) => void;
  submitActivate: (formData: FormData) => void;
  submitCancel: (formData: FormData) => void;
  onDismiss: () => void;
}) {
  const { kind, run } = confirmation;
  const isCancel = kind === "cancel";
  const title = kind === "lock" ? "ยืนยันการล็อกหลักฐาน" : kind === "activate" ? "ยืนยันการเปิดใช้งาน" : "ยืนยันการยกเลิก";
  const description = kind === "lock"
    ? "เมื่อล็อกแล้ว input, seed, candidate hash และผลลัพธ์จะแก้ไขไม่ได้"
    : kind === "activate"
      ? "run นี้จะเป็นชุดตัวอย่างปัจจุบัน และ active เดิมจะถูกแทนที่ตามกติกา"
      : "การยกเลิกเป็นสถานะสิ้นสุด และ run นี้จะเลือกใช้กับการวิเคราะห์ไม่ได้";
  const action = kind === "lock" ? submitLock : kind === "activate" ? submitActivate : submitCancel;

  return (
    <div className={styles.confirmation} role="alertdialog" aria-modal="true" aria-labelledby="sampling-confirm-title" aria-describedby="sampling-confirm-description">
      <div>
        <h3 id="sampling-confirm-title">{title}</h3>
        <p id="sampling-confirm-description">{description}</p>
        {isCancel && (
          <label className={styles.confirmReason} htmlFor="sampling-cancel-reason">
            เหตุผลการยกเลิก
            <input id="sampling-cancel-reason" name="reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} minLength={3} maxLength={500} required />
          </label>
        )}
      </div>
      <form action={action} className={styles.confirmActions}>
        <input type="hidden" name="runId" value={run.id} />
        {isCancel && <input type="hidden" name="reason" value={cancelReason} />}
        <button type="button" className={styles.secondaryButton} onClick={onDismiss} disabled={pending}>กลับไปตรวจสอบ</button>
        <button type="submit" className={isCancel ? styles.dangerButton : styles.primaryButton} disabled={pending || (isCancel && cancelReason.trim().length < 3)}>
          {pending ? "กำลังบันทึก…" : kind === "lock" ? "ล็อกหลักฐาน" : kind === "activate" ? "เปิดใช้งาน" : "ยืนยันยกเลิก"}
        </button>
      </form>
    </div>
  );
}

function RunReceipt({
  run,
  onConfirm,
  disabled,
}: {
  run: SamplingRunSummary;
  onConfirm: (kind: Confirmation["kind"], run: SamplingRunSummary) => void;
  disabled: boolean;
}) {
  const statusClass = styles[`status_${run.status}` as keyof typeof styles];
  return (
    <li className={styles.runReceipt}>
      <div className={styles.runHeader}>
        <div>
          <h3>Sampling run <span>v{run.version}</span></h3>
          <p>สร้างเมื่อ {thaiDate(run.createdAt)}</p>
        </div>
        <span className={`${styles.status} ${statusClass}`} data-status={run.status}>สถานะ: {statusLabels[run.status]}</span>
      </div>
      <dl className={styles.runFacts}>
        <div><dt>ประชากร</dt><dd>{number(run.populationSize, 0)} ราย</dd></div>
        <div><dt>e</dt><dd>{number(run.marginOfError, 3)}</dd></div>
        <div><dt>ตัวอย่าง n</dt><dd>{number(run.targetN, 0)} ราย</dd></div>
        <div><dt>สูตร</dt><dd>{run.formulaVersion}</dd></div>
        <div><dt>การจัดสรร</dt><dd>{run.allocationEvidence.length} ชั้นพื้นที่</dd></div>
      </dl>
      <div className={styles.runActions}>
        {run.status === "draft" && <button type="button" className={styles.primaryButton} onClick={() => onConfirm("lock", run)} disabled={disabled}><LockKeyhole size={16} aria-hidden="true" />ล็อกหลักฐาน</button>}
        {run.status === "locked" && <button type="button" className={styles.primaryButton} onClick={() => onConfirm("activate", run)} disabled={disabled}><Play size={16} aria-hidden="true" />เปิดใช้งาน</button>}
        {(run.status === "draft" || run.status === "locked") && <button type="button" className={styles.dangerButton} onClick={() => onConfirm("cancel", run)} disabled={disabled}><X size={16} aria-hidden="true" />ยกเลิก run</button>}
        {run.status === "active" && <span className={styles.terminalNote}><Check size={16} aria-hidden="true" />ชุดปัจจุบัน</span>}
        {(run.status === "superseded" || run.status === "cancelled") && <span className={styles.terminalNote}><LockKeyhole size={16} aria-hidden="true" />อ่านอย่างเดียว</span>}
      </div>
    </li>
  );
}

export function SamplingWorkbench({
  initialImports,
  initialRuns,
  canMutate = true,
  previewAction,
  createDraftAction,
  lockAction,
  activateAction,
  cancelAction,
}: SamplingWorkbenchProps) {
  const acceptedImports = useMemo(() => initialImports.filter((item) => item.status === "accepted"), [initialImports]);
  const [populationImportId, setPopulationImportId] = useState(acceptedImports[0]?.id ?? "");
  const [marginOfError, setMarginOfError] = useState(0.05);
  const [seedText, setSeedText] = useState("palmtrack-acceptance-seed-v1");
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? "33333333-3333-4333-8333-333333333333");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [previewState, submitPreview, previewPending] = useActionState<SamplingPreviewState | IdleState, FormData>(
    (_, formData) => previewAction({ status: "invalid" }, formData),
    initialPreview,
  );
  const [createState, submitCreate, createPending] = useActionState<SamplingRunState | IdleState, FormData>(
    (_, formData) => createDraftAction({ status: "invalid" }, formData),
    initialRun,
  );
  const [lockState, submitLock, lockPending] = useActionState<SamplingRunState | IdleState, FormData>(
    (_, formData) => lockAction({ status: "invalid" }, formData),
    initialRun,
  );
  const [activateState, submitActivate, activatePending] = useActionState<SamplingRunState | IdleState, FormData>(
    (_, formData) => activateAction({ status: "invalid" }, formData),
    initialRun,
  );
  const [cancelState, submitCancel, cancelPending] = useActionState<SamplingRunState | IdleState, FormData>(
    (_, formData) => cancelAction({ status: "invalid" }, formData),
    initialRun,
  );

  const lifecyclePending = lockPending || activatePending || cancelPending;
  const runs = useMemo(() => {
    let current = initialRuns;
    if (createState.status === "ready") {
      current = [createState.run, ...current.filter((run) => run.id !== createState.run.id)];
    }
    if (lockState.status === "ready") {
      current = current.map((run) => run.id === lockState.run.id ? lockState.run : run);
    }
    if (activateState.status === "ready") {
      current = current.map((run) => run.id === activateState.run.id ? activateState.run : run);
    }
    if (cancelState.status === "ready") {
      current = current.map((run) => run.id === cancelState.run.id ? cancelState.run : run);
    }
    return current;
  }, [activateState, cancelState, createState, initialRuns, lockState]);
  const selectedSnapshot = acceptedImports.find((item) => item.id === populationImportId);
  const hasPreview = previewState.status === "ready";
  const confirmationComplete = confirmation !== null && (
    (confirmation.kind === "lock" && lockState.status === "ready" && lockState.run.id === confirmation.run.id) ||
    (confirmation.kind === "activate" && activateState.status === "ready" && activateState.run.id === confirmation.run.id) ||
    (confirmation.kind === "cancel" && cancelState.status === "ready" && cancelState.run.id === confirmation.run.id)
  );

  return (
    <section className={styles.workbench} aria-labelledby="sampling-workbench-title">
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.path}>งานวิจัย · การสุ่มตัวอย่าง</p>
          <h1 id="sampling-workbench-title">สร้างการสุ่มตัวอย่าง</h1>
          <p className={styles.intro}>ตรวจตัวเลขและหลักฐานใน worksheet เดียว ตั้งแต่ snapshot ที่รับรองจนถึงการเปิดใช้งาน</p>
        </div>
        <span className={styles.syntheticBoundary}>ข้อมูลสังเคราะห์เท่านั้น</span>
      </header>

      <div className={styles.worksheet}>
        <form className={styles.inputSection} action={submitPreview} aria-describedby="sampling-input-note">
          <div className={styles.sectionHeading}>
            <div>
              <h2>กำหนดชุดตัวอย่าง</h2>
              <p id="sampling-input-note">เลือกเฉพาะ snapshot ที่รับรองแล้ว ระบบจะคำนวณจากข้อมูลที่อนุญาตเท่านั้น</p>
            </div>
            <span className={styles.stepMark}>INPUT</span>
          </div>
          <div className={styles.fields}>
            <label htmlFor="sampling-population">ประชากรที่รับรองแล้ว
              <select id="sampling-population" name="populationImportId" value={populationImportId} onChange={(event) => setPopulationImportId(event.target.value)} required disabled={!canMutate || previewPending}>
                {acceptedImports.length === 0 && <option value="">ยังไม่มี snapshot ที่รับรอง</option>}
                {acceptedImports.map((item) => <option value={item.id} key={item.id}>{item.sourceLabel} · {number(item.eligibleCount, 0)} ราย</option>)}
              </select>
            </label>
            <label htmlFor="sampling-margin">ค่าความคลาดเคลื่อน (e)
              <input id="sampling-margin" name="marginOfError" type="number" min="0.001" max="0.999" step="0.001" value={marginOfError} onChange={(event) => setMarginOfError(Number(event.target.value))} required disabled={!canMutate || previewPending} />
              <small>ค่าระหว่าง 0 ถึง 1 เช่น 0.05</small>
            </label>
            <label htmlFor="sampling-seed">seed สำหรับการสุ่ม
              <input id="sampling-seed" name="seedText" type="text" maxLength={200} value={seedText} onChange={(event) => setSeedText(event.target.value)} required disabled={!canMutate || previewPending} />
              <small>ข้อความนี้ไม่ใช่รหัสลับ แต่จะถูกบันทึกเป็นหลักฐาน</small>
            </label>
          </div>
          <input type="hidden" name="stratumDefinitionVersion" value={STRATUM_DEFINITION_VERSION} />
          <div className={styles.formFooter}>
            {selectedSnapshot ? <p className={styles.receiptHint}>snapshot · <code>{selectedSnapshot.inputDigest.slice(0, 16)}…</code> · {selectedSnapshot.referenceDate}</p> : <p className={styles.feedbackWarning} role="status">ยืนยัน snapshot จากงานประชากรก่อนเริ่มสุ่ม</p>}
            {canMutate && <button type="submit" className={styles.primaryButton} disabled={previewPending || acceptedImports.length === 0}>{previewPending ? <><RefreshCw size={16} className={styles.spin} aria-hidden="true" />กำลังตรวจหลักฐาน…</> : "ดูตัวอย่างหลักฐาน"}</button>}
          </div>
        </form>

        <StateNotice state={previewState} />
        {hasPreview && (
          <>
            <EvidencePreview evidence={previewState.evidence} />
            {canMutate && (
              <form className={styles.draftFooter} action={submitCreate}>
                <input type="hidden" name="populationImportId" value={populationImportId} />
                <input type="hidden" name="seedText" value={seedText} />
                <input type="hidden" name="marginOfError" value={marginOfError} />
                <input type="hidden" name="stratumDefinitionVersion" value={STRATUM_DEFINITION_VERSION} />
                <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
                <div><strong>พร้อมบันทึกฉบับร่าง</strong><p>สร้างหลักฐานบนเซิร์ฟเวอร์เพื่อเข้าสู่ขั้นตอน lock</p></div>
                <button type="submit" className={styles.primaryButton} disabled={createPending}>{createPending ? "กำลังบันทึก…" : "บันทึกฉบับร่าง"}</button>
              </form>
            )}
          </>
        )}
        <StateNotice state={createState} />

        <section className={styles.runsSection} aria-labelledby="sampling-runs-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="sampling-runs-title">หลักฐานและสถานะ run</h2><p>ทุกสถานะมีข้อความกำกับ ไม่ใช้สีอย่างเดียว</p></div>
            <span className={styles.stepMark}>RECEIPTS · {runs.length}</span>
          </div>
          {!canMutate && <p className={styles.feedbackWarning} role="status">บัญชีนี้อ่านหลักฐานได้ แต่ไม่มีสิทธิ์เปลี่ยนสถานะ run</p>}
          {runs.length === 0 ? <p className={styles.empty}>ยังไม่มี sampling run ในพื้นที่ทำงานนี้</p> : (
            <ol className={styles.runList}>
              {runs.map((run) => <RunReceipt key={`${run.id}-${run.version}`} run={run} onConfirm={(kind, selectedRun) => { setCancelReason(""); setConfirmation({ kind, run: selectedRun }); }} disabled={!canMutate || lifecyclePending} />)}
            </ol>
          )}
        </section>

        {confirmation && !confirmationComplete && canMutate && <ConfirmationDialog confirmation={confirmation} pending={lifecyclePending} cancelReason={cancelReason} setCancelReason={setCancelReason} submitLock={submitLock} submitActivate={submitActivate} submitCancel={submitCancel} onDismiss={() => setConfirmation(null)} />}
        <StateNotice state={lockState} />
        <StateNotice state={activateState} />
        <StateNotice state={cancelState} />
      </div>
    </section>
  );
}
