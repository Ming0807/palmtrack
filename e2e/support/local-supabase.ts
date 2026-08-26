import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export type LocalE2ERole =
  | "admin"
  | "research_manager"
  | "field_collector"
  | "farmer"
  | "evaluator_readonly";

type Credential = { email: string; password: string };
type CredentialMap = Record<LocalE2ERole, Credential>;

export const validFixturePath = path.resolve("e2e/fixtures/population-valid.csv");
export const samplingFixturePath = path.resolve("e2e/fixtures/population-acceptance-121.csv");
export const duplicateFixturePath = path.resolve(
  "e2e/fixtures/population-invalid-duplicate.csv",
);

const npxCli = path.join(
  path.dirname(process.execPath),
  "node_modules",
  "npm",
  "bin",
  "npx-cli.js",
);

function runNpx(args: string[]): void {
  execFileSync(process.execPath, [npxCli, ...args], { stdio: "ignore" });
}

function localApiUrl(): string {
  const value = process.env.PALMTRACK_E2E_LOCAL_API_URL;
  if (!value) throw new Error("local E2E API URL is missing");
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("local E2E refuses a non-loopback API URL");
  }
  return value;
}

function localContainer(): string {
  const expectedName = "supabase_db_palmtrack";
  const output = execFileSync(
    "docker",
    ["ps", "--filter", `name=^/${expectedName}$`, "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
  const names = output.split(/\r?\n/u).filter(Boolean);
  if (names.length !== 1 || names[0] !== expectedName) {
    throw new Error("PalmTrack local database container was not uniquely resolved");
  }
  const label = execFileSync(
    "docker",
    ["inspect", "--format", '{{ index .Config.Labels "com.supabase.cli.project" }}', expectedName],
    { encoding: "utf8" },
  ).trim();
  if (label !== "palmtrack") throw new Error("local database project label is invalid");
  return expectedName;
}

function runPsql(sql: string, variables: Record<string, string> = {}): string {
  const args = ["exec", "-i", localContainer(), "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
  for (const [name, value] of Object.entries(variables)) args.push("-v", `${name}=${value}`);
  const result = spawnSync("docker", args, { input: sql, encoding: "utf8" });
  if (result.status !== 0) {
    const safeDetail = result.stderr
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/giu, "[synthetic-id]")
      .replace(/palmtrack-[^\s@]+@example\.invalid/giu, "[synthetic-email]")
      .trim()
      .slice(0, 600);
    throw new Error(`local database setup failed: ${safeDetail}`);
  }
  return result.stdout.trim();
}

function credentials(): CredentialMap {
  const raw = process.env.PALMTRACK_E2E_CREDENTIALS;
  if (!raw) throw new Error("local E2E credentials are unavailable");
  return JSON.parse(raw) as CredentialMap;
}

export async function setupLocalSupabase(): Promise<void> {
  localApiUrl();
  runNpx(["supabase", "db", "reset", "--local"]);
  const serviceKey = process.env.PALMTRACK_E2E_LOCAL_SERVICE_KEY;
  if (!serviceKey) throw new Error("local E2E service key is missing");
  const admin = createClient(localApiUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runId = randomBytes(7).toString("hex");
  const roles: LocalE2ERole[] = [
    "admin",
    "research_manager",
    "field_collector",
    "farmer",
    "evaluator_readonly",
  ];
  const users = {} as Record<LocalE2ERole, { id: string; credential: Credential }>;
  for (const role of roles) {
    const credential = {
      email: `palmtrack-${role}-${runId}@example.invalid`,
      password: `${randomBytes(18).toString("base64url")}Aa1!`,
    };
    const response = await admin.auth.admin.createUser({
      ...credential,
      email_confirm: true,
    });
    if (response.error || !response.data.user) {
      throw new Error("local synthetic Auth user setup failed");
    }
    users[role] = { id: response.data.user.id, credential };
  }

  runPsql(
    String.raw`begin;
set local role palmtrack_recovery_executor;
select private.bootstrap_workspace('PalmTrack synthetic E2E', :'admin_id'::uuid);
reset role;
insert into public.user_profile (auth_user_id, workspace_id, role, status, must_change_password)
select :'manager_id'::uuid, id, 'research_manager'::public.app_role, 'active'::public.record_status, false from public.workspace where status = 'active'
union all select :'collector_id'::uuid, id, 'field_collector'::public.app_role, 'active'::public.record_status, false from public.workspace where status = 'active'
union all select :'farmer_id'::uuid, id, 'farmer'::public.app_role, 'active'::public.record_status, false from public.workspace where status = 'active'
union all select :'evaluator_id'::uuid, id, 'evaluator_readonly'::public.app_role, 'active'::public.record_status, false from public.workspace where status = 'active';
commit;`,
    {
      admin_id: users.admin.id,
      manager_id: users.research_manager.id,
      collector_id: users.field_collector.id,
      farmer_id: users.farmer.id,
      evaluator_id: users.evaluator_readonly.id,
    },
  );
  process.env.PALMTRACK_E2E_CREDENTIALS = JSON.stringify(
    Object.fromEntries(roles.map((role) => [role, users[role].credential])),
  );
}

export async function teardownLocalSupabase(): Promise<void> {
  runNpx(["supabase", "db", "reset", "--local"]);
}

export async function signInAs(page: Page, role: LocalE2ERole): Promise<void> {
  const credential = credentials()[role];
  await page.goto("/sign-in");
  await page.getByLabel("อีเมล หรือโทรศัพท์รูปแบบ +66").fill(credential.email);
  await page.getByLabel("รหัสผ่าน").fill(credential.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL("**/app");
}

export async function fillValidPopulationForm(page: Page, fixturePath: string): Promise<void> {
  await page.getByLabel("ไฟล์ประชากร CSV").setInputFiles(fixturePath);
  await page.getByLabel("แหล่งข้อมูล", { exact: true }).fill("ชุดทดสอบ FX-BASE");
  await page.getByLabel("หลักฐานอนุญาตแหล่งข้อมูล").fill("SYN-FX_BASE");
  await page.getByLabel("วันที่อ้างอิง").fill("2026-08-25");
}

export async function submitSyntheticMetadata(page: Page): Promise<void> {
  await page.getByLabel("แหล่งข้อมูล", { exact: true }).fill("ชุดทดสอบไม่ผ่าน");
  await page.getByLabel("หลักฐานอนุญาตแหล่งข้อมูล").fill("SYN-FX_BAD");
  await page.getByLabel("วันที่อ้างอิง").fill("2026-08-25");
  await page.getByRole("button", { name: "ตรวจและนำเข้า" }).click();
}

export async function completeValidPopulationImport(page: Page, fixturePath: string): Promise<void> {
  await page.goto("/app/research/population");
  await fillValidPopulationForm(page, fixturePath);
  await page.getByRole("button", { name: "ตรวจและนำเข้า" }).click();
  await page.getByText("ตรวจผ่านทั้งชุด").waitFor();
  const acceptButton = page.getByRole("button", { name: "รับ snapshot" }).first();
  const acceptedElement = await acceptButton.elementHandle();
  await acceptButton.click();
  await acceptedElement?.waitForElementState("hidden");
}

export async function databaseImportCount(): Promise<number> {
  return Number(runPsql("select count(*) from public.population_import;"));
}
