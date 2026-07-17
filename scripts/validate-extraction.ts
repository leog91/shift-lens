import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ActualSheetSchema, PayrollSchema } from "./fallback-schemas";

const weekDir = process.argv[2];
if (!weekDir) throw new Error("Usage: bun run scripts/validate-extraction.ts fallback-data/<week>");

const actual = JSON.parse(readFileSync(join(weekDir, "extracted", "actual.json"), "utf8"));
const payroll = JSON.parse(readFileSync(join(weekDir, "extracted", "payroll.json"), "utf8"));
ActualSheetSchema.parse(actual);
PayrollSchema.parse(payroll);
console.log("Extraction JSON is valid.");
