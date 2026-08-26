import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CircleAlert,
  Clock3,
  FlaskConical,
  LockKeyhole,
} from "lucide-react";

import type {
  AnalyticsState,
  DashboardReadModel,
  OperationalMetric,
  ResearchSummaryState,
} from "@/modules/dashboard/domain/dashboard-model";
import { ROLE_LABELS } from "@/modules/navigation/role-navigation";

import styles from "./dashboard.module.css";

type DashboardOverviewProps = {
  model: DashboardReadModel;
  synthetic?: boolean;
};

const baht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function StateNote({ message, loading = false }: { message: string; loading?: boolean }) {
  return (
    <div className={styles.stateNote} role="status" aria-live="polite">
      {loading ? <Clock3 size={19} aria-hidden="true" /> : <CircleAlert size={19} aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}

function Metric({ metric }: { metric: OperationalMetric }) {
  if (metric.status !== "available") {
    return (
      <div className={styles.metricCell}>
        <dt>{metric.label}</dt>
        <dd className={styles.metricMessage}>
          {metric.status === "loading" ? <Clock3 size={17} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />}
          <span>{metric.message}</span>
        </dd>
      </div>
    );
  }

  const valueClass = [
    styles.metricValue,
    metric.tone === "positive" ? styles.metricValuePositive : "",
    metric.tone === "negative" ? styles.metricValueNegative : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={styles.metricCell}>
      <dt>{metric.label}</dt>
      <dd>
        <span className={valueClass}>{metric.value}</span>
        {metric.caption ? <span className={styles.metricCaption}>{metric.caption}</span> : null}
      </dd>
    </div>
  );
}

function Analytics({ analytics }: { analytics: AnalyticsState }) {
  if (analytics.status !== "available") {
    return <StateNote message={analytics.message} loading={analytics.status === "loading"} />;
  }

  const maximum = Math.max(
    1,
    ...analytics.trendRows.flatMap((row) => [Number(row.income), Number(row.expense)]),
  );

  return (
    <>
      <p className={styles.chartHeadline}>{analytics.headline}</p>
      <div className={styles.trendChart} aria-hidden="true">
        {analytics.trendRows.map((row) => (
          <div className={styles.trendColumn} key={row.label}>
            <div className={styles.bars}>
              <span className={styles.barIncome} style={{ height: `${Math.max(4, (Number(row.income) / maximum) * 100)}%` }} />
              <span className={styles.barExpense} style={{ height: `${Math.max(4, (Number(row.expense) / maximum) * 100)}%` }} />
            </div>
            <span className={styles.trendLabel}>{row.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.legend} aria-hidden="true">
        <span><i className={`${styles.legendKey} ${styles.legendIncome}`} />รายรับ</span>
        <span><i className={`${styles.legendKey} ${styles.legendExpense}`} />ค่าใช้จ่าย</span>
      </div>
      <details className={styles.tableToggle}>
        <summary>ดูตัวเลขในรูปแบบตาราง</summary>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable} aria-label="ข้อมูลแนวโน้มรายเดือน">
            <thead><tr><th scope="col">เดือน</th><th scope="col">รายรับ</th><th scope="col">ค่าใช้จ่าย</th></tr></thead>
            <tbody>
              {analytics.trendRows.map((row) => (
                <tr key={row.label}><th scope="row">{row.label}</th><td>{baht.format(Number(row.income))}</td><td>{baht.format(Number(row.expense))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {analytics.freshnessNote ? <p className={styles.freshnessNote}><CircleAlert size={18} aria-hidden="true" />{analytics.freshnessNote}</p> : null}
    </>
  );
}

function ResearchSummary({ research }: { research: ResearchSummaryState }) {
  if (research.status !== "available" && research.status !== "empty") {
    return <StateNote message={research.message} loading={research.status === "loading"} />;
  }

  return (
    <>
      {research.status === "available" ? (
        <dl className={styles.researchStats}>
          <div><dt>Sampling run ทั้งหมด</dt><dd>{research.runCount.toLocaleString("th-TH")}</dd></div>
          <div><dt>ประชากรของ run ที่ active</dt><dd>{research.activeRun?.populationSize.toLocaleString("th-TH") ?? "—"}</dd></div>
          <div><dt>กลุ่มตัวอย่างเป้าหมาย</dt><dd>{research.activeRun?.targetN.toLocaleString("th-TH") ?? "—"}</dd></div>
          <div><dt>Snapshot ที่รับรองแล้ว</dt><dd>{research.acceptedSnapshotCount?.toLocaleString("th-TH") ?? "—"}</dd></div>
        </dl>
      ) : <StateNote message="ยังไม่มี sampling run ในพื้นที่ทำงานนี้" />}
      {research.links.length > 0 ? (
        <div className={styles.researchLinks}>
          {research.links.map((link) => <Link className={styles.researchLink} href={link.href} key={link.href}>{link.label}<ArrowRight size={16} aria-hidden="true" /></Link>)}
        </div>
      ) : null}
      {research.note ? <p className={styles.researchNote}>{research.note}</p> : null}
    </>
  );
}

export function DashboardOverview({ model, synthetic = false }: DashboardOverviewProps) {
  return (
    <article className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1>{model.heading}</h1>
          <p className={styles.asOf}>ข้อมูล ณ {model.dataAsOf} · {ROLE_LABELS[model.role]}</p>
        </div>
        {synthetic ? <span className={styles.synthetic}><FlaskConical size={16} aria-hidden="true" />ข้อมูลสังเคราะห์</span> : null}
      </header>

      <section className={styles.section} aria-labelledby="operational-heading">
        <div className={styles.sectionHeading}><h2 id="operational-heading">สรุปการดำเนินงาน</h2><span>บัญชีเงินสดและผลผลิต</span></div>
        <dl className={styles.metricStrip}>{model.operational.map((metric) => <Metric key={metric.key} metric={metric} />)}</dl>
      </section>

      <section className={styles.section} aria-labelledby="analytics-heading">
        <div className={styles.sectionHeading}><h2 id="analytics-heading">แนวโน้มการเงินและผลผลิต</h2><BarChart3 size={20} aria-hidden="true" /></div>
        <Analytics analytics={model.analytics} />
      </section>

      <section className={styles.section} aria-labelledby="queue-heading">
        <div className={styles.sectionHeading}><h2 id="queue-heading">งานที่ควรทำต่อ</h2><span>{model.workQueue.length.toLocaleString("th-TH")} รายการ</span></div>
        <ol className={styles.queueList}>
          {model.workQueue.map((item, index) => (
            <li className={styles.queueRow} key={item.id}>
              <span className={styles.queueNumber}>{String(index + 1).padStart(2, "0")}</span>
              <div className={styles.queueBody}><div className={styles.queueTitle}>{item.title}</div><p className={styles.queueDetail}>{item.detail}</p></div>
              {item.action.kind === "link" ? (
                <Link className={styles.queueAction} href={item.action.href}>{item.action.label}<ArrowRight size={16} aria-hidden="true" /></Link>
              ) : (
                <span className={styles.queuePending}><strong><Clock3 size={16} aria-hidden="true" />{item.action.label}</strong><small>{item.action.reason}</small></span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className={`${styles.section} ${styles.researchSection}`} aria-labelledby="research-heading">
        <div className={styles.sectionHeading}><h2 id="research-heading">หลักฐานสนับสนุนงานวิจัย</h2><span>ส่วนรองของผลิตภัณฑ์</span></div>
        <ResearchSummary research={model.research} />
      </section>
    </article>
  );
}
