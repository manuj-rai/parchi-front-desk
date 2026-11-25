import { Chip } from "@/components/ui/Chip";
import { SCOPE_LABEL, SCOPE_TONE, TIER_LABEL } from "@/lib/labels";
import type { ServedBy, Turn } from "@/lib/types";

/**
 * What the two agents decided on this turn, side by side, with the model that served each.
 * Under the front-desk agent: its reasoning, the problem area it named, and whether this
 * clinic treats it (decided from the clinic's file, not by the agent).
 */
export function AgentReadout({ turn }: { turn: Turn }) {
  const understanding = turn.understanding;
  const safety = turn.safety;
  const danger = safety.tier !== "none";
  const scope = turn.scope;

  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="agent-readout">
      <article className="flex flex-col rounded-2xl bg-frost p-4 ring-1 ring-rule">
        <AgentHeading name="Front-desk agent" question="What does the caller want?" dot="bg-iris" />
        {understanding ? (
          <>
            <p className="mt-3 text-[20px] font-bold tracking-[-0.02em] text-night" data-testid="intent">
              {understanding.intent}
            </p>
            <ConfidenceBar value={understanding.confidence} />
            <p className="mt-2 text-[12.5px] italic leading-snug text-night-soft" data-testid="agent-thinking">
              {understanding.thinking}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="scope">
              <Chip tone={SCOPE_TONE[scope.verdict]} testId="scope-verdict">{SCOPE_LABEL[scope.verdict]}</Chip>
              {scope.see && <span className="text-[12px] text-night-soft">sent to {scope.see}</span>}
            </div>
            <dl className="mt-3 space-y-1 text-[12.5px]">
              <Fact label="Problem heard" value={understanding.concern ?? "—"} />
              <Fact label="Problem area" value={understanding.problem_area ?? "—"} />
              <Fact label="Name heard" value={understanding.name ?? "—"} />
              {understanding.intent === "book" && <Fact label="Booking for" value={understanding.booking_day} />}
              <Fact label="Don't message me" value={understanding.wants_no_messages ? "Yes" : "No"} strong={understanding.wants_no_messages} />
              <Fact label="Language" value={understanding.language} />
            </dl>
          </>
        ) : (
          <p className="mt-3 text-[13px] text-stamp">Every model failed. The caller was handed to a person.</p>
        )}
        <ServedLine served={turn.served_by.front_desk} />
      </article>

      <article className={`flex flex-col rounded-2xl p-4 ring-1 ${danger ? "bg-stamp-wash ring-stamp/25" : "bg-frost ring-rule"}`}>
        <AgentHeading name="Safety agent" question="Is there any danger?" dot="bg-stamp" />
        <p className={`mt-3 text-[20px] font-bold tracking-[-0.02em] ${danger ? "text-stamp" : "text-night"}`} data-testid="safety-tier">
          {TIER_LABEL[safety.tier]}
        </p>
        <p className="mt-1 min-h-[18px] truncate text-[12.5px] text-night-soft">{safety.sign ?? "Nothing on the doctor's list"}</p>
        <dl className="mt-3 space-y-1 text-[12.5px]">
          <Fact label="Safety model said" value={TIER_LABEL[safety.model_said as keyof typeof TIER_LABEL] ?? safety.model_said} />
          <Fact label="Word list said" value={TIER_LABEL[safety.words_said as keyof typeof TIER_LABEL] ?? safety.words_said} />
          <Fact label="Rule" value="Either one raises the alarm" />
        </dl>
        <ServedLine served={turn.served_by.safety} />
      </article>
    </div>
  );
}

function AgentHeading({ name, question, dot }: { name: string; question: string; dot: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-night">
        <span aria-hidden className={`size-2 rounded-full ${dot}`} />
        {name}
      </p>
      <p className="text-[12px] text-night-faint">{question}</p>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const unsure = value < 0.6;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div
        className="relative h-2 flex-1 rounded-full bg-mist"
        role="meter"
        aria-label="Confidence"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
      >
        <div className={`h-full rounded-full ${unsure ? "bg-haldi" : "bg-linear-to-r from-iris to-orchid"}`} style={{ width: `${value * 100}%` }} />
        <div className="absolute -inset-y-1 w-px bg-night-faint" style={{ left: "60%" }} title="Below 0.6 counts as unsure" />
      </div>
      <span className="w-[86px] text-right text-[12px] font-medium tabular-nums text-night-soft">
        {value.toFixed(2)} {unsure ? "unsure" : "sure"}
      </span>
    </div>
  );
}

function Fact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-night-faint">{label}</dt>
      <dd className={`text-right ${strong ? "font-semibold text-stamp" : "text-night-soft"}`}>{value}</dd>
    </div>
  );
}

function ServedLine({ served }: { served: ServedBy }) {
  return (
    // mt-auto keeps both cards' footers level; pt-4 keeps a gap when the card is full.
    <div className="mt-auto pt-4">
      <p className="border-t border-rule pt-2.5 text-[12px] text-night-faint">
        served by <span className="font-mono text-night-soft">{served.model}</span> in{" "}
        <span className="tabular-nums text-night-soft">{served.ms} ms</span>
        {served.fallbacks.length > 0 && (
          <span className="ml-1">
            <Chip tone="haldi">fell back from {served.fallbacks.join(", ")}</Chip>
          </span>
        )}
      </p>
    </div>
  );
}
