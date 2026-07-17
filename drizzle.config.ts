import { defineConfig } from "drizzle-kit";
import { localProfilePath } from "./src/lib/local-profile";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DATABASE_URL ?? localProfilePath("data", "shiftlens.sqlite") }
});
