import { describe, expect, it } from "vitest";

import {
  createMulberry32,
  deriveSeed,
  fisherYatesShuffle,
  hashOrderedCandidateSet,
  selectByAllocation,
  sortCandidatesByCode,
} from "./sampling-deterministic";

describe("[UNIT-08] sha256-mulberry32-fy-v1 seed", () => {
  it("[UNIT-08] NFC-equivalent seed texts share digest and seed_u32", async () => {
    const composed = "palmtrack-seed-café-v1";
    const decomposed = "palmtrack-seed-café-v1";
    expect(composed.normalize("NFC")).toBe(decomposed.normalize("NFC"));
    const a = await deriveSeed(composed);
    const b = await deriveSeed(decomposed);
    expect(a.seedNormalized).toBe(b.seedNormalized);
    expect(a.seedDigestHex).toBe(b.seedDigestHex);
    expect(a.seedU32).toBe(b.seedU32);
    expect(a.algorithmVersion).toBe("sha256-mulberry32-fy-v1");
  });

  it("[UNIT-08] same seed replays identical shuffle steps and order", async () => {
    const { seedU32 } = await deriveSeed("palmtrack-acceptance-seed-v1");
    const candidates = sortCandidatesByCode([
      { farmerCode: "SYN-003", stratumCode: "SOUTH" },
      { farmerCode: "SYN-001", stratumCode: "NORTH" },
      { farmerCode: "SYN-002", stratumCode: "SOUTH" },
    ]);
    expect(candidates.map((item) => item.farmerCode)).toEqual(["SYN-001", "SYN-002", "SYN-003"]);
    const first = fisherYatesShuffle(candidates, createMulberry32(seedU32));
    const second = fisherYatesShuffle(candidates, createMulberry32(seedU32));
    expect(second.steps).toEqual(first.steps);
    expect(second.shuffled).toEqual(first.shuffled);
    expect(first.steps).toHaveLength(2);
  });

  it("[UNIT-08] ordered candidate hash is stable and selection honors allocation", async () => {
    const ordered = sortCandidatesByCode([
      { farmerCode: "SYN-002", stratumCode: "SOUTH" },
      { farmerCode: "SYN-001", stratumCode: "NORTH" },
    ]);
    const hash = await hashOrderedCandidateSet(ordered);
    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(await hashOrderedCandidateSet(ordered)).toBe(hash);
    const { seedU32 } = await deriveSeed("palmtrack-acceptance-seed-v1");
    const { shuffled } = fisherYatesShuffle(ordered, createMulberry32(seedU32));
    const { selected } = selectByAllocation(shuffled, [
      { stratumCode: "NORTH", finalAllocation: 1 },
      { stratumCode: "SOUTH", finalAllocation: 1 },
    ]);
    expect(selected).toHaveLength(2);
    expect(selected.map((item) => item.selectionOrder)).toEqual([1, 2]);
  });
});
