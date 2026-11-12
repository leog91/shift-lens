import { readFileSync } from "node:fs";
import { hostedDatabase } from "../src/lib/hosted/database";

const database = hostedDatabase();
try {
  await database.executeMultiple(readFileSync(new URL("./hosted-schema.sql", import.meta.url), "utf8"));
  console.log("Hosted auth and published-data tables initialized. No local data was read or uploaded.");
} finally { database.close(); }
