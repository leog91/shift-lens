import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const target = process.argv[2];
if (!target) throw new Error("Usage: bun run profile:init <profile-directory> [business-name]");

const profileDirectory = resolve(process.cwd(), target);
const businessName = process.argv[3] ?? basename(profileDirectory);
const dataDirectory = resolve(profileDirectory, "data");
const primaryWeekPath = resolve(dataDirectory, "local-week.json");

if (existsSync(primaryWeekPath)) throw new Error(`A profile already exists at ${profileDirectory}.`);

mkdirSync(dataDirectory, { recursive: true });
mkdirSync(resolve(profileDirectory, "photo-inbox", "manual-review"), { recursive: true });
writeFileSync(primaryWeekPath, `${JSON.stringify({
  id: "local-week",
  weekStarting: "",
  status: "open",
  documents: [],
  photoAssignments: [],
  employees: [],
  shifts: [],
  payroll: [],
  reviewItems: []
}, null, 2)}\n`);
writeFileSync(resolve(dataDirectory, "local-extra-weeks.json"), "[]\n");
writeFileSync(resolve(dataDirectory, "local-settings.json"), "{}\n");
writeFileSync(resolve(profileDirectory, "profile.json"), `${JSON.stringify({ businessName }, null, 2)}\n`);

console.log(`Created local profile for ${businessName} at ${profileDirectory}`);
