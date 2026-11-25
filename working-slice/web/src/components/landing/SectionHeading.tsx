import type { ReactNode } from "react";

/** A section's title and the one or two sentences that set it up. */
export function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="max-w-[680px]">
      <h2 className="max-w-[22ch] text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-night sm:text-[40px]">{title}</h2>
      {children && <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.6] text-night-soft">{children}</p>}
    </div>
  );
}
