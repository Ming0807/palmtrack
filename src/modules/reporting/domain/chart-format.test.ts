import { describe, expect, it } from "vitest";

import {
  CHART_PALETTE,
  describeChartSummary,
  formatThaiDecimal4,
  formatThaiInt,
} from "./chart-format";

describe("formatThaiInt", () => {
  it("formats counts with Thai digits", () => {
    expect(formatThaiInt(93)).toBe("๙๓");
    expect(formatThaiInt(121)).toBe("๑๒๑");
  });
});

describe("formatThaiDecimal4", () => {
  it("formats quotas with four Thai digits", () => {
    expect(formatThaiDecimal4(2.6666666666666665)).toBe("๒.๖๖๖๗");
  });
});

describe("CHART_PALETTE", () => {
  it("provides at least four distinct hex colors starting with indigo", () => {
    expect(CHART_PALETTE.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CHART_PALETTE).size).toBe(CHART_PALETTE.length);
    for (const color of CHART_PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/u);
    }
    expect(CHART_PALETTE[0]).toBe("#3b3f8c");
  });
});

describe("describeChartSummary", () => {
  it("summarizes allocation rows in Thai", () => {
    expect(
      describeChartSummary([
        { stratumCode: "NORTH", allocated: 3, eligible: 4 },
        { stratumCode: "SOUTH", allocated: 1, eligible: 2 },
      ]),
    ).toBe("ชั้นภูมิ NORTH จัดสรร ๓ จาก ๔; ชั้นภูมิ SOUTH จัดสรร ๑ จาก ๒");
  });

  it("omits the eligible base when unknown", () => {
    expect(describeChartSummary([{ stratumCode: "NORTH", allocated: 3 }])).toBe(
      "ชั้นภูมิ NORTH จัดสรร ๓",
    );
  });
});
