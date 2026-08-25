"use client";

import {
  Check,
  ClipboardCheck,
  FileLock2,
  LockKeyhole,
  RotateCcw,
  Send,
} from "lucide-react";
import { useState } from "react";
import { savePrototypeDraft } from "./draft-store";
import {
  canEditReturnedAssignment,
  instrumentBoundary,
  workflowSteps,
  type PrototypeState,
} from "./model";

type AssignmentRouteProps = {
  assignmentId: string;
  prototypeState: PrototypeState;
};

const stepIcons = [Check, ClipboardCheck, FileLock2, LockKeyhole, Send];

export function AssignmentRoute({
  assignmentId,
  prototypeState,
}: AssignmentRouteProps) {
  const returned = prototypeState === "returned";
  const [resumed, setResumed] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const editable = canEditReturnedAssignment({ returned, resumed });

  return (
    <section aria-labelledby="assignment-title" className="pt-assignment-route">
      <div className="pt-assignment-heading">
        <div>
          <p className="pt-assignment-code">งาน {assignmentId}</p>
          <h1 id="assignment-title">พื้นที่ตัวอย่าง ก-01</h1>
        </div>
        <span className="pt-status pt-status--priority">งานสำคัญ</span>
      </div>

      {returned ? (
        <div className="pt-returned-panel" role="status">
          <div>
            <strong>ผู้ตรวจส่งคืนรายการนี้</strong>
            <p>
              อ่านเหตุผลก่อน รายการยังเป็นแบบอ่านอย่างเดียวจนกว่าจะกดกลับมาแก้ไข
            </p>
          </div>
          <button
            className="pt-secondary-action"
            disabled={resumed}
            onClick={() => setResumed(true)}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={18} />
            {resumed ? "แก้ไขได้แล้ว" : "กลับมาแก้ไข"}
          </button>
        </div>
      ) : null}

      <h2>เส้นทางหลักฐาน</h2>
      <ol aria-label="ลำดับขั้นตอนงานวิจัย" className="pt-evidence-route">
        {workflowSteps.map((step, index) => {
          const Icon = stepIcons[index];
          const waiting = step.key === "baseline";
          return (
            <li className={`pt-route-step pt-route-step--${step.status}`} key={step.key}>
              <span aria-hidden="true" className="pt-route-marker">
                <Icon size={20} strokeWidth={2} />
              </span>
              <div className="pt-route-copy">
                <strong>{step.label}</strong>
                <span>{step.description}</span>
                {waiting ? (
                  <span className="pt-instrument-boundary">
                    {instrumentBoundary.label}
                  </span>
                ) : null}
              </div>
              <span className="pt-route-state">
                {step.status === "complete"
                  ? "เสร็จสิ้น"
                  : step.status === "waiting"
                    ? "กำลังรอ"
                    : "ล็อกอยู่"}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="pt-next-step" aria-disabled={!editable}>
        <div>
          <span>ขั้นตอนถัดไป</span>
          <strong>ข้อมูลพื้นฐาน</strong>
          <p>{instrumentBoundary.label} — ยังไม่มีแบบคำถามหรือช่องรับคำตอบ</p>
        </div>
        <button className="pt-primary-action" disabled type="button">
          รอการอนุมัติ
          <LockKeyhole aria-hidden="true" size={18} />
        </button>
      </div>
      {prototypeState === "offline" ? (
        <div className="pt-local-draft">
          <div>
            <strong>ร่างในเครื่องเท่านั้น</strong>
            <p>บันทึก checkpoint สังเคราะห์ใน IndexedDB และส่งเมื่อออนไลน์</p>
          </div>
          <button
            className="pt-secondary-action"
            onClick={async () => {
              await savePrototypeDraft(assignmentId);
              setDraftMessage("บันทึกร่างในเครื่องแล้ว");
            }}
            type="button"
          >
            บันทึกร่างในเครื่อง
          </button>
          <span aria-live="polite">{draftMessage}</span>
        </div>
      ) : null}
    </section>
  );
}
