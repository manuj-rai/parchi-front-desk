/** The share of checks that passed, as a ring with the count in the middle. */
export function PassRing({ passed, total }: { passed: number; total: number }) {
  const radius = 29;
  const length = 2 * Math.PI * radius;
  const share = total ? passed / total : 0;
  const allPassed = passed === total;
  return (
    <span className="relative grid size-[72px] shrink-0 place-items-center" data-testid="testlab-pass-ring">
      <svg aria-hidden viewBox="0 0 72 72" className="absolute inset-0 -rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" strokeWidth="6" className="stroke-frost" />
        <circle
          cx="36" cy="36" r={radius} fill="none" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={length} strokeDashoffset={length * (1 - share)}
          className={`transition-[stroke-dashoffset] duration-700 ${allPassed ? "stroke-wall" : "stroke-stamp"}`}
        />
      </svg>
      <span className="text-[14px] font-bold tabular-nums tracking-[-0.02em] text-night">{Math.round(share * 100)}%</span>
    </span>
  );
}
