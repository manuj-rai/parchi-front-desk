import type { ProblemAreaInfo } from "@/lib/types";

interface TreatsChecklistProps {
  areas: ProblemAreaInfo[];
  treats: string[];
  onChange: (treats: string[]) => void;
  disabled: boolean;
}

/**
 * What the doctor treats, one problem area per line. A caller whose problem is not ticked
 * gets no token: Parchi says who to see instead (shown beside each unticked area).
 */
export function TreatsChecklist({ areas, treats, onChange, disabled }: TreatsChecklistProps) {
  const ticked = new Set(treats);
  const toggle = (id: string) =>
    onChange(ticked.has(id) ? treats.filter((area) => area !== id) : [...treats, id]);

  return (
    <fieldset disabled={disabled} data-testid="settings-treats">
      <legend className="text-[12.5px] font-semibold text-night-soft">What the doctor treats</legend>
      <p className="mt-0.5 text-[12px] text-night-faint">
        Anything not ticked gets no token. Parchi tells the caller who to see, and to go to a hospital if it gets worse.
      </p>
      <ul className="mt-2 divide-y divide-rule rounded-2xl ring-1 ring-rule">
        {areas.map((area) => {
          const on = ticked.has(area.id);
          return (
            <li key={area.id}>
              <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 has-disabled:cursor-default">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(area.id)}
                  data-testid={`treats-${area.id}`}
                  className="mt-0.5 size-4 shrink-0 accent-iris"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-night">{area.label}</span>
                  <span className="block text-[12px] text-night-faint">{area.describes}</span>
                </span>
                <span className={`shrink-0 text-right text-[12px] ${on ? "font-semibold text-wall" : "text-night-soft"}`}>
                  {on ? "Treated here" : <>Sent to <span lang="hi-Latn">{area.see}</span></>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {treats.length === 0 && (
        <p className="mt-1.5 text-[12px] text-stamp" data-testid="treats-none">Tick at least one: a clinic must treat something.</p>
      )}
    </fieldset>
  );
}
