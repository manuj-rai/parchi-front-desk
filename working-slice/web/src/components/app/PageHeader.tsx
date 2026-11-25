import type { ReactNode } from "react";

/** The top of a page: what it is for, and its main actions. */
export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-5 pt-6">
      <div className="min-w-0 max-w-[68ch]">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-night sm:text-[30px]">{title}</h1>
        {children && <p className="mt-1.5 text-[14.5px] leading-relaxed text-night-soft">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
