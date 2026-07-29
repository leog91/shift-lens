export const defaultRosterCloseTimes = {
  monday: "22:00",
  tuesday: "22:00",
  wednesday: "22:00",
  thursday: "22:00",
  friday: "23:00",
  saturday: "23:00",
  sunday: "22:00"
} as const;

export function rosterCloseTimes() {
  // This local profile's roster uses CLOSE rather than a finish time. Keep the
  // assumption isolated here so another business can supply different rules.
  return defaultRosterCloseTimes;
}
