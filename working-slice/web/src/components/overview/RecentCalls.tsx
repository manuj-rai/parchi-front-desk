import Link from "next/link";
import { Icon } from "@/components/app/Icon";
import { Chip } from "@/components/ui/Chip";
import { dayLabel } from "@/lib/days";
import { PRIORITY_LABEL, PRIORITY_TONE, ROUTE_SHORT } from "@/lib/labels";
import type { CallSummary } from "@/lib/types";

/** The latest calls, newest first, each one click from its recording. */
export function RecentCalls({ calls, today, onOpen }: { calls: CallSummary[]; today: string; onOpen: (id: string) => void }) {
  return (
    <section aria-labelledby="recent-title" className="rounded-[24px] bg-frost p-4 ring-1 ring-iris-wash" data-testid="overview-recent">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-title" className="text-[15px] font-semibold text-night">Latest calls</h2>
        <Link href="/app/calls/" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-iris-deep hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris">
          All calls <Icon name="arrow" className="size-4" />
        </Link>
      </div>
      {calls.length ? (
        <ul className="mt-3 divide-y divide-rule">
          {calls.map((call) => (
            <li key={call.id}>
              <button
                type="button"
                onClick={() => onOpen(call.id)}
                data-testid={`recent-${call.id}`}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 text-left hover:bg-haze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
              >
                <span className="w-[86px] shrink-0 text-[12.5px] tabular-nums text-night-faint">
                  {dayLabel(call.day, today)} {call.time}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-night">
                  {call.name ?? "Name not given"} <span className="font-normal tabular-nums text-night-soft">{call.phone_display}</span>
                </span>
                {call.routes[0] && <Chip>{ROUTE_SHORT[call.routes[0]]}</Chip>}
                {call.priority !== "routine" && <Chip tone={PRIORITY_TONE[call.priority]}>{PRIORITY_LABEL[call.priority]}</Chip>}
                {call.live ? <Chip tone="wall">On the line</Chip> : call.reviewed ? <Chip tone="iris">Reviewed</Chip> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-rule-strong px-4 py-6 text-center text-[13.5px] text-night-soft">
          No calls yet. Play a caller in the Test lab, or add test calls there.
        </p>
      )}
    </section>
  );
}
