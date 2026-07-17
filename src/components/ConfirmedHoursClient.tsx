"use client";

import { useState } from "react";
import { formatDuration, workedMinutes, type ShiftInput } from "@/domain/reconciliation";

type ConfirmedShift = Omit<ShiftInput, "startTime" | "finishTime" | "breakMinutes"> & {
  startTime: string;
  finishTime: string;
  breakMinutes: number;
  totalMinutes: number;
};

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`));
}

function shareText(weekStarting: string, shifts: ConfirmedShift[]) {
  const byEmployee = new Map<string, ConfirmedShift[]>();
  for (const shift of shifts) {
    const employeeShifts = byEmployee.get(shift.employeeName) ?? [];
    employeeShifts.push(shift);
    byEmployee.set(shift.employeeName, employeeShifts);
  }

  return [
    `Confirmed hours | Week starting ${weekStarting}`,
    ...[...byEmployee.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([employeeName, employeeShifts]) => {
      const total = employeeShifts.reduce((sum, shift) => sum + shift.totalMinutes, 0);
      return [
        "",
        employeeName,
        ...employeeShifts.map((shift) => `${formatDay(shift.date)}: ${shift.startTime}–${shift.finishTime}, ${shift.breakMinutes} min break, ${formatDuration(shift.totalMinutes)}`),
        `Week total: ${formatDuration(total)}`
      ];
    })
  ].join("\n");
}

export function ConfirmedHoursClient({ weekStarting, shifts }: { weekStarting: string; shifts: ShiftInput[] }) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const confirmedShifts: ConfirmedShift[] = shifts.flatMap((shift) => {
    const { startTime, finishTime, breakMinutes } = shift;
    if ((shift.status !== "confirmed" && shift.status !== "manually_entered") || startTime == null || finishTime == null || breakMinutes == null) return [];
    const totalMinutes = workedMinutes(startTime, finishTime, breakMinutes);
    return totalMinutes == null ? [] : [{ ...shift, startTime, finishTime, breakMinutes, totalMinutes }];
  })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const people = new Map<string, ConfirmedShift[]>();
  for (const shift of confirmedShifts) {
    const personShifts = people.get(shift.employeeName) ?? [];
    personShifts.push(shift);
    people.set(shift.employeeName, personShifts);
  }

  async function share() {
    const text = shareText(weekStarting, confirmedShifts);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Confirmed hours: ${weekStarting}`, text });
        setShareStatus("Shared.");
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus("Copied to clipboard.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Could not share these hours.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="hours-toolbar no-print">
        <p>{confirmedShifts.length} confirmed shift{confirmedShifts.length === 1 ? "" : "s"} across {people.size} {people.size === 1 ? "person" : "people"}.</p>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" onClick={() => window.print()} type="button">Print</button>
          <button className="button-primary" onClick={share} type="button">Share hours</button>
        </div>
        {shareStatus ? <p className="w-full text-xs text-stone-600" role="status">{shareStatus}</p> : null}
      </div>

      {people.size === 0 ? (
        <div className="empty-state">No complete confirmed shifts are available for this week yet.</div>
      ) : (
        <div className="confirmed-hours-list">
            {[...people.entries()].map(([employeeName, personShifts]) => {
              const total = personShifts.reduce((sum, shift) => sum + shift.totalMinutes, 0);
              return (
                <section className="hours-person" key={employeeName}>
                  <div className="hours-person-header">
                    <h2>{employeeName}</h2>
                    <span>Week total <strong>{formatDuration(total)}</strong></span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="hours-table">
                      <thead>
                        <tr><th>Day</th><th>Start</th><th>Finish</th><th>Break</th><th>Total</th></tr>
                      </thead>
                      <tbody>
                        {personShifts.map((shift) => (
                          <tr key={shift.id}>
                            <td data-label="Day">{formatDay(shift.date)}</td>
                            <td data-label="Start">{shift.startTime}</td>
                            <td data-label="Finish">{shift.finishTime}</td>
                            <td data-label="Break">{shift.breakMinutes} min</td>
                            <td data-label="Total" className="font-semibold">{formatDuration(shift.totalMinutes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
