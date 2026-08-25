export const POPULATION_SCHEMA_VERSION = "synthetic-population-v1" as const;
export const MAX_POPULATION_FILE_BYTES = 1_048_576;
export const POPULATION_HEADER =
  "farmer_code,stratum_code,eligible,exclusion_reason_code";

export type ExclusionReason =
  | "OUT_OF_SCOPE"
  | "DUPLICATE_SOURCE"
  | "INELIGIBLE_RULE";

export type PopulationRow = {
  rowNumber: number;
  farmerCode: string;
  stratumCode: string;
  eligible: boolean;
  exclusionReasonCode: ExclusionReason | null;
};

export type PopulationValidationError = {
  rowNumber: number | null;
  fieldCode:
    | "file"
    | "header"
    | "farmer_code"
    | "stratum_code"
    | "eligible"
    | "exclusion_reason_code";
  reasonCode: string;
};

export type PopulationValidationResult =
  | { status: "invalid"; errors: PopulationValidationError[] }
  | {
      status: "valid";
      rows: PopulationRow[];
      canonicalText: string;
      digest: string;
      counts: { total: number; eligible: number; excluded: number };
    };

export async function validatePopulationCsv(
  input: Uint8Array,
): Promise<PopulationValidationResult> {
  const fileError = (reasonCode: string): PopulationValidationResult => ({
    status: "invalid",
    errors: [{ rowNumber: null, fieldCode: "file", reasonCode }],
  });

  if (input.byteLength === 0) return fileError("EMPTY_FILE");
  if (input.byteLength > MAX_POPULATION_FILE_BYTES) {
    return fileError("FILE_TOO_LARGE");
  }

  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    return fileError("INVALID_UTF8");
  }

  const text = decoded.replace(/^\uFEFF/u, "").replaceAll("\r\n", "\n");
  if (text.includes("\r")) return fileError("INVALID_LINE_ENDING");
  const lines = text.split("\n");
  while (lines.at(-1) === "") lines.pop();
  if (lines[0] !== POPULATION_HEADER) {
    return {
      status: "invalid",
      errors: [{ rowNumber: null, fieldCode: "header", reasonCode: "INVALID_HEADER" }],
    };
  }

  const allowedReasons = new Set<ExclusionReason>([
    "OUT_OF_SCOPE",
    "DUPLICATE_SOURCE",
    "INELIGIBLE_RULE",
  ]);
  const seenCodes = new Set<string>();
  const rows: PopulationRow[] = [];
  const errors: PopulationValidationError[] = [];

  for (const [index, line] of lines.slice(1).entries()) {
    const rowNumber = index + 1;
    if (line.length === 0 || line.includes('"')) {
      errors.push({ rowNumber, fieldCode: "file", reasonCode: "INVALID_ROW_FORMAT" });
      continue;
    }
    const cells = line.split(",");
    if (cells.length !== 4) {
      errors.push({ rowNumber, fieldCode: "file", reasonCode: "INVALID_COLUMN_COUNT" });
      continue;
    }
    const [farmerCode, stratumCode, eligibleText, reasonText] = cells;
    const before = errors.length;
    if (!/^SYN-[0-9]{3,6}$/u.test(farmerCode)) {
      errors.push({ rowNumber, fieldCode: "farmer_code", reasonCode: "INVALID_FARMER_CODE" });
    } else if (seenCodes.has(farmerCode)) {
      errors.push({ rowNumber, fieldCode: "farmer_code", reasonCode: "DUPLICATE_FARMER_CODE" });
    } else {
      seenCodes.add(farmerCode);
    }
    if (!/^[A-Z0-9_-]{1,24}$/u.test(stratumCode)) {
      errors.push({ rowNumber, fieldCode: "stratum_code", reasonCode: "INVALID_STRATUM_CODE" });
    }
    const eligible =
      eligibleText === "true" ? true : eligibleText === "false" ? false : null;
    if (eligible === null) {
      errors.push({ rowNumber, fieldCode: "eligible", reasonCode: "INVALID_ELIGIBLE" });
    }
    const reason = reasonText as ExclusionReason;
    if (eligible === true && reasonText !== "") {
      errors.push({ rowNumber, fieldCode: "exclusion_reason_code", reasonCode: "EXCLUSION_REASON_FORBIDDEN" });
    }
    if (eligible === false && reasonText === "") {
      errors.push({ rowNumber, fieldCode: "exclusion_reason_code", reasonCode: "EXCLUSION_REASON_REQUIRED" });
    } else if (eligible === false && !allowedReasons.has(reason)) {
      errors.push({ rowNumber, fieldCode: "exclusion_reason_code", reasonCode: "INVALID_EXCLUSION_REASON" });
    }
    if (errors.length === before && eligible !== null) {
      rows.push({ rowNumber, farmerCode, stratumCode, eligible, exclusionReasonCode: eligible ? null : reason });
    }
  }

  if (rows.length === 0 && errors.length === 0) return fileError("NO_DATA_ROWS");
  if (errors.length > 0) return { status: "invalid", errors };

  const canonicalText = rows
    .map((row) => [row.rowNumber, row.farmerCode, row.stratumCode, row.eligible ? "1" : "0", row.exclusionReasonCode ?? ""].join(","))
    .join("\n") + "\n";
  const digestBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalText));
  const digest = Array.from(new Uint8Array(digestBytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const eligible = rows.filter((row) => row.eligible).length;

  return { status: "valid", rows, canonicalText, digest, counts: { total: rows.length, eligible, excluded: rows.length - eligible } };
}
