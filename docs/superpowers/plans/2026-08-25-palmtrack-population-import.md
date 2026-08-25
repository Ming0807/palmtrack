# PalmTrack Population Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ส่งมอบ FR-02 เป็น vertical slice ที่ให้ `admin` และ `research_manager` ตรวจ CSV สังเคราะห์ นำเข้าแบบ atomic และรับ immutable population snapshot ผ่าน production UI โดยมี RLS/audit/test ครบ

**Architecture:** เพิ่ม bounded module `research/population` ใน Next.js modular monolith Pure domain parser สร้าง canonical rows และ SHA-256 digest; server action ตรวจ verified session แล้วเรียก Supabase RPC; PostgreSQL transaction owner บังคับ exact role, single workspace, duplicate/idempotency, immutability และ audit UI สืบทอด evidence-route visual system และไม่เชื่อม hosted Supabase ในรอบนี้

**Tech Stack:** Next.js 16.3.2 App Router, React 19.2.8, TypeScript 5.9.3, Zod 4.4.3, Supabase SSR/PostgreSQL 17/RLS/pgTAP, Vitest/Testing Library, Playwright/axe, CSS Modules

## Global Constraints

- ใช้เฉพาะข้อมูลสังเคราะห์และ schema `synthetic-population-v1`; ห้าม PII, questionnaire, consent, response หรือ sampling implementation
- V1 มี workspace เดียวแต่ root table มี non-null `workspace_id`; ไม่มี tenant selector
- CSV UTF-8 ขนาดสูงสุด `1_048_576` bytes และ header exact `farmer_code,stratum_code,eligible,exclusion_reason_code`
- Persisted metadata ใช้ `source_authorization_ref` รูปแบบ `^SYN-[A-Z0-9_-]{3,40}$` และ eligibility rule exact `synthetic-eligibility-v1`; ทั้งคู่เป็น provenance ของ fixture เท่านั้น ไม่อนุมัติข้อมูลจริง
- `farmer_code` exact `^SYN-[0-9]{3,6}$`; `stratum_code` exact `^[A-Z0-9_-]{1,24}$`
- exclusion allowlist exact `OUT_OF_SCOPE | DUPLICATE_SOURCE | INELIGIBLE_RULE`
- UI ภาษาไทย, 360 px, keyboard, visible focus, live status และ WCAG 2.1 AA; action target อย่างน้อย 44 CSS px
- Authorization บังคับ server/database exact `admin | research_manager`; UI hiding ไม่ใช่ security
- Migration ใหม่ทดสอบ local Docker เท่านั้นและห้าม apply hosted Supabase; ผู้ใช้จะรัน SQL ภายหลัง
- ทุก production behavior ใช้ TDD: test ต้อง fail ด้วยเหตุผลที่คาดก่อนเขียน implementation
- อ่านคู่มือที่เกี่ยวข้องใน `node_modules/next/dist/docs/` หลัง `npm ci` ก่อนแก้ App Router, Server Action หรือ Form code ตาม `AGENTS.md`
- Traceability ที่ slice ต้องบันทึกโดยไม่กล่าวอ้างเกินจริง: `FR-02`, `FR-15`, `NFR-01`, `NFR-03`, `NFR-05`, `NFR-06`, `NFR-08`; evidence IDs `INT-01`, `E2E-02`, `E2E-15`, `SEC-02`, `RLS-09`

---

### Task 1: Pure population CSV contract and digest

**Files:**
- Create: `src/modules/research/population/domain/population-import.ts`
- Create: `src/modules/research/population/domain/population-import.test.ts`
- Create: `src/modules/research/population/domain/fixtures.ts`

**Interfaces:**
- Consumes: UTF-8 bytes only
- Produces: `validatePopulationCsv(input: Uint8Array): Promise<PopulationValidationResult>` and `FX_POPULATION_CSV`

- [ ] **Step 1: Write failing parser and canonicalization tests**

```ts
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
    expect(result.errors).not.toContainEqual(
      expect.objectContaining({ reasonCode: "FILE_TOO_LARGE" }),
    );
  });

  it.each([
    ["SYN-1,NORTH,true,", "farmer_code", "INVALID_FARMER_CODE"],
    ["SYN-001,north,true,", "stratum_code", "INVALID_STRATUM_CODE"],
    ["SYN-001,NORTH,yes,", "eligible", "INVALID_ELIGIBLE"],
    ["SYN-001,NORTH,false,UNAPPROVED", "exclusion_reason_code", "INVALID_EXCLUSION_REASON"],
    ["\"SYN-001\",NORTH,true,", "file", "INVALID_ROW_FORMAT"],
  ])("[INT-01] enforces the exact field allowlists", async (row, fieldCode, reasonCode) => {
    const result = await validatePopulationCsv(bytes(`${POPULATION_HEADER}\n${row}\n`));
    expect(result).toMatchObject({
      status: "invalid",
      errors: [expect.objectContaining({ rowNumber: 1, fieldCode, reasonCode })],
    });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/modules/research/population/domain/population-import.test.ts`

Expected: FAIL because `population-import.ts` and its exports do not exist

- [ ] **Step 3: Implement the strict domain contract**

```ts
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
  fieldCode: "file" | "header" | "farmer_code" | "stratum_code" | "eligible" | "exclusion_reason_code";
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
    if (eligibleText !== "true" && eligibleText !== "false") {
      errors.push({ rowNumber, fieldCode: "eligible", reasonCode: "INVALID_ELIGIBLE" });
    }
    const eligible = eligibleText === "true";
    const reason = reasonText as ExclusionReason;
    if (eligible && reasonText !== "") {
      errors.push({ rowNumber, fieldCode: "exclusion_reason_code", reasonCode: "EXCLUSION_REASON_FORBIDDEN" });
    }
    if (!eligible && reasonText === "") {
      errors.push({ rowNumber, fieldCode: "exclusion_reason_code", reasonCode: "EXCLUSION_REASON_REQUIRED" });
    } else if (!eligible && !allowedReasons.has(reason)) {
      errors.push({ rowNumber, fieldCode: "exclusion_reason_code", reasonCode: "INVALID_EXCLUSION_REASON" });
    }
    if (errors.length === before) {
      rows.push({
        rowNumber,
        farmerCode,
        stratumCode,
        eligible,
        exclusionReasonCode: eligible ? null : reason,
      });
    }
  }

  if (rows.length === 0 && errors.length === 0) return fileError("NO_DATA_ROWS");
  if (errors.length > 0) return { status: "invalid", errors };

  const canonicalText = rows
    .map((row) => [
      row.rowNumber,
      row.farmerCode,
      row.stratumCode,
      row.eligible ? "1" : "0",
      row.exclusionReasonCode ?? "",
    ].join(","))
    .join("\n") + "\n";
  const digestBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalText),
  );
  const digest = Array.from(new Uint8Array(digestBytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const eligible = rows.filter((row) => row.eligible).length;

  return {
    status: "valid",
    rows,
    canonicalText,
    digest,
    counts: { total: rows.length, eligible, excluded: rows.length - eligible },
  };
}
```

`fixtures.ts` exports exactly three rows shown in the test and never names a person or location smaller than a synthetic stratum code

```ts
export const FX_POPULATION_CSV = [
  "farmer_code,stratum_code,eligible,exclusion_reason_code",
  "SYN-001,NORTH,true,",
  "SYN-002,SOUTH,true,",
  "SYN-003,SOUTH,false,OUT_OF_SCOPE",
  "",
].join("\n");
```

- [ ] **Step 4: Run domain tests and confirm GREEN**

Run: `npm test -- src/modules/research/population/domain/population-import.test.ts`

Expected: PASS for valid fixture, BOM/CRLF equivalence, file/header/row errors, size boundary, duplicate, allowlists and digest stability

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/modules/research/population/domain
git commit -m "feat: validate synthetic population imports"
```

---

### Task 2: Population schema, transactional RPC, RLS and audit

**Files:**
- Create: `supabase/migrations/202608250002_population_import.sql`
- Create: `supabase/tests/database/002_population_import.test.sql`
- Create: `supabase/rollback/202608250002_population_import_rollback.sql`
- Modify: `package.json`

**Interfaces:**
- Consumes: `jsonb` rows matching `PopulationRow`, lowercase SHA-256 digest, exact schema version
- Produces: `public.create_population_import(text,text,date,text,text,text,jsonb,uuid)`, `public.accept_population_import(uuid)` and `public.list_population_imports()` returning the same safe receipt projection including creator/acceptor profile IDs

- [ ] **Step 1: Write pgTAP RED tests for catalog, role matrix and atomic lifecycle**

Add a top-level `plan(...)` and assertions that prove:

Every pgTAP description begins with one stable ID from `[INT-01]`, `[RLS-09]` or `[SEC-02]`; no anonymous assertion label is allowed.

```sql
select has_table('public', 'population_import');
select has_table('public', 'population_member');
select has_function('public', 'create_population_import', array['text','text','date','text','text','text','jsonb','uuid']);
select has_function('public', 'accept_population_import', array['uuid']);
select has_function('public', 'list_population_imports', array[]::text[]);

-- Authenticate synthetic admin and manager separately: valid create + accept.
-- Admin/manager list returns only the current workspace safe projection.
-- Collector/farmer/evaluator/anonymous create, accept and list: exact SQLSTATE 42501.
-- A second synthetic workspace cannot be observed or referenced by an authorized first-workspace caller.
-- Invalid duplicate/digest/count/schema/workspace input: no batch/member/audit remains.
-- Reusing one idempotency UUID returns the original import only for identical input.
-- Forged validated rows carrying accepted_by/accepted_at and accepted rows missing either field fail constraints.
-- Accepted parent/member UPDATE/DELETE/TRUNCATE and direct API insert are denied.
-- Successful create/accept records exact actor/workspace/entity/action/count/digest keys.
```

- [ ] **Step 2: Run pgTAP and confirm RED**

Run: `npx supabase test db supabase/tests/database/002_population_import.test.sql`

Expected: FAIL because the tables and functions do not exist

- [ ] **Step 3: Implement ordered SQL migration**

The migration must, in this order:

```sql
begin;

create type public.population_import_status as enum ('validated', 'accepted');

create table public.population_import (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete restrict,
  source_label text not null check (char_length(btrim(source_label)) between 1 and 120),
  source_authorization_ref text not null check (source_authorization_ref ~ '^SYN-[A-Z0-9_-]{3,40}$'),
  reference_date date not null,
  schema_version text not null check (schema_version = 'synthetic-population-v1'),
  eligibility_rule_version text not null check (eligibility_rule_version = 'synthetic-eligibility-v1'),
  input_digest text not null check (input_digest ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid not null,
  total_count integer not null check (total_count > 0),
  eligible_count integer not null check (eligible_count between 0 and total_count),
  excluded_count integer not null check (excluded_count = total_count - eligible_count),
  status public.population_import_status not null default 'validated',
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  accepted_by uuid,
  accepted_at timestamptz,
  unique (workspace_id, idempotency_key),
  unique (id, workspace_id),
  foreign key (created_by, workspace_id) references public.user_profile(id, workspace_id),
  foreign key (accepted_by, workspace_id) references public.user_profile(id, workspace_id),
  check (
    (status = 'validated' and accepted_by is null and accepted_at is null)
    or
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
  )
);

create table public.population_member (
  id uuid primary key default gen_random_uuid(),
  population_import_id uuid not null,
  workspace_id uuid not null,
  row_number integer not null check (row_number > 0),
  farmer_code text not null check (farmer_code ~ '^SYN-[0-9]{3,6}$'),
  stratum_code text not null check (stratum_code ~ '^[A-Z0-9_-]{1,24}$'),
  eligible boolean not null,
  exclusion_reason_code text check (exclusion_reason_code in ('OUT_OF_SCOPE','DUPLICATE_SOURCE','INELIGIBLE_RULE')),
  foreign key (population_import_id, workspace_id)
    references public.population_import(id, workspace_id) on delete restrict,
  unique (population_import_id, row_number),
  unique (population_import_id, farmer_code),
  check ((eligible and exclusion_reason_code is null) or (not eligible and exclusion_reason_code is not null))
);
```

Then enable/force RLS, revoke public/anon/authenticated/service-role table access, grant table operations only to `palmtrack_transaction_owner`, add owner-only policies, and create mutation guards. The parent guard permits exactly one update shape: old status `validated`, new status `accepted`, all immutable columns byte-for-byte equal, and only `status`, `accepted_by`, `accepted_at` changing to valid acceptance values. Every other parent update and every member update/delete/truncate raises `42501`; accepted rows cannot transition again. Extend `private.append_audit_event` allowlists before owner transfer with exact actions and values:

```text
population.import_created -> before_status='none', after_status='validated', total_count, eligible_count, excluded_count, input_digest, schema_version, eligibility_rule_version, source_authorization_ref_digest
population.import_accepted -> before_status='validated', after_status='accepted', total_count, eligible_count, excluded_count, input_digest, schema_version, eligibility_rule_version, source_authorization_ref_digest
```

`create_population_import` must derive actor/workspace/role through existing helpers, require exact role `admin|research_manager`, lock on idempotency key, validate every JSON type/value/count/digest using `extensions.digest(convert_to(canonical_text,'UTF8'),'sha256')`, validate provenance fields, insert parent/members and audit atomically, and return an existing ID only when every immutable input matches. `accept_population_import` repeats exact role/workspace checks, locks the row, permits `validated→accepted` once, and is idempotent for the same accepted row. `list_population_imports` repeats exact role/workspace checks and returns the safe projection only; it never accepts a caller-supplied workspace. Revoke every function from broad roles, grant only `authenticated`, then alter owner to `palmtrack_transaction_owner`.

- [ ] **Step 4: Reset local database and confirm GREEN**

Run: `npx supabase db reset --local`

Run: `npx supabase test db`

Run: `npx supabase db lint --local --schema public --schema private`

Expected: both migrations apply; Safety Skeleton 55 assertions remain green; population suite passes with exact planned count; lint reports no schema error

- [ ] **Step 5: Rehearse compensating rollback on a disposable local database**

`supabase/rollback/202608250002_population_import_rollback.sql` must revoke/drop the three public RPCs and new trigger functions, drop `population_member`, drop `population_import`, drop `population_import_status`, and restore the exact pre-002 `private.append_audit_event` definition/ACL/owner from migration 001. It stays outside `supabase/tests/` because the CLI treats every SQL file below that directory as pgTAP. The script begins with a guard that refuses execution unless both new tables exist. The PowerShell/Docker wrapper resolves the Supabase local database container from `docker ps`, validates the project label equals `palmtrack`, and pipes the script only to that container; it never accepts a URL or remote host.

Run the rollback through `docker exec -i` against the local database, run the 55 Safety Skeleton pgTAP assertions, then run `npx supabase db reset --local` and the complete database suite again. Expected: rollback leaves 001 functional, reset reapplies 002, and both suites pass. Never run the compensating script against hosted Supabase.

- [ ] **Step 6: Add repeatable database scripts and commit Task 2**

```json
{
  "scripts": {
    "test:db": "supabase test db",
    "lint:db": "supabase db lint --local --schema public --schema private"
  }
}
```

```powershell
git add package.json package-lock.json supabase/migrations/202608250002_population_import.sql supabase/tests/database/002_population_import.test.sql supabase/rollback/202608250002_population_import_rollback.sql
git commit -m "feat: persist immutable population imports"
```

---

### Task 3: Authorized population application service

**Files:**
- Create: `src/modules/research/population/server/population-service.ts`
- Create: `src/modules/research/population/server/population-service.test.ts`
- Create: `src/modules/research/population/server/population-gateway.ts`
- Create: `src/modules/research/population/server/population-gateway.test.ts`
- Create: `src/modules/research/population/server/actions.ts`
- Create: `src/modules/research/population/server/actions.test.ts`

**Interfaces:**
- Consumes: `IdentitySession`, `File`, metadata and gateway RPC adapter
- Produces: non-throwing `PopulationActionState` safe for UI and `listPopulationImports()`

```ts
export type PopulationReceipt = {
  id: string;
  sourceLabel: string;
  sourceAuthorizationRef: string;
  referenceDate: string;
  schemaVersion: typeof POPULATION_SCHEMA_VERSION;
  eligibilityRuleVersion: "synthetic-eligibility-v1";
  inputDigest: string;
  totalCount: number;
  eligibleCount: number;
  excludedCount: number;
  status: "validated" | "accepted";
  createdByProfileId: string;
  createdAt: string;
  acceptedByProfileId: string | null;
  acceptedAt: string | null;
};

export type PopulationActionState =
  | { status: "idle" }
  | { status: "invalid"; errors: PopulationValidationError[] }
  | { status: "forbidden" }
  | { status: "conflict" }
  | { status: "service_unavailable" }
  | { status: "validated"; importId: string; receipt: PopulationReceipt }
  | { status: "accepted"; importId: string; receipt: PopulationReceipt };

export type PopulationListState =
  | { status: "ready"; imports: PopulationReceipt[] }
  | { status: "forbidden" }
  | { status: "service_unavailable" };
```

- [ ] **Step 1: Write RED tests for exact roles, validation and safe errors**

```ts
it.each(["admin", "research_manager"])("[INT-01] allows %s through the gateway", async (role) => {
  const result = await createPopulationImport(validInput, depsFor(role));
  expect(result).toMatchObject({ status: "validated" });
});

it.each(["field_collector", "farmer", "evaluator_readonly"])("[RLS-09] denies %s before gateway access", async (role) => {
  const deps = depsFor(role);
  expect(await createPopulationImport(validInput, deps)).toEqual({ status: "forbidden" });
  expect(deps.gateway.create).not.toHaveBeenCalled();
});
```

Also test invalid file never calls RPC, metadata uses strict Zod schema, provider errors map to `conflict` only for known duplicate/idempotency codes and otherwise `service_unavailable`, and no returned state contains provider message, Auth UID, connection value or raw CSV

`actions.test.ts` must exercise these exact exported signatures with injected service dependencies before the production wrappers bind real session/client creation:

```ts
export async function createPopulationImportAction(
  previous: PopulationActionState,
  formData: FormData,
): Promise<PopulationActionState>;
export async function acceptPopulationImportAction(
  previous: PopulationActionState,
  formData: FormData,
): Promise<PopulationActionState>;

it("[SEC-02] rejects a non-File payload before reading bytes", async () => {
  const form = new FormData();
  form.set("file", "not-a-file");
  expect(await createPopulationImportAction({ status: "idle" }, form)).toMatchObject({
    status: "invalid",
    errors: [expect.objectContaining({ reasonCode: "FILE_REQUIRED" })],
  });
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/modules/research/population/server`

Expected: FAIL because service/actions do not exist

- [ ] **Step 3: Implement service boundary and Server Actions**

```ts
export interface PopulationGateway {
  create(input: {
    sourceLabel: string;
    sourceAuthorizationRef: string;
    referenceDate: string;
    schemaVersion: typeof POPULATION_SCHEMA_VERSION;
    eligibilityRuleVersion: "synthetic-eligibility-v1";
    digest: string;
    rows: PopulationRow[];
    idempotencyKey: string;
  }): Promise<PopulationReceipt>;
  accept(importId: string): Promise<PopulationReceipt>;
  list(): Promise<PopulationReceipt[]>;
}

export class PopulationGatewayError extends Error {
  constructor(readonly code: "CONFLICT" | "UNAVAILABLE") {
    super("population gateway failed");
    this.name = "PopulationGatewayError";
  }
}

export function createSupabasePopulationGateway(
  client: Pick<SupabaseClient, "rpc">,
): PopulationGateway;

const metadataSchema = z.object({
  sourceLabel: z.string().trim().min(1).max(120),
  sourceAuthorizationRef: z.string().regex(/^SYN-[A-Z0-9_-]{3,40}$/u),
  referenceDate: z.iso.date(),
  idempotencyKey: z.uuid(),
});

export async function createPopulationImport(
  input: {
    fileBytes: Uint8Array;
    sourceLabel: string;
    sourceAuthorizationRef: string;
    referenceDate: string;
    idempotencyKey: string;
  },
  deps: { session: IdentitySession; gateway: PopulationGateway },
): Promise<PopulationActionState> {
  if (
    deps.session.status !== "authorized" ||
    !["admin", "research_manager"].includes(deps.session.profile.role)
  ) {
    return { status: "forbidden" };
  }
  const metadata = metadataSchema.safeParse(input);
  if (!metadata.success) {
    return {
      status: "invalid",
      errors: [{ rowNumber: null, fieldCode: "file", reasonCode: "INVALID_METADATA" }],
    };
  }
  const validation = await validatePopulationCsv(input.fileBytes);
  if (validation.status === "invalid") return validation;
  try {
    const receipt = await deps.gateway.create({
      sourceLabel: metadata.data.sourceLabel,
      sourceAuthorizationRef: metadata.data.sourceAuthorizationRef,
      referenceDate: metadata.data.referenceDate,
      schemaVersion: POPULATION_SCHEMA_VERSION,
      eligibilityRuleVersion: "synthetic-eligibility-v1",
      digest: validation.digest,
      rows: validation.rows,
      idempotencyKey: metadata.data.idempotencyKey,
    });
    return { status: "validated", importId: receipt.id, receipt };
  } catch (error) {
    return error instanceof PopulationGatewayError && error.code === "CONFLICT"
      ? { status: "conflict" }
      : { status: "service_unavailable" };
  }
}

export async function acceptPopulationImport(
  importId: string,
  deps: { session: IdentitySession; gateway: PopulationGateway },
): Promise<PopulationActionState> {
  if (
    deps.session.status !== "authorized" ||
    !["admin", "research_manager"].includes(deps.session.profile.role)
  ) return { status: "forbidden" };
  if (!z.uuid().safeParse(importId).success) {
    return { status: "conflict" };
  }
  try {
    const receipt = await deps.gateway.accept(importId);
    return { status: "accepted", importId: receipt.id, receipt };
  } catch (error) {
    return error instanceof PopulationGatewayError && error.code === "CONFLICT"
      ? { status: "conflict" }
      : { status: "service_unavailable" };
  }
}

export async function listPopulationImports(
  deps: { session: IdentitySession; gateway: PopulationGateway },
): Promise<PopulationListState> {
  if (
    deps.session.status !== "authorized" ||
    !["admin", "research_manager"].includes(deps.session.profile.role)
  ) return { status: "forbidden" };
  try {
    return { status: "ready", imports: await deps.gateway.list() };
  } catch {
    return { status: "service_unavailable" };
  }
}
```

`actions.ts` begins with `"use server"`, resolves session again for every mutation, accepts `FormData`, rejects non-`File`, converts only after size guard, creates no synthetic/fallback identity, calls the service and invokes `revalidatePath("/app/research/population")` only after success. Do not log provider error objects.

- [ ] **Step 4: Run service/action tests and confirm GREEN**

`population-gateway.ts` owns the only RPC mapping. It validates every returned row with Zod and maps snake case to `PopulationReceipt`:

```ts
const receiptRowSchema = z.object({
  id: z.uuid(),
  source_label: z.string().min(1).max(120),
  source_authorization_ref: z.string().regex(/^SYN-[A-Z0-9_-]{3,40}$/u),
  reference_date: z.iso.date(),
  schema_version: z.literal("synthetic-population-v1"),
  eligibility_rule_version: z.literal("synthetic-eligibility-v1"),
  input_digest: z.string().regex(/^[0-9a-f]{64}$/u),
  total_count: z.number().int().positive(),
  eligible_count: z.number().int().nonnegative(),
  excluded_count: z.number().int().nonnegative(),
  status: z.enum(["validated", "accepted"]),
  created_by_profile_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  accepted_by_profile_id: z.uuid().nullable(),
  accepted_at: z.iso.datetime({ offset: true }).nullable(),
});

function mapReceipt(row: z.infer<typeof receiptRowSchema>): PopulationReceipt {
  return {
    id: row.id,
    sourceLabel: row.source_label,
    sourceAuthorizationRef: row.source_authorization_ref,
    referenceDate: row.reference_date,
    schemaVersion: row.schema_version,
    eligibilityRuleVersion: row.eligibility_rule_version,
    inputDigest: row.input_digest,
    totalCount: row.total_count,
    eligibleCount: row.eligible_count,
    excludedCount: row.excluded_count,
    status: row.status,
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
    acceptedByProfileId: row.accepted_by_profile_id,
    acceptedAt: row.accepted_at,
  };
}

function rpcError(error: { code?: string } | null): never {
  throw new PopulationGatewayError(
    error?.code === "23505" || error?.code === "40001" ? "CONFLICT" : "UNAVAILABLE",
  );
}

export function createSupabasePopulationGateway(
  client: Pick<SupabaseClient, "rpc">,
): PopulationGateway {
  return {
    async create(input) {
      const response = await client.rpc("create_population_import", {
        p_source_label: input.sourceLabel,
        p_source_authorization_ref: input.sourceAuthorizationRef,
        p_reference_date: input.referenceDate,
        p_schema_version: input.schemaVersion,
        p_eligibility_rule_version: input.eligibilityRuleVersion,
        p_input_digest: input.digest,
        p_rows: input.rows.map((row) => ({
          row_number: row.rowNumber,
          farmer_code: row.farmerCode,
          stratum_code: row.stratumCode,
          eligible: row.eligible,
          exclusion_reason_code: row.exclusionReasonCode,
        })),
        p_idempotency_key: input.idempotencyKey,
      }).single();
      if (response.error) rpcError(response.error);
      return mapReceipt(receiptRowSchema.parse(response.data));
    },
    async accept(importId) {
      const response = await client.rpc("accept_population_import", {
        p_import_id: importId,
      }).single();
      if (response.error) rpcError(response.error);
      return mapReceipt(receiptRowSchema.parse(response.data));
    },
    async list() {
      const response = await client.rpc("list_population_imports");
      if (response.error) rpcError(response.error);
      return z.array(receiptRowSchema).parse(response.data).map(mapReceipt);
    },
  };
}
```

`population-gateway.test.ts` asserts the exact RPC names/parameters above, snake-to-camel mapping including both actor profile IDs, safe conflict mapping, unavailable mapping and rejection of a malformed provider row. `actions.ts` creates the configured server client, wraps it with `createSupabasePopulationGateway`, and never accesses a table directly.

Run: `npm test -- src/modules/research/population/server`

Expected: PASS with exact role matrix, invalid no-write and sanitized state coverage

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/modules/research/population/server
git commit -m "feat: add authorized population import service"
```

---

### Task 4: Production Thai population-import surface

**Files:**
- Create: `src/app/app/research/page.tsx`
- Create: `src/app/app/research/population/page.tsx`
- Create: `src/modules/research/population/ui/population-import-flow.tsx`
- Create: `src/modules/research/population/ui/population-import-flow.test.tsx`
- Create: `src/modules/research/population/ui/population-import.module.css`
- Modify: `src/modules/navigation/role-navigation.ts`
- Modify: `src/modules/navigation/role-navigation.test.ts`
- Modify: `src/app/app/[section]/page.tsx`

**Interfaces:**
- Consumes: action state and safe `PopulationReceipt[]`
- Produces: `/app/research` landing and `/app/research/population` flow

- [ ] **Step 1: Write RED component and navigation tests**

```tsx
it("[E2E-02] shows the synthetic boundary and evidence-route steps", () => {
  render(<PopulationImportFlow initialImports={[]} createAction={createAction} acceptAction={acceptAction} />);
  expect(screen.getByText("ข้อมูลสังเคราะห์เท่านั้น")).toBeVisible();
  expect(screen.getByRole("heading", { name: "นำเข้าประชากร" })).toBeVisible();
  expect(screen.getByText("เลือกไฟล์")).toBeVisible();
  expect(screen.getByText("ตรวจทั้งชุด")).toBeVisible();
  expect(screen.queryByText(/แบบสอบถาม|ความยินยอม|คำตอบ/u)).not.toBeInTheDocument();
});

it("[SEC-02] renders sanitized errors in a live summary without raw cells", async () => {
  renderInvalidFlow();
  expect(await screen.findByRole("alert")).toHaveTextContent("พบข้อมูลที่ต้องแก้ไข");
  expect(screen.getByText("แถว 2 · farmer_code · DUPLICATE_FARMER_CODE")).toBeVisible();
  expect(screen.queryByText("SYN-001")).not.toBeInTheDocument();
});
```

Add these exact state tests:

```tsx
it("[E2E-02] keeps unavailable future operations out of the action surface", () => {
  renderReadyFlow();
  expect(screen.queryByRole("button", { name: /สร้างการสุ่ม|มอบหมาย|ส่งออก/u })).not.toBeInTheDocument();
});

it.each([
  ["service_unavailable", "ระบบฐานข้อมูลยังไม่พร้อม"],
  ["conflict", "ข้อมูลชุดนี้เปลี่ยนไปแล้ว"],
])("[SEC-02] announces %s without exposing provider detail", (status, copy) => {
  renderActionState({ status });
  expect(screen.getByRole("status")).toHaveTextContent(copy);
  expect(screen.queryByText(/postgres|supabase|sqlstate|auth\.uid/iu)).not.toBeInTheDocument();
});

it("[SEC-02] offers only the sanitized error CSV projection", async () => {
  renderInvalidFlow();
  const download = await screen.findByRole("link", { name: "ดาวน์โหลดรายการที่ต้องแก้" });
  expect(download).toHaveAttribute("download", "population-import-errors.csv");
  expect(decodeErrorDownload(download)).toBe(
    "row_number,reason_code,field_code\n2,DUPLICATE_FARMER_CODE,farmer_code\n",
  );
});

it("[E2E-02] shows the fixed synthetic provenance and immutable accepted receipt", () => {
  renderAcceptedFlow();
  expect(screen.getByText("synthetic-eligibility-v1")).toBeVisible();
  expect(screen.getByText("SYN-FX_BASE")).toBeVisible();
  expect(screen.getByLabelText("คัดลอก SHA-256 digest แบบเต็ม")).toBeEnabled();
  expect(screen.getByText(/ผู้รับ snapshot · โปรไฟล์ [0-9a-f]{8}/u)).toBeVisible();
  expect(screen.getByText(/25 ส\.ค\. 2569.*เวลาไทย/u)).toBeVisible();
  expect(screen.queryByRole("button", { name: /แก้ไข snapshot/u })).not.toBeInTheDocument();
});
```

Navigation tests assert both authorized roles receive `/app/research/population` and all other roles do not. Browser tests in Task 5 own keyboard order, offline request blocking, double-submit behavior, 360 px overflow and axe checks.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/modules/research/population/ui src/modules/navigation/role-navigation.test.ts`

Expected: FAIL because the production flow and navigation target do not exist

- [ ] **Step 3: Implement the established minimal-premium surface**

Use the existing warm paper/charcoal/indigo/rust tokens and Bai Jamjuree/Noto Sans Thai. Structure one ruled evidence sheet rather than KPI cards:

```tsx
<section aria-labelledby="population-title">
  <p>งานวิจัย · ประชากร</p>
  <h1 id="population-title">นำเข้าประชากร</h1>
  <span>ข้อมูลสังเคราะห์เท่านั้น</span>
  <ol aria-label="ขั้นตอนนำเข้าประชากร">
    <li>เลือกไฟล์</li>
    <li>ตรวจทั้งชุด</li>
    <li>ยืนยันแหล่งข้อมูล</li>
    <li>รับ snapshot</li>
  </ol>
  <PopulationImportForm
    schemaVersion="synthetic-population-v1"
    eligibilityRuleVersion="synthetic-eligibility-v1"
    action={createPopulationImportAction}
  />
  <ValidationSummary state={state} errorDownload={buildSanitizedErrorCsv(state)} />
  <PopulationReceiptList imports={initialImports} acceptAction={acceptPopulationImportAction} />
</section>
```

The route independently resolves the verified session, authorizes only `admin|research_manager`, renders existing non-enumerating states, and never depends on navigation visibility. Add a manager entry `ประชากร` and an admin entry `นำเข้าประชากร` both targeting `/app/research/population`; keep generic `/app/research` as the manager landing. Remove only the obsolete dynamic fallback branch for the now-concrete route.

- [ ] **Step 4: Run component/navigation tests and confirm GREEN**

Run: `npm test -- src/modules/research/population/ui src/modules/navigation/role-navigation.test.ts`

Expected: PASS for idle/invalid/submitting/accepted/forbidden states and both authorized navigation projections

- [ ] **Step 5: Run Impeccable mechanical detector once after UI is complete**

Run: `node C:\Users\NOTEBOOK\.agents\skills\impeccable\scripts\detect.mjs --json src/app/app/research src/modules/research/population/ui src/modules/navigation/role-navigation.ts`

Expected: JSON output reviewed; fix all mechanical accessibility/responsive/design-system violations in one batch and do not run the detector a second time

- [ ] **Step 6: Commit Task 4**

```powershell
git add src/app/app/research src/app/app/[section]/page.tsx src/modules/research/population/ui src/modules/navigation
git commit -m "feat: add population import experience"
```

---

### Task 5: Authenticated local browser evidence and visual QA

**Files:**
- Create: `e2e/population-import.spec.ts`
- Create: `e2e/support/local-supabase.ts`
- Create: `e2e/fixtures/population-valid.csv`
- Create: `e2e/fixtures/population-invalid-duplicate.csv`
- Create: `playwright.local.config.ts`
- Create: `scripts/run-local-e2e.mjs`
- Modify: `package.json`
- Create: `docs/assets/population-import/README.md`
- Create after capture: `docs/assets/population-import/mobile.png`
- Create after capture: `docs/assets/population-import/desktop.png`

**Interfaces:**
- Consumes: running local Supabase only
- Produces: `npm run test:e2e:local` which fails closed unless Supabase URL is loopback and seeds synthetic Auth users without committed credentials

```ts
export type LocalE2ERole = "admin" | "research_manager" | "field_collector" | "farmer" | "evaluator_readonly";
export async function signInAs(page: Page, role: LocalE2ERole): Promise<void>;
export async function completeValidPopulationImport(page: Page, fixturePath: string): Promise<void>;
export async function fillValidPopulationForm(page: Page, fixturePath: string): Promise<void>;
export async function submitSyntheticMetadata(page: Page): Promise<void>;
export async function databaseImportCount(): Promise<number>;
export const validFixturePath: string;
export const duplicateFixturePath: string;
```

`e2e/fixtures/population-valid.csv` contains the exact `FX_POPULATION_CSV` bytes from Task 1 so browser and domain tests share the same reviewed three synthetic codes. `population-invalid-duplicate.csv` repeats `SYN-001` in a second row and contains no additional field.

- [ ] **Step 1: Write RED E2E journey**

```ts
test("[E2E-02] research manager validates and accepts a synthetic population", async ({ page }) => {
  await signInAs(page, "research_manager");
  await page.goto("/app/research/population");
  await expect(page.getByText("ข้อมูลสังเคราะห์เท่านั้น")).toBeVisible();
  await page.getByLabel("ไฟล์ประชากร CSV").setInputFiles(validFixturePath);
  await page.getByLabel("แหล่งข้อมูล").fill("ชุดทดสอบ FX-BASE");
  await page.getByLabel("หลักฐานอนุญาตแหล่งข้อมูล").fill("SYN-FX_BASE");
  await page.getByLabel("วันที่อ้างอิง").fill("2026-08-25");
  await page.getByRole("button", { name: "ตรวจและนำเข้า" }).click();
  await expect(page.getByText("ตรวจผ่านทั้งชุด")).toBeVisible();
  await page.getByRole("button", { name: "รับ snapshot" }).click();
  await expect(page.getByText("snapshot ถูกล็อกแล้ว")).toBeVisible();
});

test("[E2E-15] admin uses the same audited import path", async ({ page }) => {
  await signInAs(page, "admin");
  await completeValidPopulationImport(page, validFixturePath);
  await expect(page.getByText("snapshot ถูกล็อกแล้ว")).toBeVisible();
});

for (const role of ["field_collector", "farmer", "evaluator_readonly"] as const) {
  test(`[RLS-09] ${role} receives a non-enumerating forbidden state`, async ({ page }) => {
    await signInAs(page, role);
    await page.goto("/app/research/population");
    await expect(page.getByRole("heading", { name: "ไม่สามารถเปิดหน้านี้ได้" })).toBeVisible();
    await expect(page.getByText(/population|snapshot|นำเข้าประชากร/iu)).toHaveCount(0);
  });
}

test("[SEC-02] invalid duplicate file writes nothing and exposes no raw cell", async ({ page }) => {
  await signInAs(page, "research_manager");
  const before = await databaseImportCount();
  await page.goto("/app/research/population");
  await page.getByLabel("ไฟล์ประชากร CSV").setInputFiles(duplicateFixturePath);
  await submitSyntheticMetadata(page);
  await expect(page.getByRole("alert")).toContainText("DUPLICATE_FARMER_CODE");
  await expect(page.getByRole("alert")).not.toContainText("SYN-001");
  expect(await databaseImportCount()).toBe(before);
});

test("[INT-01] double submission keeps one idempotent import", async ({ page }) => {
  await signInAs(page, "research_manager");
  await page.goto("/app/research/population");
  await fillValidPopulationForm(page, validFixturePath);
  const submit = page.getByRole("button", { name: "ตรวจและนำเข้า" });
  await submit.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText("ตรวจผ่านทั้งชุด")).toBeVisible();
  expect(await databaseImportCount()).toBe(1);
});

test("[E2E-02][A11Y-01][A11Y-02] mobile flow is keyboard-safe, offline-safe and accessible", async ({ page, context }) => {
  await signInAs(page, "research_manager");
  await page.goto("/app/research/population");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  await context.setOffline(true);
  await fillValidPopulationForm(page, validFixturePath);
  await page.getByRole("button", { name: "ตรวจและนำเข้า" }).click();
  await expect(page.getByRole("status")).toContainText("ออฟไลน์");
  expect(await databaseImportCount()).toBe(0);
  await context.setOffline(false);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
```

- [ ] **Step 2: Run local E2E and confirm RED**

Run: `npm run test:e2e:local -- e2e/population-import.spec.ts`

Expected: FAIL because local harness/support/config do not exist

- [ ] **Step 3: Implement fail-closed local harness**

`scripts/run-local-e2e.mjs` runs `supabase status -o env`, parses values without printing them, verifies `API_URL` host is `127.0.0.1|localhost`, injects the local public URL/key into the Next web server and passes the local service key only to Playwright global setup under `PALMTRACK_E2E_LOCAL_SERVICE_KEY`; it refuses any hosted `supabase.co` URL and removes that key from `webServer.env`. Global setup begins with `npx supabase db reset --local`, then `e2e/support/local-supabase.ts` creates random per-run synthetic emails/passwords through local Admin API, resolves the local database container name from `docker ps`, and pipes parameterized SQL to `docker exec -i <container> psql` as the out-of-band local operator. It invokes `private.bootstrap_workspace` under `palmtrack_recovery_executor` for the first admin, then inserts the remaining synthetic profiles into that workspace. Global teardown runs one more `npx supabase db reset --local`, removing test imports, audit actors, profiles and Auth users together without violating append-only foreign keys; it never issues individual profile or audit deletes. The helper rejects a non-local container/project label and never commits or prints generated credentials. No test-only database function ships in the migration.

Add the exact package entry:

```json
{
  "scripts": {
    "test:e2e:local": "node scripts/run-local-e2e.mjs"
  }
}
```

`playwright.local.config.ts` uses a separate port, `workers: 1`, explicit local env and production `/app` health path; it must not inherit `DATABASE_URL`, `DIRECT_URL`, hosted Supabase values or common secret variables into browser output.

- [ ] **Step 4: Run local E2E and capture bounded visual evidence**

Run: `npm run test:e2e:local -- e2e/population-import.spec.ts`

Expected: authorized journeys and security negatives pass; 360 px and desktop have no overflow or serious/critical axe findings

Capture exactly one ready/accepted mobile screenshot and one desktop screenshot after settling motion. Open each image once to verify it is nonblank, correctly named and contains only synthetic codes. Record viewport, commit, route and synthetic fixture digest in `docs/assets/population-import/README.md`.

- [ ] **Step 5: Commit Task 5**

```powershell
git add e2e/population-import.spec.ts e2e/support/local-supabase.ts e2e/fixtures/population-valid.csv e2e/fixtures/population-invalid-duplicate.csv playwright.local.config.ts scripts/run-local-e2e.mjs package.json package-lock.json docs/assets/population-import
git commit -m "test: verify population import end to end"
```

---

### Task 6: Traceability, incident ledger and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/TRACEABILITY_MATRIX.md`
- Modify: `docs/DEPLOYMENT_RUNBOOK.md`
- Modify: `docs/INDEX.md`
- Modify: `LOG.md`

**Interfaces:**
- Consumes: actual test counts and commit/migration evidence only
- Produces: accurate status boundary; no claim that sampling or hosted migration is complete

- [ ] **Step 1: Update evidence status without changing authoritative requirements**

Add a `Population Import evidence status — 2026-08-25` section mapping FR-02 and relevant NFRs to actual domain/pgTAP/component/local-E2E evidence. Roadmap marks only the population-import tracer bullet complete inside increment 2 and leaves deterministic sampling pending. README states migration `202608250002` is local-only and must be user-applied to hosted later. Deployment runbook requires checking `supabase migration list` and applying pending versions once through `supabase db push`/migration tooling; it explicitly warns that pasting an already-recorded ordered migration into SQL Editor produces duplicate-object errors and must not be repaired by dropping existing relations.

Confirm sanitized incidents `DEV-20260825-039` and `DEV-20260825-040` retain the observed evidence: the amended design commit after a trailing-blank warning, and hosted SQL Editor `42P07` after migration `202608250001` was run again despite matching local/remote history. Update only their resolution/related-commit fields when implementation evidence exists. Ordered migrations are applied once through migration tooling rather than pasted repeatedly into SQL Editor. Do not include environment values, Auth credentials, raw CSV or provider identifiers.

- [ ] **Step 2: Run complete local verification fresh**

Run in this order and retain counts:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:e2e:local -- e2e/population-import.spec.ts
npm run test:db
npm run lint:db
npm audit --audit-level=high
git diff --check
```

Expected: every command exits 0; generic Playwright remains isolated/unconfigured, local Playwright uses loopback Supabase only, both pgTAP suites pass and audit reports zero high vulnerabilities

- [ ] **Step 3: Run documentation and secret gates**

Verify all tracked Markdown relative links resolve; no unfinished marker or filler instruction remains; every configured `.env.local` value is absent from tracked files; no generated test credential, real PII, service key, database password or hosted connection appears in Git; `docs/INDEX.md` links the spec, plan and evidence index.

Run this repository-native PowerShell gate; expected output is three `PASS` lines and exit 0:

```powershell
$ErrorActionPreference = 'Stop'
$tracked = @(git ls-files)
$configured = @{}
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([A-Z0-9_]+)=(.*)$') {
    $value = $matches[2].Trim('"')
    if ($value.Length -ge 12) { $configured[$matches[1]] = $value }
  }
}
foreach ($entry in $configured.GetEnumerator()) {
  foreach ($file in $tracked) {
    if ((Test-Path -LiteralPath $file -PathType Leaf) -and
        [IO.File]::ReadAllText((Resolve-Path $file)).Contains($entry.Value)) {
      throw "configured value tracked under $($entry.Name)"
    }
  }
}
'Configured-value scan: PASS'

$broken = @()
foreach ($file in @(git ls-files '*.md')) {
  $full = (Resolve-Path $file).Path
  foreach ($match in [regex]::Matches([IO.File]::ReadAllText($full), '\[[^\]]+\]\(([^)]+)\)')) {
    $target = ($match.Groups[1].Value -split '#', 2)[0]
    if ($target -and $target -notmatch '^(https?://|mailto:)') {
      $resolved = Join-Path (Split-Path $full -Parent) ([Uri]::UnescapeDataString($target.Trim('<>')))
      if (-not (Test-Path -LiteralPath $resolved)) { $broken += "$file -> $target" }
    }
  }
}
if ($broken.Count) { throw ($broken -join '; ') }
'Markdown links: PASS'

$forbiddenMarkers = @(
  -join ([char[]](84,66,68)),
  -join ([char[]](84,79,68,79)),
  -join ([char[]](112,108,97,99,101,104,111,108,100,101,114))
)
foreach ($marker in $forbiddenMarkers) {
  $hits = @(rg -n -i "\b$marker\b" --glob '*.md')
  if ($LASTEXITCODE -notin 0,1) { throw 'marker scan failed' }
  if ($hits.Count) { throw ($hits -join '; ') }
}
'Documentation markers: PASS'
```

- [ ] **Step 4: Request task and whole-branch reviews**

Use Luna-only review agents through the `superpowers:subagent-driven-development` workflow. Before each implementer dispatch run:

```powershell
$taskNumber = 1 # set to the task currently entering its implementer gate
& 'C:/Program Files/Git/bin/bash.exe' C:/Users/NOTEBOOK/.agents/skills/superpowers/subagent-driven-development/scripts/task-brief docs/superpowers/plans/2026-08-25-palmtrack-population-import.md $taskNumber
```

Before each task review and the final review run:

```powershell
$taskBaseCommit = git rev-parse HEAD~1
& 'C:/Program Files/Git/bin/bash.exe' C:/Users/NOTEBOOK/.agents/skills/superpowers/subagent-driven-development/scripts/review-package $taskBaseCommit HEAD
```

Pass the generated brief/report/review-package paths to a fresh Luna reviewer. Every task review returns both spec-compliance and code-quality verdicts. The final reviewer uses `C:/Users/NOTEBOOK/.agents/skills/superpowers/requesting-code-review/code-reviewer.md` and checks role/RLS/atomicity/audit/env isolation/UI/a11y/traceability. Fix every Critical/Important finding with named covering tests and re-review before proceeding.

- [ ] **Step 5: Commit documentation and finish branch**

```powershell
git add README.md docs LOG.md
git commit -m "docs: record population import evidence"
git status --short
git log --oneline --decorate -8
```

Expected: clean feature worktree. Fast-forward `main` only after final verification/review; do not push GitHub and do not apply hosted SQL.
