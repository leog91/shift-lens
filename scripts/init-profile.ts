import { existsSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Database } from "bun:sqlite";

const target = process.argv[2];
if (!target) throw new Error("Usage: bun run profile:init <profile-directory> [business-name]");

const profileDirectory = resolve(process.cwd(), target);
const businessName = process.argv[3] ?? basename(profileDirectory);
const dataDirectory = resolve(profileDirectory, "data");
const databasePath = resolve(dataDirectory, "shiftlens.sqlite");

if (existsSync(databasePath) || existsSync(resolve(dataDirectory, "local-week.json"))) throw new Error(`A profile already exists at ${profileDirectory}.`);

mkdirSync(dataDirectory, { recursive: true });
mkdirSync(resolve(profileDirectory, "photo-inbox", "manual-review"), { recursive: true });
const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "local";
const database = new Database(databasePath);
database.exec(`
  CREATE TABLE companies (id TEXT PRIMARY KEY NOT NULL, business_name TEXT NOT NULL, schema_version INTEGER NOT NULL);
  CREATE TABLE profile_settings (key TEXT PRIMARY KEY NOT NULL, value_json TEXT NOT NULL);
  CREATE TABLE local_employees (id TEXT PRIMARY KEY NOT NULL, company_id TEXT NOT NULL, display_name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE local_employee_aliases (employee_id TEXT NOT NULL, alias TEXT NOT NULL, PRIMARY KEY (employee_id, alias));
  CREATE TABLE local_weeks (id TEXT PRIMARY KEY NOT NULL, company_id TEXT NOT NULL, week_starting TEXT NOT NULL, status TEXT NOT NULL);
  CREATE TABLE local_documents (id TEXT PRIMARY KEY NOT NULL, week_id TEXT NOT NULL, document_type TEXT NOT NULL, document_date TEXT, filename TEXT NOT NULL, path TEXT NOT NULL, quality_warnings_json TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE local_photo_assignments (path TEXT PRIMARY KEY NOT NULL, week_id TEXT NOT NULL, week_starting TEXT NOT NULL, document_type TEXT NOT NULL, document_date TEXT, note TEXT);
  CREATE TABLE local_shifts (id TEXT PRIMARY KEY NOT NULL, week_id TEXT NOT NULL, employee_id TEXT NOT NULL, employee_name TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT, finish_time TEXT, break_minutes INTEGER, status TEXT NOT NULL, source_document TEXT);
  CREATE TABLE local_payroll_entries (week_id TEXT NOT NULL, employee_id TEXT NOT NULL, employee_name TEXT NOT NULL, ordinary_paid_minutes INTEGER NOT NULL, sunday_paid_minutes INTEGER NOT NULL, other_paid_minutes INTEGER NOT NULL, displayed_total_paid_minutes INTEGER, PRIMARY KEY (week_id, employee_id));
  CREATE TABLE local_review_items (id TEXT PRIMARY KEY NOT NULL, week_id TEXT NOT NULL, employee_name TEXT NOT NULL, filename TEXT NOT NULL, document_path TEXT, review_type TEXT, raw TEXT, proposed TEXT, reason TEXT NOT NULL);
`);
database.query("INSERT INTO companies (id, business_name, schema_version) VALUES (?, ?, 1)").run(`company-${slug}`, businessName);
database.close();

console.log(`Created local SQLite profile for ${businessName} at ${profileDirectory}`);
