import { seconds } from "@/lib/labels";
import type { Turn } from "@/lib/types";

const STAGES = [
  { key: "speech_to_text", label: "Speech to text", colour: "bg-iris/35" },
  { key: "agents", label: "Two agents, in parallel", colour: "bg-iris" },
  { key: "text_to_speech", label: "First sentence to speech", colour: "bg-orchid" },
] as const;

interface LatencyMeterProps {
  timings: Turn["timings_ms"];
  limitS: number;
  offline: boolean;
}

/**
 * How long until the caller hears the answer start, against the red 2-second line.
 * The number that decides v1. ("Ji, ek second" plays meanwhile, so the first second is not silent.)
 */
export function LatencyMeter({ timings, limitS, offline }: LatencyMeterProps) {
  const limitMs = limitS * 1000;
  const scale = Math.max(timings.first_sound, limitMs * 1.5);
  const over = timings.first_sound - limitMs;
  const percent = (ms: number) => `${(100 * ms) / scale}%`;

  return (
    <section aria-labelledby="latency-heading" className="rounded-2xl bg-haze p-4 ring-1 ring-rule" data-testid="latency-meter">
      <h3 id="latency-heading" className="text-[12px] font-semibold text-night-faint">Until the answer starts</h3>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[32px] font-bold leading-none tracking-[-0.03em] tabular-nums text-night" data-testid="latency-total">
          {seconds(timings.first_sound)}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${over > 0 ? "bg-stamp-wash text-stamp" : "bg-wall-wash text-wall"}`}
          data-testid="latency-verdict"
        >
          {over > 0 ? `over the ${limitS}-second limit by ${seconds(over)}` : `within the ${limitS}-second limit`}
        </span>
      </div>
      {offline && (
        <p className="mt-2 text-[12.5px] text-haldi">Offline test mode: stand-in models answer instantly, so these timings are not real.</p>
      )}

      <div className="relative mt-4 h-3 rounded-full bg-mist" aria-hidden>
        <div className="flex h-full overflow-hidden rounded-full">
          {STAGES.map((stage) => (
            <div key={stage.key} className={stage.colour} style={{ width: percent(timings[stage.key]) }} />
          ))}
        </div>
        <div className="absolute -inset-y-1.5 w-[2px] -translate-x-1/2 rounded-full bg-stamp" style={{ left: percent(limitMs) }} />
      </div>
      <div className="relative h-5 text-[12px] font-medium text-stamp" aria-hidden>
        <span className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap" style={{ left: percent(limitMs) }}>
          {limitS} s: callers start hanging up
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        {STAGES.map((stage) => (
          <div key={stage.key} className="rounded-xl bg-frost px-3 py-2 ring-1 ring-rule">
            <dt className="flex items-center gap-1.5 text-[12px] text-night-faint">
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${stage.colour}`} />
              {stage.label}
            </dt>
            <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-night">
              {timings[stage.key]} ms
              {stage.key === "text_to_speech" && !offline && timings.text_to_speech < 50 && (
                <span className="ml-1.5 text-[12px] font-medium text-wall">pre-made</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
