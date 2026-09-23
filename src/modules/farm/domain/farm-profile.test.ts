import { describe, expect, it } from "vitest";

import { validateAreaRai, validateFarmName } from "./farm-profile";

describe("validateFarmName", () => {
  it("trims synthetic Thai garden names", () => {
    expect(validateFarmName("  สวนปาล์มเหนือ  ")).toEqual({ status: "valid", name: "สวนปาล์มเหนือ" });
  });

  it.each(["", "   ", "x".repeat(121)])("rejects %s", (value) => {
    expect(validateFarmName(value).status).toBe("invalid");
  });
});

describe("validateAreaRai", () => {
  it("accepts decimal(14,3) areas", () => {
    expect(validateAreaRai(12.5)).toEqual({ status: "valid", areaRai: 12.5 });
    expect(validateAreaRai(6.25)).toEqual({ status: "valid", areaRai: 6.25 });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 12.5001, 100000000000])(
    "rejects %s",
    (value) => {
      expect(validateAreaRai(value).status).toBe("invalid");
    },
  );
});
