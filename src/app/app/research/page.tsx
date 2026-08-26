import { ArrowRight, DatabaseZap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { resolveIdentitySession } from "@/modules/identity/server/session";
import { ConfigurationErrorState, ForbiddenState, UnconfiguredState } from "@/modules/identity/ui";
import styles from "../app-shell.module.css";

export default async function ResearchPage() {
  const session = await resolveIdentitySession();
  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status === "unconfigured") return <UnconfiguredState />;
  if (session.status === "configuration_error") return <ConfigurationErrorState />;
  if (session.status !== "authorized" || session.profile.role !== "research_manager") return <ForbiddenState />;

  return (
    <section className={styles.content}>
      <h1>งานวิจัย</h1>
      <p className={styles.lead}>จัดเตรียมฐานประชากรและหลักฐานก่อนเริ่มการสุ่มตัวอย่าง โดยทุกขั้นตอนตรวจสอบย้อนหลังได้</p>
      <div className={styles.notice}>
        <DatabaseZap size={24} aria-hidden="true" />
        <h2>ประชากรวิจัย</h2>
        <p>ตรวจไฟล์สังเคราะห์ ยืนยันที่มา และรับ snapshot ที่ล็อกแล้ว</p>
        <Link href="/app/research/population">เปิดงานประชากร <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      <div className={styles.notice}>
        <DatabaseZap size={24} aria-hidden="true" />
        <h2>การสุ่มตัวอย่าง</h2>
        <p>ดูรายการ sampling run ของพื้นที่ทำงาน</p>
        <Link href="/app/research/sampling">เปิดงานสุ่มตัวอย่าง <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
