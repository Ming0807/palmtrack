import { ArrowLeft, Clock, Layers, Milestone } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { resolveIdentitySession } from "@/modules/identity/server/session";
import { ConfigurationErrorState, ForbiddenState, UnconfiguredState } from "@/modules/identity/ui";
import { getModuleStatus, isRoleAllowedForSection } from "@/modules/navigation/module-status";

import styles from "./module-status.module.css";

export default async function ApplicationSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const metadata = getModuleStatus(section);
  if (!metadata) notFound();

  const session = await resolveIdentitySession();
  if (session.status === "anonymous") redirect("/sign-in");
  if (session.status === "unconfigured") return <UnconfiguredState />;
  if (session.status === "configuration_error") return <ConfigurationErrorState />;
  if (session.status === "inactive" || session.status === "forbidden") return <ForbiddenState />;

  if (!isRoleAllowedForSection(session.profile.role, section)) {
    return <ForbiddenState />;
  }

  return (
    <section className={styles.container} aria-labelledby="section-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>{metadata.eyebrow}</p>
        <h1 id="section-title" className={styles.title}>{metadata.title}</h1>
        <p className={styles.lead}>{metadata.description}</p>
      </header>

      <div className={styles.statusCard} role="status" aria-label={`สถานะโมดูล ${metadata.title}`}>
        <div className={styles.statusHeader}>
          <span className={styles.statusBadge}>
            <Clock size={14} aria-hidden="true" />
            {metadata.status}
          </span>
          <h2 className={styles.statusHeading}>สถานะการดำเนินงาน</h2>
        </div>
        <p className={styles.statusDescription}>{metadata.statusReason}</p>
      </div>

      <div className={styles.sectionGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Layers size={18} className={styles.cardIcon} aria-hidden="true" />
            <h2 className={styles.cardHeading}>สิ่งที่โมดูลจะรองรับ</h2>
          </div>
          <ul className={styles.list}>
            {metadata.capabilities.map((item, idx) => (
              <li key={idx} className={styles.listItem}>{item}</li>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Milestone size={18} className={styles.cardIcon} aria-hidden="true" />
            <h2 className={styles.cardHeading}>ขั้นตอนและแผนงานถัดไป</h2>
          </div>
          <ul className={styles.list}>
            {metadata.nextSteps.map((item, idx) => (
              <li key={idx} className={styles.listItem}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/app" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          กลับสู่หน้าหลัก
        </Link>
      </div>
    </section>
  );
}
