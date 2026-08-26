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

export default async function SamplingPage() {
  const clientResult = await createSupabaseServerClient();
  if (clientResult.status === "unconfigured") return <UnconfiguredState />;
  if (clientResult.status === "configuration_error") return <ConfigurationErrorState />;

  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(clientResult.client),
  });
  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status !== "authorized") return <ForbiddenState />;

  const result = await listSamplingRuns({
    session,
    gateway: createSupabaseSamplingGateway(clientResult.client),
  });
  if (result.status === "forbidden") return <ForbiddenState />;
  if (result.status !== "ready") return <ConfigurationErrorState />;

  return (
    <section className={styles.content}>
      <p className={styles.eyebrow}>RESEARCH / SAMPLING</p>
      <h1>การสุ่มตัวอย่าง</h1>
      <p className={styles.lead}>
        ตรวจสอบ sampling run ที่ผูกกับ snapshot ประชากรและหลักฐานการคำนวณได้จากพื้นที่ทำงานนี้
      </p>
      <p>
        <Link href="/app/research">กลับไปงานวิจัย</Link>
      </p>
      <section className={styles.notice} aria-labelledby="sampling-runs-title">
        <h2 id="sampling-runs-title">sampling runs</h2>
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
