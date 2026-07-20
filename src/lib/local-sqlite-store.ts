import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { LocalWeek } from "./week-data";
import { localProfilePath } from "./local-profile";

type WeekRow = { id: string; week_starting: string; status: string };
type EmployeeRow = { id: string; display_name: string; active: number };
type DocumentRow = { id: string; document_type: LocalWeek["documents"][number]["documentType"]; document_date: string | null; filename: string; path: string; quality_warnings_json: string };
type ShiftRow = { id: string; employee_id: string; employee_name: string; date: string; start_time: string | null; finish_time: string | null; break_minutes: number | null; status: LocalWeek["shifts"][number]["status"]; source_document: string | null };
type PayrollRow = { employee_id: string; employee_name: string; ordinary_paid_minutes: number; sunday_paid_minutes: number; other_paid_minutes: number; displayed_total_paid_minutes: number | null };
type ReviewRow = LocalWeek["reviewItems"][number];

export function localDatabasePath() {
  return localProfilePath("data", "shiftlens.sqlite");
}

function openDatabase(path = localDatabasePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY NOT NULL,
      business_name TEXT NOT NULL,
      schema_version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profile_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_employees (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS local_employee_aliases (
      employee_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      PRIMARY KEY (employee_id, alias)
    );
    CREATE TABLE IF NOT EXISTS local_weeks (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL,
      week_starting TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_documents (
      id TEXT PRIMARY KEY NOT NULL,
      week_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_date TEXT,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      quality_warnings_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS local_photo_assignments (
      path TEXT PRIMARY KEY NOT NULL,
      week_id TEXT NOT NULL,
      week_starting TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_date TEXT,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS local_shifts (
      id TEXT PRIMARY KEY NOT NULL,
      week_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT,
      finish_time TEXT,
      break_minutes INTEGER,
      status TEXT NOT NULL,
      source_document TEXT
    );
    CREATE TABLE IF NOT EXISTS local_payroll_entries (
      week_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      ordinary_paid_minutes INTEGER NOT NULL,
      sunday_paid_minutes INTEGER NOT NULL,
      other_paid_minutes INTEGER NOT NULL,
      displayed_total_paid_minutes INTEGER,
      PRIMARY KEY (week_id, employee_id)
    );
    CREATE TABLE IF NOT EXISTS local_review_items (
      id TEXT PRIMARY KEY NOT NULL,
      week_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      document_path TEXT,
      review_type TEXT,
      raw TEXT,
      proposed TEXT,
      reason TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profile_weeks (
      id TEXT PRIMARY KEY NOT NULL,
      week_starting TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
  `);
  return database;
}

function legacyWeeks() {
  const primaryPath = localProfilePath("data", "local-week.json");
  const extraPath = localProfilePath("data", "local-extra-weeks.json");
  if (!existsSync(primaryPath)) return [];
  const primary = JSON.parse(readFileSync(primaryPath, "utf8")) as LocalWeek;
  const extra = existsSync(extraPath) ? JSON.parse(readFileSync(extraPath, "utf8")) as LocalWeek[] : [];
  return primary.weekStarting ? [primary, ...extra.filter((week) => week.id !== primary.id)] : extra;
}

function legacySettings() {
  const path = localProfilePath("data", "local-settings.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

function legacyCompany() {
  const path = localProfilePath("profile.json");
  if (!existsSync(path)) return { id: "company-migrated-local-profile", businessName: "Migrated local profile" };
  const value = JSON.parse(readFileSync(path, "utf8")) as { businessName?: unknown };
  const businessName = typeof value.businessName === "string" && value.businessName.trim() ? value.businessName.trim() : "Migrated local profile";
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "migrated-local-profile";
  return { id: `company-${slug}`, businessName };
}

function companyId(database: Database.Database) {
  const company = database.prepare("SELECT id FROM companies LIMIT 1").get() as { id: string } | undefined;
  if (!company) throw new Error("No local profile database exists. Run bun run profile:init first.");
  return company.id;
}

function writeWeek(database: Database.Database, company: string, week: LocalWeek) {
  database.prepare("DELETE FROM local_documents WHERE week_id = ?").run(week.id);
  database.prepare("DELETE FROM local_photo_assignments WHERE week_id = ?").run(week.id);
  database.prepare("DELETE FROM local_shifts WHERE week_id = ?").run(week.id);
  database.prepare("DELETE FROM local_payroll_entries WHERE week_id = ?").run(week.id);
  database.prepare("DELETE FROM local_review_items WHERE week_id = ?").run(week.id);
  database.prepare("DELETE FROM local_weeks WHERE id = ?").run(week.id);

  database.prepare("INSERT INTO local_weeks (id, company_id, week_starting, status) VALUES (?, ?, ?, ?)").run(week.id, company, week.weekStarting, week.status);
  const employee = database.prepare("INSERT INTO local_employees (id, company_id, display_name, active) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, company_id = excluded.company_id");
  const alias = database.prepare("INSERT OR IGNORE INTO local_employee_aliases (employee_id, alias) VALUES (?, ?)");
  for (const person of week.employees) {
    employee.run(person.id, company, person.displayName);
    for (const value of person.aliases) alias.run(person.id, value);
  }

  const document = database.prepare("INSERT INTO local_documents (id, week_id, document_type, document_date, filename, path, quality_warnings_json) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const item of week.documents) document.run(item.id, week.id, item.documentType, item.documentDate, item.filename, item.path, JSON.stringify(item.qualityWarnings));
  const assignment = database.prepare("INSERT INTO local_photo_assignments (path, week_id, week_starting, document_type, document_date, note) VALUES (?, ?, ?, ?, ?, ?)");
  for (const item of week.photoAssignments ?? []) assignment.run(item.path, week.id, item.weekStarting, item.documentType, item.documentDate, item.note);
  const shift = database.prepare("INSERT INTO local_shifts (id, week_id, employee_id, employee_name, date, start_time, finish_time, break_minutes, status, source_document) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of week.shifts) shift.run(item.id, week.id, item.employeeId, item.employeeName, item.date, item.startTime, item.finishTime, item.breakMinutes, item.status, item.sourceDocument ?? null);
  const payroll = database.prepare("INSERT INTO local_payroll_entries (week_id, employee_id, employee_name, ordinary_paid_minutes, sunday_paid_minutes, other_paid_minutes, displayed_total_paid_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const item of week.payroll) payroll.run(week.id, item.employeeId, item.employeeName, item.ordinaryPaidMinutes, item.sundayPaidMinutes, item.otherPaidMinutes, item.displayedTotalPaidMinutes);
  const review = database.prepare("INSERT INTO local_review_items (id, week_id, employee_name, filename, document_path, review_type, raw, proposed, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of week.reviewItems) review.run(item.id, week.id, item.employeeName, item.filename, item.documentPath ?? null, item.reviewType ?? null, item.raw, item.proposed, item.reason);
}

function migrateSnapshots(database: Database.Database) {
  const snapshots = database.prepare("SELECT payload_json FROM profile_weeks").all() as Array<{ payload_json: string }>;
  if (snapshots.length === 0) return;
  const company = companyId(database);
  const migrate = database.transaction(() => {
    for (const snapshot of snapshots) writeWeek(database, company, JSON.parse(snapshot.payload_json) as LocalWeek);
    database.prepare("DELETE FROM profile_weeks").run();
  });
  migrate();
}

function migrateLegacyJson(database: Database.Database) {
  const hasCompany = database.prepare("SELECT 1 FROM companies LIMIT 1").get();
  if (hasCompany) return;
  const weeks = legacyWeeks();
  if (weeks.length === 0) return;
  const company = legacyCompany();
  const importData = database.transaction(() => {
    database.prepare("INSERT INTO companies (id, business_name, schema_version) VALUES (?, ?, 1)").run(company.id, company.businessName);
    database.prepare("INSERT INTO profile_settings (key, value_json) VALUES ('settings', ?)").run(JSON.stringify(legacySettings()));
    const insert = database.prepare("INSERT INTO profile_weeks (id, week_starting, payload_json) VALUES (?, ?, ?)");
    for (const week of weeks) insert.run(week.id, week.weekStarting, JSON.stringify(week));
  });
  importData();
}

function withDatabase<T>(operation: (database: Database.Database) => T) {
  const path = localDatabasePath();
  if (!existsSync(path) && !existsSync(localProfilePath("data", "local-week.json"))) return null;
  const database = openDatabase(path);
  try {
    migrateLegacyJson(database);
    migrateSnapshots(database);
    return operation(database);
  } finally {
    database.close();
  }
}

function readWeek(database: Database.Database, row: WeekRow): LocalWeek {
  const employees = (database.prepare("SELECT DISTINCT e.id, e.display_name, e.active FROM local_employees e JOIN local_shifts s ON s.employee_id = e.id WHERE s.week_id = ? UNION SELECT DISTINCT e.id, e.display_name, e.active FROM local_employees e JOIN local_payroll_entries p ON p.employee_id = e.id WHERE p.week_id = ? UNION SELECT DISTINCT e.id, e.display_name, e.active FROM local_employees e WHERE e.company_id = ? ORDER BY display_name").all(row.id, row.id, companyId(database)) as EmployeeRow[]).map((employee) => ({
    id: employee.id,
    displayName: employee.display_name,
    aliases: (database.prepare("SELECT alias FROM local_employee_aliases WHERE employee_id = ? ORDER BY alias").all(employee.id) as Array<{ alias: string }>).map((alias) => alias.alias)
  }));
  const documents = (database.prepare("SELECT id, document_type, document_date, filename, path, quality_warnings_json FROM local_documents WHERE week_id = ? ORDER BY document_date, filename").all(row.id) as DocumentRow[]).map((document) => ({
    id: document.id,
    documentType: document.document_type,
    documentDate: document.document_date,
    filename: document.filename,
    path: document.path,
    qualityWarnings: JSON.parse(document.quality_warnings_json) as string[]
  }));
  const photoAssignments = (database.prepare("SELECT path, week_starting, document_type, document_date, note FROM local_photo_assignments WHERE week_id = ? ORDER BY path").all(row.id) as Array<{ path: string; week_starting: string; document_type: LocalWeek["photoAssignments"][number]["documentType"]; document_date: string | null; note: string | null }>).map((assignment) => ({
    path: assignment.path,
    weekStarting: assignment.week_starting,
    documentType: assignment.document_type,
    documentDate: assignment.document_date,
    note: assignment.note
  }));
  const shifts = (database.prepare("SELECT id, employee_id, employee_name, date, start_time, finish_time, break_minutes, status, source_document FROM local_shifts WHERE week_id = ? ORDER BY date, employee_name").all(row.id) as ShiftRow[]).map((shift) => ({
    id: shift.id,
    employeeId: shift.employee_id,
    employeeName: shift.employee_name,
    date: shift.date,
    startTime: shift.start_time,
    finishTime: shift.finish_time,
    breakMinutes: shift.break_minutes,
    status: shift.status,
    sourceDocument: shift.source_document
  }));
  const payroll = (database.prepare("SELECT employee_id, employee_name, ordinary_paid_minutes, sunday_paid_minutes, other_paid_minutes, displayed_total_paid_minutes FROM local_payroll_entries WHERE week_id = ? ORDER BY employee_name").all(row.id) as PayrollRow[]).map((entry) => ({
    employeeId: entry.employee_id,
    employeeName: entry.employee_name,
    ordinaryPaidMinutes: entry.ordinary_paid_minutes,
    sundayPaidMinutes: entry.sunday_paid_minutes,
    otherPaidMinutes: entry.other_paid_minutes,
    displayedTotalPaidMinutes: entry.displayed_total_paid_minutes
  }));
  const reviewItems = database.prepare("SELECT id, employee_name AS employeeName, filename, document_path AS documentPath, review_type AS reviewType, raw, proposed, reason FROM local_review_items WHERE week_id = ? ORDER BY id").all(row.id) as ReviewRow[];
  return { id: row.id, weekStarting: row.week_starting, status: row.status, documents, photoAssignments, employees, shifts, payroll, reviewItems };
}

export function getLocalWeeks(): LocalWeek[] {
  return withDatabase((database) => {
    const weeks = database.prepare("SELECT id, week_starting, status FROM local_weeks ORDER BY CASE WHEN week_starting = '' THEN 0 ELSE 1 END, week_starting DESC").all() as WeekRow[];
    return weeks.map((week) => readWeek(database, week));
  }) ?? [];
}

export function writeLocalWeeks(weeks: LocalWeek[]) {
  const database = openDatabase();
  try {
    migrateLegacyJson(database);
    migrateSnapshots(database);
    const company = companyId(database);
    const replace = database.transaction(() => {
      const existing = database.prepare("SELECT id FROM local_weeks").all() as Array<{ id: string }>;
      for (const row of existing) if (!weeks.some((week) => week.id === row.id)) {
        database.prepare("DELETE FROM local_documents WHERE week_id = ?").run(row.id);
        database.prepare("DELETE FROM local_photo_assignments WHERE week_id = ?").run(row.id);
        database.prepare("DELETE FROM local_shifts WHERE week_id = ?").run(row.id);
        database.prepare("DELETE FROM local_payroll_entries WHERE week_id = ?").run(row.id);
        database.prepare("DELETE FROM local_review_items WHERE week_id = ?").run(row.id);
        database.prepare("DELETE FROM local_weeks WHERE id = ?").run(row.id);
      }
      for (const week of weeks) writeWeek(database, company, week);
    });
    replace();
  } finally {
    database.close();
  }
}

export function writeLocalWeek(week: LocalWeek) {
  const database = openDatabase();
  try {
    migrateLegacyJson(database);
    migrateSnapshots(database);
    const company = companyId(database);
    database.transaction(() => writeWeek(database, company, week))();
  } finally {
    database.close();
  }
}

export function createLocalEmployee(displayName: string, aliases: string[]) {
  const database = openDatabase();
  try {
    migrateLegacyJson(database);
    migrateSnapshots(database);
    const company = companyId(database);
    const name = displayName.trim();
    const existing = database.prepare("SELECT id FROM local_employees WHERE company_id = ? AND lower(display_name) = lower(?)").get(company, name) as { id: string } | undefined;
    if (existing) throw new Error("An employee with this name already exists.");
    const id = `employee-${randomUUID()}`;
    const insert = database.transaction(() => {
      database.prepare("INSERT INTO local_employees (id, company_id, display_name, active) VALUES (?, ?, ?, 1)").run(id, company, name);
      const alias = database.prepare("INSERT OR IGNORE INTO local_employee_aliases (employee_id, alias) VALUES (?, ?)");
      for (const value of aliases) alias.run(id, value);
    });
    insert();
    return { id, displayName: name, aliases };
  } finally {
    database.close();
  }
}

export function getLocalSettingsValue() {
  return withDatabase((database) => {
    const row = database.prepare("SELECT value_json FROM profile_settings WHERE key = 'settings'").get() as { value_json: string } | undefined;
    return row ? JSON.parse(row.value_json) as unknown : {};
  }) ?? {};
}
