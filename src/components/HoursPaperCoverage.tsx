export function HoursPaperCoverage({ expectedDates, missingDates }: { expectedDates: string[]; missingDates: string[] }) {
  const missing = missingDates.length;
  const expected = expectedDates.length;
  return <div className={`rounded-lg border p-4 text-sm ${!expected ? "border-stone-200 bg-stone-50 text-stone-600" : missing ? "border-amber-300 bg-amber-50 text-amber-950" : "border-green-300 bg-green-50 text-green-950"}`} role="status" aria-label="Daily paper coverage">
    <p className="font-semibold">{!expected ? "No daily paper coverage available" : missing ? `${missing} of ${expected} daily papers missing` : expected === 1 ? "Daily paper present" : `All ${expected} daily papers present`}</p>
    <p className="mt-1">{expected ? `${expected - missing} of ${expected} days have a daily paper. ` : ""}Coverage is for loaded weeks only, not unloaded dates or employee attendance.{missing ? " Hours may be incomplete; missing papers do not mean nobody worked." : ""}</p>
    {missing ? <details className="mt-2"><summary className="cursor-pointer font-semibold">Show missing dates ({missing})</summary><ul className="mt-2 flex flex-wrap gap-2" aria-label="Missing daily paper dates">{missingDates.map(date => <li className="rounded border border-amber-300 bg-white px-2 py-1" key={date}>{date}</li>)}</ul></details> : null}
  </div>;
}
