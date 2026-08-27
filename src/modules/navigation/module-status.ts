import { isRole, type Role } from "@/modules/identity/domain/roles";

export type PendingSectionKey =
  | "settings"
  | "audit"
  | "my-work"
  | "reports"
  | "evaluation";

export type ModuleStatusMetadata = {
  readonly key: PendingSectionKey;
  readonly title: string;
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
    description: "จัดการขอบเขตพื้นที่ทำงาน นโยบายความปลอดภัย และสิทธิ์ผู้ใช้งาน",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "V1 ใช้พื้นที่ทำงานเดียวและยังไม่มีหน้าจอสำหรับเปลี่ยนการตั้งค่าระบบ",
    capabilities: [
      "กำหนดค่าขอบเขตพื้นที่ทำงาน (Workspace boundary)",
      "จัดการผู้ใช้งานและการกำหนดบทบาทตามคำขอที่ผ่านการอนุมัติ",
      "ตั้งค่านโยบายความปลอดภัยและการลดทอนข้อมูลส่วนบุคคล (Anonymization Policy)",
    ],
    nextSteps: [
      "ขอบเขตพื้นที่ทำงานและสิทธิ์หลักยังคงบังคับที่เซิร์ฟเวอร์และฐานข้อมูล",
      "ก่อนเปิดหน้าจอนี้ ต้องกำหนดรายการค่าที่แก้ได้ การยืนยัน และหลักฐาน Audit ให้ครบ",
    ],
    allowedRoles: ["admin"],
  },
  audit: {
    key: "audit",
    title: "ตรวจสอบเหตุการณ์",
    description: "ตรวจสอบประวัติการดำเนินงานและหลักฐานความปลอดภัยที่ผ่านการลดข้อมูลส่วนบุคคล",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "ฐานข้อมูลรองรับ Audit Event แล้ว แต่ยังไม่มีมุมมองสำหรับค้นหาและอ่านผ่านเว็บแอป",
    capabilities: [
      "ค้นหาและกรองบันทึกเหตุการณ์ตามรหัสผู้ดำเนินการ (Actor UUID) และช่วงเวลา",
      "ตรวจสอบประวัติการแก้ไขข้อมูลที่ได้รับการยืนยัน (Verified correction trail)",
      "ตรวจสอบบันทึกการยินยอมและการถอนตัวจากโครงการวิจัยโดยไม่เปิดเผย PII",
    ],
    nextSteps: [
      "กำหนด safe projection ที่ไม่เปิดเผย PII ก่อนเชื่อมข้อมูลเข้าหน้านี้",
      "เพิ่มตัวกรอง สิทธิ์อ่าน และ acceptance test สำหรับเหตุการณ์ที่อยู่ในขอบเขต",
    ],
    allowedRoles: ["admin"],
  },
  "my-work": {
    key: "my-work",
    title: "งานของฉัน",
    description: "ดูรายการเกษตรกรที่ได้รับมอบหมายและบันทึกข้อมูลแบบสอบถามภาคสนาม",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "ยังไม่มีแบบสอบถามฉบับอนุมัติ จึงยังไม่เปิดการเก็บข้อมูลภาคสนาม",
    capabilities: [
      "ดูรายชื่อเกษตรกรและแปลงปลูกที่ได้รับมอบหมายตามการสุ่มตัวอย่าง",
      "แสดงหนังสือแจ้งสิทธิ์ (Privacy Notice) และบันทึกความยินยอม (Consent)",
      "บันทึกข้อมูลแบบสอบถามภาคสนามพร้อมระบบบันทึกแบบออฟไลน์ที่ปลอดภัย",
    ],
    nextSteps: [
      "อนุมัติ Questionnaire Version, Question Code และ Codebook ก่อนสร้างแบบบันทึกจริง",
      "ทำ Assignment, Consent, Offline Draft และการส่งซ้ำแบบ idempotent ให้ผ่าน acceptance test",
    ],
    allowedRoles: ["field_collector"],
  },
  reports: {
    key: "reports",
    title: "รายงาน",
    description: "เตรียมรายงานสรุปแบบไม่ระบุตัวตนและตรวจสอบความคืบหน้าโครงการวิจัย",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "ยังไม่มีชุดรายงานและเส้นทาง Export ที่ผ่านการตรวจรับสำหรับใช้งานจริง",
    capabilities: [
      "สร้างและดาวน์โหลดรายงานสรุปงานวิจัยแบบลดทอนข้อมูลส่วนบุคคล (Anonymized export)",
      "ติดตามความคืบหน้าของกระบวนการเก็บข้อมูล (Collection Funnel & Progress)",
      "จัดการคำขอส่งออกข้อมูลพร้อมการบันทึกวัตถุประสงค์และ Audit Trail",
    ],
    nextSteps: [
      "กำหนดนิยามตัวชี้วัด ตัวกรอง และการกระทบยอดกับข้อมูลต้นทาง",
      "ทดสอบ Anonymized Export เป็นค่าเริ่มต้น พร้อมสิทธิ์และ Audit สำหรับ Full-PII Export",
    ],
    allowedRoles: ["research_manager"],
  },
  evaluation: {
    key: "evaluation",
    title: "ภาพรวมประเมิน",
    description: "ดูข้อมูลสรุปภาพรวมแบบไม่ระบุตัวตนเพื่อประเมินผลโครงการโดยไม่แก้ไขข้อมูลฐาน",
    status: "ยังไม่เปิดใช้งาน",
    statusReason: "ยังไม่มีมุมมองสรุปที่ผ่านการตรวจว่าไม่สามารถย้อนกลับไปหาบุคคลได้",
    capabilities: [
      "เข้าถึงชุดข้อมูลวิจัยแบบสรุปรวม (Aggregated Evaluation Views)",
      "วิเคราะห์ตัวชี้วัดความสำเร็จของโครงการตามแบบจำลองทางสถิติ",
      "ส่งออกรายงานผลการประเมินแบบอ่านอย่างเดียวโดยไม่มีข้อมูล PII",
    ],
    nextSteps: [
      "กำหนดเกณฑ์ Aggregation และการลดทอนข้อมูลสำหรับชุดประเมิน",
      "พิสูจน์สิทธิ์อ่านอย่างเดียว การปิดกั้นข้อมูลระดับแถว และ Export ที่ไม่เปิดเผย PII",
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
  if (!metadata || !isRole(role)) return false;
  return metadata.allowedRoles.includes(role);
}
