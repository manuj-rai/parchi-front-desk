import { JOB_LABEL } from "@/lib/labels";
import type { SystemInfo } from "@/lib/types";

/** Each AI job's models in order. A model whose provider has no key here is shown struck through. */
export function ModelRoutes({ system }: { system: SystemInfo }) {
  return (
    <section aria-labelledby="routes-heading" className="rounded-2xl p-4 ring-1 ring-rule" data-testid="model-routes">
      <h3 id="routes-heading" className="text-[13px] font-semibold text-night">Model routing</h3>
      <p className="text-[12px] text-night-faint">Tried in order; if one fails or runs out of time, the next one answers.</p>
      {/* Scrolls sideways on a phone. Relative, so the screen-reader text inside stays clipped;
          focusable, so the scroll works from the keyboard too. */}
      <div
        className="relative mt-2 overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
        tabIndex={0}
        role="region"
        aria-labelledby="routes-heading"
        data-testid="model-routes-scroll"
      >
        <table className="w-full min-w-[420px] text-[12.5px]">
          <thead className="sr-only">
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Models, in order</th>
              <th scope="col">Time limit</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(system.routes).map(([job, route]) => (
              <tr key={job} className="border-t border-rule first:border-t-0">
                <th scope="row" className="w-[132px] py-2 pr-3 text-left font-semibold text-night-soft">
                  {JOB_LABEL[job] ?? job}
                </th>
                <td className="py-2">
                  <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {route.order.map((model, index) => {
                      const active = route.active.includes(model);
                      return (
                        <li key={model} className="flex items-center gap-1.5">
                          {index > 0 && <span aria-hidden className="text-night-ghost">→</span>}
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[11.5px] ${active ? "bg-iris-wash text-iris-deep" : "text-night-faint line-through decoration-night-ghost"}`}
                            title={active ? "Key set: can serve" : "No key here: skipped"}
                          >
                            {model}
                            {!active && <span className="sr-only"> (no key here: skipped)</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </td>
                <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums text-night-faint" title="Time limit per attempt">
                  {route.timeout_s} s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
