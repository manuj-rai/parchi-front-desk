import { useId, type ReactNode } from "react";

interface PanelProps {
  eyebrow: string;          // who or what this panel is about, e.g. "The caller"
  title: string;
  aside?: ReactNode;        // a small control or status at the right of the header
  children: ReactNode;
  className?: string;
  testId?: string;
}

/** A column of the console: a card floating on the lilac backdrop, with a quiet header. */
export function Panel({ eyebrow, title, aside, children, className = "", testId }: PanelProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-testid={testId}
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-frost shadow-lg shadow-night/5 ring-1 ring-iris-wash ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-night-faint">{eyebrow}</p>
          <h2 id={headingId} className="truncate text-[16px] font-semibold tracking-[-0.01em] text-night">{title}</h2>
        </div>
        {aside}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
