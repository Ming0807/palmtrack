import { describe, expect, it } from "vitest";

import {
  allocateLargestRemainder,
  buildSamplingEvidence,
  calculateSampleSize,
  replaySamplingEvidence,
  type SamplingCandidate,
  type SamplingEvidenceInput,
} from "./deterministic-sampling";

const candidates: SamplingCandidate[] = [
  { memberId: "m-03", farmerCode: "SYN-003", stratumCode: "SOUTH" },
  { memberId: "m-01", farmerCode: "SYN-001", stratumCode: "NORTH" },
  { memberId: "m-04", farmerCode: "SYN-004", stratumCode: "SOUTH" },
  { memberId: "m-02", farmerCode: "SYN-002", stratumCode: "NORTH" },
  { memberId: "m-05", farmerCode: "SYN-005", stratumCode: "EAST" },
];

const evidenceInput: SamplingEvidenceInput = {
  populationSize: candidates.length,
  marginOfError: 0.5,
  seedText: "e\u0301",
  candidates,
};

describe("calculateSampleSize", () => {
  it("calculates and ceils the mandated Yamane 121/0.05 vector", () => {
    expect(calculateSampleSize(121, 0.05)).toEqual({
      populationSize: 121,
      marginOfError: 0.05,
      unrounded: 92.89827255278311,
      roundingRule: "ceil",
      targetN: 93,
    });
  });

  it.each([
    [0, 0.05],
    [-1, 0.05],
    [1.5, 0.05],
    [121, 0],
    [121, 1],
    [121, Number.NaN],
    [121, Number.POSITIVE_INFINITY],
  ])("rejects invalid bounds N=%s e=%s", (populationSize, marginOfError) => {
    expect(() => calculateSampleSize(populationSize, marginOfError)).toThrow(
      "invalid sampling bounds",
    );
  });
});

describe("allocateLargestRemainder", () => {
  it("uses bytewise stratum-code ordering when remainders tie", () => {
    expect(
      allocateLargestRemainder(
        [
          { stratumCode: "B", eligibleCount: 10 },
          { stratumCode: "A", eligibleCount: 10 },
          { stratumCode: "C", eligibleCount: 10 },
        ],
        5,
      ),
    ).toEqual([
      { stratumCode: "A", eligibleCount: 10, quota: 5 / 3, floorAllocation: 1, remainder: 5 / 3 - 1, finalAllocation: 2 },
      { stratumCode: "B", eligibleCount: 10, quota: 5 / 3, floorAllocation: 1, remainder: 5 / 3 - 1, finalAllocation: 2 },
      { stratumCode: "C", eligibleCount: 10, quota: 5 / 3, floorAllocation: 1, remainder: 5 / 3 - 1, finalAllocation: 1 },
    ]);
  });

  it("rejects a target that exceeds eligible capacity", () => {
    expect(() =>
      allocateLargestRemainder(
        [
          { stratumCode: "A", eligibleCount: 1 },
          { stratumCode: "B", eligibleCount: 2 },
        ],
        4,
      ),
    ).toThrow("target exceeds eligible capacity");
  });
});

describe("deterministic sampling evidence", () => {
  it("normalizes NFC-equivalent seeds to the same digest and replay result", async () => {
    const decomposed = await buildSamplingEvidence(evidenceInput);
    const composed = await buildSamplingEvidence({ ...evidenceInput, seedText: "é" });

    expect(decomposed.seedNormalized).toBe("é");
    expect(decomposed.seedNormalized).toBe(composed.seedNormalized);
    expect(decomposed.seedDigestHex).toBe(composed.seedDigestHex);
    expect(decomposed.seedU32).toBe(composed.seedU32);
    expect(decomposed.orderedCandidateSetHash).toBe(composed.orderedCandidateSetHash);
    expect(decomposed.orderedSelectedMembers).toEqual(composed.orderedSelectedMembers);
    await expect(replaySamplingEvidence(evidenceInput, decomposed)).resolves.toBe(true);
  });

  it("matches the reviewed complete synthetic algorithm vector", async () => {
    const evidence = await buildSamplingEvidence(evidenceInput);

    expect(evidence).toMatchObject({
      algorithmVersion: "sha256-mulberry32-fy-v1",
      seedText: "e\u0301",
      seedNormalized: "é",
      seedNormalizedUtf8Hex: "c3a9",
      seedDigestHex: "4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c",
      seedU32: 0x4a99557e,
      orderedCandidateSetByteStreamHex:
        "0000000753594e2d303031000000054e4f5254480000000753594e2d303032000000054e4f5254480000000753594e2d30303300000005534f5554480000000753594e2d30303400000005534f5554480000000753594e2d3030350000000445415354",
      initialCandidateMemberIds: ["m-01", "m-02", "m-03", "m-04", "m-05"],
      orderedCandidateSetHash: "b6b19714bd434aca66ea0ab05f99b2a83eb1b95eb31a804242febbd33f8adc5e",
      swapTrace: [
        { i: 4, j: 3 },
        { i: 3, j: 0 },
        { i: 2, j: 0 },
        { i: 1, j: 0 },
      ],
      shuffledMemberIds: ["m-02", "m-03", "m-05", "m-01", "m-04"],
      orderedSelectedMembers: [
        { memberId: "m-02", stratumCode: "NORTH", selectionOrder: 1 },
        { memberId: "m-03", stratumCode: "SOUTH", selectionOrder: 2 },
        { memberId: "m-05", stratumCode: "EAST", selectionOrder: 3 },
      ],
    });
    expect(evidence.allocationRows).toEqual([
      { stratumCode: "EAST", eligibleCount: 1, quota: 0.6, floorAllocation: 0, remainder: 0.6, finalAllocation: 1 },
      { stratumCode: "NORTH", eligibleCount: 2, quota: 1.2, floorAllocation: 1, remainder: 0.19999999999999996, finalAllocation: 1 },
      { stratumCode: "SOUTH", eligibleCount: 2, quota: 1.2, floorAllocation: 1, remainder: 0.19999999999999996, finalAllocation: 1 },
    ]);
    expect(await replaySamplingEvidence(evidenceInput, evidence)).toBe(true);
  });

  it("rejects tampered evidence during replay", async () => {
    const evidence = await buildSamplingEvidence(evidenceInput);
    const tampered = { ...evidence, seedU32: evidence.seedU32 + 1 };

    await expect(replaySamplingEvidence(evidenceInput, tampered)).resolves.toBe(false);
  });
});
