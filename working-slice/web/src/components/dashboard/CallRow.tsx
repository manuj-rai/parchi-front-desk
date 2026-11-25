import { Chip } from "@/components/ui/Chip";
import { duration } from "@/lib/days";
import { PRIORITY_LABEL, PRIORITY_TONE, ROUTE_SHORT } from "@/lib/labels";
import type { CallSummary } from "@/lib/types";

/** One call in the day's list: when, who, what they wanted, how serious, and whether it is reviewed. */
export function CallRow({ call, selected, onSelect }: { call: CallSummary; selected: boolean; onSelect: () => void }) {
  const wanted = [...new Set(call.routes)].slice(0, 2);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`call-row-${call.id}`}
      className={`grid w-full grid-cols-[52px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 rounded-2xl px-3.5 py-3 text-left ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris sm:grid-cols-[52px_minmax(0,1fr)_auto] ${selected ? "bg-iris-wash/60 ring-iris/40" : "bg-frost ring-rule hover:ring-rule-strong"}`}
    >
      <span className="pt-0.5 text-[14px] font-semibold tabular-nums text-night">{call.time}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="truncate text-[14px] font-semibold text-night">{call.name ?? "Name not given"}</span>
          <span className="text-[13px] tabular-nums text-night-soft">{call.phone_display}</span>
          {call.test && <Chip>test</Chip>}
        </span>
        {call.number_name && (
          <span className="block text-[12px] text-night-faint">This number is {call.number_name}&apos;s</span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {wanted.map((route) => (
            <Chip key={route} tone="neutral">{ROUTE_SHORT[route]}</Chip>
          ))}
          {call.turn_count === 0 && <Chip tone="neutral">Hung up after the greeting</Chip>}
          <span className="text-[12px] tabular-nums text-night-faint">{duration(call.duration_s)}</span>
        </span>
      </span>
      <span className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-3 sm:flex-col sm:items-end">
        {call.priority !== "routine" && <Chip tone={PRIORITY_TONE[call.priority]}>{PRIORITY_LABEL[call.priority]}</Chip>}
        {call.live ? (
          <Chip tone="wall" testId={`call-status-${call.id}`}>
            {call.taken_over_by ? `With ${call.taken_over_by}` : "On the line"}
          </Chip>
        ) : call.reviewed ? (
          <Chip tone="iris" testId={`call-status-${call.id}`}>Reviewed</Chip>
        ) : (
          <Chip tone="neutral" testId={`call-status-${call.id}`}>To review</Chip>
        )}
      </span>
    </button>
  );
}
