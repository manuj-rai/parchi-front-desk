"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FrontDesk } from "@/hooks/useFrontDesk";
import { dayLabel } from "@/lib/days";
import { TokenSlip } from "./TokenSlip";

// The doctor's time as the receptionist types it: 24-hour, like "11:30" or "17:45".
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** The receptionist's page, on her own phone. Her taps are the clinic's source of truth. */
/** What the board needs: the console passes its whole state, the Appointments page its own board. */
type BoardSource = Pick<FrontDesk, "clinic" | "updateBoard" | "cancelToken">;

export function TokenBoard({ desk }: { desk: BoardSource }) {
  const [typedEta, setEta] = useState<string | null>(null);   // null: show the board's current time
  const etaHintId = useId();
  const clinic = desk.clinic;
  if (!clinic) {
    return <p className="p-4 text-[13px] text-night-faint" data-testid="token-board-loading">Loading the board…</p>;
  }

  const eta = typedEta ?? clinic.eta;
  const waiting = Math.max(0, clinic.tokens.length - clinic.now_serving);
  const doctorIn = clinic.doctor === "in";
  const etaValid = TIME.test(eta.trim());

  return (
    <div className="space-y-4 p-4" data-testid="token-board">
      <div className={`rounded-2xl p-3.5 ${doctorIn ? "bg-wall-wash" : "bg-haldi-wash"}`}>
        <p className={`text-[12px] font-semibold ${doctorIn ? "text-wall" : "text-haldi"}`}>What callers hear now</p>
        <p className="mt-1 text-[14px] leading-snug text-night" aria-live="polite" data-testid="status-line">
          {clinic.status_line}
        </p>
      </div>

      <fieldset>
        <legend className="text-[12px] font-semibold text-night-soft">The doctor</legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={doctorIn ? "secondary" : "primary"} onClick={() => desk.updateBoard("arrived")} data-testid="board-arrived">
            Doctor aa gaye
          </Button>
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              if (etaValid) desk.updateBoard("eta", eta.trim());
            }}
          >
            <input
              value={eta}
              onChange={(event) => setEta(event.target.value)}
              aria-label="Doctor's expected time"
              aria-invalid={!etaValid}
              aria-describedby={etaValid ? undefined : etaHintId}
              inputMode="numeric"
              maxLength={5}
              autoComplete="off"
              data-testid="board-eta-input"
              className={`h-8 w-[66px] rounded-full bg-frost px-2 text-center text-[13px] font-medium tabular-nums text-night outline-none ring-1 transition-shadow focus:ring-2 ${etaValid ? "ring-rule-strong focus:ring-iris" : "ring-stamp focus:ring-stamp"}`}
            />
            <Button type="submit" size="sm" disabled={!etaValid} data-testid="board-eta">
              Time set
            </Button>
          </form>
          <Button size="sm" variant="quiet" onClick={() => desk.updateBoard("left")} data-testid="board-left">
            Chale gaye
          </Button>
        </div>
        {!etaValid && (
          <p id={etaHintId} className="mt-1.5 text-[12px] text-stamp" data-testid="board-eta-error">
            Type the time as hours and minutes, like 11:30 or 17:45.
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <Count label="Now seeing" value={clinic.now_serving || "—"} testId="now-serving" />
        <Count label="Waiting" value={waiting} testId="waiting" />
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => desk.updateBoard("walk_in")} data-testid="board-walk-in">
          + Walk-in token
        </Button>
        <Button size="sm" className="flex-1" onClick={() => desk.updateBoard("next")} data-testid="board-next">
          Next patient
        </Button>
      </div>

      {!clinic.open_today && (
        <p className="rounded-2xl bg-haldi-wash px-3.5 py-2.5 text-[12.5px] text-haldi" data-testid="board-closed-today">
          The clinic is closed today by its days. Phone bookings go to the next open day. Set the doctor&apos;s time to open today.
        </p>
      )}

      {clinic.tokens.length ? (
        <ol className="space-y-2" aria-label="Tokens today">
          {clinic.tokens.map((token) => (
            <TokenSlip key={token.id} token={token} onCancel={() => desk.cancelToken(token.number)} />
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed border-rule-strong px-4 py-3 text-[12.5px] text-night-faint">
          No tokens yet today. Walk-ins and phone bookings appear here.
        </p>
      )}

      {clinic.later.length > 0 && (
        <section aria-label="Booked for later days" data-testid="tokens-later">
          <p className="text-[12px] font-semibold text-night-soft">Booked for later</p>
          <ol className="mt-2 space-y-2">
            {clinic.later.map((token) => (
              <TokenSlip key={token.id} token={token} when={dayLabel(token.day, clinic.day)} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Count({ label, value, testId }: { label: string; value: number | string; testId: string }) {
  return (
    <div className="rounded-2xl bg-haze px-3.5 py-2.5 ring-1 ring-rule">
      <p className="text-[12px] font-medium text-night-faint">{label}</p>
      <p className="text-[26px] font-bold tabular-nums leading-tight tracking-[-0.02em] text-night" data-testid={testId}>{value}</p>
    </div>
  );
}
