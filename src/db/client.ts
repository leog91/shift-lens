import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { localProfilePath } from "@/lib/local-profile";

export const sqlite = new Database(process.env.DATABASE_URL ?? localProfilePath("data", "shiftlens.sqlite"));
export const db = drizzle(sqlite, { schema });
