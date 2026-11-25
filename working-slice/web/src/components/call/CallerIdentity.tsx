import { Chip } from "@/components/ui/Chip";
import type { Caller } from "@/lib/types";

/** Who is on the line: the name on record for their number, and whether they called before. */
export function CallerIdentity({ caller, nameHeard }: { caller: Caller; nameHeard: string | null }) {
  const name = nameHeard ?? caller.name;
  return (
    <div className="flex items-center gap-3 border-b border-rule bg-haze/60 px-4 py-2.5" data-testid="caller-identity">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-iris-wash text-[14px] font-bold text-iris-deep"
      >
        {name ? name[0].toUpperCase() : "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-night" data-testid="caller-name">
          {name ?? "Name not given yet"}
          {caller.name && nameHeard && nameHeard !== caller.name && (
            <span className="font-normal text-night-faint"> (this number is {caller.name}&apos;s)</span>
          )}
        </p>
        <p className="text-[12.5px] tabular-nums text-night-soft" data-testid="caller-phone">{caller.phone_display}</p>
      </div>
      {caller.phone && (
        <Chip tone={caller.known ? "iris" : "neutral"} testId="caller-known">
          {caller.known ? `Called ${caller.earlier_calls} time${caller.earlier_calls === 1 ? "" : "s"} before` : "First call"}
        </Chip>
      )}
    </div>
  );
}
