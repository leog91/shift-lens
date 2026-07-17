import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compareActualAndPaid, formatDuration, invalidShiftReason, type PayrollInput, type ShiftInput } from "../src/domain/reconciliation";
import { ActualSheetSchema, PayrollSchema } from "./fallback-schemas";

const weekDir = process.argv[2];
if (!weekDir) throw new Error("Usage: bun run scripts/reconcile-week.ts fallback-data/<week>");

const actual = ActualSheetSchema.parse(JSON.parse(readFileSync(join(weekDir, "extracted", "actual.json"), "utf8")));
const payroll = PayrollSchema.parse(JSON.parse(readFileSync(join(weekDir, "extracted", "payroll.json"), "utf8")));

const shifts: ShiftInput[] = actual.documents.flatMap((document) => document.rows.map((row, index) => ({
  id: `${document.filename}-${index}`,
  employeeId: row.employeeName ?? row.rawEmployeeName ?? `unknown-${document.filename}-${index}`,
  employeeName: row.employeeName ?? row.rawEmployeeName ?? "Unknown",
  date: document.date,
  startTime: row.startTime,
  finishTime: row.finishTime,
  breakMinutes: row.breakMinutes,
  status: row.reviewRequired ? "uncertain" : "confirmed",
  sourceDocument: document.filename
})));

const payrollEntries: PayrollInput[] = payroll.employees.filter((employee) => employee.employeeName).map((employee) => ({
  employeeId: employee.employeeName as string,
  employeeName: employee.employeeName as string,
  ordinaryPaidMinutes: employee.ordinaryPaidMinutes ?? 0,
  sundayPaidMinutes: employee.sundayPaidMinutes ?? 0,
  otherPaidMinutes: employee.otherPaidMinutes ?? 0,
  displayedTotalPaidMinutes: employee.totalPaidMinutes
}));

const rows = compareActualAndPaid(shifts, payrollEntries);
const unresolved = actual.documents.flatMap((document) => document.rows.map((row, index) => ({ document, row, index })).filter((item) => item.row.reviewRequired));
const invalid = shifts.map((shift) => ({ shift, reason: invalidShiftReason(shift) })).filter((item) => item.reason && item.shift.status !== "uncertain");

const lines = [
  `# Reconciliation ${actual.week}`,
  "",
  "| Employee | Actual | Paid | Difference | Status |",
  "| -------- | -----: | ---: | ---------: | ------ |",
  ...rows.map((row) => `| ${row.employeeName} | ${formatDuration(row.actualTotalMinutes)} | ${formatDuration(row.paidTotalMinutes)} | ${formatDuration(row.differenceMinutes)} | ${row.status} |`),
  "",
  "## Daily Actual-Shift Breakdown",
  ...shifts.map((shift) => `- ${shift.employeeName}: ${shift.date} ${shift.startTime ?? "null"}-${shift.finishTime ?? "null"}, break ${shift.breakMinutes ?? "null"}m, ${shift.status}, source ${shift.sourceDocument}`),
  "",
  "## Paid-Hour Category Breakdown",
  ...payrollEntries.map((entry) => `- ${entry.employeeName}: ordinary ${formatDuration(entry.ordinaryPaidMinutes)}, Sunday ${formatDuration(entry.sundayPaidMinutes)}, other ${formatDuration(entry.otherPaidMinutes)}, total ${formatDuration(entry.displayedTotalPaidMinutes ?? entry.ordinaryPaidMinutes + entry.sundayPaidMinutes + entry.otherPaidMinutes)}`),
  "",
  "## Missing Or Extra Hours",
  ...rows.map((row) => `- ${row.employeeName}: ${row.differenceMinutes > 0 ? `${formatDuration(row.differenceMinutes)} missing` : row.differenceMinutes < 0 ? `${formatDuration(Math.abs(row.differenceMinutes))} extra` : "matches"}`),
  "",
  "## Unresolved Fields",
  ...(unresolved.length ? unresolved.map((item) => `- ${item.document.filename} row ${item.index + 1}: ${item.row.reviewReason ?? "Requires review"}; uncertain fields: ${item.row.uncertainFields.join(", ")}`) : ["- None"]),
  "",
  "## Invalid Confirmed Values",
  ...(invalid.length ? invalid.map((item) => `- ${item.shift.sourceDocument}: ${item.reason}`) : ["- None"]),
  "",
  "## Review Instructions",
  "Confirm or correct every unresolved value before treating totals as final. Do not guess unreadable fields."
];

const reportDir = join(weekDir, "reports");
mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, "reconciliation.md"), `${lines.join("\n")}\n`);
console.log(`Wrote ${join(reportDir, "reconciliation.md")}`);
