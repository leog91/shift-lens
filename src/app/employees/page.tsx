import { getAllWeekData } from "@/lib/week-data";
import { isLocalDataMode } from "@/lib/data-mode";
import { EmployeeListClient } from "@/components/EmployeeListClient";

export default function EmployeesPage() {
  const employees = new Map<string, { id: string; displayName: string; aliases: string[] }>();
  for (const week of getAllWeekData()) {
    for (const employee of week.employees) employees.set(employee.id, employee);
  }

  return (
    <section className="space-y-6">
      <div className="page-heading"><p className="eyebrow">People</p><h1>Employees</h1><p>Open an employee to see confirmed actual hours across every loaded week.</p></div>
      <EmployeeListClient initialEmployees={[...employees.values()]} readOnly={!isLocalDataMode()} />
    </section>
  );
}
