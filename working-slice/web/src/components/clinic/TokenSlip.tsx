import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { formatPhone } from "@/lib/phone";
import type { Token } from "@/lib/types";

interface TokenSlipProps {
  token: Token;
  when?: string;                 // for a later day: "Tomorrow", "Mon 30 Nov"
  onCancel?: () => void;         // today's waiting tokens: the receptionist can cancel
}

/** One token, drawn as a parchi: a slip torn from a pad, with its number stamped on it. */
export function TokenSlip({ token, when, onCancel }: TokenSlipProps) {
  const done = token.status === "seen" || token.status === "cancelled";
  return (
    <li
      data-testid={`token-${token.number}`}
      data-status={token.status}
      className={`slip flex items-center gap-3 rounded-xl px-3.5 pb-2.5 pt-3 ring-1 ${token.status === "seeing" ? "ring-2 ring-iris" : "ring-rule"} ${done ? "opacity-55" : ""}`}
    >
      <span className="w-9 text-[22px] font-bold tabular-nums leading-none tracking-[-0.02em] text-iris-deep">{token.number}</span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13.5px] font-semibold text-night ${token.status === "cancelled" ? "line-through" : ""}`}>
          {token.name}
        </p>
        <p className="text-[12px] tabular-nums text-night-faint">
          {when && <span className="font-semibold text-night-soft">{when} · </span>}
          {token.source === "phone" ? "booked by phone" : "walk-in"}
          {token.phone && <span data-testid={`token-${token.number}-phone`}> · {formatPhone(token.phone)}</span>}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {token.status === "seeing" && <Chip tone="iris">with the doctor</Chip>}
        {token.status === "seen" && <Chip>seen</Chip>}
        {token.status === "cancelled" && <Chip testId={`token-${token.number}-cancelled`}>cancelled</Chip>}
        {token.see_first && token.status === "waiting" && <Chip tone="stamp">see first</Chip>}
        {token.no_contact && !done && <Chip tone="haldi">no call · no message</Chip>}
        {onCancel && token.status === "waiting" && (
          <Button size="sm" variant="quiet" className="h-6 px-2 text-[11.5px]" onClick={onCancel}
            aria-label={`Cancel token ${token.number}`} data-testid={`token-${token.number}-cancel`}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  );
}
