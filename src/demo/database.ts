import Database from "better-sqlite3";
import { demoWeeks } from "./seed";
import type { LocalWeek } from "@/lib/week-data";

let database: Database.Database | undefined;

function getDatabase() {
  if (database) return database;

  database = new Database(":memory:");
  database.exec("CREATE TABLE demo_weeks (id TEXT PRIMARY KEY NOT NULL, week_starting TEXT NOT NULL, payload_json TEXT NOT NULL)");
  const insert = database.prepare("INSERT INTO demo_weeks (id, week_starting, payload_json) VALUES (?, ?, ?)");
  const seed = database.transaction(() => {
    for (const week of demoWeeks) insert.run(week.id, week.weekStarting, JSON.stringify(week));
  });
  seed();
  // The committed seed is the only source of truth for the public demo.
  database.pragma("query_only = ON");
  return database;
}

export function getDemoWeeks(): LocalWeek[] {
  const rows = getDatabase().prepare("SELECT payload_json FROM demo_weeks ORDER BY week_starting DESC").all() as Array<{ payload_json: string }>;
  return rows.map((row) => JSON.parse(row.payload_json) as LocalWeek);
}
