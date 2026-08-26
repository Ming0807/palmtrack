import type { Role } from "@/modules/identity/domain/roles";

import {
  buildDashboardHeading,
  buildWorkQueue,
  type AnalyticsState,
  type DashboardReadModel,
  type LedgerMetricKey,
  type MetricTone,
  type OperationalMetric,
} from "./dashboard-model";

/**
 * Deterministic synthetic fixtures for /prototype/dashboard only.
 * These must never be imported by a production provider. Every value is
 * invented and clearly labeled "ข้อมูลสังเคราะห์" by the prototype route.
 */

export type PrototypeScenario =
  | "typical"
  | "empty"
  | "loading"
  | "partial"
  | "unavailable";

export const PROTOTYPE_SCENARIOS: readonly PrototypeScenario[] = [
  "typical",
  "empty",
  "loading",
  "partial",
  "unavailable",
];

export function isPrototypeScenario(value: unknown): value is PrototypeScenario {
  return (
    typeof value === "string" &&
    (PROTOTYPE_SCENARIOS as readonly string[]).includes(value)
  );
}

const METRIC_LABELS: Record<LedgerMetricKey, string> = {
  net_income: "รายรับสุทธิ",
  expense_total: "ค่าใช้จ่าย",
  cash_result: "กำไร/ขาดทุนเงินสด",
  harvest_volume: "ผลผลิตที่เก็บได้",
};

const baht = (value: string): string =>
  `฿${Number(value).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function availableMetric(
  key: LedgerMetricKey,
  value: string,
  tone: MetricTone,
  caption: string | null = null,
): OperationalMetric {
  return { status: "available", key, label: METRIC_LABELS[key], value, caption, tone };
}

// Fixed invented series — no randomness, no real-world source.
const TREND_FULL: readonly { label: string; income: string; expense: string }[] = [
  { label: "มี.ค. 2569", income: "48200.00", expense: "31500.00" },
  { label: "เม.ย. 2569", income: "51400.00", expense: "28800.00" },
  { label: "พ.ค. 2569", income: "39600.00", expense: "34100.00" },
  { label: "มิ.ย. 2569", income: "62300.00", expense: "29900.00" },
  { label: "ก.ค. 2569", income: "57900.00", expense: "36400.00" },
];

const TREND_PARTIAL = TREND_FULL.slice(0, 3);

function operationalFor(scenario: PrototypeScenario): OperationalMetric[] {
  if (scenario === "loading") {
    return (Object.keys(METRIC_LABELS) as LedgerMetricKey[]).map((key) => ({
      status: "loading" as const,
      key,
      label: METRIC_LABELS[key],
      message: "กำลังโหลดข้อมูล",
    }));
  }
  if (scenario === "unavailable") {
    return (Object.keys(METRIC_LABELS) as LedgerMetricKey[]).map((key) => ({
      status: "unavailable" as const,
      key,
      label: METRIC_LABELS[key],
      message: "อ่านข้อมูลช่วงนี้ไม่สำเร็จชั่วคราว โปรดโหลดหน้าใหม่ภายหลัง",
    }));
  }
  if (scenario === "empty") {
    return (Object.keys(METRIC_LABELS) as LedgerMetricKey[]).map((key) => ({
      status: "empty" as const,
      key,
      label: METRIC_LABELS[key],
      message: "ยังไม่มีรายการในช่วงเวลานี้",
    }));
  }
  return [
    availableMetric("net_income", baht("259400.00"), "neutral", "สังเคราะห์ · มี.ค.–ก.ค. 2569"),
    availableMetric("expense_total", baht("160700.00"), "neutral", "สังเคราะห์ · ทุกหมวดรวมกัน"),
    availableMetric("cash_result", `+${baht("98700.00")}`, "positive", "รายรับ − ค่าใช้จ่าย"),
    availableMetric("harvest_volume", "1,284 ตัน", "neutral", scenario === "partial" ? "สังเคราะห์ · 3 เดือนล่าสุด" : "สังเคราะห์ · 5 เดือนล่าสุด"),
  ];
}

function analyticsFor(scenario: PrototypeScenario): AnalyticsState {
  if (scenario === "loading") {
    return { status: "loading", message: "กำลังโหลดข้อมูล" };
  }
  if (scenario === "unavailable") {
    return { status: "unavailable", message: "โหลดแนวโน้มไม่สำเร็จชั่วคราว" };
  }
  if (scenario === "empty") {
    return { status: "empty", message: "ยังไม่มีข้อมูลรายรับ ค่าใช้จ่าย และผลผลิตในช่วงนี้" };
  }
  const trendRows = scenario === "partial" ? TREND_PARTIAL : TREND_FULL;
  return {
    status: "available",
    headline:
      scenario === "partial"
        ? "แนวโน้มรายเดือน (ข้อมูลยังไม่ครบทุกเดือน)"
        : "แนวโน้มรายเดือน",
    trendRows,
    freshnessNote:
      scenario === "partial"
        ? "ข้อมูลสังเคราะห์บางเดือนยังไม่ถูกบันทึก ตัวเลขจึงยังสรุปไม่ครบ"
        : null,
    partial: scenario === "partial",
  };
}

function researchFor(role: Role, scenario: PrototypeScenario): DashboardReadModel["research"] {
  if (role === "farmer" || role === "field_collector") {
    return { status: "not_enabled", message: "ส่วนหลักฐานงานวิจัยแสดงเฉพาะบทบาทที่ได้รับสิทธิ์" };
  }
  if (scenario === "loading") {
    return { status: "loading", message: "กำลังโหลดข้อมูล" };
  }
  if (scenario === "unavailable") {
    return { status: "unavailable", message: "อ่านสรุปการเก็บข้อมูลไม่สำเร็จชั่วคราว" };
  }
  if (scenario === "empty") {
    return {
      status: "empty",
      links: [{ label: "เปิดงานประชากร", href: "/app/research/population" }],
      note: null,
    };
  }
  return {
    status: "available",
    activeRun: { populationSize: 121, targetN: 93 },
    runCount: scenario === "partial" ? 2 : 3,
    acceptedSnapshotCount: 1,
    links: [
      { label: "เปิดงานประชากร", href: "/app/research/population" },
      { label: "เปิดงานสุ่มตัวอย่าง", href: "/app/research/sampling" },
    ],
    note: scenario === "partial" ? "snapshot ใหม่กำลังรอตรวจความครบถ้วน" : null,
  };
}

// Fixed presentation timestamp keeps screenshots deterministic.
const FIXED_DATA_AS_OF = "26 ส.ค. 2569 · 14:05 น. เวลาไทย";

/** Deterministic synthetic dashboard model for one role/scenario pair. */
export function buildPrototypeDashboardModel(
  role: Role,
  scenario: PrototypeScenario,
): DashboardReadModel {
  return {
    role,
    heading: buildDashboardHeading(),
    dataAsOf: FIXED_DATA_AS_OF,
    operational: operationalFor(scenario),
    analytics: analyticsFor(scenario),
    workQueue: buildWorkQueue(role),
    research: researchFor(role, scenario),
  };
}
