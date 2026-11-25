// From the decision memo: the answer starts after 2.1 to 3.9 s (median 2.7), against a 2 s limit.
const SCALE_MAX = 4;
const LIMIT = 2;
const LOW = 2.1;
const HIGH = 3.9;
const MEDIAN = 2.7;

const pct = (seconds: number) => `${(seconds / SCALE_MAX) * 100}%`;

/** The one result that is not good enough yet, drawn against the limit it misses. */
export function LatencyCard() {
  return (
    <div className="flex flex-col rounded-[24px] bg-frost/85 p-6 shadow-lg shadow-night/5 ring-1 ring-iris-wash md:col-span-2" data-testid="latency-card">
      <span className="self-start rounded-full bg-stamp-wash px-4 py-1.5 text-[26px] font-bold leading-none tracking-[-0.03em] text-stamp">
        2.7 s
      </span>
      <p className="mt-5 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-night">
        is the median wait before the answer starts. The limit is 2 seconds, and Parchi is not under it yet.
      </p>

      <div className="mt-7" role="img" aria-label="Measured wait from 2.1 to 3.9 seconds, median 2.7, against a 2-second limit">
        <div className="relative h-3 rounded-full bg-haze">
          <div className="absolute inset-y-0 rounded-full bg-iris/30" style={{ left: pct(LOW), width: pct(HIGH - LOW) }} />
          <div className="absolute -inset-y-1 w-1 -translate-x-1/2 rounded-full bg-iris" style={{ left: pct(MEDIAN) }} />
          <div className="absolute -inset-y-2.5 w-0.5 -translate-x-1/2 bg-stamp" style={{ left: pct(LIMIT) }} />
        </div>
        <div className="relative mt-3 h-4 text-[12px] text-night-soft">
          <span className="absolute left-0">0 s</span>
          <span className="absolute -translate-x-1/2 font-semibold text-stamp" style={{ left: pct(LIMIT) }}>2 s limit</span>
          <span className="absolute right-0">4 s</span>
        </div>
      </div>

      <p className="mt-5 text-[14px] leading-relaxed text-night-soft">
        Measured from 2.1 to 3.9 seconds. Pre-made audio and choosing models by measurement already cut it from 3.8 to 6.5 seconds.
        Streaming speech-to-text should close the rest, but that is not shown yet.
      </p>
    </div>
  );
}
