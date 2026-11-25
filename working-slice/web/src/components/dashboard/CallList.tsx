"use client";

import { useMemo, useState } from "react";
import { dayLabel } from "@/lib/days";
import type { CallSummary } from "@/lib/types";
import { CallRow } from "./CallRow";

interface CallListProps {
  calls: CallSummary[];
  today: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Every call, by day: today, yesterday, and the days before. Search by name, number or words said. */
export function CallList({ calls, today, selectedId, onSelect }: CallListProps) {
  const [query, setQuery] = useState("");
  const [toReviewOnly, setToReviewOnly] = useState(false);

  const days = useMemo(() => {
    const words = query.trim().toLowerCase();
    const digits = words.replace(/\D/g, "");
    const shown = calls.filter((call) => {
      if (toReviewOnly && call.reviewed) return false;
      if (!words) return true;
      const said = `${call.name ?? ""} ${call.number_name ?? ""} ${call.first_words ?? ""}`.toLowerCase();
      return said.includes(words) || (digits.length >= 3 && (call.phone ?? "").includes(digits));
    });
    const byDay = new Map<string, CallSummary[]>();
    for (const call of shown) byDay.set(call.day, [...(byDay.get(call.day) ?? []), call]);
    return [...byDay.entries()];
  }, [calls, query, toReviewOnly]);

  return (
    <section aria-labelledby="call-list-title" className="rounded-[24px] bg-frost/70 p-4 ring-1 ring-iris-wash">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="call-list-title" className="text-[16px] font-semibold text-night">All calls</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, number or words"
            aria-label="Search calls by name, number or what the caller said"
            data-testid="call-search"
            className="h-9 w-[220px] rounded-full bg-frost px-4 text-[13.5px] text-night outline-none ring-1 ring-rule-strong placeholder:text-night-faint focus:ring-2 focus:ring-iris"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-full px-2 text-[13px] font-medium text-night-soft">
            <input
              type="checkbox"
              checked={toReviewOnly}
              onChange={(event) => setToReviewOnly(event.target.checked)}
              data-testid="call-filter-to-review"
              className="size-4 accent-iris"
            />
            To review only
          </label>
        </div>
      </div>

      {days.length ? (
        days.map(([day, dayCalls]) => (
          <div key={day} className="mt-5" data-testid={`call-day-${day}`}>
            <h3 className="flex items-baseline gap-2 text-[13.5px] font-semibold text-night">
              {dayLabel(day, today)}
              <span className="font-normal text-night-faint">
                {dayCalls.length} call{dayCalls.length === 1 ? "" : "s"}
              </span>
            </h3>
            <ul className="mt-2 space-y-2">
              {dayCalls.map((call) => (
                <li key={call.id}>
                  <CallRow call={call} selected={selectedId === call.id} onSelect={() => onSelect(call.id)} />
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-rule-strong px-4 py-6 text-center text-[13.5px] text-night-soft" data-testid="call-list-empty">
          {calls.length
            ? "No calls match. Clear the search or the filter."
            : "No calls in the last two weeks. Calls appear here as soon as Parchi answers them."}
        </p>
      )}
    </section>
  );
}
