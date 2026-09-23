export const YAMANE_FORMULA_VERSION = "yamane-v1" as const;

export type YamaneInput = {
  populationSize: number;
  marginOfError: number;
};

export type YamaneResult = {
  populationSize: number;
  marginOfError: number;
  unrounded: number;
  target: number;
  formulaVersion: typeof YAMANE_FORMULA_VERSION;
};

export function calculateYamaneSampleSize(input: YamaneInput): YamaneResult {
  if (!Number.isInteger(input.populationSize) || input.populationSize <= 0) {
    throw new Error("INVALID_POPULATION_SIZE");
  }
  if (!Number.isFinite(input.marginOfError) || input.marginOfError <= 0 || input.marginOfError >= 1) {
    throw new Error("INVALID_MARGIN_OF_ERROR");
  }
  const unrounded = input.populationSize / (1 + input.populationSize * input.marginOfError * input.marginOfError);
  return {
    populationSize: input.populationSize,
    marginOfError: input.marginOfError,
    unrounded,
    target: Math.ceil(unrounded),
    formulaVersion: YAMANE_FORMULA_VERSION,
  };
}
