import { isLocalDataMode } from "./data-mode";
import { getLocalSettingsValue } from "./local-sqlite-store";

interface LocalSettings {
  priorityEmployeeId?: string;
}

export function getLocalSettings(): LocalSettings {
  if (!isLocalDataMode()) return {};
  const value: unknown = getLocalSettingsValue();
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const priorityEmployeeId = "priorityEmployeeId" in value && typeof value.priorityEmployeeId === "string" ? value.priorityEmployeeId : undefined;
  return { priorityEmployeeId };
}
