import { clock } from "@/lib/days";
import type { SettingsChange } from "@/lib/types";

/** Who changed the clinic's settings, when, and what. Newest first. */
export function SettingsHistory({ history }: { history: SettingsChange[] }) {
  if (history.length === 0) {
    return <p className="px-5 py-4 text-[13px] text-night-soft" data-testid="settings-history-empty">No changes yet. The details are as in the clinic file.</p>;
  }
  return (
    <ol className="divide-y divide-rule" data-testid="settings-history">
      {history.map((change) => (
        <li key={`${change.at}-${change.changed.join()}`} className="px-5 py-3">
          <p className="text-[13px] text-night">
            <span className="font-semibold">{change.by}</span>{" "}
            <span className="text-night-soft">changed {change.changed.join(", ")}</span>
          </p>
          <p className="text-[12px] text-night-faint">
            <time dateTime={change.at}>{change.at.slice(0, 10)} at {clock(change.at)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
