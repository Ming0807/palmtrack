import { spawnSync } from "node:child_process";
import path from "node:path";

const npxCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const runNpx = (args, options = {}) => spawnSync(process.execPath, [npxCli, ...args], options);
const status = runNpx(["supabase", "status", "-o", "env"], {
  encoding: "utf8",
});
if (status.status !== 0) throw new Error("Supabase local is not running");

const values = Object.fromEntries(
  status.stdout
    .split(/\r?\n/u)
    .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const apiUrl = values.API_URL;
const anonKey = values.ANON_KEY;
const serviceKey = values.SERVICE_ROLE_KEY;
if (!apiUrl || !anonKey || !serviceKey) throw new Error("Supabase local status is incomplete");
const parsed = new URL(apiUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.hostname.endsWith("supabase.co")) {
  throw new Error("Refusing non-local Supabase E2E target");
}

const environment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) =>
    !name.startsWith("SUPABASE_") &&
    !name.startsWith("NEXT_PUBLIC_SUPABASE_") &&
    !["DATABASE_URL", "DIRECT_URL"].includes(name) &&
    !/(?:^|_)(?:PASSWORD|TOKEN|PRIVATE_KEY)(?:$|_)/iu.test(name),
  ),
);
Object.assign(environment, {
  PALMTRACK_E2E_LOCAL_API_URL: apiUrl,
  PALMTRACK_E2E_LOCAL_ANON_KEY: anonKey,
  PALMTRACK_E2E_LOCAL_SERVICE_KEY: serviceKey,
});

const args = ["playwright", "test", "--config", "playwright.local.config.ts", ...process.argv.slice(2)];
const result = runNpx(args, { env: environment, stdio: "inherit" });
process.exit(result.status ?? 1);
