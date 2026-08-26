import { describe, expect, it } from "vitest";

import {
  allocateLargestRemainder,
  buildSamplingEvidence,
  canonicalizeMarginOfErrorText,
  calculateSampleSize,
  replaySamplingEvidence,
  type SamplingCandidate,
  type SamplingEvidenceInput,
} from "./deterministic-sampling";

const candidates: SamplingCandidate[] = [
  { memberId: "33333333-3333-4333-8333-333333333333", farmerCode: "SYN-003", stratumCode: "SOUTH" },
  { memberId: "11111111-1111-4111-8111-111111111111", farmerCode: "SYN-001", stratumCode: "NORTH" },
  { memberId: "44444444-4444-4444-8444-444444444444", farmerCode: "SYN-004", stratumCode: "SOUTH" },
  { memberId: "22222222-2222-4222-8222-222222222222", farmerCode: "SYN-002", stratumCode: "NORTH" },
  { memberId: "55555555-5555-4555-8555-555555555555", farmerCode: "SYN-005", stratumCode: "EAST" },
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
    [Number.MAX_SAFE_INTEGER + 1, 0.05],
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

describe("margin-of-error text contract", () => {
  it("canonicalizes 0.050 to 0.05 without losing the persisted text contract", () => {
    expect(canonicalizeMarginOfErrorText("0.050")).toBe("0.05");
    expect(canonicalizeMarginOfErrorText("0.5000")).toBe("0.5");
    expect(canonicalizeMarginOfErrorText("0.000100")).toBe("0.0001");
  });

  it.each(["", "0", "0.0", "1", "0.05e0", "0.050 ", "-0.05", `0.${"0".repeat(400)}1`])(
    "rejects non-canonical or unsafe margin text %j",
    (value) => {
      expect(() => canonicalizeMarginOfErrorText(value)).toThrow("invalid margin of error text");
    },
  );

  it("includes the canonical text in replayable evidence", async () => {
    const evidence = await buildSamplingEvidence({ ...evidenceInput, marginOfErrorText: "0.500" });
    expect(evidence.marginOfErrorText).toBe("0.5");
    await expect(replaySamplingEvidence({ ...evidenceInput, marginOfErrorText: "0.500" }, evidence)).resolves.toBe(true);
  });
});

describe("sampling candidate identifiers", () => {
  it("requires lowercase canonical UUID member identifiers", async () => {
    await expect(buildSamplingEvidence({
      populationSize: 1,
      marginOfError: 0.5,
      seedText: "canonical-member-id",
      candidates: [{ memberId: "m-01", farmerCode: "SYN-001", stratumCode: "NORTH" }],
    })).rejects.toThrow("candidate member id must be a canonical lowercase UUID");
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

  it("orders fractional remainders by exact rational value", () => {
    const target = 9_007_199_254_351_035;

    const rows = allocateLargestRemainder(
      [
        { stratumCode: "A", eligibleCount: 4_503_599_626_826_210 },
        { stratumCode: "B", eligibleCount: 4_503_599_626_653_690 },
        { stratumCode: "C", eligibleCount: 1_260_100 },
      ],
      target,
    );

    expect(rows.map(({ stratumCode, finalAllocation }) => ({ stratumCode, finalAllocation }))).toEqual([
      { stratumCode: "A", finalAllocation: 4_503_599_626_631_727 },
      { stratumCode: "B", finalAllocation: 4_503_599_626_459_208 },
      { stratumCode: "C", finalAllocation: 1_260_100 },
    ]);
    expect(rows.reduce((sum, row) => sum + row.finalAllocation, 0)).toBe(target);
  });

  it("keeps allocation floors exact when the quota product exceeds Number precision", () => {
    const rows = allocateLargestRemainder(
      [
        { stratumCode: "A", eligibleCount: 7_854_361_139_770_447 },
        { stratumCode: "B", eligibleCount: 1_152_838_114_969_553 },
      ],
      9_007_199_254_019_958,
    );

    expect(rows).toEqual([
      {
        stratumCode: "A",
        eligibleCount: 7_854_361_139_770_447,
        quota: expect.any(Number),
        floorAllocation: 7_854_361_139_142_563,
        remainder: expect.any(Number),
        finalAllocation: 7_854_361_139_142_564,
      },
      {
        stratumCode: "B",
        eligibleCount: 1_152_838_114_969_553,
        quota: expect.any(Number),
        floorAllocation: 1_152_838_114_877_394,
        remainder: expect.any(Number),
        finalAllocation: 1_152_838_114_877_394,
      },
    ]);
  });

  it("uses UTF-8 byte order for tied stratum remainders", () => {
    const rows = allocateLargestRemainder(
      [
        { stratumCode: "\u{1F600}", eligibleCount: 10 },
        { stratumCode: "\uE000", eligibleCount: 10 },
        { stratumCode: "A", eligibleCount: 10 },
      ],
      5,
    );

    expect(rows.map(({ stratumCode, finalAllocation }) => ({ stratumCode, finalAllocation }))).toEqual([
      { stratumCode: "A", finalAllocation: 2 },
      { stratumCode: "\uE000", finalAllocation: 2 },
      { stratumCode: "\u{1F600}", finalAllocation: 1 },
    ]);
  });

  it.each([
    [[{ stratumCode: "A", eligibleCount: Number.MAX_SAFE_INTEGER + 1 }], 1],
    [
      [
        { stratumCode: "A", eligibleCount: Number.MAX_SAFE_INTEGER },
        { stratumCode: "B", eligibleCount: 1 },
      ],
      Number.MAX_SAFE_INTEGER,
    ],
  ])("rejects unsafe capacity or sum: %j", (strata, targetN) => {
    expect(() => allocateLargestRemainder(strata, targetN)).toThrow();
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

  it("sorts candidate codes by UTF-8 bytes rather than UTF-16 code units", async () => {
    const evidence = await buildSamplingEvidence({
      populationSize: 2,
      marginOfError: 0.5,
      seedText: "synthetic-seed",
      candidates: [
        { memberId: "66666666-6666-4666-8666-666666666666", farmerCode: "\uE000", stratumCode: "A" },
        { memberId: "77777777-7777-4777-8777-777777777777", farmerCode: "\u{1F600}", stratumCode: "B" },
      ],
    });

    expect(evidence.initialCandidateMemberIds).toEqual([
      "66666666-6666-4666-8666-666666666666",
      "77777777-7777-4777-8777-777777777777",
    ]);
  });

  it("rejects C1 control characters in canonical candidate codes", async () => {
    await expect(
      buildSamplingEvidence({
        ...evidenceInput,
        candidates: [
          ...candidates.slice(0, 4),
          { memberId: "55555555-5555-4555-8555-555555555555", farmerCode: "SYN-\u0080", stratumCode: "EAST" },
        ],
      }),
    ).rejects.toThrow("control character");
  });

  it("rejects ambiguous adapter aliases at the domain boundary", async () => {
    const legacyInput = {
      N: evidenceInput.populationSize,
      e: evidenceInput.marginOfError,
      seed_text: evidenceInput.seedText,
      population: evidenceInput.candidates,
    } as unknown as SamplingEvidenceInput;

    await expect(buildSamplingEvidence(legacyInput)).rejects.toThrow();
  });

  it("matches the reviewed complete synthetic algorithm vector", async () => {
    const evidence = await buildSamplingEvidence(evidenceInput);

    expect(evidence).toEqual({
      algorithmVersion: "sha256-mulberry32-fy-v1",
      formulaVersion: "yamane-v1",
      formula: {
        populationSize: 5,
        marginOfError: 0.5,
        unrounded: 2.2222222222222223,
        roundingRule: "ceil",
        targetN: 3,
      },
      populationSize: 5,
      marginOfError: 0.5,
      marginOfErrorText: "0.5",
      unrounded: 2.2222222222222223,
      roundingRule: "ceil",
      targetN: 3,
      seedText: "e\u0301",
      seedNormalized: "é",
      seedNormalizedUtf8Hex: "c3a9",
      seedDigestHex: "4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c",
      seedU32: 0x4a99557e,
      orderedCandidateSetByteStreamHex:
        "0000000753594e2d303031000000054e4f5254480000000753594e2d303032000000054e4f5254480000000753594e2d30303300000005534f5554480000000753594e2d30303400000005534f5554480000000753594e2d3030350000000445415354",
      initialCandidateMemberIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
      ],
      orderedCandidateSetHash: "b6b19714bd434aca66ea0ab05f99b2a83eb1b95eb31a804242febbd33f8adc5e",
      swapTrace: [
        { i: 4, j: 3 },
        { i: 3, j: 0 },
        { i: 2, j: 0 },
        { i: 1, j: 0 },
      ],
      shuffledMemberIds: [
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
        "55555555-5555-4555-8555-555555555555",
        "11111111-1111-4111-8111-111111111111",
        "44444444-4444-4444-8444-444444444444",
      ],
      orderedSelectedMembers: [
        { memberId: "22222222-2222-4222-8222-222222222222", stratumCode: "NORTH", selectionOrder: 1 },
        { memberId: "33333333-3333-4333-8333-333333333333", stratumCode: "SOUTH", selectionOrder: 2 },
        { memberId: "55555555-5555-4555-8555-555555555555", stratumCode: "EAST", selectionOrder: 3 },
      ],
      orderedSelectedMemberIds: [
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
        "55555555-5555-4555-8555-555555555555",
      ],
      orderedResultDigestVersion: "ordered-result-sha256-v1",
      orderedResultHash: "8ec30357127f8236ff24eedd58d451d4b694bfbee4fcfede636737c38064c722",
      allocationRows: [
        { stratumCode: "EAST", eligibleCount: 1, quota: 0.6, floorAllocation: 0, remainder: 0.6, finalAllocation: 1 },
        { stratumCode: "NORTH", eligibleCount: 2, quota: 1.2, floorAllocation: 1, remainder: 0.19999999999999996, finalAllocation: 1 },
        { stratumCode: "SOUTH", eligibleCount: 2, quota: 1.2, floorAllocation: 1, remainder: 0.19999999999999996, finalAllocation: 1 },
      ],
    });
    expect(await replaySamplingEvidence(evidenceInput, evidence)).toBe(true);
  });

  it("rejects tampered evidence during replay", async () => {
    const evidence = await buildSamplingEvidence(evidenceInput);
    const tampered = { ...evidence, seedU32: evidence.seedU32 + 1 };

    await expect(replaySamplingEvidence(evidenceInput, tampered)).resolves.toBe(false);
  });

  it("records the ordered-result digest with the v1 length-prefixed canonical stream", async () => {
    const vector = await buildSamplingEvidence({
      populationSize: 2,
      marginOfError: 0.5,
      seedText: "ordered-result-vector",
      candidates: [
        { memberId: "22222222-2222-4222-8222-222222222222", farmerCode: "SYN-002", stratumCode: "SOUTH" },
        { memberId: "11111111-1111-4111-8111-111111111111", farmerCode: "SYN-001", stratumCode: "NORTH" },
      ],
      targetN: 2,
    });

    expect(vector.orderedResultDigestVersion).toBe("ordered-result-sha256-v1");
    expect(vector.orderedResultHash).toBe("77dc36582ce46286d8bda82c044f31705649359244c5c682acf19ccda14153c8");
    expect(await replaySamplingEvidence({
      populationSize: 2,
      marginOfError: 0.5,
      seedText: "ordered-result-vector",
      candidates: [
        { memberId: "22222222-2222-4222-8222-222222222222", farmerCode: "SYN-002", stratumCode: "SOUTH" },
        { memberId: "11111111-1111-4111-8111-111111111111", farmerCode: "SYN-001", stratumCode: "NORTH" },
      ],
      targetN: 2,
    }, { ...vector, orderedResultHash: "0".repeat(64) })).toBe(false);
  });
});
