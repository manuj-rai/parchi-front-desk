import type { ReactNode } from "react";

interface StatCardProps {
  value: string;
  children: ReactNode;    // what the number counts, as a sentence
  note?: ReactNode;       // what Parchi does about it, or the caveat
}

/** A number in a pill, then what it means: the reference's results card, with a soft glow. */
export function StatCard({ value, children, note }: StatCardProps) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[26px] bg-frost/90 p-6 shadow-[0_20px_50px_-28px] shadow-night/25 ring-1 ring-iris-wash">
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-iris/10 blur-2xl" />
      <span className="relative self-start rounded-full bg-linear-to-br from-iris-wash to-frost px-4 py-1.5 ring-1 ring-iris/15">
        <span className="bg-linear-to-r from-iris to-orchid bg-clip-text text-[28px] font-bold leading-none tracking-[-0.03em] text-transparent">
          {value}
        </span>
      </span>
      <p className="relative mt-5 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-night">{children}</p>
      {note && <p className="relative mt-3 text-[14px] leading-relaxed text-night-soft">{note}</p>}
    </div>
  );
}
