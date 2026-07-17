import { mkdirSync } from "node:fs";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { localProfilePath } from "@/lib/local-profile";

const now = new Date().toISOString();
mkdirSync("data", { recursive: true });
const db = new Database(process.env.DATABASE_URL ?? localProfilePath("data", "shiftlens.sqlite"));

db.exec(`
CREATE TABLE IF NOT EXISTS employees (id text primary key, display_name text not null, active integer not null, created_at text not null, updated_at text not null);
CREATE TABLE IF NOT EXISTS employee_aliases (id text primary key, employee_id text not null, alias text not null, created_at text not null);
CREATE TABLE IF NOT EXISTS weeks (id text primary key, week_starting text not null, notes text, status text not null, created_at text not null, updated_at text not null);
CREATE TABLE IF NOT EXISTS documents (id text primary key, week_id text not null, document_type text not null, document_date text, original_filename text not null, original_path text not null, processed_path text, mime_type text not null, extraction_provider text, extraction_status text not null, quality_warnings_json text not null, created_at text not null, updated_at text not null);
CREATE TABLE IF NOT EXISTS shifts (id text primary key, employee_id text not null, week_id text not null, document_id text, date text not null, source text not null, start_time text, finish_time text, break_minutes integer, status text not null, notes text, created_at text not null, updated_at text not null);
CREATE TABLE IF NOT EXISTS payroll_entries (id text primary key, employee_id text not null, week_id text not null, document_id text, ordinary_paid_minutes integer not null, sunday_paid_minutes integer not null, other_paid_minutes integer not null, displayed_total_paid_minutes integer, status text not null, notes text, created_at text not null, updated_at text not null);
CREATE TABLE IF NOT EXISTS review_items (id text primary key, week_id text not null, document_id text, extracted_field_id text, review_type text not null, status text not null, message text not null, proposed_value text, confirmed_value text, resolved_at text, created_at text not null);
DELETE FROM review_items; DELETE FROM payroll_entries; DELETE FROM shifts; DELETE FROM documents; DELETE FROM employee_aliases; DELETE FROM employees; DELETE FROM weeks;
`);

const run = (sql: string, values: SQLQueryBindings[]) => db.query(sql).run(...values);

for (const employee of [["emp-ana", "Ana Byrne"], ["emp-ben", "Ben Walsh"], ["emp-cara", "Cara Nolan"], ["emp-dara", "Dara Lee"]]) {
  run("INSERT INTO employees VALUES (?, ?, 1, ?, ?)", [employee[0], employee[1], now, now]);
}
for (const alias of [["alias-ana", "emp-ana", "Anna"], ["alias-ben", "emp-ben", "Benn"], ["alias-cara", "emp-cara", "Caz"], ["alias-dara", "emp-dara", "D Lee"]]) {
  run("INSERT INTO employee_aliases VALUES (?, ?, ?, ?)", [alias[0], alias[1], alias[2], now]);
}
run("INSERT INTO weeks VALUES (?, ?, ?, ?, ?, ?)", ["week-2026-w28", "2026-07-06", "Fictional seed week", "needs_review", now, now]);
run("INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ["doc-daily", "week-2026-w28", "daily_sheet", "2026-07-09", "thursday-placeholder.jpg", "public/placeholders/thursday-placeholder.jpg", null, "image/jpeg", "paddle-ocr", "needs_review", "[\"The photo may be blurry.\"]", now, now]);

for (const item of [
  ["s1", "emp-ana", "2026-07-06", "09:00", "17:00", 30],
  ["s2", "emp-ben", "2026-07-06", "15:00", "23:00", 30],
  ["s3", "emp-cara", "2026-07-12", "10:00", "18:00", 30],
  ["s4", "emp-dara", "2026-07-08", "11:00", "19:00", 30]
]) {
  run("INSERT INTO shifts VALUES (?, ?, ?, ?, ?, 'actual', ?, ?, ?, 'confirmed', NULL, ?, ?)", [item[0], item[1], "week-2026-w28", "doc-daily", item[2], item[3], item[4], item[5], now, now]);
}
for (const item of [
  ["p1", "emp-ana", 450, 0, 0, 450, null],
  ["p2", "emp-ben", 390, 0, 0, 390, "One hour missing"],
  ["p3", "emp-cara", 450, 0, 0, 450, "Sunday hour classified ordinary"]
]) {
  run("INSERT INTO payroll_entries VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'confirmed', ?, ?, ?)", [item[0], item[1], "week-2026-w28", item[2], item[3], item[4], item[5], item[6], now, now]);
}
run("INSERT INTO review_items VALUES (?, ?, ?, NULL, ?, 'open', ?, NULL, NULL, NULL, ?)", ["r1", "week-2026-w28", "doc-daily", "start_time", "Start time is unreadable. Do not guess.", now]);

console.log("Seeded fictional ShiftLens data.");
