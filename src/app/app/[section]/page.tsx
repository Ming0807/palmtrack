import { notFound, redirect } from "next/navigation";

import { getRoleNavigation } from "@/modules/navigation/role-navigation";
import { resolveIdentitySession } from "@/modules/identity/server/session";
import { ConfigurationErrorState, ForbiddenState, UnconfiguredState } from "@/modules/identity/ui";

import styles from "../app-shell.module.css";

const SECTION_COPY = {
  settings: ["ตั้งค่าระบบ", "จัดการขอบเขตพื้นที่ทำงานและสิทธิ์ที่อนุมัติ"],
  audit: ["ตรวจสอบเหตุการณ์", "ตรวจสอบหลักฐานการทำงานที่ผ่านการลดข้อมูลส่วนบุคคล"],
  research: ["งานวิจัย", "เตรียมประชากร การสุ่มตัวอย่าง และงานภาคสนามตาม protocol"],
  reports: ["รายงาน", "เตรียมรายงานแบบไม่ระบุตัวตนและหลักฐานการวิจัย"],
  "my-work": ["งานของฉัน", "ดูเฉพาะงานภาคสนามที่ได้รับมอบหมาย"],
  gardens: ["สวนของฉัน", "จัดการข้อมูลสวนที่เป็นของบัญชีเกษตรกร"],
  "garden-account": ["บัญชีสวน", "ติดตามกิจกรรม รายจ่าย ผลผลิต และรายรับของสวน"],
  evaluation: ["ภาพรวมประเมิน", "ดูข้อมูลสรุปแบบไม่ระบุตัวตนโดยไม่แก้ไขข้อมูลฐาน"],
} as const;

type SectionKey = keyof typeof SECTION_COPY;

export default async function ApplicationSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in SECTION_COPY)) notFound();

  const session = await resolveIdentitySession();
  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status === "unconfigured") return <UnconfiguredState />;
  if (session.status === "configuration_error") return <ConfigurationErrorState />;
  if (session.status === "inactive" || session.status === "forbidden") return <ForbiddenState />;

  const route = `/app/${section}` as const;
  if (!getRoleNavigation(session.profile.role).some((item) => item.href === route)) return <ForbiddenState />;

  const [title, description] = SECTION_COPY[section as SectionKey];
  return (
    <section className={styles.content}>
      <p className={styles.eyebrow}>โมดูลตามสิทธิ์</p>
      <h1>{title}</h1>
      <p className={styles.lead}>{description}</p>
      <div className={styles.notice}>
        <h2>สถานะปัจจุบัน</h2>
        <p>เส้นทางและสิทธิ์ฝั่งเซิร์ฟเวอร์พร้อมแล้ว ฟังก์ชันข้อมูลของโมดูลจะเพิ่มเป็น vertical slice ถัดไปหลังฐานข้อมูลผ่านการทดสอบ RLS</p>
      </div>
    </section>
  );
}
