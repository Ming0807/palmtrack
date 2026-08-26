import Link from "next/link";

import {
  buildPrototypeDashboardModel,
  isPrototypeScenario,
  PROTOTYPE_SCENARIOS,
  type PrototypeScenario,
} from "@/modules/dashboard/domain/dashboard-fixtures";
import { isRole, ROLES, type Role } from "@/modules/identity/domain/roles";
import { ROLE_LABELS } from "@/modules/navigation/role-navigation";
import { DashboardOverview } from "@/modules/dashboard/ui/dashboard-overview";
import styles from "@/modules/dashboard/ui/dashboard.module.css";

type DashboardPrototypePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SCENARIO_LABELS: Record<PrototypeScenario, string> = {
  typical: "มีข้อมูล",
  empty: "ไม่มีข้อมูล",
  loading: "กำลังโหลด",
  partial: "ข้อมูลไม่ครบ",
  unavailable: "บริการขัดข้อง",
};

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function prototypeHref(role: Role, scenario: PrototypeScenario): string {
  return `/prototype/dashboard?role=${role}&scenario=${scenario}`;
}

export default async function DashboardPrototypePage({ searchParams }: DashboardPrototypePageProps) {
  const query = await searchParams;
  const roleInput = single(query.role);
  const scenarioInput = single(query.scenario);
  const role: Role = isRole(roleInput) ? roleInput : "research_manager";
  const scenario: PrototypeScenario = isPrototypeScenario(scenarioInput) ? scenarioInput : "typical";

  return (
    <main className={styles.prototypePage}>
      <div className={styles.prototypeFrame}>
        <aside className={styles.prototypeToolbar} aria-label="ตัวควบคุมหน้าจอสาธิต">
          <p className={styles.prototypeNotice}><strong>พื้นที่ทดสอบ UX:</strong> ทุกตัวเลขในหน้านี้เป็นข้อมูลสังเคราะห์ ไม่มีข้อมูลเกษตรกรจริงและไม่เชื่อมต่อฐานข้อมูล</p>
          <div className={styles.prototypeControls}>
            <div className={styles.prototypeControlGroup}><strong>บทบาท</strong>{ROLES.map((item) => <Link className={item === role ? styles.prototypeControlActive : styles.prototypeControl} aria-current={item === role ? "page" : undefined} href={prototypeHref(item, scenario)} key={item}>{ROLE_LABELS[item]}</Link>)}</div>
            <div className={styles.prototypeControlGroup}><strong>สถานะ</strong>{PROTOTYPE_SCENARIOS.map((item) => <Link className={item === scenario ? styles.prototypeControlActive : styles.prototypeControl} aria-current={item === scenario ? "page" : undefined} href={prototypeHref(role, item)} key={item}>{SCENARIO_LABELS[item]}</Link>)}</div>
          </div>
        </aside>
        <DashboardOverview model={buildPrototypeDashboardModel(role, scenario)} synthetic />
      </div>
    </main>
  );
}
