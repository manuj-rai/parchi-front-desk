import { Icon, type IconName } from "@/components/app/Icon";
import type { CallsResponse } from "@/lib/types";

const TILES: { key: Exclude<keyof CallsResponse["summary"], "live_now">; label: string; icon: IconName; tone: string; badge: string; card: string }[] = [
  { key: "emergencies", label: "Emergencies to review", icon: "alert", tone: "text-stamp", badge: "bg-stamp text-white", card: "bg-stamp-wash ring-stamp/20" },
  { key: "needs_attention", label: "Need attention", icon: "flag", tone: "text-haldi", badge: "bg-haldi text-white", card: "bg-haldi-wash ring-haldi/20" },
  { key: "to_review", label: "Waiting for review", icon: "eye", tone: "text-iris-deep", badge: "bg-iris-wash text-iris-deep", card: "bg-frost ring-iris-wash" },
  { key: "calls_today", label: "Calls today", icon: "calls", tone: "text-night", badge: "bg-linear-to-br from-iris to-orchid text-white", card: "bg-frost ring-iris-wash" },
];

/** The day at a glance. The most serious first, because that is what the doctor acts on. */
export function SummaryTiles({ summary }: { summary: CallsResponse["summary"] }) {
  return (
    <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((tile) => (
        <div key={tile.key} className={`flex items-center gap-3 rounded-[20px] px-4 py-3.5 ring-1 ${tile.card}`} data-testid={`summary-${tile.key}`}>
          <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-[13px] ${tile.badge}`}>
            <Icon name={tile.icon} className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-semibold leading-tight text-night-soft">{tile.label}</span>
            <span className={`mt-0.5 block text-[28px] font-bold leading-none tracking-[-0.03em] ${tile.tone}`}>{summary[tile.key]}</span>
          </span>
        </div>
      ))}
      {summary.live_now > 0 && (
        <p className="col-span-2 flex items-center gap-2 text-[13px] font-semibold text-wall lg:col-span-4" data-testid="summary-live">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-wall" />
          {summary.live_now} call{summary.live_now === 1 ? "" : "s"} on the line now
        </p>
      )}
    </section>
  );
}
