import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardCheck,
  FileChartColumn,
  DatabaseZap,
  LayoutDashboard,
  Settings2,
  Sprout,
  Shuffle,
  WalletCards,
} from "lucide-react";

import { isRole, type Role } from "@/modules/identity/domain/roles";

export type RoleNavigationItem = {
  label: string;
  href: "/app" | `/app/${string}`;
  icon: LucideIcon;
};

/**
 * Production navigation is a presentation projection only. Route handlers and
 * server authorization remain the source of truth for every href.
 */
export const ROLE_NAVIGATION = {
  admin: [
    { label: "ภาพรวม", href: "/app", icon: LayoutDashboard },
    { label: "นำเข้าประชากร", href: "/app/research/population", icon: DatabaseZap },
    { label: "ตั้งค่าระบบ", href: "/app/settings", icon: Settings2 },
    { label: "ตรวจสอบเหตุการณ์", href: "/app/audit", icon: ClipboardCheck },
  ],
  research_manager: [
    { label: "ภาพรวม", href: "/app", icon: LayoutDashboard },
    { label: "งานวิจัย", href: "/app/research", icon: LayoutDashboard },
    { label: "ประชากร", href: "/app/research/population", icon: DatabaseZap },
    { label: "การสุ่ม", href: "/app/research/sampling", icon: Shuffle },
    { label: "รายงาน", href: "/app/reports", icon: FileChartColumn },
  ],
  field_collector: [
    { label: "ภาพรวม", href: "/app", icon: LayoutDashboard },
    { label: "งานของฉัน", href: "/app/my-work", icon: ClipboardCheck },
  ],
  farmer: [
    { label: "ภาพรวม", href: "/app", icon: LayoutDashboard },
    { label: "สวนของฉัน", href: "/app/gardens", icon: Sprout },
    { label: "บัญชีสวน", href: "/app/garden-account", icon: WalletCards },
  ],
  evaluator_readonly: [
    { label: "ภาพรวม", href: "/app", icon: LayoutDashboard },
    { label: "ภาพรวมประเมิน", href: "/app/evaluation", icon: BarChart3 },
  ],
} as const satisfies Record<Role, readonly RoleNavigationItem[]>;

const noNavigation: readonly RoleNavigationItem[] = [];

export function getRoleNavigation(role: unknown): readonly RoleNavigationItem[] {
  return isRole(role) ? ROLE_NAVIGATION[role] : noNavigation;
}

export const navigationForRole = getRoleNavigation;
export const getNavigationForRole = getRoleNavigation;

// Kept as a named export for callers that prefer a noun over a verb.
export const roleNavigation = ROLE_NAVIGATION;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  research_manager: "ผู้จัดการงานวิจัย",
  field_collector: "ผู้เก็บข้อมูลภาคสนาม",
  farmer: "เกษตรกร",
  evaluator_readonly: "ผู้ประเมิน (อ่านอย่างเดียว)",
};
