import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { hostedDatabase } from "@/lib/hosted/database";
import { authorizedCompany, hostedAuth } from "@/lib/hosted/auth";
import { provisionOwner } from "@/lib/hosted/provision-owner";

let directory: string;
const secret = "fictional-auth-secret-at-least-32-characters";
const password = "fictional-owner-password";
let ip = 1;

async function signIn(email = "owner@example.com", pass = password, address = `192.0.2.${ip++}`) {
  return hostedAuth().handler(new Request("https://fictional.example/api/auth/sign-in/email", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://fictional.example", "x-forwarded-for": address },
    body: JSON.stringify({ email, password: pass })
  }));
}

function sessionHeaders(response: Response) {
  const cookie = response.headers.get("set-cookie")?.match(/__Secure-better-auth\.session_token=[^;]+/)?.[0];
  expect(cookie).toBeTruthy();
  return new Headers({ cookie: cookie! });
}

beforeAll(async () => {
  directory = mkdtempSync("/tmp/opencode/shiftlens-auth-");
  vi.stubEnv("SHIFT_LENS_DATA_MODE", "hosted");
  vi.stubEnv("TURSO_DATABASE_URL", `file:${join(directory, "auth.sqlite")}`);
  vi.stubEnv("BETTER_AUTH_URL", "https://fictional.example");
  vi.stubEnv("BETTER_AUTH_SECRET", secret);
  vi.stubEnv("SHIFT_LENS_SYNC_TOKEN", "fictional-sync-secret-at-least-32-characters");
  vi.stubEnv("SHIFT_LENS_SYNC_SOURCE_ID", "11111111-1111-4111-8111-111111111111");
  vi.stubEnv("SHIFT_LENS_HOSTED_COMPANY_ID", "fictional-business");
  vi.stubEnv("SHIFT_LENS_HOSTED_OWNER_EMAIL", "owner@example.com");
  await hostedDatabase().executeMultiple(readFileSync("scripts/hosted-schema.sql", "utf8"));
});
afterAll(() => {
  hostedDatabase().close();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
beforeEach(async () => {
  await hostedDatabase().executeMultiple("DELETE FROM auth_session; DELETE FROM auth_account; DELETE FROM auth_user; DELETE FROM auth_rate_limit; DELETE FROM auth_verification;");
  await provisionOwner(hostedDatabase(), "owner@example.com", password);
});

test("anonymous requests cannot read hosted data", async () => {
  expect(await authorizedCompany(new Headers())).toBeNull();
});

test("runtime account creation and public signup are disabled, including for the owner", async () => {
  const context = await hostedAuth().$context;
  await expect(context.internalAdapter.createUser({ name: "Fictional Intruder", email: "not-invited@example.com", emailVerified: true }, { method: "email-password" })).rejects.toThrow("disabled");
  for (const email of ["owner@example.com", "other@example.com"]) {
    const response = await hostedAuth().handler(new Request("https://fictional.example/api/auth/sign-up/email", {
      method: "POST", headers: { "content-type": "application/json", origin: "https://fictional.example", "x-forwarded-for": `192.0.2.${ip++}` },
      body: JSON.stringify({ name: "Fictional Signup", email, password })
    }));
    expect(response.ok).toBe(false);
  }
  expect(Number((await hostedDatabase().execute("SELECT count(*) AS count FROM auth_user")).rows[0].count)).toBe(1);
});

test("real database-backed sessions authorize only the verified owner and honor revocation", async () => {
  const ownerId = await provisionOwner(hostedDatabase(), "owner@example.com", password, true);
  const response = await signIn();
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("Secure");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  const requestHeaders = sessionHeaders(response);
  expect(await authorizedCompany(requestHeaders)).toBe("fictional-business");
  await hostedDatabase().execute({ sql: "UPDATE auth_user SET email_verified = 0 WHERE id = ?", args: [ownerId] });
  expect(await authorizedCompany(requestHeaders)).toBeNull();
  await hostedDatabase().execute({ sql: "UPDATE auth_user SET email_verified = 1, email = ? WHERE id = ?", args: ["other@example.com", ownerId] });
  expect(await authorizedCompany(requestHeaders)).toBeNull();
  await hostedDatabase().execute({ sql: "UPDATE auth_user SET email = ? WHERE id = ?", args: ["owner@example.com", ownerId] });
  await hostedDatabase().execute({ sql: "DELETE FROM auth_session WHERE user_id = ?", args: [ownerId] });
  expect(await authorizedCompany(requestHeaders)).toBeNull();
});

test("wrong passwords and unknown accounts fail with the same generic response", async () => {
  const wrongPassword = await signIn("owner@example.com", "wrong-password");
  const unknownUser = await signIn("unknown@example.com");
  expect(wrongPassword.status).toBe(401);
  expect(unknownUser.status).toBe(401);
  expect(await wrongPassword.json()).toEqual(await unknownUser.json());
});

test("owner reset is explicit, stores only hashes, and revokes previous sessions", async () => {
  const first = await signIn();
  const requestHeaders = sessionHeaders(first);
  await expect(provisionOwner(hostedDatabase(), "owner@example.com", "replacement-owner-password")).rejects.toThrow("--reset");
  expect(await authorizedCompany(requestHeaders)).toBe("fictional-business");
  await provisionOwner(hostedDatabase(), "owner@example.com", "replacement-owner-password", true);
  expect(await authorizedCompany(requestHeaders)).toBeNull();
  expect((await signIn()).status).toBe(401);
  expect((await signIn("owner@example.com", "replacement-owner-password")).status).toBe(200);
  const rows = await hostedDatabase().execute("SELECT password FROM auth_account");
  expect(rows.rows).toHaveLength(1);
  expect(rows.rows[0].password).not.toBe("replacement-owner-password");
  expect(String(rows.rows[0].password).length).toBeGreaterThan(64);
});

test("password validation does not change the account", async () => {
  await expect(provisionOwner(hostedDatabase(), "owner@example.com", "short", true)).rejects.toThrow("12–128");
  expect((await signIn()).status).toBe(200);
});

test("persistent rate limiting throttles password guessing", async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    expect((await signIn("owner@example.com", "incorrect-password", "192.0.2.200")).status).toBe(401);
  }
  expect((await signIn("owner@example.com", "incorrect-password", "192.0.2.200")).status).toBe(429);
  const limits = await hostedDatabase().execute("SELECT count(*) AS count FROM auth_rate_limit");
  expect(Number(limits.rows[0].count)).toBeGreaterThan(0);
});
