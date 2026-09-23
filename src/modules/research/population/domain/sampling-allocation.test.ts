import { describe, expect, it } from "vitest";

import { allocateLargestRemainder } from "./sampling-allocation";

describe("[UNIT-02] allocateLargestRemainder", () => {
  it("[UNIT-02] N=121 target 93 sums exactly with three strata", () => {
    const result = allocateLargestRemainder({
      populationSize: 121,
      target: 93,
      strata: [
        { stratumCode: "NORTH", eligibleCount: 50 },
        { stratumCode: "SOUTH", eligibleCount: 40 },
        { stratumCode: "EAST", eligibleCount: 31 },
      ],
    });
    expect(result.allocations.reduce((sum, item) => sum + item.finalAllocation, 0)).toBe(93);
    expect(result.allocations).toEqual([
      expect.objectContaining({ stratumCode: "NORTH", finalAllocation: 38 }),
      expect.objectContaining({ stratumCode: "SOUTH", finalAllocation: 31 }),
      expect.objectContaining({ stratumCode: "EAST", finalAllocation: 24 }),
    ]);
  });

  it("[UNIT-02] breaks remainder ties by bytewise stratum code", () => {
    const result = allocateLargestRemainder({
      populationSize: 4,
      target: 2,
      strata: [
        { stratumCode: "B", eligibleCount: 2 },
        { stratumCode: "A", eligibleCount: 2 },
      ],
    });
    expect(result.allocations).toEqual([
      expect.objectContaining({ stratumCode: "B", finalAllocation: 1 }),
      expect.objectContaining({ stratumCode: "A", finalAllocation: 1 }),
    ]);
    const uneven = allocateLargestRemainder({
      populationSize: 3,
      target: 2,
      strata: [
        { stratumCode: "B", eligibleCount: 1 },
        { stratumCode: "A", eligibleCount: 2 },
      ],
    });
    expect(uneven.allocations.find((item) => item.stratumCode === "A")).toMatchObject({ finalAllocation: 1 });
    expect(uneven.allocations.find((item) => item.stratumCode === "B")).toMatchObject({ finalAllocation: 1 });
  });

  it("[UNIT-02] honors floors and never exceeds stratum capacity", () => {
    const cases = [
      allocateLargestRemainder({
        populationSize: 121,
        target: 93,
        strata: [
          { stratumCode: "NORTH", eligibleCount: 50 },
          { stratumCode: "SOUTH", eligibleCount: 40 },
          { stratumCode: "EAST", eligibleCount: 31 },
        ],
      }),
      allocateLargestRemainder({
        populationSize: 4,
        target: 3,
        strata: [
          { stratumCode: "B", eligibleCount: 2 },
          { stratumCode: "A", eligibleCount: 2 },
        ],
      }),
    ];
    for (const result of cases) {
      for (const item of result.allocations) {
        expect(item.finalAllocation).toBeGreaterThanOrEqual(item.floor);
        expect(item.finalAllocation).toBeLessThanOrEqual(item.eligibleCount);
      }
    }
    expect(cases[1].allocations.find((item) => item.stratumCode === "A")).toMatchObject({ finalAllocation: 2 });
    expect(cases[1].allocations.find((item) => item.stratumCode === "B")).toMatchObject({ finalAllocation: 1 });
  });

  it("[UNIT-02] rejects strata sum mismatch", () => {
    expect(() =>
      allocateLargestRemainder({
        populationSize: 121,
        target: 93,
        strata: [{ stratumCode: "A", eligibleCount: 100 }],
      }),
    ).toThrow("STRATA_SUM_MISMATCH");
  });
});
