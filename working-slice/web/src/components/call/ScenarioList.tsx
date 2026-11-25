"use client";

import { SCENARIOS } from "@/lib/scenarios";

/** One click says a sentence from the brief's pilot calls. For testing by hand and on camera. */
export function ScenarioList({ enabled, onSay }: { enabled: boolean; onSay: (text: string) => void }) {
  return (
    <details className="group" open>
      <summary
        data-testid="scenario-toggle"
        className="flex cursor-pointer select-none list-none items-center gap-1.5 rounded-md text-[12.5px] font-semibold text-night-soft hover:text-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 transition-transform duration-150 group-open:rotate-90">
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Calls from the brief
        {!enabled && <span className="font-normal text-night-faint">(start a call to use them)</span>}
      </summary>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            disabled={!enabled}
            title={scenario.text}
            onClick={() => onSay(scenario.text)}
            data-testid={`scenario-${scenario.id}`}
            className="rounded-full bg-frost px-3 py-1 text-[12.5px] font-medium text-night-soft ring-1 ring-rule-strong transition-colors duration-150 hover:bg-iris-wash hover:text-iris-deep hover:ring-iris/30 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
          >
            {scenario.label}
          </button>
        ))}
      </div>
    </details>
  );
}
