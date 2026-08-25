import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileWarning,
  LockKeyhole,
  MapPinned,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import {
  assignmentHref,
  priorityAssignments,
  workflowSteps,
  type PrototypeAssignment,
} from "./model";

const statusIcons = {
  overdue: CircleAlert,
  active: Clock3,
  returned: RotateCcw,
  review: Check,
};

export function QueueVariant() {
  return (
    <section aria-labelledby="queue-title" className="pt-queue-variant">
      <div className="pt-page-heading">
        <div>
          <h1 id="queue-title">งานของฉัน</h1>
          <p>เรียงตามความสำคัญและกำหนดส่ง</p>
        </div>
        <div className="pt-queue-count" aria-label="มอบหมายทั้งหมด 4 งาน">
          <span>มอบหมาย</span>
          <strong>4 งาน</strong>
        </div>
      </div>

      <dl className="pt-queue-summary">
        <div>
          <dt>เกินกำหนด</dt>
          <dd>1 งาน</dd>
        </div>
        <div>
          <dt>ครบกำหนดวันนี้</dt>
          <dd>2 งาน</dd>
        </div>
        <div>
          <dt>รอตรวจ / ส่งแล้ว</dt>
          <dd>1 งาน</dd>
        </div>
      </dl>

      <div className="pt-section-heading">
        <h2>คิวงาน</h2>
        <span>ลำดับ 1 ควรทำก่อน</span>
      </div>
      <ol className="pt-assignment-list">
        {priorityAssignments.map((assignment, index) => (
          <AssignmentRow assignment={assignment} index={index + 1} key={assignment.id} />
        ))}
      </ol>
    </section>
  );
}

function AssignmentRow({
  assignment,
  index,
}: {
  assignment: PrototypeAssignment;
  index: number;
}) {
  const StatusIcon = statusIcons[assignment.status];
  const action = (
    <>
      {assignment.nextAction}
      <ArrowRight aria-hidden="true" size={18} />
    </>
  );

  return (
    <li className={`pt-assignment-row pt-assignment-row--${assignment.status}`}>
      <span aria-label={`ลำดับ ${index}`} className="pt-margin-number">
        {String(index).padStart(2, "0")}
      </span>
      <div className="pt-assignment-main">
        <div className="pt-assignment-title-row">
          <div>
            <strong>{assignment.id}</strong>
            <span>{assignment.statusLabel}</span>
          </div>
          <StatusIcon aria-hidden="true" size={19} />
        </div>
        <p>
          <MapPinned aria-hidden="true" size={17} />
          {assignment.areaLabel} · {assignment.stratum}
        </p>
        <p>
          เกษตรกร {assignment.householdCount} ราย · แปลง {assignment.plotCount} แปลง
        </p>
        <span className="pt-due-label">
          <CalendarClock aria-hidden="true" size={17} />
          {assignment.dueLabel}
        </span>
        {assignment.note ? <small>{assignment.note}</small> : null}
      </div>
      {assignment.id === "SSK-024" ? (
        <Link className="pt-row-action" href={assignmentHref(assignment.id)}>
          {action}
        </Link>
      ) : (
        <button
          className="pt-row-action"
          disabled
          title="เส้นทางตัวอย่างเปิดเฉพาะ SSK-024"
          type="button"
        >
          {action}
        </button>
      )}
    </li>
  );
}

export function ReceiptVariant() {
  return (
    <section aria-labelledby="receipt-title" className="pt-receipt-variant">
      <div className="pt-page-heading pt-page-heading--receipt">
        <div>
          <h1 id="receipt-title">งานของฉัน</h1>
          <p>หลักฐานงานแบบใบรับ–ส่ง</p>
        </div>
        <span className="pt-receipt-total">04 รายการ</span>
      </div>

      <div className="pt-receipt-header" aria-hidden="true">
        <span>ลำดับ / รหัส</span>
        <span>พื้นที่ / ชั้น</span>
        <span>จำนวน</span>
        <span>สถานะ</span>
      </div>
      <ol className="pt-receipt-list">
        {priorityAssignments.map((assignment, index) => (
          <li key={assignment.id}>
            <div className="pt-receipt-code">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{assignment.id}</strong>
            </div>
            <div className="pt-receipt-area">
              <strong>{assignment.areaLabel}</strong>
              <span>{assignment.stratum}</span>
            </div>
            <div className="pt-receipt-amount">
              <strong>{assignment.householdCount}</strong>
              <span>ราย</span>
            </div>
            <div className="pt-receipt-status">
              <span className={`pt-status pt-status--${assignment.status}`}>
                {assignment.statusLabel}
              </span>
              {assignment.id === "SSK-024" ? (
                <Link aria-label={`เปิดงาน ${assignment.id}`} href={assignmentHref(assignment.id)}>
                  <ChevronRight aria-hidden="true" size={22} />
                </Link>
              ) : (
                <button
                  aria-label={`งาน ${assignment.id} ยังไม่เปิดในต้นแบบ`}
                  disabled
                  title="เส้นทางตัวอย่างเปิดเฉพาะ SSK-024"
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={22} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="pt-receipt-footnote">
        <ClipboardList aria-hidden="true" size={18} />
        ตัวเลขทั้งหมดเป็นข้อมูลตัวอย่างสำหรับเปรียบเทียบโครงหน้าจอ
      </p>
    </section>
  );
}

export function RouteVariant() {
  const focus = priorityAssignments[0];
  return (
    <section aria-labelledby="route-preview-title" className="pt-route-variant">
      <div className="pt-page-heading">
        <div>
          <h1 id="route-preview-title">งานของฉัน</h1>
          <p>ติดตามตำแหน่งงานบนเส้นทางหลักฐาน</p>
        </div>
        <span className="pt-status pt-status--active">กำลังดำเนินการ</span>
      </div>

      <div className="pt-focus-assignment">
        <div>
          <span>งานหลักลำดับถัดไป</span>
          <strong>{focus.id}</strong>
          <p>{focus.areaLabel}</p>
        </div>
        <div>
          <span>ความคืบหน้า</span>
          <strong>2 / 5 ขั้นตอน</strong>
          <Link className="pt-secondary-action" href={assignmentHref(focus.id)}>
            เปิดเส้นทางงาน
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </div>

      <h2>เส้นทางหลักฐาน</h2>
      <ol className="pt-route-preview">
        {workflowSteps.map((step) => (
          <li className={`pt-route-preview--${step.status}`} key={step.key}>
            <span aria-hidden="true">
              {step.status === "complete" ? <Check size={17} /> : <LockKeyhole size={16} />}
            </span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </div>
          </li>
        ))}
      </ol>

      <div className="pt-route-next">
        <FileWarning aria-hidden="true" size={24} />
        <div>
          <span>ขั้นตอนที่ต้องตรวจ</span>
          <strong>รออนุมัติเครื่องมือวิจัย</strong>
        </div>
        <Link className="pt-primary-action" href={assignmentHref(focus.id)}>
          ดูรายละเอียด
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </div>
    </section>
  );
}
