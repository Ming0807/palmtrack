const thaiIntFormatter = new Intl.NumberFormat("th-TH-u-nu-thai", {
  maximumFractionDigits: 0,
});

const thaiDecimal4Formatter = new Intl.NumberFormat("th-TH-u-nu-thai", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function formatThaiInt(value: number): string {
  return thaiIntFormatter.format(value);
}

export function formatThaiDecimal4(value: number): string {
  return thaiDecimal4Formatter.format(value);
}

// Indigo-first, then a color-blind-safe sequence (Okabe–Ito order) that
// extends the DESIGN.md evidence palette. Charts must never rely on color
// alone; every series also carries text labels and a data table.
export const CHART_PALETTE = [
  "#3b3f8c",
  "#0072b2",
  "#009e73",
  "#d55e00",
  "#cc79a7",
  "#e69f00",
] as const;

export type ChartSummaryRow = {
  stratumCode: string;
  allocated: number;
  eligible?: number;
};

export function describeChartSummary(rows: ChartSummaryRow[]): string {
  return rows
    .map((row) =>
      row.eligible === undefined
        ? `ชั้นภูมิ ${row.stratumCode} จัดสรร ${formatThaiInt(row.allocated)}`
        : `ชั้นภูมิ ${row.stratumCode} จัดสรร ${formatThaiInt(row.allocated)} จาก ${formatThaiInt(row.eligible)}`,
    )
    .join("; ");
}
