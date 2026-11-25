import { dayLabel } from "@/lib/days";
import type { CallSummary } from "@/lib/types";

interface PriorityQueueProps {
  title: string;
  tone: "stamp" | "haldi";
  calls: CallSummary[];
  today: string;
  empty: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  testId: string;
}

const TONE = {
  stamp: { card: "bg-stamp-wash ring-stamp/20", dot: "bg-stamp", text: "text-stamp" },
  haldi: { card: "bg-haldi-wash ring-haldi/20", dot: "bg-haldi", text: "text-haldi" },
};

/** Calls that need the doctor first, still unreviewed, most recent first. */
export function PriorityQueue({ title, tone, calls, today, empty, selectedId, onSelect, testId }: PriorityQueueProps) {
  const look = TONE[tone];
  return (
    <section aria-labelledby={`${testId}-title`} className={`rounded-[24px] p-4 ring-1 ${look.card}`} data-testid={testId}>
      <h2 id={`${testId}-title`} className={`flex items-center gap-2 text-[15px] font-semibold ${look.text}`}>
        <span aria-hidden className={`size-2 rounded-full ${look.dot}`} />
        {title}
        <span className="ml-auto rounded-full bg-frost px-2 py-0.5 text-[12px] tabular-nums text-night-soft">{calls.length}</span>
      </h2>
      {calls.length ? (
        <ul className="mt-3 space-y-2">
          {calls.map((call) => (
            <li key={call.id}>
              <button
                type="button"
                onClick={() => onSelect(call.id)}
                aria-pressed={selectedId === call.id}
                data-testid={`${testId}-${call.id}`}
                className={`flex w-full items-start gap-3 rounded-2xl bg-frost px-3.5 py-2.5 text-left ring-1 transition-colors hover:ring-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${selectedId === call.id ? "ring-iris" : "ring-transparent"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-night">
                    {call.name ?? "Name not given"} <span className="font-normal tabular-nums text-night-soft">{call.phone_display}</span>
                  </span>
                  <span className={`block truncate text-[13px] font-medium ${look.text}`}>{call.reason}</span>
                </span>
                <span className="shrink-0 text-right text-[12px] tabular-nums text-night-faint">
                  {dayLabel(call.day, today)}
                  <span className="block">{call.time}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-night-soft">{empty}</p>
      )}
    </section>
  );
}
