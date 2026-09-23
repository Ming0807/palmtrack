"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Check, Clipboard, FileCheck2, FileUp, LockKeyhole } from "lucide-react";

import { allocateLargestRemainder } from "@/modules/research/population/domain/sampling-allocation";
import {
  createMulberry32,
  deriveSeed,
  fisherYatesShuffle,
  hashOrderedCandidateSet,
  selectByAllocation,
  sortCandidatesByCode,
} from "@/modules/research/population/domain/sampling-deterministic";
import { calculateYamaneSampleSize } from "@/modules/research/population/domain/sampling-yamane";
import type {
  PopulationSnapshotMember,
  SamplingMember,
  SamplingRunDetail,
} from "@/modules/research/population/server/sampling-gateway";
import type { SamplingActionState } from "@/modules/research/population/server/sampling-service";

import styles from "./sampling-run.module.css";

type SamplingAction = (
  previous: SamplingActionState,
  formData: FormData,
) => Promise<SamplingActionState>;

export type AcceptedSnapshot = {
  id: string;
  sourceLabel: string;
  eligibleCount: number;
  inputDigest: string;
  members: PopulationSnapshotMember[];
};

export type SamplingRunFlowProps = {
  initialRuns: { detail: SamplingRunDetail; members: SamplingMember[] }[];
  acceptedSnapshots?: AcceptedSnapshot[];
  canManage: boolean;
  actionState?: SamplingActionState;
  draftAction: SamplingAction;
  lockAction: SamplingAction;
  activateAction: SamplingAction;
  cancelAction: SamplingAction;
};

const idleState: SamplingActionState = { status: "idle" };

const STATUS_LABEL: Record<SamplingRunDetail["status"], string> = {
  draft: "ฉบับร่าง",
  locked: "ล็อกแล้ว",
  active: "ใช้งานอยู่",
  superseded: "ถูกแทนที่แล้ว",
  cancelled: "ยกเลิกแล้ว",
};

function ActionFeedback({ state }: { state: SamplingActionState }) {
  if (state.status === "service_unavailable") {
    return <p className={styles.systemStatus} role="status">ระบบฐานข้อมูลยังไม่พร้อม โปรดลองอีกครั้ง</p>;
  }
  if (state.status === "conflict") {
    return <p className={styles.systemStatus} role="status">ข้อมูลชุดนี้เปลี่ยนไปแล้ว โปรดโหลดหน้าใหม่ก่อนทำต่อ</p>;
  }
  if (state.status === "forbidden") {
    return <p className={styles.systemStatus} role="status">บัญชีนี้ไม่มีสิทธิ์จัดการการสุ่มตัวอย่าง</p>;
  }
  if (state.status === "invalid") {
    return <p className={styles.systemStatus} role="alert">พบข้อมูลที่ต้องแก้ไข โปรดตรวจสูตรและหลักฐานอีกครั้ง</p>;
  }
  if (state.status === "draft") {
    return <p className={styles.successStatus} role="status"><Check size={18} aria-hidden="true" />สร้างฉบับร่างและบันทึกหลักฐานแล้ว</p>;
  }
  if (state.status === "locked") {
    return <p className={styles.successStatus} role="status"><Check size={18} aria-hidden="true" />ล็อกรอบสุ่มแล้ว แก้ไข input ไม่ได้</p>;
  }
  if (state.status === "active") {
    return <p className={styles.successStatus} role="status"><Check size={18} aria-hidden="true" />เปิดใช้รอบสุ่มแล้ว รอบเดิมถูกแทนที่</p>;
  }
  return null;
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Clipboard size={16} aria-hidden="true" />
      <span aria-live="polite" className={styles.copyState}>{copied ? "คัดลอกแล้ว" : ""}</span>
    </button>
  );
}

function formatThaiTimestamp(value: string): string {
  return `${new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value))} เวลาไทย`;
}

type DraftEvidence = {
  seedNormalized: string;
  seedDigestHex: string;
  seedU32: number;
  candidateHash: string;
  allocationsJson: string;
  membersJson: string;
  target: number;
  unrounded: number;
} | null;

function DraftForm({
  snapshots,
  action,
}: {
  snapshots: AcceptedSnapshot[];
  action: SamplingAction;
}) {
  const [state, submit, pending] = useActionState(action, idleState);
  const [snapshotId, setSnapshotId] = useState(snapshots[0]?.id ?? "");
  const [margin, setMargin] = useState("0.05");
  const [seedText, setSeedText] = useState("palmtrack-acceptance-seed-v1");
  const [evidence, setEvidence] = useState<DraftEvidence>(null);

  const snapshot = useMemo(
    () => snapshots.find((item) => item.id === snapshotId) ?? snapshots[0],
    [snapshots, snapshotId],
  );

  const preview = useMemo(() => {
    if (!snapshot) return null;
    const marginValue = Number(margin);
    if (!Number.isFinite(marginValue) || marginValue <= 0 || marginValue >= 1) return null;
    const eligible = snapshot.members.filter((member) => member.eligible);
    if (eligible.length === 0) return null;
    const yamane = calculateYamaneSampleSize({ populationSize: eligible.length, marginOfError: marginValue });
    const strata = new Map<string, number>();
    for (const member of eligible) strata.set(member.stratumCode, (strata.get(member.stratumCode) ?? 0) + 1);
    const allocation = allocateLargestRemainder({
      populationSize: eligible.length,
      target: yamane.target,
      strata: [...strata.entries()].map(([stratumCode, eligibleCount]) => ({ stratumCode, eligibleCount })),
    });
    return { yamane, allocation, eligibleCount: eligible.length };
  }, [snapshot, margin]);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!snapshot || !preview || seedText.length < 1) {
        setEvidence(null);
        return;
      }
      const eligible = snapshot.members.filter((member) => member.eligible);
      const ordered = sortCandidatesByCode(
        eligible.map((member) => ({ farmerCode: member.farmerCode, stratumCode: member.stratumCode })),
      );
      const seed = await deriveSeed(seedText);
      const candidateHash = await hashOrderedCandidateSet(ordered);
      const { shuffled } = fisherYatesShuffle(ordered, createMulberry32(seed.seedU32));
      const { selected } = selectByAllocation(
        shuffled,
        preview.allocation.allocations.map((item) => ({
          stratumCode: item.stratumCode,
          finalAllocation: item.finalAllocation,
        })),
      );
      const idByCode = new Map(eligible.map((member) => [member.farmerCode, member.id]));
      const membersJson = JSON.stringify(
        selected.map((item) => ({
          populationMemberId: idByCode.get(item.farmerCode),
          stratumCode: item.stratumCode,
          selectionOrder: item.selectionOrder,
        })),
      );
      if (!cancelled) {
        setEvidence({
          seedNormalized: seed.seedNormalized,
          seedDigestHex: seed.seedDigestHex,
          seedU32: seed.seedU32,
          candidateHash,
          allocationsJson: JSON.stringify(
            preview.allocation.allocations.map((item) => ({
              stratumCode: item.stratumCode,
              finalAllocation: item.finalAllocation,
            })),
          ),
          membersJson,
          target: preview.yamane.target,
          unrounded: preview.yamane.unrounded,
        });
      }
    }
    void build();
    return () => {
      cancelled = true;
    };
  }, [snapshot, preview, seedText]);

  if (snapshots.length === 0) {
    return <p className={styles.systemStatus}>ยังไม่มี snapshot ที่รับแล้ว จึงสร้างรอบสุ่มไม่ได้</p>;
  }

  return (
    <form action={submit} className={styles.draftForm}>
      <div className={styles.fields}>
        <label>
          snapshot ประชากรที่รับแล้ว
          <select name="populationImportId" value={snapshot?.id ?? ""} onChange={(event) => setSnapshotId(event.target.value)}>
            {snapshots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sourceLabel} · เข้าเกณฑ์ {item.eligibleCount}
              </option>
            ))}
          </select>
        </label>
        <label>
          ค่าคลาดเคลื่อน (e)
          <input name="marginOfError" value={margin} onChange={(event) => setMargin(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          seed ข้อความ
          <input name="seedText" value={seedText} onChange={(event) => setSeedText(event.target.value)} maxLength={200} />
        </label>
      </div>
      {preview ? (
        <div className={styles.preview}>
          <p>สูตร Yamane n = N / (1 + N·e²) · N={preview.eligibleCount} e={margin} ≈ {preview.yamane.unrounded.toFixed(4)} ปัดขึ้น {preview.yamane.target}</p>
          <table className={styles.allocationTable}>
            <caption>การจัดสรร largest remainder รวม {preview.yamane.target}</caption>
            <thead>
              <tr><th scope="col">ชั้นภูมิ</th><th scope="col">N_h</th><th scope="col">โควตา</th><th scope="col">จัดสรร</th></tr>
            </thead>
            <tbody>
              {preview.allocation.allocations.map((item) => (
                <tr key={item.stratumCode}>
                  <th scope="row">{item.stratumCode}</th>
                  <td>{item.eligibleCount}</td>
                  <td>{item.quota.toFixed(4)}</td>
                  <td>{item.finalAllocation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <input type="hidden" name="seedNormalized" value={evidence?.seedNormalized ?? ""} />
      <input type="hidden" name="seedDigestHex" value={evidence?.seedDigestHex ?? ""} />
      <input type="hidden" name="seedU32" value={evidence ? String(evidence.seedU32) : ""} />
      <input type="hidden" name="candidateHash" value={evidence?.candidateHash ?? ""} />
      <input type="hidden" name="allocationsJson" value={evidence?.allocationsJson ?? ""} />
      <input type="hidden" name="membersJson" value={evidence?.membersJson ?? ""} />
      <div className={styles.formFooter}>
        <p>ตรวจทานสูตรและการจัดสรรก่อนสร้าง หลักฐานจะถูกแช่แข็งเมื่อล็อก</p>
        <button type="submit" disabled={pending || !evidence}>
          <FileUp size={18} aria-hidden="true" />สร้างฉบับร่าง
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}

function RunCard({
  detail,
  members,
  lockAction,
  activateAction,
  cancelAction,
  canManage,
}: {
  detail: SamplingRunDetail;
  members: SamplingMember[];
  lockAction: SamplingAction;
  activateAction: SamplingAction;
  cancelAction: SamplingAction;
  canManage: boolean;
}) {
  const [lockState, submitLock, lockPending] = useActionState(lockAction, idleState);
  const [activateState, submitActivate, activatePending] = useActionState(activateAction, idleState);
  const [cancelState, submitCancel, cancelPending] = useActionState(cancelAction, idleState);
  const [cancelReason, setCancelReason] = useState("");

  return (
    <li className={styles.receipt}>
      <div className={styles.receiptHeading}>
        <div>
          <h3>รอบที่ {detail.version} · เป้าหมาย {detail.targetN}</h3>
          <p>ประชากร {detail.populationSize} · สูตร yamane-v1</p>
        </div>
        <span className={styles[detail.status]}>{STATUS_LABEL[detail.status]}</span>
      </div>
      <div className={styles.evidence}>
        <p><span>อัลกอริทึม</span>{detail.algorithmVersion}</p>
        <p><span>e</span>{detail.marginOfError}</p>
        <p className={styles.digest}>
          <span>candidate</span><code>{detail.candidateHash.slice(0, 16)}…</code>
          <CopyButton label="คัดลอก candidate hash แบบเต็ม" value={detail.candidateHash} />
        </p>
        <p className={styles.digest}>
          <span>seed</span><code>{detail.seedDigestHex.slice(0, 16)}…</code>
          <CopyButton label="คัดลอก seed digest แบบเต็ม" value={detail.seedDigestHex} />
        </p>
      </div>
      <table className={styles.allocationTable}>
        <caption>การจัดสรรที่ล็อก รวม {detail.targetN}</caption>
        <thead>
          <tr><th scope="col">ชั้นภูมิ</th><th scope="col">จัดสรร</th></tr>
        </thead>
        <tbody>
          {detail.allocations.map((item) => (
            <tr key={item.stratumCode}>
              <th scope="row">{item.stratumCode}</th>
              <td>{item.finalAllocation}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.receiptFooter}>
        <p>ผลสุ่ม {members.length} รายการ · {detail.lockedAt ? formatThaiTimestamp(detail.lockedAt) : "ยังไม่ล็อก"}</p>
      </div>
      {canManage && detail.status === "draft" ? (
        <form action={submitLock} className={styles.inlineForm}>
          <input type="hidden" name="runId" value={detail.id} />
          <input type="hidden" name="candidateHash" value={detail.candidateHash} />
          <input type="hidden" name="seedDigestHex" value={detail.seedDigestHex} />
          <button type="submit" disabled={lockPending} className={styles.acceptButton}>
            <LockKeyhole size={18} aria-hidden="true" />ล็อกผลสุ่ม
          </button>
          <ActionFeedback state={lockState} />
        </form>
      ) : null}
      {canManage && detail.status === "locked" ? (
        <div className={styles.inlineActions}>
          <form action={submitActivate} className={styles.inlineForm}>
            <input type="hidden" name="runId" value={detail.id} />
            <button type="submit" disabled={activatePending} className={styles.acceptButton}>
              <FileCheck2 size={18} aria-hidden="true" />เปิดใช้รอบนี้
            </button>
            <ActionFeedback state={activateState} />
          </form>
          <form action={submitCancel} className={styles.inlineForm}>
            <input type="hidden" name="runId" value={detail.id} />
            <label>
              เหตุผลยกเลิก
              <input name="reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={200} />
            </label>
            <button type="submit" disabled={cancelPending || cancelReason.trim().length === 0} className={styles.acceptButton}>
              ยกเลิกรอบ
            </button>
            <ActionFeedback state={cancelState} />
          </form>
        </div>
      ) : null}
    </li>
  );
}

export function SamplingRunFlow({
  initialRuns,
  acceptedSnapshots = [],
  canManage,
  actionState = idleState,
  draftAction,
  lockAction,
  activateAction,
  cancelAction,
}: SamplingRunFlowProps) {
  return (
    <section aria-labelledby="sampling-title" className={styles.sheet}>
      <div className={styles.heading}>
        <div>
          <p className={styles.path}>งานวิจัย · การสุ่มตัวอย่าง</p>
          <h1 id="sampling-title">สุ่มตัวอย่าง</h1>
          <p className={styles.intro}>ดูสูตร Yamane การจัดสรร และหลักฐาน sha256-mulberry32-fy-v1 ก่อนล็อกและเปิดใช้รอบสุ่ม</p>
        </div>
        <span className={styles.syntheticBoundary}>ข้อมูลสังเคราะห์เท่านั้น</span>
      </div>
      <ol aria-label="ขั้นตอนสุ่มตัวอย่าง" className={styles.steps}>
        <li><FileUp size={16} aria-hidden="true" />เลือก snapshot</li>
        <li><Clipboard size={16} aria-hidden="true" />ตรวจสูตร</li>
        <li><LockKeyhole size={16} aria-hidden="true" />ล็อก</li>
        <li><FileCheck2 size={16} aria-hidden="true" />เปิดใช้</li>
      </ol>
      <ActionFeedback state={actionState} />
      {canManage ? <DraftForm snapshots={acceptedSnapshots} action={draftAction} /> : null}
      <div className={styles.history}>
        <div className={styles.historyHeading}>
          <h2>รอบสุ่มทั้งหมด</h2>
          <span>{initialRuns.length} รอบ</span>
        </div>
        {initialRuns.length === 0 ? (
          <div className={styles.empty}><p>ยังไม่มีรอบสุ่มใน workspace นี้</p></div>
        ) : (
          <ul className={styles.receiptList}>
            {initialRuns.map((run) => (
              <RunCard
                key={run.detail.id}
                detail={run.detail}
                members={run.members}
                lockAction={lockAction}
                activateAction={activateAction}
                cancelAction={cancelAction}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
