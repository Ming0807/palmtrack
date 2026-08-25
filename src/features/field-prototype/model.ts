export const prototypeVariants = ["A", "B", "C"] as const;
export type PrototypeVariant = (typeof prototypeVariants)[number];

export const prototypeStates = [
  "default",
  "loading",
  "empty",
  "validation",
  "forbidden",
  "not-found",
  "stale",
  "offline",
  "syncing",
  "service-unavailable",
  "success",
  "returned",
] as const;
export type PrototypeState = (typeof prototypeStates)[number];

export type AssignmentStatus =
  | "overdue"
  | "active"
  | "returned"
  | "review";

export type PrototypeAssignment = {
  id: string;
  synthetic: true;
  areaLabel: string;
  stratum: string;
  householdCount: number;
  plotCount: number;
  dueLabel: string;
  status: AssignmentStatus;
  statusLabel: string;
  nextAction: string;
  priority: number;
  note?: string;
};

export const prototypeAssignments: readonly PrototypeAssignment[] = [
  {
    id: "SSK-024",
    synthetic: true,
    areaLabel: "พื้นที่ตัวอย่าง ก-01",
    stratum: "ชั้นตัวอย่าง A1",
    householdCount: 12,
    plotCount: 18,
    dueLabel: "เกินกำหนด 1 วัน",
    status: "overdue",
    statusLabel: "ยังไม่เริ่ม",
    nextAction: "เริ่มเก็บข้อมูล",
    priority: 1,
  },
  {
    id: "SSK-031",
    synthetic: true,
    areaLabel: "พื้นที่ตัวอย่าง ก-02",
    stratum: "ชั้นตัวอย่าง A2",
    householdCount: 10,
    plotCount: 15,
    dueLabel: "ครบกำหนดวันนี้",
    status: "active",
    statusLabel: "กำลังทำอยู่",
    nextAction: "ทำต่อ",
    priority: 2,
  },
  {
    id: "SSK-017",
    synthetic: true,
    areaLabel: "พื้นที่ตัวอย่าง ข-01",
    stratum: "ชั้นตัวอย่าง B1",
    householdCount: 8,
    plotCount: 12,
    dueLabel: "ครบกำหนดวันนี้",
    status: "returned",
    statusLabel: "ส่งคืนแก้ไข",
    nextAction: "ดูเหตุผล",
    priority: 3,
    note: "ตรวจทานข้อมูลแปลงลำดับที่ 7 ก่อนกลับมาแก้ไข",
  },
  {
    id: "SSK-008",
    synthetic: true,
    areaLabel: "พื้นที่ตัวอย่าง ข-02",
    stratum: "ชั้นตัวอย่าง B2",
    householdCount: 9,
    plotCount: 14,
    dueLabel: "ครบกำหนดใน 2 วัน",
    status: "review",
    statusLabel: "รอตรวจ",
    nextAction: "ดูรายละเอียด",
    priority: 4,
  },
] as const;

export const priorityAssignments = [...prototypeAssignments].sort(
  (left, right) => left.priority - right.priority,
);

export const workflowSteps = [
  {
    key: "assigned",
    label: "มอบหมาย",
    description: "รับงานและตรวจสอบขอบเขตข้อมูลตัวอย่าง",
    status: "complete",
  },
  {
    key: "notice-consent",
    label: "แจ้งข้อมูลและยินยอม",
    description: "อธิบายวัตถุประสงค์และบันทึกความยินยอม",
    status: "complete",
  },
  {
    key: "baseline",
    label: "ข้อมูลพื้นฐาน",
    description: "ยังไม่เปิดรับคำตอบจนกว่าเครื่องมือวิจัยจะอนุมัติ",
    status: "waiting",
  },
  {
    key: "farm-ledger",
    label: "สมุดสวน",
    description: "จะเปิดเมื่อผ่านขั้นก่อนหน้า",
    status: "locked",
  },
  {
    key: "review",
    label: "ส่งตรวจ",
    description: "จะเปิดเมื่อข้อมูลที่อนุมัติครบถ้วน",
    status: "locked",
  },
] as const;

export const instrumentBoundary = {
  label: "รออนุมัติเครื่องมือวิจัย",
  interactive: false,
  fields: [] as const,
  persistence: "none" as const,
};

export function parseVariant(value: unknown): PrototypeVariant {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = typeof candidate === "string" ? candidate.toUpperCase() : "A";
  return prototypeVariants.includes(normalized as PrototypeVariant)
    ? (normalized as PrototypeVariant)
    : "A";
}

export function parsePrototypeState(value: unknown): PrototypeState {
  const candidate = Array.isArray(value) ? value[0] : value;
  return prototypeStates.includes(candidate as PrototypeState)
    ? (candidate as PrototypeState)
    : "default";
}

export function assignmentHref(assignmentId: string): string {
  return `/prototype/field/${assignmentId}?variant=C`;
}

export function canEditReturnedAssignment(input: {
  returned: boolean;
  resumed: boolean;
}): boolean {
  return !input.returned || input.resumed;
}

export function getConnectionMessage(state: PrototypeState): string {
  if (state === "offline") {
    return "ออฟไลน์ — บันทึกร่างไว้ในเครื่อง และส่งเมื่อออนไลน์";
  }
  if (state === "syncing") {
    return "กำลังส่งร่างที่รออยู่ — อย่าปิดหน้าจอนี้";
  }
  return "พร้อมทำงานออฟไลน์ — ซิงก์ล่าสุด 08:45 น.";
}
