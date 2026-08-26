import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import {
  ConfigurationErrorState,
  ForbiddenState,
  UnconfiguredState,
} from "@/modules/identity/ui";
import { createSupabaseSamplingGateway } from "@/modules/research/sampling/server/sampling-gateway";
import { listSamplingRuns } from "@/modules/research/sampling/server/sampling-service";
import styles from "../../app-shell.module.css";

const statusLabels = {
  draft: "ฉบับร่าง",
  locked: "ล็อกแล้ว",
  active: "กำลังใช้งาน",
  superseded: "แทนที่แล้ว",
  cancelled: "ยกเลิกแล้ว",
} as const;

function SamplingListState({ status }: { status: "conflict" | "replay_mismatch" }) {
  return (
    <section className={styles.content} aria-live="polite">
      <h1>การสุ่มตัวอย่าง</h1>
      {status === "conflict" ? (
        <p role="alert">ไม่สามารถโหลดรายการ sampling run ได้ในขณะนี้ โปรดลองอีกครั้ง</p>
      ) : (
        <p role="alert">หลักฐานของ sampling run ไม่ตรงกัน จึงหยุดการทำงานไว้ก่อน</p>
      )}
    </section>
  );
}

export default async function SamplingPage() {
  const clientResult = await createSupabaseServerClient();
  if (clientResult.status === "unconfigured") return <UnconfiguredState />;
  if (clientResult.status === "configuration_error") return <ConfigurationErrorState />;

  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(clientResult.client),
  });
  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status === "unconfigured") return <UnconfiguredState />;
  if (session.status === "configuration_error") return <ConfigurationErrorState />;
  if (session.status !== "authorized") return <ForbiddenState />;

  const result = await listSamplingRuns({
    session,
    gateway: createSupabaseSamplingGateway(clientResult.client),
  });
  if (result.status === "forbidden") return <ForbiddenState />;
  if (result.status === "conflict" || result.status === "replay_mismatch") {
    return <SamplingListState status={result.status} />;
  }
  if (result.status !== "ready") return <ConfigurationErrorState />;

  const backHref = session.profile.role === "research_manager" ? "/app/research" : "/app";

  return (
    <section className={styles.content}>
      <p className={styles.eyebrow}>RESEARCH / SAMPLING</p>
      <h1>การสุ่มตัวอย่าง</h1>
      <p className={styles.lead}>
        หน้านี้แสดงรายการ sampling run ของพื้นที่ทำงานเท่านั้น ส่วนแบบฟอร์มและ workbench จะเพิ่มในขั้นถัดไป
      </p>
      <p>
        <Link href={backHref}>{session.profile.role === "research_manager" ? "กลับไปงานวิจัย" : "กลับหน้าหลัก"}</Link>
      </p>
      <section className={styles.notice} aria-labelledby="sampling-runs-title">
        <h2 id="sampling-runs-title">รายการ sampling runs</h2>
        {result.runs.length === 0 ? (
          <p>ยังไม่มี sampling run ในพื้นที่ทำงานนี้</p>
        ) : (
          <ul>
            {result.runs.map((run) => (
              <li key={`${run.id}-${run.version}`}>
                <strong>Run v{run.version}</strong> · {statusLabels[run.status]} · n={run.targetN}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
