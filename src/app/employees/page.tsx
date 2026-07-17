import Link from "next/link";
import { getAllWeekData } from "@/lib/week-data";

export default function EmployeesPage() {
  const employees = new Map<string, { displayName: string; aliases: string[] }>();
  for (const week of getAllWeekData()) {
    for (const employee of week.employees) employees.set(employee.id, employee);
  }

  return (
    <section className="space-y-6">
      <div className="page-heading"><p className="eyebrow">People</p><h1>Employees</h1><p>Open an employee to see confirmed actual hours across every loaded week.</p></div>
      <div className="employee-list">
        {[...employees.entries()].sort(([, a], [, b]) => a.displayName.localeCompare(b.displayName)).map(([employeeId, employee]) => (
          <Link className="employee-card" href={`/employees/${employeeId}`} key={employeeId}>
            <div><h2>{employee.displayName}</h2><p>{employee.aliases.length ? `Also recorded as: ${employee.aliases.join(", ")}` : "No recorded aliases"}</p></div><span>View hours <span aria-hidden="true">&rarr;</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
