import { LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { resolveIdentitySession } from "@/modules/identity/server/session";
import {
  ConfigurationErrorState,
  ForbiddenState,
  UnconfiguredState,
} from "@/modules/identity/ui";

import { signIn } from "./actions";
import styles from "./sign-in.module.css";

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await resolveIdentitySession();
  const query = await searchParams;

  if (session.status === "authorized") {
    redirect("/app");
  }

  if (session.status === "unconfigured") {
    return <main className={styles.statePage}><UnconfiguredState /></main>;
  }

  if (session.status === "configuration_error") {
    return <main className={styles.statePage}><ConfigurationErrorState /></main>;
  }

  if (session.status === "inactive" || session.status === "forbidden") {
    return <main className={styles.statePage}><ForbiddenState /></main>;
  }

  const hasError = query.error === "invalid" || query.error === "configuration";

  return (
    <main className={styles.page}>
      <section className={styles.introduction} aria-labelledby="sign-in-title">
        <div className={styles.eyebrow}>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>พื้นที่ทำงานที่ได้รับอนุญาต</span>
        </div>
        <p className={styles.brand}>PalmTrack</p>
        <h1 id="sign-in-title">เข้าสู่ระบบเพื่อเริ่มงาน</h1>
        <p className={styles.lead}>
          ใช้บัญชีที่ผู้ดูแลโครงการจัดสรรให้ ระบบจะแสดงเฉพาะงานและข้อมูลตามบทบาทของคุณ
        </p>
        <div className={styles.assurance}>
          <LockKeyhole size={20} aria-hidden="true" />
          <p>ข้อมูลส่วนบุคคลและไฟล์เป็นข้อมูลส่วนตัว การเข้าถึงสำคัญถูกตรวจสอบและบันทึกเหตุการณ์</p>
        </div>
      </section>

      <section className={styles.panel} aria-label="แบบฟอร์มเข้าสู่ระบบ">
        <div>
          <p className={styles.step}>บัญชีโครงการ</p>
          <h2>ยืนยันตัวตน</h2>
        </div>
        {hasError ? (
          <p className={styles.error} role="alert">
            ไม่สามารถเข้าสู่ระบบได้ โปรดตรวจสอบข้อมูลหรือติดต่อผู้ดูแลระบบ
          </p>
        ) : null}
        <form action={signIn} className={styles.form}>
          <label htmlFor="identifier">อีเมล หรือโทรศัพท์รูปแบบ +66</label>
          <input autoComplete="username" id="identifier" inputMode="email" maxLength={254} name="identifier" required type="text" />
          <label htmlFor="password">รหัสผ่าน</label>
          <input autoComplete="current-password" id="password" maxLength={1024} name="password" required type="password" />
          <button type="submit">เข้าสู่ระบบ</button>
        </form>
        <p className={styles.support}>หากเข้าใช้งานไม่ได้ โปรดติดต่อผู้ดูแลโครงการผ่านช่องทางที่ได้รับแจ้ง</p>
      </section>
    </main>
  );
}
