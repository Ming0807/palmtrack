import { type Role } from "@/modules/identity/domain/roles";

export type PendingSectionKey =
  | "settings"
  | "audit"
  | "my-work"
  | "reports"
  | "evaluation";

export type ModuleStatusMetadata = {
  readonly key: PendingSectionKey;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly status: "ยังไม่เปิดใช้งาน";
  readonly statusReason: string;
  readonly capabilities: readonly string[];
  readonly nextSteps: readonly string[];
  readonly allowedRoles: readonly Role[];
};

export const PENDING_SECTIONS: Record<PendingSectionKey, ModuleStatusMetadata> = {
  settings: {
    key: "settings",
    title: "ตั้งค่าระบบ",
    eyebrow: "การจัดการระบบและพื้นที่ทำงาน",
    description: "จัดการขอบเขตพื้นที่ทำงาน นโยบายความปลอดภัย และสิทธิ์ผู้ใช้งาน",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "การตั้งค่าระบบใน V1 ถูกกำหนดล่วงหน้าผ่านการตั้งค่าเริ่มต้นระดับฐานข้อมูลและ RLS",
    capabilities: [
      "กำหนดค่าขอบเขตพื้นที่ทำงาน (Workspace boundary)",
      "จัดการผู้ใช้งานและการกำหนดบทบาทตามคำขอที่ผ่านการอนุมัติ",
      "ตั้งค่านโยบายความปลอดภัยและการลดทอนข้อมูลส่วนบุคคล (Anonymization Policy)",
    ],
    nextSteps: [
      "ระบบปัจจุบันใช้การกำหนดค่าระดับฐานข้อมูลที่มี RLS ควบคุมอย่างเข้มงวด",
      "หน้าจอตั้งค่าแบบกราฟิกจะเปิดใช้งานในรอบการพัฒนาถัดไป",
    ],
    allowedRoles: ["admin"],
  },
  audit: {
    key: "audit",
    title: "ตรวจสอบเหตุการณ์",
    eyebrow: "บันทึกและตรวจสอบความปลอดภัย",
    description: "ตรวจสอบประวัติการดำเนินงานและหลักฐานความปลอดภัยที่ผ่านการลดข้อมูลส่วนบุคคล",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "ระบบบันทึกเหตุการณ์ความปลอดภัยผ่าน RPC สู่ตาราง audit_event โดยตรงแล้ว",
    capabilities: [
      "ค้นหาและกรองบันทึกเหตุการณ์ตามรหัสผู้ดำเนินการ (Actor UUID) และช่วงเวลา",
      "ตรวจสอบประวัติการแก้ไขข้อมูลที่ได้รับการยืนยัน (Verified correction trail)",
      "ตรวจสอบบันทึกการยินยอมและการถอนตัวจากโครงการวิจัยโดยไม่เปิดเผย PII",
    ],
    nextSteps: [
      "เหตุการณ์สำคัญทั้งหมดถูกบันทึกลงใน audit_event ของฐานข้อมูลอย่างต่อเนื่อง",
      "หน้าจอ UI Explorer สำหรับค้นหาและตรวจสอบบันทึกจะเปิดให้ใช้งานในรอบถัดไป",
    ],
    allowedRoles: ["admin"],
  },
  "my-work": {
    key: "my-work",
    title: "งานของฉัน",
    eyebrow: "งานภาคสนาม",
    description: "ดูรายการเกษตรกรที่ได้รับมอบหมายและบันทึกข้อมูลแบบสอบถามภาคสนาม",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "อยู่ระหว่างรอการอนุมัติแบบสอบถามวิจัยฉบับจริง (Approved Questionnaire Gate)",
    capabilities: [
      "ดูรายชื่อเกษตรกรและแปลงปลูกที่ได้รับมอบหมายตามการสุ่มตัวอย่าง",
      "แสดงหนังสือแจ้งสิทธิ์ (Privacy Notice) และบันทึกความยินยอม (Consent)",
      "บันทึกข้อมูลแบบสอบถามภาคสนามพร้อมระบบบันทึกแบบออฟไลน์ที่ปลอดภัย",
    ],
    nextSteps: [
      "ระบบความปลอดภัยและ Flow การมอบหมายงานภาคสนามพร้อมในระดับโครงสร้างแล้ว",
      "จะเปิดใช้งานเต็มรูปแบบทันทีที่แบบสอบถามวิจัยได้รับการอนุมัติอย่างเป็นทางการ",
    ],
    allowedRoles: ["field_collector"],
  },
  reports: {
    key: "reports",
    title: "รายงาน",
    eyebrow: "สรุปผลและรายงานวิจัย",
    description: "เตรียมรายงานสรุปแบบไม่ระบุตัวตนและตรวจสอบความคืบหน้าโครงการวิจัย",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "อยู่ระหว่างรวบรวมข้อมูลจากการเก็บภาคสนามเพื่อนำมาประมวลผล",
    capabilities: [
      "สร้างและดาวน์โหลดรายงานสรุปงานวิจัยแบบลดทอนข้อมูลส่วนบุคคล (Anonymized export)",
      "ติดตามความคืบหน้าของกระบวนการเก็บข้อมูล (Collection Funnel & Progress)",
      "จัดการคำขอส่งออกข้อมูลพร้อมการบันทึกวัตถุประสงค์และ Audit Trail",
    ],
    nextSteps: [
      "โมดูลรายงานจะเปิดใช้งานหลังมีการส่งข้อมูลภาคสนามที่ผ่านการตรวจสอบความถูกต้องแล้ว",
      "ในระหว่างนี้สามารถตรวจสอบสถิติเบื้องต้นได้จากหน้าภาพรวม",
    ],
    allowedRoles: ["research_manager"],
  },
  evaluation: {
    key: "evaluation",
    title: "ภาพรวมประเมิน",
    eyebrow: "การประเมินผลโครงการ",
    description: "ดูข้อมูลสรุปภาพรวมแบบไม่ระบุตัวตนเพื่อประเมินผลโครงการโดยไม่แก้ไขข้อมูลฐาน",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "รอการประมวลผลข้อมูลหลังเสร็จสิ้นกระบวนการเก็บข้อมูลภาคสนาม",
    capabilities: [
      "เข้าถึงชุดข้อมูลวิจัยแบบสรุปรวม (Aggregated Evaluation Views)",
      "วิเคราะห์ตัวชี้วัดความสำเร็จของโครงการตามแบบจำลองทางสถิติ",
      "ส่งออกรายงานผลการประเมินแบบอ่านอย่างเดียวโดยไม่มีข้อมูล PII",
    ],
    nextSteps: [
      "โมดูลจะพร้อมใช้งานเมื่อมีชุดข้อมูลวิจัยที่ผ่านการสุ่มและเก็บข้อมูลครบถ้วน",
      "สิทธิ์การเข้าถึงถูกจำกัดให้อ่านเฉพาะมุมมองสรุปตามมาตรฐานความปลอดภัย",
    ],
    allowedRoles: ["evaluator_readonly"],
  },
};

export function isPendingSectionKey(key: string): key is PendingSectionKey {
  return Object.prototype.hasOwnProperty.call(PENDING_SECTIONS, key);
}

export function getModuleStatus(section: string): ModuleStatusMetadata | null {
  if (isPendingSectionKey(section)) {
    return PENDING_SECTIONS[section];
  }
  return null;
}

export function isRoleAllowedForSection(role: unknown, section: string): boolean {
  const metadata = getModuleStatus(section);
  if (!metadata) return false;
  return (metadata.allowedRoles as readonly unknown[]).includes(role);
}
