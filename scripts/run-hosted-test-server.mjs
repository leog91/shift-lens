// Disposable fictional hosted database. Never reads a local business profile.
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@libsql/client";
import { hashPassword } from "better-auth/crypto";

const directory = process.env.SHIFT_LENS_HOSTED_E2E_DIR;
if (!directory?.startsWith("/tmp/opencode/shiftlens-hosted-e2e-")) throw new Error("Missing disposable test directory");
const database = createClient({ url: `file:${join(directory, "hosted.sqlite")}` });
await database.executeMultiple(readFileSync("scripts/hosted-schema.sql", "utf8"));
const now = Date.now();
await database.execute({ sql: "INSERT INTO auth_user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)", args: ["fictional-owner", "Fictional Owner", "owner@example.com", now, now] });
await database.execute({ sql: "INSERT INTO auth_account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, 'credential', ?, ?, ?, ?)", args: ["fictional-account", "fictional-owner", "fictional-owner", await hashPassword("fictional-owner-password"), now, now] });
database.close();
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "-p", "3102"], {
  stdio: "inherit", env: {
    ...process.env, SHIFT_LENS_DATA_MODE: "hosted", SHIFT_LENS_NEXT_DIST_DIR: ".next/e2e-hosted",
    TURSO_DATABASE_URL: `file:${join(directory, "hosted.sqlite")}`,
    BETTER_AUTH_URL: "http://127.0.0.1:3102", BETTER_AUTH_SECRET: "fictional-auth-secret-at-least-32-characters",
    SHIFT_LENS_SYNC_TOKEN: "fictional-sync-secret-at-least-32-characters",
    SHIFT_LENS_SYNC_SOURCE_ID: "11111111-1111-4111-8111-111111111111",
    SHIFT_LENS_HOSTED_COMPANY_ID: "fictional-business", SHIFT_LENS_HOSTED_OWNER_EMAIL: "owner@example.com"
  }
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGTERM"));
child.on("exit", code => { rmSync(directory, { recursive: true, force: true }); process.exit(code ?? 0); });
