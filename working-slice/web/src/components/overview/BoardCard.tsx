import Link from "next/link";
import { Icon } from "@/components/app/Icon";
import type { ClinicSnapshot } from "@/lib/types";

/** The token board in one card: what callers hear now, and the queue. */
export function BoardCard({ clinic }: { clinic: ClinicSnapshot | null }) {
  const active = clinic?.tokens.filter((token) => token.status !== "cancelled") ?? [];
  const waiting = active.filter((token) => token.status === "waiting").length;
  const doctorIn = clinic?.doctor === "in";

  return (
    <section aria-labelledby="board-card-title" className="flex flex-col rounded-[24px] bg-frost p-4 ring-1 ring-iris-wash" data-testid="overview-board">
      <h2 id="board-card-title" className="flex items-center gap-2 text-[15px] font-semibold text-night">
        <Icon name="appointments" className="size-[18px] text-iris-deep" />
        Today&apos;s board
      </h2>
      {clinic ? (
        <>
          <p className={`mt-3 rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug text-night ${doctorIn ? "bg-wall-wash" : "bg-haldi-wash"}`}>
            <span className={`block text-[12px] font-semibold ${doctorIn ? "text-wall" : "text-haldi"}`}>What callers hear now</span>
            {clinic.status_line}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Now seeing", clinic.now_serving || "—"],
              ["Waiting", waiting],
              ["Tokens today", active.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-haze px-2 py-2 ring-1 ring-rule">
                <dt className="text-[11.5px] font-medium text-night-faint">{label}</dt>
                <dd className="text-[20px] font-bold tabular-nums text-night">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <div className="mt-3 h-28 animate-pulse rounded-2xl bg-mist" aria-hidden />
      )}
      <Link href="/app/appointments/" data-testid="overview-board-link"
        className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[13.5px] font-semibold text-iris-deep hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris">
        Open the board <Icon name="arrow" className="size-4" />
      </Link>
    </section>
  );
}
