/**
 * Reference implementation of the V1 deterministic sampling contract.
 *
 * This module deliberately has no persistence or UI dependency. The values
 * returned by it are the evidence persisted by the sampling-run boundary.
 */

export const SAMPLING_ALGORITHM_VERSION = "sha256-mulberry32-fy-v1" as const;
export const SAMPLE_SIZE_FORMULA_VERSION = "yamane-v1" as const;

export type SamplingCandidate = {
  memberId?: string;
  farmerCode?: string;
  stratumCode?: string;
  eligible?: boolean;
  // These aliases make the domain adapter tolerant of persisted snake_case
  // projections while keeping the canonical evidence in camelCase.
  id?: string;
  populationMemberId?: string;
  farmer_code?: string;
  stratum_code?: string;
};

export type SamplingStratum = {
  stratumCode?: string;
  eligibleCount?: number;
  code?: string;
  count?: number;
  populationCount?: number;
  N_h?: number;
  stratum_code?: string;
  eligible_count?: number;
};

export type SamplingEvidenceInput = {
  populationSize?: number;
  marginOfError?: number;
  seedText?: string;
  candidates?: readonly SamplingCandidate[];
  strata?: readonly SamplingStratum[];
  targetN?: number;
  // Accepted aliases are useful at the server/database adapter boundary.
  N?: number;
  e?: number;
  seed_text?: string;
  population?: readonly SamplingCandidate[];
  target_n?: number;
};

export type SampleSizeCalculation = {
  populationSize: number;
  marginOfError: number;
  unrounded: number;
  roundingRule: "ceil";
  targetN: number;
};

export type AllocationRow = {
  stratumCode: string;
  eligibleCount: number;
  quota: number;
  floorAllocation: number;
  remainder: number;
  finalAllocation: number;
};

export type SwapTraceRow = { i: number; j: number };

export type SelectedMember = {
  memberId: string;
  stratumCode: string;
  selectionOrder: number;
};

export type SamplingEvidence = {
  algorithmVersion: typeof SAMPLING_ALGORITHM_VERSION;
  formulaVersion: typeof SAMPLE_SIZE_FORMULA_VERSION;
  formula: SampleSizeCalculation;
  populationSize: number;
  marginOfError: number;
  unrounded: number;
  roundingRule: "ceil";
  targetN: number;
  seedText: string;
  seedNormalized: string;
  seedNormalizedUtf8Hex: string;
  seedDigestHex: string;
  seedU32: number;
  orderedCandidateSetByteStreamHex: string;
  orderedCandidateSetHash: string;
  initialCandidateMemberIds: string[];
  swapTrace: SwapTraceRow[];
  shuffledMemberIds: string[];
  allocationRows: AllocationRow[];
  orderedSelectedMembers: SelectedMember[];
  orderedSelectedMemberIds: string[];
};

type NormalizedCandidate = {
  memberId: string;
  farmerCode: string;
  stratumCode: string;
};

const textEncoder = new TextEncoder();

function invalid(message: string): never {
  throw new Error(message);
}

function utf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function compareBytes(left: string, right: string): number {
  const leftBytes = utf8(left);
  const rightBytes = utf8(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) {
      return leftBytes[index] - rightBytes[index];
    }
  }
  return leftBytes.length - rightBytes.length;
}

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function requireFiniteInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || !Number.isFinite(value)) invalid(message);
  return value;
}

function resolvePopulationSize(input: SamplingEvidenceInput): number {
  const value = input.populationSize ?? input.N;
  if (value === undefined) invalid("population size is required");
  return value;
}

function resolveMarginOfError(input: SamplingEvidenceInput): number {
  const value = input.marginOfError ?? input.e;
  if (value === undefined) invalid("margin of error is required");
  return value;
}

function resolveSeedText(input: SamplingEvidenceInput): string {
  const value = input.seedText ?? input.seed_text;
  if (value === undefined) invalid("seed text is required");
  return value;
}

function resolveCandidates(input: SamplingEvidenceInput): readonly SamplingCandidate[] {
  return input.candidates ?? input.population ?? [];
}

function candidateMemberId(candidate: SamplingCandidate): string {
  const value = candidate.memberId ?? candidate.populationMemberId ?? candidate.id;
  if (value === undefined || value.length === 0) invalid("candidate member id is required");
  return value;
}

function candidateFarmerCode(candidate: SamplingCandidate): string {
  const value = candidate.farmerCode ?? candidate.farmer_code;
  if (value === undefined || value.length === 0) invalid("candidate farmer code is required");
  return value;
}

function candidateStratumCode(candidate: SamplingCandidate): string {
  const value = candidate.stratumCode ?? candidate.stratum_code;
  if (value === undefined || value.length === 0) invalid("candidate stratum code is required");
  return value;
}

function normalizeCandidates(
  candidates: readonly SamplingCandidate[],
): NormalizedCandidate[] {
  const normalized = candidates
    .filter((candidate) => candidate.eligible !== false)
    .map((candidate) => {
      const memberId = candidateMemberId(candidate);
      const farmerCode = candidateFarmerCode(candidate);
      const stratumCode = candidateStratumCode(candidate);
      if (hasControlCharacter(farmerCode) || hasControlCharacter(stratumCode)) {
        invalid("candidate code contains a control character");
      }
      return { memberId, farmerCode, stratumCode };
    });

  const memberIds = new Set<string>();
  const farmerCodes = new Set<string>();
  for (const candidate of normalized) {
    if (memberIds.has(candidate.memberId)) invalid("candidate member ids must be unique");
    if (farmerCodes.has(candidate.farmerCode)) invalid("candidate farmer codes must be unique");
    memberIds.add(candidate.memberId);
    farmerCodes.add(candidate.farmerCode);
  }
  normalized.sort((left, right) => compareBytes(left.farmerCode, right.farmerCode));
  return normalized;
}

function stratumCode(stratum: SamplingStratum): string {
  const value = stratum.stratumCode ?? stratum.stratum_code ?? stratum.code;
  if (value === undefined || value.length === 0) invalid("stratum code is required");
  if (hasControlCharacter(value)) invalid("stratum code contains a control character");
  return value;
}

function stratumCount(stratum: SamplingStratum): number {
  const value =
    stratum.eligibleCount ??
    stratum.eligible_count ??
    stratum.populationCount ??
    stratum.count ??
    stratum.N_h;
  if (value === undefined) invalid("stratum eligible count is required");
  requireFiniteInteger(value, "stratum eligible count must be a non-negative integer");
  if (value < 0) invalid("stratum eligible count must be a non-negative integer");
  return value;
}

function normalizeStrata(
  strata: readonly SamplingStratum[] | undefined,
  candidates: readonly NormalizedCandidate[],
): SamplingStratum[] {
  if (strata === undefined) {
    const counts = new Map<string, number>();
    for (const candidate of candidates) {
      counts.set(candidate.stratumCode, (counts.get(candidate.stratumCode) ?? 0) + 1);
    }
    return [...counts.entries()].map(([stratumCodeValue, eligibleCount]) => ({
      stratumCode: stratumCodeValue,
      eligibleCount,
    }));
  }

  const seen = new Set<string>();
  const normalized = strata.map((stratum) => {
    const code = stratumCode(stratum);
    if (seen.has(code)) invalid("stratum codes must be unique");
    seen.add(code);
    return { stratumCode: code, eligibleCount: stratumCount(stratum) };
  });
  return normalized;
}

function toUint32BigEndian(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, false);
  return bytes;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function sha256(input: Uint8Array): Promise<Uint8Array> {
  // TypeScript's DOM lib models Uint8Array buffers as ArrayBufferLike while
  // Web Crypto accepts the same bytes as a BufferSource at runtime.
  const digest = await crypto.subtle.digest("SHA-256", input as unknown as BufferSource);
  return new Uint8Array(digest);
}

function canonicalCandidateBytes(candidates: readonly NormalizedCandidate[]): Uint8Array {
  return concatBytes(
    candidates.map((candidate) => {
      const farmerCode = utf8(candidate.farmerCode);
      const stratumCode = utf8(candidate.stratumCode);
      return concatBytes([
        toUint32BigEndian(farmerCode.length),
        farmerCode,
        toUint32BigEndian(stratumCode.length),
        stratumCode,
      ]);
    }),
  );
}

function allocationRowsFor(
  strata: readonly SamplingStratum[],
  targetN: number,
): AllocationRow[] {
  requireFiniteInteger(targetN, "target must be a non-negative integer");
  if (targetN < 0) invalid("target must be a non-negative integer");
  const seenCodes = new Set<string>();
  const normalized = strata.map((stratum) => {
    const code = stratumCode(stratum);
    if (seenCodes.has(code)) invalid("stratum codes must be unique");
    seenCodes.add(code);
    return { stratumCode: code, eligibleCount: stratumCount(stratum) };
  });
  const totalCapacity = normalized.reduce((sum, stratum) => sum + stratum.eligibleCount, 0);
  if (totalCapacity === 0) {
    if (targetN !== 0) invalid("target exceeds eligible capacity");
    return normalized
      .map((stratum) => ({
        ...stratum,
        quota: 0,
        floorAllocation: 0,
        remainder: 0,
        finalAllocation: 0,
      }))
      .sort((left, right) => compareBytes(left.stratumCode, right.stratumCode));
  }
  if (targetN > totalCapacity) invalid("target exceeds eligible capacity");

  const rows = normalized.map<AllocationRow>((stratum) => {
    const quota = (targetN * stratum.eligibleCount) / totalCapacity;
    const floorAllocation = Math.floor(quota);
    return {
      ...stratum,
      quota,
      floorAllocation,
      remainder: quota - floorAllocation,
      finalAllocation: floorAllocation,
    };
  });
  let remaining = targetN - rows.reduce((sum, row) => sum + row.floorAllocation, 0);
  const byRemainder = [...rows].sort(
    (left, right) =>
      right.remainder - left.remainder || compareBytes(left.stratumCode, right.stratumCode),
  );
  for (const row of byRemainder) {
    if (remaining === 0) break;
    row.finalAllocation += 1;
    remaining -= 1;
  }
  if (remaining !== 0) invalid("unable to allocate target");
  for (const row of rows) {
    if (row.finalAllocation > row.eligibleCount) {
      invalid("allocation exceeds eligible capacity");
    }
  }
  rows.sort((left, right) => compareBytes(left.stratumCode, right.stratumCode));
  return rows;
}

export function calculateSampleSize(
  populationSize: number,
  marginOfError: number,
): SampleSizeCalculation {
  if (
    !Number.isInteger(populationSize) ||
    populationSize <= 0 ||
    !Number.isFinite(marginOfError) ||
    marginOfError <= 0 ||
    marginOfError >= 1
  ) {
    invalid("invalid sampling bounds");
  }
  const unrounded = populationSize / (1 + populationSize * marginOfError ** 2);
  return {
    populationSize,
    marginOfError,
    unrounded,
    roundingRule: "ceil",
    targetN: Math.ceil(unrounded),
  };
}

export function allocateLargestRemainder(
  strata: readonly SamplingStratum[],
  targetN: number,
): AllocationRow[] {
  if (strata.length === 0) {
    if (targetN === 0) return [];
    invalid("target exceeds eligible capacity");
  }
  return allocationRowsFor(strata, targetN);
}

function nextMulberry32(state: { value: number }): number {
  state.value = (state.value + 0x6d2b79f5) >>> 0;
  let t = Math.imul(state.value ^ (state.value >>> 15), state.value | 1) >>> 0;
  t = (t ^ ((t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0)) >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function inputTargetN(input: SamplingEvidenceInput, calculation: SampleSizeCalculation): number {
  const explicitTarget = input.targetN ?? input.target_n;
  if (explicitTarget === undefined) return calculation.targetN;
  requireFiniteInteger(explicitTarget, "target must be a non-negative integer");
  if (explicitTarget < 0 || explicitTarget > calculation.populationSize) {
    invalid("target exceeds eligible capacity");
  }
  return explicitTarget;
}

function evidenceComparable(evidence: SamplingEvidence): unknown {
  return {
    algorithmVersion: evidence.algorithmVersion,
    formulaVersion: evidence.formulaVersion,
    formula: evidence.formula,
    populationSize: evidence.populationSize,
    marginOfError: evidence.marginOfError,
    unrounded: evidence.unrounded,
    roundingRule: evidence.roundingRule,
    targetN: evidence.targetN,
    seedText: evidence.seedText,
    seedNormalized: evidence.seedNormalized,
    seedNormalizedUtf8Hex: evidence.seedNormalizedUtf8Hex,
    seedDigestHex: evidence.seedDigestHex,
    seedU32: evidence.seedU32,
    orderedCandidateSetByteStreamHex: evidence.orderedCandidateSetByteStreamHex,
    orderedCandidateSetHash: evidence.orderedCandidateSetHash,
    initialCandidateMemberIds: evidence.initialCandidateMemberIds,
    swapTrace: evidence.swapTrace,
    shuffledMemberIds: evidence.shuffledMemberIds,
    allocationRows: evidence.allocationRows,
    orderedSelectedMembers: evidence.orderedSelectedMembers,
    orderedSelectedMemberIds: evidence.orderedSelectedMemberIds,
  };
}

export async function buildSamplingEvidence(
  input: SamplingEvidenceInput,
): Promise<SamplingEvidence> {
  const populationSize = resolvePopulationSize(input);
  const marginOfError = resolveMarginOfError(input);
  const calculation = calculateSampleSize(populationSize, marginOfError);
  const targetN = inputTargetN(input, calculation);
  const seedText = resolveSeedText(input);
  if (seedText.length === 0) invalid("seed text must not be empty");

  const candidates = normalizeCandidates(resolveCandidates(input));
  if (candidates.length !== populationSize) {
    invalid("population size must equal eligible candidate count");
  }
  const strata = normalizeStrata(input.strata, candidates);
  const stratumTotal = strata.reduce((sum, stratum) => sum + stratumCount(stratum), 0);
  if (stratumTotal !== populationSize) invalid("strata total must equal population size");
  const candidateCounts = new Map<string, number>();
  for (const candidate of candidates) {
    candidateCounts.set(
      candidate.stratumCode,
      (candidateCounts.get(candidate.stratumCode) ?? 0) + 1,
    );
  }
  for (const stratum of strata) {
    if ((candidateCounts.get(stratumCode(stratum)) ?? 0) !== stratumCount(stratum)) {
      invalid("stratum capacity must equal eligible candidate count");
    }
  }

  const normalizedSeed = seedText.normalize("NFC");
  const seedBytes = utf8(normalizedSeed);
  const seedDigest = await sha256(seedBytes);
  const seedView = new DataView(seedDigest.buffer, seedDigest.byteOffset, seedDigest.byteLength);
  const seedU32 = seedView.getUint32(0, false);
  const candidateBytes = canonicalCandidateBytes(candidates);
  const candidateDigest = await sha256(candidateBytes);
  const allocationRows = allocateLargestRemainder(strata, targetN);
  const allocations = new Map(
    allocationRows.map((row) => [row.stratumCode, row.finalAllocation]),
  );

  const shuffled = candidates.map((candidate) => ({ ...candidate }));
  const initialCandidateMemberIds = shuffled.map((candidate) => candidate.memberId);
  const state = { value: seedU32 };
  const swapTrace: SwapTraceRow[] = [];
  for (let index = shuffled.length - 1; index >= 1; index -= 1) {
    const swapIndex = Math.floor(nextMulberry32(state) * (index + 1));
    swapTrace.push({ i: index, j: swapIndex });
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const shuffledMemberIds = shuffled.map((candidate) => candidate.memberId);
  const selectedCounts = new Map<string, number>();
  const orderedSelectedMembers: SelectedMember[] = [];
  for (const candidate of shuffled) {
    const selectedCount = selectedCounts.get(candidate.stratumCode) ?? 0;
    const quota = allocations.get(candidate.stratumCode);
    if (quota === undefined) invalid("candidate stratum is not allocated");
    if (selectedCount < quota) {
      orderedSelectedMembers.push({
        memberId: candidate.memberId,
        stratumCode: candidate.stratumCode,
        selectionOrder: orderedSelectedMembers.length + 1,
      });
      selectedCounts.set(candidate.stratumCode, selectedCount + 1);
      if (orderedSelectedMembers.length === targetN) break;
    }
  }
  if (orderedSelectedMembers.length !== targetN) invalid("unable to select target");

  return {
    algorithmVersion: SAMPLING_ALGORITHM_VERSION,
    formulaVersion: SAMPLE_SIZE_FORMULA_VERSION,
    formula: calculation,
    populationSize,
    marginOfError,
    unrounded: calculation.unrounded,
    roundingRule: calculation.roundingRule,
    targetN,
    seedText,
    seedNormalized: normalizedSeed,
    seedNormalizedUtf8Hex: bytesToHex(seedBytes),
    seedDigestHex: bytesToHex(seedDigest),
    seedU32,
    orderedCandidateSetByteStreamHex: bytesToHex(candidateBytes),
    orderedCandidateSetHash: bytesToHex(candidateDigest),
    initialCandidateMemberIds,
    swapTrace,
    shuffledMemberIds,
    allocationRows,
    orderedSelectedMembers,
    orderedSelectedMemberIds: orderedSelectedMembers.map((member) => member.memberId),
  };
}

export async function replaySamplingEvidence(
  input: SamplingEvidenceInput,
  evidence: SamplingEvidence,
): Promise<boolean> {
  try {
    const rebuilt = await buildSamplingEvidence(input);
    return JSON.stringify(evidenceComparable(rebuilt)) === JSON.stringify(evidenceComparable(evidence));
  } catch {
    return false;
  }
}
