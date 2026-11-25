import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import type { FrontDesk } from "@/hooks/useFrontDesk";
import { ROUTE_LABEL, ROUTE_TONE } from "@/lib/labels";
import { AgentReadout } from "./AgentReadout";
import { LatencyMeter } from "./LatencyMeter";
import { ModelRoutes } from "./ModelRoutes";

const STEPS = [
  "Speech to text.",
  "Two agents at once: the front-desk agent (what do they want?) and the safety agent (any danger?).",
  "A decision: answer from the board, book, escalate, ask once, or hand to a person.",
  "Text to speech. The whole turn is timed against the 2-second limit.",
];

/** Centre column: what Parchi did on one turn, and why, and how long it took. */
export function TurnTrace({ desk, className = "" }: { desk: FrontDesk; className?: string }) {
  const turn = desk.shownTurn;
  const limit = desk.system?.silence_limit_s ?? 2;

  return (
    <Panel
      eyebrow="Inside Parchi"
      title={turn ? `Turn ${desk.shownTurnNumber} of ${desk.turns.length}` : "Waiting for the caller"}
      testId="turn-trace"
      className={className}
      aside={turn && <Chip tone={ROUTE_TONE[turn.route]} testId="route-chip">route · {turn.route}</Chip>}
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {turn ? (
          <>
            <LatencyMeter timings={turn.timings_ms} limitS={limit} offline={desk.system?.mode === "offline-test"} />
            <AgentReadout turn={turn} />
            <section aria-labelledby="decision-heading" className="rounded-2xl p-4 ring-1 ring-rule">
              <h3 id="decision-heading" className="text-[12px] font-semibold text-night-faint">Decision</h3>
              <p className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-night" data-testid="route-label">{ROUTE_LABEL[turn.route]}</p>
              {turn.actions.length > 0 && (
                <ul className="mt-2.5 space-y-1.5 text-[13px] text-night-soft" data-testid="actions">
                  {turn.actions.map((action) => (
                    <li key={action} className="flex items-start gap-2">
                      <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0">
                        <circle cx="8" cy="8" r="8" className="fill-wall-wash" />
                        <path d="M4.8 8.2 7 10.4 11.2 6" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-wall" />
                      </svg>
                      {action}
                    </li>
                  ))}
                </ul>
              )}
              <blockquote className="mt-3 rounded-xl border-l-[3px] border-iris bg-haze px-3.5 py-2.5 text-[14px] leading-snug text-night">
                {turn.reply}
              </blockquote>
              <p className="mt-2 text-[12px] text-night-faint">
                spoken by <span className="font-mono text-night-soft">{turn.served_by.text_to_speech.model}</span>, heard by{" "}
                <span className="font-mono text-night-soft">{turn.served_by.speech_to_text.model}</span>
              </p>
            </section>
          </>
        ) : (
          <EmptyTrace />
        )}
        {desk.system && <ModelRoutes system={desk.system} />}
      </div>
    </Panel>
  );
}

function EmptyTrace() {
  return (
    <div className="rounded-2xl bg-haze p-5 ring-1 ring-rule" data-testid="trace-empty">
      <p className="text-[15px] font-semibold text-night">Every caller sentence goes through four steps</p>
      <ol className="mt-3 space-y-2.5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 text-[13.5px] leading-snug text-night-soft">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-iris-wash text-[12px] font-bold text-iris-deep">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
