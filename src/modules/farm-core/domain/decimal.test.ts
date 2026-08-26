import { describe, expect, it } from "vitest";

import {
  addDecimals,
  compareDecimals,
  formatArea,
  formatMoney,
  formatQuantity,
  isNonNegativeDecimal,
  isPositiveDecimal,
  multiplyDecimals,
  parseDecimal,
  subtractDecimals,
  toCanonicalDecimal,
} from "./decimal";

describe("Decimal Domain Arithmetic", () => {
  describe("parseDecimal & toCanonicalDecimal", () => {
    it("parses and formats 2-decimal money strings", () => {
      expect(parseDecimal("10000.00", 2)).toBe("10000.00");
      expect(parseDecimal("10000", 2)).toBe("10000.00");
      expect(parseDecimal("2500.5", 2)).toBe("2500.50");
      expect(parseDecimal("0", 2)).toBe("0.00");
      expect(parseDecimal(".75", 2)).toBe("0.75");
      expect(parseDecimal("  123.45  ", 2)).toBe("123.45");
      expect(parseDecimal("invalid", 2)).toBeNull();
      expect(parseDecimal("123.456", 2)).toBeNull(); // rejects extra precision
      expect(parseDecimal("-50.00", 2)).toBe("-50.00");
    });

    it("parses and formats 3-decimal quantity and area strings", () => {
      expect(parseDecimal("25.500", 3)).toBe("25.500");
      expect(parseDecimal("25.5", 3)).toBe("25.500");
      expect(parseDecimal("10", 3)).toBe("10.000");
      expect(parseDecimal("0.123", 3)).toBe("0.123");
      expect(parseDecimal("0.1234", 3)).toBeNull(); // rejects extra precision
    });

    it("converts number or string to canonical decimal", () => {
      expect(toCanonicalDecimal(10000, 2)).toBe("10000.00");
      expect(toCanonicalDecimal(2500.5, 2)).toBe("2500.50");
      expect(toCanonicalDecimal("3000.25", 2)).toBe("3000.25");
      expect(toCanonicalDecimal("12.3", 3)).toBe("12.300");
    });
  });

  describe("Arithmetic operations", () => {
    it("adds decimals without precision loss", () => {
      expect(addDecimals("10000.00", "2500.50", 2)).toBe("12500.50");
      expect(addDecimals("3000.25", "500.00", 2)).toBe("3500.25");
      expect(addDecimals("0.10", "0.20", 2)).toBe("0.30"); // no 0.30000000000000004
      expect(addDecimals("12.000", "13.500", 3)).toBe("25.500");
    });

    it("subtracts decimals without precision loss", () => {
      expect(subtractDecimals("12500.50", "3500.25", 2)).toBe("9000.25");
      expect(subtractDecimals("1000.00", "1.00", 2)).toBe("999.00");
      expect(subtractDecimals("2550.50", "50.00", 2)).toBe("2500.50");
      expect(subtractDecimals("100.00", "150.00", 2)).toBe("-50.00");
    });

    it("multiplies quantity and unit price with half-up rounding to 2 decimal places", () => {
      // 10.000 * 1000.00 = 10000.00
      expect(multiplyDecimals("10.000", "1000.00", 2)).toBe("10000.00");
      // 5.000 * 510.10 = 2550.50
      expect(multiplyDecimals("5.000", "510.10", 2)).toBe("2550.50");
      // 1.234 * 10.55 = 13.0187 -> 13.02
      expect(multiplyDecimals("1.234", "10.55", 2)).toBe("13.02");
      // 1.234 * 10.54 = 13.00636 -> 13.01
      expect(multiplyDecimals("1.234", "10.54", 2)).toBe("13.01");
      // half-up: 2.5 * 1.55 = 3.875 -> 3.88
      expect(multiplyDecimals("2.500", "1.55", 2)).toBe("3.88");
    });
  });

  describe("Validation & Comparisons", () => {
    it("identifies non-negative and positive values", () => {
      expect(isNonNegativeDecimal("0.00")).toBe(true);
      expect(isNonNegativeDecimal("100.50")).toBe(true);
      expect(isNonNegativeDecimal("-0.01")).toBe(false);

      expect(isPositiveDecimal("0.00")).toBe(false);
      expect(isPositiveDecimal("0.001")).toBe(true);
      expect(isPositiveDecimal("10.000")).toBe(true);
      expect(isPositiveDecimal("-5.00")).toBe(false);
    });

    it("compares decimal values correctly", () => {
      expect(compareDecimals("100.00", "50.00")).toBe(1);
      expect(compareDecimals("50.00", "100.00")).toBe(-1);
      expect(compareDecimals("100.00", "100.00")).toBe(0);
      expect(compareDecimals("100.0", "100.000")).toBe(0);
    });
  });

  describe("Presentation Formatting", () => {
    it("formats money with comma separators and 2 decimals", () => {
      expect(formatMoney("10000.00")).toBe("10,000.00");
      expect(formatMoney("2500.50")).toBe("2,500.50");
      expect(formatMoney("0.00")).toBe("0.00");
      expect(formatMoney("-500.25")).toBe("-500.25");
    });

    it("formats quantity and area with comma separators and 3 decimals", () => {
      expect(formatQuantity("10.000")).toBe("10.000");
      expect(formatQuantity("1250.750")).toBe("1,250.750");
      expect(formatArea("25.500")).toBe("25.500");
    });
  });
});
