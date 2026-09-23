export type StratumPopulation = {
  stratumCode: string;
  eligibleCount: number;
};

export type StratumAllocation = {
  stratumCode: string;
  eligibleCount: number;
  quota: number;
  floor: number;
  remainder: number;
  finalAllocation: number;
};

export type AllocationInput = {
  populationSize: number;
  target: number;
  strata: StratumPopulation[];
};

export type AllocationResult = {
  populationSize: number;
  target: number;
  allocations: StratumAllocation[];
};

function compareBytes(a: string, b: string): number {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.min(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i += 1) {
    if (aBytes[i] !== bBytes[i]) return aBytes[i] - bBytes[i];
  }
  return aBytes.length - bBytes.length;
}

export function allocateLargestRemainder(input: AllocationInput): AllocationResult {
  if (!Number.isInteger(input.populationSize) || input.populationSize <= 0) {
    throw new Error("INVALID_POPULATION_SIZE");
  }
  if (!Number.isInteger(input.target) || input.target <= 0 || input.target > input.populationSize) {
    throw new Error("INVALID_TARGET");
  }
  if (input.strata.length === 0) throw new Error("EMPTY_STRATA");
  const summed = input.strata.reduce((sum, item) => sum + item.eligibleCount, 0);
  if (summed !== input.populationSize) throw new Error("STRATA_SUM_MISMATCH");
  const rows: StratumAllocation[] = input.strata.map((item) => {
    if (!/^[A-Z0-9_-]{1,24}$/u.test(item.stratumCode)) throw new Error("INVALID_STRATUM_CODE");
    if (!Number.isInteger(item.eligibleCount) || item.eligibleCount < 0) throw new Error("INVALID_STRATUM_COUNT");
    const quota = (input.target * item.eligibleCount) / input.populationSize;
    const floor = Math.floor(quota);
    return {
      stratumCode: item.stratumCode,
      eligibleCount: item.eligibleCount,
      quota,
      floor,
      remainder: quota - floor,
      finalAllocation: floor,
    };
  });
  for (const row of rows) {
    if (row.finalAllocation > row.eligibleCount) throw new Error("ALLOCATION_EXCEEDS_CAPACITY");
  }
  let remaining = input.target - rows.reduce((sum, row) => sum + row.finalAllocation, 0);
  const order = [...rows].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return compareBytes(a.stratumCode, b.stratumCode);
  });
  for (const next of order) {
    if (remaining <= 0) break;
    const row = rows.find((item) => item.stratumCode === next.stratumCode);
    if (!row) continue;
    if (row.finalAllocation + 1 > row.eligibleCount) throw new Error("ALLOCATION_EXCEEDS_CAPACITY");
    row.finalAllocation += 1;
    remaining -= 1;
  }
  if (remaining !== 0) throw new Error("ALLOCATION_MISMATCH");
  rows.sort((a, b) => compareBytes(a.stratumCode, b.stratumCode));
  const inputOrder = new Map(input.strata.map((item, index) => [item.stratumCode, index]));
  rows.sort((a, b) => (inputOrder.get(a.stratumCode) ?? 0) - (inputOrder.get(b.stratumCode) ?? 0));
  return { populationSize: input.populationSize, target: input.target, allocations: rows };
}
