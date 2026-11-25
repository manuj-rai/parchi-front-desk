// Bar heights as a share of the pill: an uneven row reads as a voice, an even one as a meter.
const BARS = [0.45, 0.8, 1, 0.6, 0.9, 0.5, 0.75];

/** The pill set into the headline: a voice, talking. Sized in em so it scales with the type. */
export function VoicePill() {
  return (
    <span
      aria-hidden
      className="mx-[0.1em] inline-flex h-[0.8em] w-[1.9em] translate-y-[0.08em] items-center justify-center gap-[0.075em] rounded-full bg-linear-to-r from-iris to-orchid align-baseline shadow-lg shadow-iris/35"
    >
      {BARS.map((height, i) => (
        <span
          key={i}
          className="voice-bar w-[0.07em] rounded-full bg-frost"
          style={{ height: `${height * 0.48}em`, animationDelay: `${i * -0.17}s` }}
        />
      ))}
    </span>
  );
}
