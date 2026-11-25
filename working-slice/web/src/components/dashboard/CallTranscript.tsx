import { Chip } from "@/components/ui/Chip";
import { clock } from "@/lib/days";
import { ROUTE_SHORT, TIER_LABEL } from "@/lib/labels";
import type { LoggedTurn } from "@/lib/types";

/** What was said, turn by turn, and what Parchi did each time. For the doctor to check. */
export function CallTranscript({ turns }: { turns: LoggedTurn[] }) {
  if (!turns.length) {
    return <p className="text-[13px] text-night-soft" data-testid="transcript-empty">The caller hung up after the greeting.</p>;
  }
  return (
    <ol className="space-y-4" data-testid="transcript">
      {turns.map((turn) => {
        const danger = turn.safety_tier !== "none";
        return (
          <li key={turn.n} data-testid={`transcript-turn-${turn.n}`}>
            <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-night-faint">
              <span className="font-semibold text-night-soft">Turn {turn.n}</span>
              <span className="tabular-nums">{clock(turn.at)}</span>
              <Chip>{ROUTE_SHORT[turn.route]}</Chip>
              {danger && (
                <Chip tone="stamp">
                  {TIER_LABEL[turn.safety_tier]}
                  {turn.safety_sign ? `: ${turn.safety_sign}` : ""}
                </Chip>
              )}
            </p>
            <div className="flex flex-col gap-1.5">
              {turn.caller_text && (
                <p className="max-w-[90%] self-start rounded-2xl rounded-tl-md bg-haze px-3.5 py-2 text-[14px] leading-snug text-night ring-1 ring-rule">
                  <span className="sr-only">Caller: </span>
                  {turn.caller_text}
                </p>
              )}
              {turn.reply && turn.reply_by && (
                <>
                  <span className="self-end px-1 text-[11.5px] font-semibold text-dusk">{turn.reply_by}</span>
                  <p className="-mt-1 max-w-[90%] self-end rounded-2xl rounded-tr-md bg-dusk px-3.5 py-2 text-[14px] leading-snug text-white" data-testid={`transcript-staff-${turn.n}`}>
                    <span className="sr-only">{turn.reply_by}: </span>
                    {turn.reply}
                  </p>
                </>
              )}
              {turn.reply && !turn.reply_by && (
                <p className={`max-w-[90%] self-end rounded-2xl rounded-tr-md px-3.5 py-2 text-[14px] leading-snug text-white ${danger ? "bg-stamp" : "bg-linear-to-br from-iris to-orchid"}`}>
                  <span className="sr-only">Parchi: </span>
                  {turn.reply}
                </p>
              )}
            </div>
            {turn.actions.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap justify-end gap-1.5 text-[12px] text-night-soft">
                {turn.actions.map((action) => (
                  <li key={action} className="rounded-full bg-wall-wash px-2 py-0.5 text-wall">{action}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
