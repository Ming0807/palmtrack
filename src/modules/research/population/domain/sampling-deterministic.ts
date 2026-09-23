export const SAMPLING_ALGORITHM_VERSION = "sha256-mulberry32-fy-v1" as const;

export type SeedDerivation = {
  seedText: string;
  seedNormalized: string;
  seedUtf8Hex: string;
  seedDigestHex: string;
  seedU32: number;
  algorithmVersion: typeof SAMPLING_ALGORITHM_VERSION;
};

export type SamplingCandidate = {
  farmerCode: string;
  stratumCode: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return toHex(new Uint8Array(digest));
}

export async function deriveSeed(seedText: string): Promise<SeedDerivation> {
  const seedNormalized = seedText.normalize("NFC");
  const seedUtf8 = new TextEncoder().encode(seedNormalized);
  const seedDigestHex = await sha256Hex(seedUtf8);
  const digestBytes = new Uint8Array(
    (await crypto.subtle.digest("SHA-256", seedUtf8 as BufferSource)) as ArrayBuffer,
  );
  const view = new DataView(digestBytes.buffer, digestBytes.byteOffset, digestBytes.byteLength);
  return {
    seedText,
    seedNormalized,
    seedUtf8Hex: toHex(seedUtf8),
    seedDigestHex,
    seedU32: view.getUint32(0, false),
    algorithmVersion: SAMPLING_ALGORITHM_VERSION,
  };
}

export function createMulberry32(seedU32: number): () => number {
  let state = seedU32 >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const out = (t ^ (t >>> 14)) >>> 0;
    return out / 4294967296;
  };
}

export type ShuffleStep = { i: number; j: number };

export function fisherYatesShuffle<T>(input: T[], nextRandom: () => number): { shuffled: T[]; steps: ShuffleStep[] } {
  const shuffled = [...input];
  const steps: ShuffleStep[] = [];
  for (let i = shuffled.length - 1; i >= 1; i -= 1) {
    const j = Math.floor(nextRandom() * (i + 1));
    steps.push({ i, j });
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return { shuffled, steps };
}

function encodeLengthPrefixed(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  const out = new Uint8Array(4 + bytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, bytes.length, false);
  out.set(bytes, 4);
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function sortCandidatesByCode(candidates: SamplingCandidate[]): SamplingCandidate[] {
  const encoder = new TextEncoder();
  return [...candidates].sort((a, b) => {
    const aBytes = encoder.encode(a.farmerCode);
    const bBytes = encoder.encode(b.farmerCode);
    const length = Math.min(aBytes.length, bBytes.length);
    for (let i = 0; i < length; i += 1) {
      if (aBytes[i] !== bBytes[i]) return aBytes[i] - bBytes[i];
    }
    return aBytes.length - bBytes.length;
  });
}

export async function hashOrderedCandidateSet(ordered: SamplingCandidate[]): Promise<string> {
  for (const candidate of ordered) {
    if (/[\u0000-\u001f\u007f]/u.test(candidate.farmerCode) || /[\u0000-\u001f\u007f]/u.test(candidate.stratumCode)) {
      throw new Error("INVALID_CANDIDATE_CODE");
    }
  }
  const stream = concatBytes(
    ordered.flatMap((candidate) => [encodeLengthPrefixed(candidate.farmerCode), encodeLengthPrefixed(candidate.stratumCode)]),
  );
  return sha256Hex(stream);
}

export type AllocationQuota = { stratumCode: string; finalAllocation: number };

export function selectByAllocation(
  shuffled: SamplingCandidate[],
  allocations: AllocationQuota[],
): { selected: (SamplingCandidate & { selectionOrder: number })[] } {
  const quota = new Map(allocations.map((item) => [item.stratumCode, item.finalAllocation]));
  const counted = new Map<string, number>();
  const selected: (SamplingCandidate & { selectionOrder: number })[] = [];
  for (const candidate of shuffled) {
    const limit = quota.get(candidate.stratumCode);
    if (limit === undefined) throw new Error("UNKNOWN_STRATUM");
    const used = counted.get(candidate.stratumCode) ?? 0;
    if (used < limit) {
      selected.push({ ...candidate, selectionOrder: selected.length + 1 });
      counted.set(candidate.stratumCode, used + 1);
    }
    const target = allocations.reduce((sum, item) => sum + item.finalAllocation, 0);
    if (selected.length === target) break;
  }
  const target = allocations.reduce((sum, item) => sum + item.finalAllocation, 0);
  if (selected.length !== target) throw new Error("SELECTION_INCOMPLETE");
  return { selected };
}
