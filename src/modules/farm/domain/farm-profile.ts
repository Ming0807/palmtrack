export type ValidName = { status: "valid"; name: string };
export type InvalidName = { status: "invalid" };
export type NameValidation = ValidName | InvalidName;

export function validateFarmName(value: string): NameValidation {
  const name = value.trim();
  if (name.length < 1 || name.length > 120) return { status: "invalid" };
  return { status: "valid", name };
}

export type ValidArea = { status: "valid"; areaRai: number };
export type InvalidArea = { status: "invalid" };
export type AreaValidation = ValidArea | InvalidArea;

const MAX_AREA_RAI = 100000000000;

export function validateAreaRai(value: number): AreaValidation {
  if (!Number.isFinite(value) || value <= 0 || value >= MAX_AREA_RAI) return { status: "invalid" };
  if (Math.round(value * 1000) / 1000 !== value) return { status: "invalid" };
  return { status: "valid", areaRai: value };
}

export function validateDeleteReason(value: string): NameValidation {
  const name = value.trim();
  if (name.length < 1 || name.length > 200) return { status: "invalid" };
  return { status: "valid", name };
}
