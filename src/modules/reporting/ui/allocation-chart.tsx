"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_PALETTE,
  describeChartSummary,
  formatThaiInt,
  type ChartSummaryRow,
} from "@/modules/reporting/domain/chart-format";

import styles from "./allocation-chart.module.css";

export type AllocationChartRow = ChartSummaryRow;

export type AllocationChartProps = {
  title: string;
  rows: AllocationChartRow[];
  emptyLabel: string;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AllocationChart({ title, rows, emptyLabel }: AllocationChartProps) {
  if (rows.length === 0) {
    return <p className={styles.empty}>{emptyLabel}</p>;
  }
  const showEligible = rows.some((row) => row.eligible !== undefined);
  const data = rows.map((row) => ({
    stratum: row.stratumCode,
    allocated: row.allocated,
    label: formatThaiInt(row.allocated),
  }));
  const height = Math.max(160, rows.length * 56 + 48);
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{title}</figcaption>
      <div
        className={styles.chartRegion}
        data-testid="allocation-chart"
        role="img"
        aria-label={describeChartSummary(rows)}
        tabIndex={0}
      >
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="stratum" width={88} tick={{ fontSize: 14 }} />
            <Tooltip
              formatter={(value) => [formatThaiInt(Number(value)), "จัดสรร"]}
              labelFormatter={(label) => `ชั้นภูมิ ${String(label)}`}
            />
            <Bar dataKey="allocated" name="จัดสรร" isAnimationActive={!prefersReducedMotion()}>
              {data.map((entry, index) => (
                <Cell key={entry.stratum} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
              ))}
              <LabelList dataKey="label" position="right" style={{ fontSize: 14, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className={styles.tableDetails}>
        <summary>ดูตารางข้อมูล</summary>
        <table aria-label={`ตาราง${title}`}>
          <thead>
            <tr>
              <th scope="col">ชั้นภูมิ</th>
              {showEligible ? <th scope="col">N_h</th> : null}
              <th scope="col">จัดสรร</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stratumCode}>
                <th scope="row">{row.stratumCode}</th>
                {showEligible ? <td>{row.eligible === undefined ? "–" : formatThaiInt(row.eligible)}</td> : null}
                <td>{formatThaiInt(row.allocated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
