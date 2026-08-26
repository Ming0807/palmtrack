import {
  buildDashboardHeading,
  buildLedgerNotEnabledMetrics,
  buildWorkQueue,
  type DashboardReadModel,
  type ResearchLink,
  type ResearchSummaryState,
} from "@/modules/dashboard/domain/dashboard-model";
import type { Role } from "@/modules/identity/domain/roles";
import type { IdentitySession } from "@/modules/identity/server/session";
import type { PopulationGateway } from "@/modules/research/population/server/population-gateway";
import { listPopulationImports } from "@/modules/research/population/server/population-service";
import type { SamplingGateway } from "@/modules/research/sampling/server/sampling-gateway";
import { listSamplingRuns } from "@/modules/research/sampling/server/sampling-service";

/**
 * Production dashboard provider. It reads only what the current system can
 * authorize for the caller; modules without a backend stay in truthful
 * `not_enabled` states and synthetic fixtures are never imported here.
 */

export type DashboardGateways = {
  populationGateway: PopulationGateway;
  samplingGateway: SamplingGateway;
};

type AuthorizedSession = Extract<IdentitySession, { status: "authorized" }>;

type BuildDashboardModelInput = DashboardGateways & {
  session: AuthorizedSession;
  now?: Date;
};

function formatThaiAsOf(date: Date): string {
  return `${new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(date)} น. เวลาไทย`;
}

const NOT_ENABLED_FOR_FIELD_ROLES =
  "ส่วนนี้รวบรวมหลักฐานการเก็บข้อมูลของทีมวิจัย จึงแสดงเฉพาะผู้จัดการงานวิจัย ผู้ดูแลระบบ และผู้ประเมินแบบอ่านอย่างเดียว";

function researchLinks(role: Role): ResearchLink[] {
  if (role === "evaluator_readonly") {
    return [];
  }
  return [
    { label: "เปิดงานประชากร", href: "/app/research/population" },
    ...(role === "research_manager"
      ? ([{ label: "เปิดงานสุ่มตัวอย่าง", href: "/app/research/sampling" }] satisfies ResearchLink[])
      : []),
  ];
}

async function loadResearchSummary(
  input: BuildDashboardModelInput,
): Promise<ResearchSummaryState> {
  const { session, populationGateway, samplingGateway } = input;
  const role = session.profile.role;

  if (role === "farmer" || role === "field_collector") {
    return { status: "not_enabled", message: NOT_ENABLED_FOR_FIELD_ROLES };
  }

  let runs;
  try {
    runs = await listSamplingRuns({ session, gateway: samplingGateway });
  } catch {
    return { status: "unavailable", message: "อ่านสถานะการเก็บข้อมูลไม่สำเร็จชั่วคราว" };
  }
  if (runs.status === "forbidden") return { status: "not_enabled", message: NOT_ENABLED_FOR_FIELD_ROLES };
  if (runs.status !== "ready") {
    return { status: "unavailable", message: "อ่านสถานะการเก็บข้อมูลไม่สำเร็จชั่วคราว" };
  }

  const activeRunSummary = runs.runs.find((run) => run.status === "active");
  const activeRun = activeRunSummary
    ? {
        populationSize: activeRunSummary.populationSize,
        targetN: activeRunSummary.targetN,
      }
    : null;

  const links = researchLinks(role);

  let acceptedSnapshotCount: number | null = null;
  let snapshotNote: string | null = null;
  if (role === "research_manager" || role === "admin") {
    try {
      const imports = await listPopulationImports({ session, gateway: populationGateway });
      if (imports.status === "ready") {
        acceptedSnapshotCount =
          imports.imports.filter((receipt) => receipt.status === "accepted").length;
      } else {
        snapshotNote = "ยังอ่านจำนวน snapshot ประชากรไม่สำเร็จชั่วคราว";
      }
    } catch {
      snapshotNote = "ยังอ่านจำนวน snapshot ประชากรไม่สำเร็จชั่วคราว";
    }
  }

  if (activeRun === null && runs.runs.length === 0) {
    return {
      status: "empty",
      links,
      note: snapshotNote,
    };
  }

  return {
    status: "available",
    activeRun,
    runCount: runs.runs.length,
    acceptedSnapshotCount,
    links,
    note:
      role === "evaluator_readonly"
        ? "แสดงเฉพาะผลรวมแบบไม่ระบุตัวบุคคล ไม่มีข้อมูลระดับสมาชิก"
        : snapshotNote,
  };
}

/** Builds the production `/app` read model for an authorized session. */
export async function buildDashboardModel(
  input: BuildDashboardModelInput,
): Promise<DashboardReadModel> {
  return {
    role: input.session.profile.role,
    heading: buildDashboardHeading(),
    dataAsOf: formatThaiAsOf(input.now ?? new Date()),
    operational: buildLedgerNotEnabledMetrics(),
    analytics: {
      status: "not_enabled",
      message:
        "พื้นที่แนวโน้มรายรับ ค่าใช้จ่าย และผลผลิตจะเปิดใช้หลังโมดูลบัญชีสวนพร้อมบันทึกข้อมูลจริง",
    },
    workQueue: buildWorkQueue(input.session.profile.role),
    research: await loadResearchSummary(input),
  };
}
import "server-only";
