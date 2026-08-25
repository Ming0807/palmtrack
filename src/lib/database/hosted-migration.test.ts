import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250001_safety_skeleton.sql",
  ),
  "utf8",
);

describe("Supabase hosted migration compatibility", () => {
  it("does not ask the non-superuser migration role to alter superuser-only attributes", () => {
    const alterRoleStatements = migration.match(/alter role[\s\S]*?;/gi) ?? [];

    expect(alterRoleStatements).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\b(?:no)?superuser\b/i),
        expect.stringMatching(/\b(?:no)?replication\b/i),
        expect.stringMatching(/\b(?:no)?bypassrls\b/i),
      ]),
    );
  });

  it("fails closed when a pre-existing internal role has privileged attributes", () => {
    expect(migration).toMatch(/rolsuper[\s\S]*rolreplication[\s\S]*rolbypassrls/i);
    expect(migration).toContain(
      "PalmTrack internal role has unsafe provider-managed attributes",
    );
  });

  it("retains only the controlled operator membership needed for function ownership", () => {
    expect(migration).toMatch(
      /grant %I to %I with admin false, inherit false, set true/i,
    );
    expect(migration).toContain(
      "PalmTrack internal role has an unsafe membership",
    );
  });
});
