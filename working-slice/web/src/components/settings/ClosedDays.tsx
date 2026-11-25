const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface ClosedDaysProps {
  closed: string[];
  onChange: (closed: string[]) => void;
  disabled: boolean;
}

/** The days the clinic is closed. No tokens are booked for them; a booking moves to the next open day. */
export function ClosedDays({ closed, onChange, disabled }: ClosedDaysProps) {
  const shut = new Set(closed);
  const toggle = (day: string) =>
    onChange(WEEKDAYS.filter((d) => (d === day ? !shut.has(d) : shut.has(d))));
  const everyDay = shut.size === WEEKDAYS.length;
  return (
    <fieldset disabled={disabled} data-testid="settings-closed-days">
      <legend className="text-[12.5px] font-semibold text-night-soft">Closed on</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => (
          <label
            key={day}
            className={`cursor-pointer select-none rounded-full px-3 py-1 text-[12.5px] font-semibold ring-1 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-iris has-disabled:cursor-default ${shut.has(day) ? "bg-stamp-wash text-stamp ring-stamp/30" : "bg-frost text-night-soft ring-rule-strong"}`}
          >
            <input type="checkbox" className="sr-only" checked={shut.has(day)} onChange={() => toggle(day)}
              data-testid={`closed-${day.toLowerCase()}`} />
            {day.slice(0, 3)}
          </label>
        ))}
      </div>
      <p className={`mt-1 text-[12px] ${everyDay ? "text-stamp" : "text-night-faint"}`}>
        {everyDay ? "The clinic must be open at least one day a week." : "No tokens are booked for these days; a booking moves to the next open day."}
      </p>
    </fieldset>
  );
}
