import { createSafeEvent } from "./safe-event";

const safeInput = {
  correlationId: "00000000-0000-4000-8000-000000000001",
  actionCode: "identity.sign_in",
  result: "success",
  occurredAt: "2026-08-25T05:00:00.000Z",
  entityId: "00000000-0000-4000-8000-000000000002",
} as const;

describe("safe application event boundary", () => {
  it("accepts only the stable non-PII event projection", () => {
    expect(createSafeEvent(safeInput)).toEqual({
      success: true,
      event: safeInput,
    });
  });

  it.each([
    "password",
    "token",
    "signedUrl",
    "rawAnswer",
    "name",
    "contact",
    "exactLocation",
  ])("rejects the unsafe field %s without echoing its value", (field) => {
    const submittedValue = `sensitive-${field}`;
    const result = createSafeEvent({ ...safeInput, [field]: submittedValue });

    expect(result).toEqual({ success: false });
    expect(JSON.stringify(result)).not.toContain(submittedValue);
  });

  it("rejects malformed IDs, action codes, results, and non-UTC time", () => {
    expect(
      createSafeEvent({
        ...safeInput,
        correlationId: "not-a-uuid",
        actionCode: "Identity Sign In",
        result: "maybe",
        occurredAt: "2026-08-25T12:00:00+07:00",
      }),
    ).toEqual({ success: false });
  });
});
