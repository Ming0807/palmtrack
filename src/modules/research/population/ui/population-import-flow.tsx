"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  FileCheck2,
  FileUp,
  LockKeyhole,
} from "lucide-react";

import type { PopulationReceipt } from "@/modules/research/population/server/population-gateway";
import type { PopulationActionState } from "@/modules/research/population/server/population-service";

import styles from "./population-import.module.css";

type PopulationAction = (
  previous: PopulationActionState,
  formData: FormData,
) => Promise<PopulationActionState>;

export type PopulationImportFlowProps = {
  initialImports: PopulationReceipt[];
  createAction: PopulationAction;
  acceptAction: PopulationAction;
};

const initialState: PopulationActionState = { status: "idle" };

function buildSanitizedErrorCsv(state: PopulationActionState): string | null {
  if (state.status !== "invalid") return null;
  return [
    "row_number,reason_code,field_code",
    ...state.errors.map((error) =>
      [error.rowNumber ?? "", error.reasonCode, error.fieldCode].join(","),
    ),
    "",
  ].join("\n");
}

function ActionFeedback({ state }: { state: PopulationActionState }) {
  const csv = buildSanitizedErrorCsv(state);
  if (state.status === "invalid" && csv) {
    return (
      <div className={styles.errorSummary} role="alert">
        <strong>พบข้อมูลที่ต้องแก้ไข</strong>
        <p>แก้รายการต่อไปนี้แล้วตรวจทั้งชุดอีกครั้ง ระบบไม่บันทึกบางแถวแยกกัน</p>
        <ul>
          {state.errors.map((error, index) => (
            <li key={`${error.rowNumber}-${error.fieldCode}-${error.reasonCode}-${index}`}>
              {error.rowNumber === null ? "ทั้งไฟล์" : `แถว ${error.rowNumber}`} ·{" "}
              {error.fieldCode} · {error.reasonCode}
            </li>
          ))}
        </ul>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
          download="population-import-errors.csv"
        >
          ดาวน์โหลดรายการที่ต้องแก้
        </a>
      </div>
    );
  }
  if (state.status === "service_unavailable") {
    return <p className={styles.systemStatus} role="status">ระบบฐานข้อมูลยังไม่พร้อม โปรดลองอีกครั้ง</p>;
  }
  if (state.status === "conflict") {
    return <p className={styles.systemStatus} role="status">ข้อมูลชุดนี้เปลี่ยนไปแล้ว โปรดโหลดหน้าใหม่ก่อนทำต่อ</p>;
  }
  if (state.status === "forbidden") {
    return <p className={styles.systemStatus} role="status">บัญชีนี้ไม่มีสิทธิ์จัดการประชากร</p>;
  }
  if (state.status === "validated") {
    return <p className={styles.successStatus} role="status"><Check size={18} aria-hidden="true" />ตรวจผ่านทั้งชุดและบันทึกหลักฐานแล้ว</p>;
  }
  return null;
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

function Receipt({ receipt, acceptAction }: { receipt: PopulationReceipt; acceptAction: PopulationAction }) {
  const [acceptState, submitAccept, pending] = useActionState(acceptAction, initialState);
  const current = acceptState.status === "accepted" ? acceptState.receipt : receipt;
  const accepted = current.status === "accepted";

  return (
    <li className={styles.receipt}>
      <div className={styles.receiptHeading}>
        <div>
          <h3>{current.sourceLabel}</h3>
          <p>{current.sourceAuthorizationRef}</p>
        </div>
        <span className={accepted ? styles.accepted : styles.validated}>
          {accepted ? "snapshot ถูกล็อกแล้ว" : "ตรวจผ่าน"}
        </span>
      </div>
      <dl className={styles.counts}>
        <div><dt>ทั้งหมด</dt><dd>{current.totalCount.toLocaleString("th-TH")}</dd></div>
        <div><dt>เข้าเกณฑ์</dt><dd>{current.eligibleCount.toLocaleString("th-TH")}</dd></div>
        <div><dt>ไม่เข้าเกณฑ์</dt><dd>{current.excludedCount.toLocaleString("th-TH")}</dd></div>
      </dl>
      <div className={styles.evidence}>
        <p><span>กติกา</span>{current.eligibilityRuleVersion}</p>
        <p><span>Schema</span>{current.schemaVersion}</p>
        <p><span>วันที่อ้างอิง</span>{current.referenceDate}</p>
        <p className={styles.digest}>
          <span>SHA-256</span><code>{current.inputDigest.slice(0, 16)}…</code>
          <button
            type="button"
            aria-label="คัดลอก SHA-256 digest แบบเต็ม"
            onClick={() => navigator.clipboard.writeText(current.inputDigest)}
          >
            <Clipboard size={16} aria-hidden="true" />
          </button>
        </p>
      </div>
      <div className={styles.receiptFooter}>
        <p>
          {accepted
            ? `ผู้รับ snapshot · โปรไฟล์ ${current.acceptedByProfileId?.slice(0, 8)} · ${formatThaiTimestamp(current.acceptedAt ?? current.createdAt)}`
            : `ผู้บันทึก · โปรไฟล์ ${current.createdByProfileId.slice(0, 8)} · ${formatThaiTimestamp(current.createdAt)}`}
        </p>
        {!accepted && (
          <form action={submitAccept}>
            <input type="hidden" name="importId" value={current.id} />
            <button className={styles.acceptButton} type="submit" disabled={pending}>
              <LockKeyhole size={17} aria-hidden="true" />
              {pending ? "กำลังรับ…" : "รับ snapshot"}
            </button>
          </form>
        )}
      </div>
      <ActionFeedback state={acceptState} />
    </li>
  );
}

export function PopulationImportFlow({ initialImports, createAction, acceptAction }: PopulationImportFlowProps) {
  const [state, submit, pending] = useActionState(createAction, initialState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const imports = useMemo(() => {
    if (state.status !== "validated") return initialImports;
    return [state.receipt, ...initialImports.filter((item) => item.id !== state.importId)];
  }, [initialImports, state]);

  return (
    <section className={styles.sheet} aria-labelledby="population-title">
      <header className={styles.heading}>
        <div>
          <p className={styles.path}>งานวิจัย · ประชากร</p>
          <h1 id="population-title">นำเข้าประชากร</h1>
          <p className={styles.intro}>ตรวจความสมบูรณ์ทั้งไฟล์ เก็บที่มา และล็อก snapshot เพื่อใช้เป็นฐานการสุ่มที่ตรวจสอบย้อนหลังได้</p>
        </div>
        <span className={styles.syntheticBoundary}>ข้อมูลสังเคราะห์เท่านั้น</span>
      </header>

      <ol className={styles.steps} aria-label="ขั้นตอนนำเข้าประชากร">
        <li><FileUp size={18} aria-hidden="true" /><span>เลือกไฟล์</span></li>
        <li><FileCheck2 size={18} aria-hidden="true" /><span>ตรวจทั้งชุด</span></li>
        <li><Check size={18} aria-hidden="true" /><span>ยืนยันแหล่งข้อมูล</span></li>
        <li><LockKeyhole size={18} aria-hidden="true" /><span>รับ snapshot</span></li>
      </ol>

      <form className={styles.importForm} action={submit}>
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <div className={styles.fileField}>
          <label htmlFor="population-file">ไฟล์ประชากร CSV</label>
          <input id="population-file" name="file" type="file" accept=".csv,text/csv" required />
          <small>UTF-8 · ไม่เกิน 1 MB · ใช้รหัสสังเคราะห์ SYN- เท่านั้น</small>
        </div>
        <div className={styles.fields}>
          <label>แหล่งข้อมูล<input name="sourceLabel" maxLength={120} required /></label>
          <label>หลักฐานอนุญาตแหล่งข้อมูล<input name="sourceAuthorizationRef" pattern="SYN-[A-Z0-9_-]{3,40}" placeholder="SYN-FX_BASE" required /></label>
          <label>วันที่อ้างอิง<input name="referenceDate" type="date" required /></label>
        </div>
        <div className={styles.formFooter}>
          <p><strong>กติกาคงที่</strong><br />synthetic-population-v1 · synthetic-eligibility-v1</p>
          <button type="submit" disabled={pending}>{pending ? "กำลังตรวจ…" : "ตรวจและนำเข้า"}</button>
        </div>
      </form>

      <ActionFeedback state={state} />

      <section className={styles.history} aria-labelledby="snapshot-heading">
        <div className={styles.historyHeading}>
          <h2 id="snapshot-heading">หลักฐานการนำเข้า</h2>
          <span>{imports.length.toLocaleString("th-TH")} ชุด</span>
        </div>
        {imports.length === 0 ? (
          <div className={styles.empty}><FileCheck2 size={24} aria-hidden="true" /><p>ยังไม่มีชุดประชากรที่ผ่านการตรวจ</p></div>
        ) : (
          <ul className={styles.receiptList}>
            {imports.map((receipt) => <Receipt key={receipt.id} receipt={receipt} acceptAction={acceptAction} />)}
          </ul>
        )}
      </section>
    </section>
  );
}
