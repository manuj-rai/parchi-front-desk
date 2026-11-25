// The product decisions of 23 and 24 November, as the doctor would hear them.
const PROMISES = [
  "Gives urgency advice only in your own signed words.",
  "Never diagnoses, names a medicine, or says a symptom is nothing.",
  "Never makes up a time or a token: both come from your board.",
  "Says it is the clinic’s AI assistant whenever a caller asks.",
  "Keeps every call’s recording and transcript for your review, the most serious first.",
  "Still unsure after one question, it passes the caller to your receptionist.",
];

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0">
      <circle cx="10" cy="10" r="10" className="fill-frost" />
      <path d="M6 10.2 8.6 12.8 14 7.4" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="stroke-dusk" />
    </svg>
  );
}

/** What Parchi promises the doctor: the deep indigo card. */
export function PromisesCard() {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-dusk p-7 text-white shadow-2xl shadow-dusk/30 sm:p-8">
      <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-orchid/40 blur-3xl" />
      <p className="relative max-w-[24ch] text-[22px] font-bold leading-snug tracking-[-0.02em]">
        What Parchi promises the doctor
      </p>
      <p className="relative mt-2 max-w-[40ch] text-[14px] leading-relaxed text-white/75">
        The doctor signs a short list of warning signs and the exact sentence for each. Parchi follows it and never goes past it.
      </p>
      <ul className="relative mt-6 flex flex-col gap-3.5 rounded-[20px] bg-white/10 p-5 ring-1 ring-white/15">
        {PROMISES.map((promise) => (
          <li key={promise} className="flex gap-3 text-[14.5px] leading-snug">
            <Check />
            {promise}
          </li>
        ))}
      </ul>
    </div>
  );
}
