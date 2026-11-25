const STEPS = [
  {
    title: "The caller speaks",
    text: "In Hindi, Hinglish or English, in any order. Nobody is asked to press a key.",
  },
  {
    title: "Two agents read it at the same time",
    text: "The front-desk agent works out what the caller wants. The safety agent listens only for danger, so checking adds no wait. A word list backs it up in case the model misses a sign.",
  },
  {
    title: "Parchi answers aloud",
    text: "Times and tokens come from the receptionist’s token board, never from the model. If either the safety agent or the word list hears an urgent sign, the caller hears the doctor’s own signed sentence and the doctor is alerted.",
  },
];

/** The three steps of one turn. They are numbered because they happen in this order. */
export function CallSteps() {
  return (
    <ol className="mt-10 flex flex-col gap-3">
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex gap-4 rounded-[22px] bg-frost/85 p-5 ring-1 ring-iris-wash">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-iris-wash text-[15px] font-bold text-iris">
            {i + 1}
          </span>
          <div>
            <p className="text-[16px] font-semibold tracking-[-0.01em] text-night">{step.title}</p>
            <p className="mt-1.5 max-w-[56ch] text-[14.5px] leading-relaxed text-night-soft">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
