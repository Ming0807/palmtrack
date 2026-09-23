import { describe, expect, it } from "vitest";

import { calculateYamaneSampleSize } from "./sampling-yamane";

describe("[UNIT-01] calculateYamaneSampleSize", () => {
  it("[UNIT-01] N=121 e=0.05 gives unrounded 92.8983 and ceil 93", () => {
    const result = calculateYamaneSampleSize({ populationSize: 121, marginOfError: 0.05 });
    expect(result.unrounded).toBeCloseTo(92.8983, 4);
    expect(result.target).toBe(93);
    expect(result.formulaVersion).toBe("yamane-v1");
  });

  it.each([[0, 0.05], [-5, 0.05], [121, 0], [121, 1], [121, Number.NaN]])(
    "[UNIT-01] rejects boundary N=%s e=%s",
    (populationSize, marginOfError) => {
      expect(() => calculateYamaneSampleSize({ populationSize, marginOfError })).toThrow();
    },
  );
});
