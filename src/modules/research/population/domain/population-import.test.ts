import { describe, expect, it } from "vitest";

import { FX_POPULATION_CSV } from "./fixtures";
import {
  MAX_POPULATION_FILE_BYTES,
  POPULATION_HEADER,
  validatePopulationCsv,
} from "./population-import";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("[INT-01] validatePopulationCsv", () => {
  it("[INT-01] normalizes the accepted synthetic contract and returns the known SHA-256 digest", async () => {
    const result = await validatePopulationCsv(bytes(FX_POPULATION_CSV));

    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("expected valid fixture");
    expect(result.rows).toHaveLength(3);
    expect(result.canonicalText).toBe(
      "1,SYN-001,NORTH,1,\n2,SYN-002,SOUTH,1,\n3,SYN-003,SOUTH,0,OUT_OF_SCOPE\n",
    );
    expect(result.digest).toBe("eab2656fc47894c6e8aefb8896086a3043cdfb2c43bbdb4f42be81e8d6b31e5b");
    expect(result.counts).toEqual({ total: 3, eligible: 2, excluded: 1 });
  });

  it.each([
    ["wrong header", "code,stratum,eligible,reason\nSYN-001,NORTH,true,\n", "INVALID_HEADER"],
    ["duplicate code", "farmer_code,stratum_code,eligible,exclusion_reason_code\nSYN-001,NORTH,true,\nSYN-001,SOUTH,true,\n", "DUPLICATE_FARMER_CODE"],
    ["missing reason", "farmer_code,stratum_code,eligible,exclusion_reason_code\nSYN-001,NORTH,false,\n", "EXCLUSION_REASON_REQUIRED"],
    ["reason on eligible", "farmer_code,stratum_code,eligible,exclusion_reason_code\nSYN-001,NORTH,true,OUT_OF_SCOPE\n", "EXCLUSION_REASON_FORBIDDEN"],
  ])("[INT-01] rejects %s without returning raw cells", async (_name, csv, reasonCode) => {
    const result = await validatePopulationCsv(bytes(csv));
    expect(result).toMatchObject({ status: "invalid" });
    if (result.status !== "invalid") throw new Error("expected invalid fixture");
    expect(result.errors).toContainEqual(expect.objectContaining({ reasonCode }));
    expect(JSON.stringify(result.errors)).not.toContain("SYN-001");
  });

  it("[INT-01] treats UTF-8 BOM and CRLF as the same canonical input", async () => {
    const lf = await validatePopulationCsv(bytes(FX_POPULATION_CSV));
    const crlf = await validatePopulationCsv(bytes(`\uFEFF${FX_POPULATION_CSV.replaceAll("\n", "\r\n")}`));
    expect(crlf).toEqual(lf);
  });

  it.each([
    [new Uint8Array(), "EMPTY_FILE"],
    [new Uint8Array(1_048_577), "FILE_TOO_LARGE"],
    [new Uint8Array([0xc3, 0x28]), "INVALID_UTF8"],
  ])("[INT-01] rejects an invalid file boundary without parsing rows", async (input, reasonCode) => {
    expect(await validatePopulationCsv(input)).toEqual({
      status: "invalid",
      errors: [{ rowNumber: null, fieldCode: "file", reasonCode }],
    });
  });

  it("[INT-01] allows the exact byte ceiling to reach content validation", async () => {
    const result = await validatePopulationCsv(new Uint8Array(MAX_POPULATION_FILE_BYTES));
    expect(result).toMatchObject({ status: "invalid" });
    if (result.status !== "invalid") throw new Error("expected invalid content");
    expect(result.errors).not.toContainEqual(expect.objectContaining({ reasonCode: "FILE_TOO_LARGE" }));
  });

  it.each([
    ["SYN-1,NORTH,true,", "farmer_code", "INVALID_FARMER_CODE"],
    ["SYN-001,north,true,", "stratum_code", "INVALID_STRATUM_CODE"],
    ["SYN-001,NORTH,yes,", "eligible", "INVALID_ELIGIBLE"],
    ["SYN-001,NORTH,false,UNAPPROVED", "exclusion_reason_code", "INVALID_EXCLUSION_REASON"],
    ['"SYN-001",NORTH,true,', "file", "INVALID_ROW_FORMAT"],
  ])("[INT-01] enforces the exact field allowlists", async (row, fieldCode, reasonCode) => {
    const result = await validatePopulationCsv(bytes(`${POPULATION_HEADER}\n${row}\n`));
    expect(result).toMatchObject({ status: "invalid", errors: [expect.objectContaining({ rowNumber: 1, fieldCode, reasonCode })] });
  });
});
