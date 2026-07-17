import { existsSync, readFileSync } from "node:fs";
import { localProfilePath } from "./local-profile";
import { isLocalDataMode } from "./data-mode";

interface LocalSettings {
  priorityEmployeeId?: string;
}

export function getLocalSettings(): LocalSettings {
  if (!isLocalDataMode()) return {};
  const path = localProfilePath("data", "local-settings.json");
  if (!existsSync(path)) return {};
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const priorityEmployeeId = "priorityEmployeeId" in value && typeof value.priorityEmployeeId === "string" ? value.priorityEmployeeId : undefined;
  return { priorityEmployeeId };
}
