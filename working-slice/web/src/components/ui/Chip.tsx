import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

const TONES: Record<Tone, string> = {
  neutral: "bg-mist text-night-soft",
  iris: "bg-iris-wash text-iris-deep",
  stamp: "bg-stamp-wash text-stamp",
  wall: "bg-wall-wash text-wall",
  haldi: "bg-haldi-wash text-haldi",
};

/** A small label for a status. Colour carries meaning only: see lib/labels.ts. */
export function Chip({ tone = "neutral", children, testId }: { tone?: Tone; children: ReactNode; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold leading-4 ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
