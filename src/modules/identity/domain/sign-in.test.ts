import { parseSignInCredentials } from "./sign-in";

describe("sign-in credential boundary", () => {
  it("accepts and normalizes an email identifier", () => {
    expect(
      parseSignInCredentials({
        identifier: "  COLLECTOR@EXAMPLE.TEST ",
        password: "synthetic-password",
      }),
    ).toEqual({
      success: true,
      credentials: {
        email: "collector@example.test",
        password: "synthetic-password",
      },
    });
  });

  it("accepts an E.164 phone identifier without inventing a country code", () => {
    expect(
      parseSignInCredentials({
        identifier: "+66812345678",
        password: "synthetic-password",
      }),
    ).toEqual({
      success: true,
      credentials: {
        phone: "+66812345678",
        password: "synthetic-password",
      },
    });
  });

  it.each([
    { identifier: "", password: "synthetic-password" },
    { identifier: "not-an-email", password: "synthetic-password" },
    { identifier: "person@example.test", password: "" },
  ])("rejects invalid credentials without returning their values", (input) => {
    const result = parseSignInCredentials(input);

    expect(result).toEqual({ success: false });
    for (const submittedValue of [input.password, input.identifier].filter(Boolean)) {
      expect(JSON.stringify(result)).not.toContain(submittedValue);
    }
  });
});
