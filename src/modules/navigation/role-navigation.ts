import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardCheck,
  FileChartColumn,
  LayoutDashboard,
  Settings2,
  Sprout,
  WalletCards,
} from "lucide-react";

import { isRole, type Role } from "@/modules/identity/domain/roles";

export type RoleNavigationItem = {
  label: string;
  href: `/app/${string}`;
  icon: LucideIcon;
};

/**
 * Production navigation is a presentation projection only. Route handlers and
 * server authorization remain the source of truth for every href.
 */
export const ROLE_NAVIGATION = {
  admin: [
    { label: "ตั้งค่าระบบ", href: "/app/settings", icon: Settings2 },
    { label: "ตรวจสอบเหตุการณ์", href: "/app/audit", icon: ClipboardCheck },
  ],
  research_manager: [
    { label: "งานวิจัย", href: "/app/research", icon: LayoutDashboard },
    { label: "รายงาน", href: "/app/reports", icon: FileChartColumn },
  ],
  field_collector: [
    { label: "งานของฉัน", href: "/app/my-work", icon: ClipboardCheck },
  ],
  farmer: [
    { label: "สวนของฉัน", href: "/app/gardens", icon: Sprout },
    { label: "บัญชีสวน", href: "/app/garden-account", icon: WalletCards },
  ],
  evaluator_readonly: [
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
