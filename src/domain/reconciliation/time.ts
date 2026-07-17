const TIME_RE = /^(\d{1,2})(?:[:.](\d{1,2}))?$/;

export function parseClockMinutes(value: string): number | null {
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] == null ? 0 : Number(match[2].padEnd(2, "0"));
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function normaliseTime(value: string): string | null {
  const minutes = parseClockMinutes(value);
  if (minutes == null) return null;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export interface TimeInterpretation {
  value: string;
  explanation: string;
}

export function possibleTimeInterpretations(raw: string, column: "start" | "finish"): TimeInterpretation[] {
  const trimmed = raw.trim();
  const match = TIME_RE.exec(trimmed);
  if (!match) return [];
  const hour = Number(match[1]);
  const minute = match[2] == null ? 0 : Number(match[2].padEnd(2, "0"));
  if (minute > 59) return [];
  const candidates = new Set<number>();
  if (hour <= 23) candidates.add(hour * 60 + minute);
  if (hour >= 1 && hour <= 11) candidates.add((hour + 12) * 60 + minute);
  return [...candidates].sort((a, b) => a - b).map((minutes) => ({
    value: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    explanation: match[2] == null ? `Bare ${column} time; AM/PM context required.` : "Parsed explicit clock-like value."
  }));
}

export function shiftDurationMinutes(startTime: string, finishTime: string): number | null {
  const start = parseClockMinutes(startTime);
  const finish = parseClockMinutes(finishTime);
  if (start == null || finish == null) return null;
  const raw = finish >= start ? finish - start : finish + 24 * 60 - start;
  return raw;
}

export function workedMinutes(startTime: string, finishTime: string, breakMinutes: number): number | null {
  const duration = shiftDurationMinutes(startTime, finishTime);
  if (duration == null || breakMinutes < 0 || breakMinutes > duration) return null;
  return duration - breakMinutes;
}

export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

export function parsePayslipHours(raw: string): { minutes: number | null; reviewRequired: boolean; reason: string | null } {
  const value = raw.trim();
  if (/^\d{1,3}:\d{2}$/.test(value)) {
    const [h, m] = value.split(":").map(Number);
    return { minutes: h * 60 + m, reviewRequired: false, reason: null };
  }
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return { minutes: Math.round(Number(value) * 60), reviewRequired: false, reason: null };
  }
  return { minutes: null, reviewRequired: true, reason: "Unreadable payslip hour value." };
}
