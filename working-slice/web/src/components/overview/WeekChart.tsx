"use client";

import { useState } from "react";
import { Icon } from "@/components/app/Icon";
import type { CallSummary } from "@/lib/types";

interface Day {
  day: string;        // YYYY-MM-DD, the clinic's date
  label: string;      // "Mon", or "Today"
  date: string;       // "23 Nov"
  urgent: number;     // an emergency sign, or the doctor's "see today" rule
  other: number;
}

const URGENT = new Set<CallSummary["priority"]>(["emergency", "see_today"]);

/** The last seven clinic days, ending today, from the call log the page already has. */
function lastSevenDays(calls: CallSummary[], today: string): Day[] {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (6 - index));
    const day = date.toISOString().slice(0, 10);
    const onDay = calls.filter((call) => call.day === day);
    const urgent = onDay.filter((call) => URGENT.has(call.priority)).length;
    return {
      day,
      label: day === today ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
      date: date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
      urgent,
      other: onDay.length - urgent,
    };
  });
}

const PLOT_PX = 180;

/** Calls per day this week, urgent ones on top: a column chart, with the same numbers as a table. */
export function WeekChart({ calls, today }: { calls: CallSummary[]; today: string }) {
  const [asTable, setAsTable] = useState(false);
  const days = lastSevenDays(calls, today);
  const total = days.reduce((sum, day) => sum + day.urgent + day.other, 0);
  const urgent = days.reduce((sum, day) => sum + day.urgent, 0);
  const most = Math.max(1, ...days.map((day) => day.urgent + day.other));
  const px = (count: number) => (count === 0 ? 0 : Math.max(4, Math.round((count / most) * PLOT_PX)));

  return (
    <section aria-labelledby="week-chart-title" className="flex flex-col rounded-[24px] bg-frost p-4 ring-1 ring-iris-wash" data-testid="overview-week">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="week-chart-title" className="flex items-center gap-2 text-[15px] font-semibold text-night">
            <Icon name="calls" className="size-[18px] text-iris-deep" />
            Calls this week
          </h2>
          <p className="mt-1 text-[13px] text-night-soft" data-testid="overview-week-total">
            <span className="text-[22px] font-bold tracking-[-0.03em] text-night">{total}</span> calls,{" "}
            <span className="font-semibold text-night">{urgent}</span> urgent
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((shown) => !shown)}
          aria-pressed={asTable}
          data-testid="overview-week-table"
          className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-iris-deep ring-1 ring-rule-strong hover:bg-iris-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
        >
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {asTable ? (
        <table className="mt-4 w-full text-left text-[13px]">
          <thead>
            <tr className="text-[12px] text-night-faint">
              <th scope="col" className="pb-1.5 font-medium">Day</th>
              <th scope="col" className="pb-1.5 text-right font-medium">Calls</th>
              <th scope="col" className="pb-1.5 text-right font-medium">Urgent</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {days.map((day) => (
              <tr key={day.day} className="border-t border-rule">
                <th scope="row" className="py-1.5 font-medium text-night">{day.label}, {day.date}</th>
                <td className="py-1.5 text-right text-night">{day.urgent + day.other}</td>
                <td className="py-1.5 text-right text-night">{day.urgent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <ul aria-label="Legend" className="mt-3 flex gap-4 text-[12px] text-night-soft">
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-[3px] bg-iris" />Other calls</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-[3px] bg-stamp" />Urgent</li>
          </ul>
          {total === 0 && (
            <p className="mt-6 text-center text-[13px] text-night-soft">No calls in the last seven days yet.</p>
          )}
          <ol className="mt-auto grid grid-cols-7 border-b border-rule-strong pt-8" data-testid="overview-week-bars">
            {days.map((day, index) => {
              const count = day.urgent + day.other;
              return (
                <li
                  key={day.day}
                  tabIndex={0}
                  aria-label={`${day.label}, ${day.date}: ${count} call${count === 1 ? "" : "s"}, ${day.urgent} urgent`}
                  className="group relative flex flex-col items-center justify-end rounded-t-xl outline-none hover:bg-haze focus-visible:bg-haze focus-visible:ring-2 focus-visible:ring-iris"
                  style={{ height: PLOT_PX + 26 }}
                >
                  <span aria-hidden className={`mb-1 text-[12px] font-semibold tabular-nums ${count ? "text-night" : "text-night-ghost"}`}>{count}</span>
                  <span
                    aria-hidden
                    className="rise flex w-6 flex-col gap-[2px]"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    {day.urgent > 0 && <span className="block rounded-t-[4px] bg-stamp" style={{ height: px(day.urgent) }} />}
                    {day.other > 0 && <span className={`block bg-iris ${day.urgent ? "" : "rounded-t-[4px]"}`} style={{ height: px(day.other) }} />}
                  </span>
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-xl bg-night px-3 py-2 text-[12px] text-white shadow-lg group-hover:block group-focus-visible:block ${index < 2 ? "left-0" : index > 4 ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                  >
                    <span className="block font-semibold">{day.label}, {day.date}</span>
                    <span className="mt-1 flex items-center gap-2"><span aria-hidden className="h-0.5 w-3 rounded bg-white/70" /><strong>{day.other}</strong> other</span>
                    <span className="flex items-center gap-2"><span aria-hidden className="h-0.5 w-3 rounded bg-stamp" /><strong>{day.urgent}</strong> urgent</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <ol aria-hidden className="grid grid-cols-7 pt-1.5 text-center text-[11.5px] font-medium text-night-faint">
            {days.map((day) => (
              <li key={day.day} className={day.day === today ? "font-semibold text-iris-deep" : ""}>{day.label}</li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
