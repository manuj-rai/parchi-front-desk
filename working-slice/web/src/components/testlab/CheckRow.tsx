import { Icon } from "@/components/app/Icon";
import { Chip } from "@/components/ui/Chip";
import { ROUTE_SHORT, TIER_LABEL } from "@/lib/labels";
import type { CheckResult } from "@/lib/types";

/** One check: passed or failed, what it protects, how long it took, and, opened, what was said and answered. */
export function CheckRow({ result, slowest }: { result: CheckResult; slowest: number }) {
  return (
    <li data-testid={`check-${result.id}`} data-passed={result.passed}>
      <details className={`group rounded-2xl ring-1 ${result.passed ? "bg-frost ring-rule" : "bg-stamp-wash ring-stamp/25"}`} open={!result.passed}>
        <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris [&::-webkit-details-marker]:hidden">
          <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${result.passed ? "bg-wall-wash text-wall" : "bg-stamp text-white"}`}>
            <Icon name={result.passed ? "check" : "cross"} className="size-3.5" />
            <span className="sr-only">{result.passed ? "Passed" : "Failed"}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-night">{result.label}</span>
            <span className="block text-[12.5px] text-night-soft">{result.why}</span>
          </span>
          <span className="w-16 shrink-0 pt-0.5 text-right">
            <span className="block text-[12px] tabular-nums text-night-faint">{result.ms} ms</span>
            <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-mist">
              <span className={`block h-full rounded-full ${result.passed ? "bg-iris/60" : "bg-stamp"}`}
                style={{ width: `${Math.max(6, Math.round((result.ms / slowest) * 100))}%` }} />
            </span>
          </span>
        </summary>
        <div className="space-y-2.5 border-t border-rule px-3.5 py-3">
          {result.problems.length > 0 && (
            <ul className="space-y-1 text-[13px] font-medium text-stamp" data-testid={`check-${result.id}-problems`}>
              {result.problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          )}
          {result.turns.map((turn, index) => (
            <div key={index} className="space-y-1.5">
              <p className="max-w-[92%] rounded-2xl rounded-tl-md bg-haze px-3 py-2 text-[13px] text-night ring-1 ring-rule">
                <span className="sr-only">Caller: </span>{turn.said}
              </p>
              <p className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md bg-linear-to-br from-iris to-orchid px-3 py-2 text-[13px] text-white">
                <span className="sr-only">Parchi: </span>{turn.reply}
              </p>
              <p className="flex flex-wrap justify-end gap-1.5">
                <Chip>{ROUTE_SHORT[turn.route] ?? turn.route}</Chip>
                {turn.tier !== "none" && <Chip tone="stamp">{TIER_LABEL[turn.tier]}</Chip>}
                {turn.actions.map((action) => <Chip key={action} tone="wall">{action}</Chip>)}
              </p>
            </div>
          ))}
        </div>
      </details>
    </li>
  );
}
