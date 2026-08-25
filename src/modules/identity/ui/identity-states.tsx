import { AlertCircle, LogIn, ServerOff } from "lucide-react";
import Link from "next/link";

import styles from "./identity-states.module.css";

type StateFrameProps = {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone?: "neutral" | "caution";
};

export type IdentityUiState =
  | "unconfigured"
  | "configuration_error"
  | "anonymous"
  | "inactive"
  | "forbidden";

function StateFrame({ children, icon, tone = "neutral" }: StateFrameProps) {
  return (
    <section
      className={`${styles.state} ${tone === "caution" ? styles.caution : ""}`}
      aria-live="polite"
    >
      <div className={styles.icon} aria-hidden="true">
        {icon}
      </div>
      <div className={styles.copy}>{children}</div>
    </section>
  );
}

export function UnconfiguredState() {
  return (
    <StateFrame icon={<ServerOff size={26} strokeWidth={1.8} />} tone="caution">
      <h1>ยังไม่ได้เชื่อมต่อระบบยืนยันตัวตน</h1>
      <p>
        ระบบนี้ยังไม่พร้อมสำหรับการเข้าสู่ระบบในสภาพแวดล้อมนี้
        โปรดตั้งค่า Supabase สำหรับการพัฒนาภายในก่อนใช้งาน
      </p>
      <p className={styles.note}>
        การตั้งค่าต้องใช้ค่าจากสภาพแวดล้อมที่ได้รับอนุญาตเท่านั้น
        ระบบจะไม่สร้างบัญชีหรือสถานะเข้าสู่ระบบจำลอง
      </p>
    </StateFrame>
  );
}

export function AnonymousSignInPrompt() {
  return (
    <StateFrame icon={<LogIn size={26} strokeWidth={1.8} />}>
      <h1>กรุณาเข้าสู่ระบบ</h1>
      <p>เข้าสู่ระบบเพื่อดูงานที่ได้รับสิทธิ์ในพื้นที่ทำงานของคุณ</p>
      <Link className={styles.primaryAction} href="/sign-in">
        ไปยังหน้าเข้าสู่ระบบ
      </Link>
    </StateFrame>
  );
}

export function ConfigurationErrorState() {
  return (
    <StateFrame icon={<ServerOff size={26} strokeWidth={1.8} />} tone="caution">
      <h1>การเชื่อมต่อระบบไม่สมบูรณ์</h1>
      <p>ระบบยังตรวจสอบการเข้าสู่ระบบไม่ได้ในขณะนี้ โปรดลองอีกครั้งหรือติดต่อผู้ดูแลระบบ</p>
      <p className={styles.note}>รายละเอียดภายในและค่าการเชื่อมต่อจะไม่แสดงบนหน้านี้</p>
    </StateFrame>
  );
}

export function ForbiddenState() {
  return (
    <StateFrame icon={<AlertCircle size={26} strokeWidth={1.8} />}>
      <h1>ไม่สามารถเข้าถึงหน้านี้ได้</h1>
      <p>หากคิดว่านี่เป็นข้อผิดพลาด โปรดติดต่อผู้ดูแลระบบ</p>
    </StateFrame>
  );
}

export const InactiveState = ForbiddenState;

/** Maps the server resolver's safe boundary states to presentational output. */
export function IdentityState({ status }: { status: IdentityUiState }) {
  switch (status) {
    case "unconfigured":
      return <UnconfiguredState />;
    case "configuration_error":
      return <ConfigurationErrorState />;
    case "anonymous":
      return <AnonymousSignInPrompt />;
    case "inactive":
    case "forbidden":
      return <ForbiddenState />;
  }
}
