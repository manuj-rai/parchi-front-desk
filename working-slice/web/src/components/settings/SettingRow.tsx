import type { ReactNode } from "react";

/** One read-only setting: its name, its value, and a line on what it does. */
export function SettingRow({ label, value, about, testId }: { label: string; value: ReactNode; about?: string; testId?: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] font-semibold text-night-soft">{label}</dt>
      <dd className="min-w-0">
        <span className="text-[14px] font-semibold text-night" data-testid={testId}>{value}</span>
        {about && <span className="mt-0.5 block text-[12.5px] text-night-faint">{about}</span>}
      </dd>
    </div>
  );
}
