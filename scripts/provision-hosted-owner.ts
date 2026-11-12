import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { hostedConfig } from "../src/lib/hosted/config";
import { hostedDatabase } from "../src/lib/hosted/database";
import { provisionOwner } from "../src/lib/hosted/provision-owner";

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Run this command in an interactive terminal. Passwords are not accepted as arguments or environment variables.");
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--reset")) throw new Error("Usage: bun run hosted:owner [--reset]");
  const config = hostedConfig();
  const controller = new AbortController();
  // Suppress readline's terminal echo; secrets do not enter shell history or logs.
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const terminal = createInterface({ input: process.stdin, output: muted, terminal: true, historySize: 0 });
  terminal.once("SIGINT", () => controller.abort());
  let password = "";
  let confirmation = "";
  try {
    console.log("Creating or resetting the configured hosted owner. Initialize tables with hosted:init first.");
    process.stdout.write("Password (12–128 characters, hidden): ");
    password = await terminal.question("", { signal: controller.signal });
    process.stdout.write("\nConfirm password (hidden): ");
    confirmation = await terminal.question("", { signal: controller.signal });
  } finally { terminal.close(); process.stdout.write("\n"); }
  if (password !== confirmation) throw new Error("Passwords do not match. No account changes made.");
  const database = hostedDatabase();
  try {
    await provisionOwner(database, config.ownerEmail, password, args.includes("--reset"));
    console.log("Owner password saved securely. Previous sessions were revoked. Sign in at /login.");
  } finally { password = ""; confirmation = ""; database.close(); }
}

try { await main(); }
catch (error) {
  // Never print database/driver errors: they can include credential query parameters.
  const message = error instanceof Error && /^(Run this command|Usage:|Missing |Hosted storage|Use |Hosted login|Password|Owner already)/.test(error.message)
    ? error.message : "Owner setup failed. Check hosted configuration and table initialization; no password was logged.";
  console.error(message);
  process.exitCode = 1;
}
