import type { Role } from "@/modules/identity/domain/roles";

/**
 * Presentation-only dashboard read model. Production data is supplied by the
 * server layer; this module owns the shape and the truthful default states.
 * Nothing here authorizes access — server authorization remains the boundary.
 */

export type DashboardSectionStatus =
  | "available"
  | "empty"
  | "loading"
  | "unavailable"
  | "not_enabled";

export type MetricTone = "neutral" | "positive" | "negative";

export type LedgerMetricKey =
  | "net_income"
  | "expense_total"
  | "cash_result"
  | "harvest_volume";

export type OperationalMetric =
  | {
      status: "available";
      key: LedgerMetricKey;
      label: string;
      value: string;
      caption: string | null;
      tone: MetricTone;
    }
  | {
      status: Exclude<DashboardSectionStatus, "available">;
      key: LedgerMetricKey;
      label: string;
      message: string;
    };

export type TrendRow = {
  /** Thai month label, e.g. "เม.ย. 2569". */
  label: string;
  /** Canonical decimal strings preserve the money boundary. */
  income: string;
  expense: string;
};

export type AnalyticsState =
  | {
      status: "available";
      headline: string;
      trendRows: readonly TrendRow[];
      freshnessNote: string | null;
      partial: boolean;
    }
  | { status: Exclude<DashboardSectionStatus, "available">; message: string };

export type WorkQueueAction =
  | { kind: "link"; label: string; href: `/app/${string}` | "/app" }
  | { kind: "pending"; label: string; reason: string };

export type WorkQueueItem = {
  id: string;
  title: string;
  detail: string;
  action: WorkQueueAction;
};

export type ResearchLink = { label: string; href: `/app/${string}` };

export type ResearchSummaryState =
  | {
      status: "available";
      activeRun: { populationSize: number; targetN: number } | null;
      runCount: number;
      acceptedSnapshotCount: number | null;
      links: readonly ResearchLink[];
      note: string | null;
    }
  | { status: "empty"; links: readonly ResearchLink[]; note: string | null }
  | { status: "loading"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "not_enabled"; message: string };

export type DashboardReadModel = {
  role: Role;
  heading: string;
  /** Thai (พ.ศ., Asia/Bangkok) presentation timestamp of the read moment. */
  dataAsOf: string;
  operational: readonly OperationalMetric[];
  analytics: AnalyticsState;
  workQueue: readonly WorkQueueItem[];
  research: ResearchSummaryState;
};

const OPERATIONAL_LABELS: Record<LedgerMetricKey, string> = {
  net_income: "รายรับสุทธิ",
  expense_total: "ค่าใช้จ่าย",
  cash_result: "กำไร/ขาดทุนเงินสด",
  harvest_volume: "ผลผลิตที่เก็บได้",
};

function ledgerMetrics(
  fill: (
    key: LedgerMetricKey,
    label: string,
  ) => OperationalMetric,
): OperationalMetric[] {
  return (
    Object.entries(OPERATIONAL_LABELS) as [
      LedgerMetricKey,
      string,
    ][]
  ).map(([key, label]) => fill(key, label));
}

/** Truthful production defaults: no farm-ledger backend exists in V1 yet. */
export function buildLedgerNotEnabledMetrics(): OperationalMetric[] {
  return ledgerMetrics((key, label) => ({
    status: "not_enabled",
    key,
    label,
    message:
      key === "net_income" || key === "expense_total" || key === "cash_result"
        ? "โมดูลบัญชีสวนยังไม่เปิดใช้งาน ตัวเลขจะแสดงหลังระบบบันทึกรายรับ-รายจ่ายเปิดตามแผนถัดไป"
        : "ยังไม่มีการบันทึกการเก็บเกี่ยวในระบบ",
  }));
}

export function buildLedgerUnavailableMetrics(): OperationalMetric[] {
  return ledgerMetrics((key, label) => ({
    status: "unavailable",
    key,
    label,
    message: "อ่านข้อมูลช่วงนี้ไม่สำเร็จชั่วคราว โปรดโหลดหน้าใหม่ภายหลัง",
  }));
}

const WORK_QUEUE_BY_ROLE: Record<Role, readonly Omit<WorkQueueItem, "id">[]> = {
  farmer: [
    {
      title: "เพิ่มค่าใช้จ่าย",
      detail: "บันทึกรายจ่ายของสวน เช่น ปุ๋ย แรงงาน และค่าขนส่ง",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "โมดูลบัญชีสวนยังไม่เปิดใช้งาน" },
    },
    {
      title: "บันทึกการเก็บเกี่ยว",
      detail: "บันทึกจำนวนช่อ/ตันที่เก็บได้ในแต่ละรอบ",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "โมดูลบัญชีสวนยังไม่เปิดใช้งาน" },
    },
    {
      title: "บันทึกการขาย",
      detail: "บันทึกรายรับจากการขายผลผลิตเพื่อคิดกำไรเงินสด",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "โมดูลบัญชีสวนยังไม่เปิดใช้งาน" },
    },
    {
      title: "จัดการข้อมูลสวน",
      detail: "ดูแลข้อมูลสวนและแปลงของตนเอง",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "โมดูลข้อมูลสวนยังไม่เปิดใช้งาน" },
    },
  ],
  field_collector: [
    {
      title: "งานที่ได้รับมอบหมาย",
      detail: "ดูรายการ assignment ที่ต้องเก็บในพื้นที่ของตน",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "ระบบ assignment ยังไม่เปิดใช้งาน" },
    },
    {
      title: "แบบร่างออฟไลน์",
      detail: "งานที่บันทึกไว้ในเครื่องรอส่งเมื่อออนไลน์",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "ระบบ assignment ยังไม่เปิดใช้งาน" },
    },
    {
      title: "งานที่ถูกตีกลับ",
      detail: "งานที่ผู้จัดการส่งกลับให้แก้ไขแล้วส่งใหม่",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "ระบบ assignment ยังไม่เปิดใช้งาน" },
    },
  ],
  research_manager: [
    {
      title: "ข้อมูลรอตรวจ",
      detail: "แบบฟอร์มที่ส่งแล้วรอตรวจและยืนยัน",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "pipeline การเก็บข้อมูลยังไม่เปิดใช้งาน" },
    },
    {
      title: "ความครบถ้วนของข้อมูล",
      detail: "ติดตาม consent และข้อมูลที่ยังขาดของกลุ่มตัวอย่าง",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "pipeline การเก็บข้อมูลยังไม่เปิดใช้งาน" },
    },
    {
      title: "ฐานประชากร",
      detail: "ตรวจและรับ snapshot ประชากรที่ล็อกแล้ว",
      action: { kind: "link", label: "เปิดงานประชากร", href: "/app/research/population" },
    },
    {
      title: "การสุ่มตัวอย่าง",
      detail: "สร้างและตรวจ sampling run ที่ตรวจสอบย้อนกลับได้",
      action: { kind: "link", label: "เปิดงานสุ่มตัวอย่าง", href: "/app/research/sampling" },
    },
  ],
  admin: [
    {
      title: "ตรวจสอบเหตุการณ์ระบบ",
      detail: "ตรวจ audit event ที่เกิดขึ้นในพื้นที่ทำงาน",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "หน้าตรวจสอบเหตุการณ์ยังไม่เปิดใช้งาน" },
    },
    {
      title: "ผู้ใช้และสิทธิ์",
      detail: "ดูแลบัญชีและขอบเขตสิทธิ์ของพื้นที่ทำงาน",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "หน้าจัดการผู้ใช้ยังไม่เปิดใช้งาน" },
    },
    {
      title: "ฐานประชากร",
      detail: "นำเข้าและรับ snapshot ประชากรสังเคราะห์",
      action: { kind: "link", label: "เปิดงานประชากร", href: "/app/research/population" },
    },
  ],
  evaluator_readonly: [
    {
      title: "ภาพรวมประเมิน",
      detail: "อ่านผลรวมแบบไม่ระบุตัวบุคคลเพื่อการประเมิน",
      action: { kind: "pending", label: "รอเปิดใช้งาน", reason: "หน้ารายงานประเมินยังไม่เปิดใช้งาน" },
    },
  ],
};

/**
 * Role-scoped next actions. Pending items are non-interactive on purpose:
 * they must never look like working links while their backend is absent.
 */
export function buildWorkQueue(role: Role): WorkQueueItem[] {
  return WORK_QUEUE_BY_ROLE[role].map((item, index) => ({
    ...item,
    id: `${role}-${index + 1}`,
  }));
}

const DASHBOARD_HEADING = "ภาพรวมสวนและข้อมูล";

export function buildDashboardHeading(): string {
  return DASHBOARD_HEADING;
}
