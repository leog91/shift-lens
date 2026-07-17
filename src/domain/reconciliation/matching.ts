import { fuzzy } from "fast-fuzzy";

export interface EmployeeNameCandidate {
  employeeId: string;
  displayName: string;
  aliases: string[];
}

export function matchEmployeeName(rawName: string, candidates: EmployeeNameCandidate[]) {
  const normalised = rawName.trim().toLowerCase();
  const scored = candidates.map((candidate) => {
    const names = [candidate.displayName, ...candidate.aliases];
    const score = Math.max(...names.map((name) => fuzzy(normalised, name.toLowerCase())));
    return { employeeId: candidate.employeeId, displayName: candidate.displayName, score };
  }).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < 0.88 || (second && best.score - second.score < 0.08)) {
    return { matched: null, possibleMatches: scored.filter((item) => item.score >= 0.75), reviewRequired: true };
  }
  return { matched: best, possibleMatches: scored.filter((item) => item.score >= 0.75), reviewRequired: false };
}
