import {
  Ban,
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  RefreshCcw,
  ServerOff,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PrototypeState } from "./model";

const exceptionalStates = {
  validation: {
    Icon: CircleAlert,
    title: "ข้อมูลตัวอย่างยังไม่ครบ",
    body: "ตรวจรายการที่มีเครื่องหมายคำเตือน แล้วลองอีกครั้ง",
  },
  forbidden: {
    Icon: Ban,
    title: "คุณไม่มีสิทธิ์เปิดงานนี้",
    body: "กลับไปที่งานของฉัน หรือติดต่อผู้จัดการงานวิจัย",
  },
  "not-found": {
    Icon: FileQuestion,
    title: "ไม่พบงานที่ต้องการ",
    body: "งานอาจถูกถอนหรือไม่ได้มอบหมายให้บัญชีนี้",
  },
  stale: {
    Icon: RefreshCcw,
    title: "ข้อมูลบนเซิร์ฟเวอร์เปลี่ยนแล้ว",
    body: "โหลดข้อมูลล่าสุดก่อนกลับมาแก้ไข เพื่อไม่ให้ทับงานของผู้อื่น",
  },
  "service-unavailable": {
    Icon: ServerOff,
    title: "บริการยังไม่พร้อมใช้งาน",
    body: "ร่างในเครื่องยังอยู่ ลองเชื่อมต่อและส่งใหม่ภายหลัง",
  },
} as const;

export function StateBoundary({
  state,
  children,
}: {
  state: PrototypeState;
  children: ReactNode;
}) {
  if (state === "loading") {
    return (
      <div aria-busy="true" aria-label="กำลังโหลดงาน" className="pt-loading-state">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (state === "empty") {
    return (
      <section className="pt-empty-state">
        <ClipboardEmptyIcon />
        <h2>ยังไม่มีงานที่มอบหมาย</h2>
        <p>เมื่อผู้จัดการมอบหมายงาน รายการจะปรากฏที่นี่โดยอัตโนมัติ</p>
      </section>
    );
  }

  if (state in exceptionalStates) {
    const { Icon, title, body } =
      exceptionalStates[state as keyof typeof exceptionalStates];
    return (
      <section className="pt-error-state" role="alert">
        <Icon aria-hidden="true" size={26} />
        <div>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <Link className="pt-secondary-action" href="/prototype/field?variant=A">
          กลับไปที่งานของฉัน
        </Link>
      </section>
    );
  }

  return (
    <>
      {state === "success" ? (
        <div className="pt-success-state" role="status">
          <CheckCircle2 aria-hidden="true" size={20} />
          บันทึกการเปลี่ยนแปลงในตัวอย่างแล้ว
        </div>
      ) : null}
      {children}
    </>
  );
}

function ClipboardEmptyIcon() {
  return <FileQuestion aria-hidden="true" size={34} />;
}
