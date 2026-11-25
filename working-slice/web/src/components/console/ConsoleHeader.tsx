import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import type { CallPhase } from "@/hooks/useFrontDesk";
import type { Tone } from "@/lib/labels";
import type { SystemInfo } from "@/lib/types";

const PHASE: Record<CallPhase, { label: string; tone: Tone }> = {
  idle: { label: "No call", tone: "neutral" },
  connecting: { label: "Connecting", tone: "neutral" },
  ready: { label: "Caller's turn", tone: "iris" },
  listening: { label: "Listening", tone: "stamp" },
  thinking: { label: "Agents working", tone: "haldi" },
  speaking: { label: "Parchi speaking", tone: "iris" },
};

interface ConsoleHeaderProps {
  system: SystemInfo | null;
  phase: CallPhase;
  onSwitchClinic: (clinicId: string) => void;
  embedded?: boolean;     // inside the app: the app's own sidebar has the logo and the links
}

export function ConsoleHeader({ system, phase, onSwitchClinic, embedded = false }: ConsoleHeaderProps) {
  const offline = system?.mode === "offline-test";
  // Demo and tests only: a production server answers for the one clinic in its settings.
  const canSwitch = Boolean(system?.clinic_switching && system.clinics.length > 1);
  const busy = phase === "connecting" || phase === "listening" || phase === "thinking" || phase === "speaking";
  return (
    <header className="p-3 sm:p-4">
      <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] bg-frost/90 px-4 py-2.5 shadow-sm shadow-night/5 ring-1 ring-iris-wash">
        {!embedded && (
        <Link
          href="/"
          data-testid="console-home-link"
          aria-label="Parchi: back to the intro page"
          className="flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
        >
          <span
            aria-hidden
            lang="hi"
            className="grid size-8 place-items-center rounded-[10px] bg-linear-to-br from-iris to-orchid text-[15px] font-semibold text-white shadow-md shadow-iris/30"
          >
            प
          </span>
          <span className="text-[17px] font-bold tracking-[-0.02em] text-night">Parchi</span>
        </Link>
        )}
        {!embedded && <span aria-hidden className="hidden h-5 w-px bg-rule sm:block" />}
        {canSwitch && system ? (
          <label className="flex min-w-0 items-center gap-2 text-[13px] text-night-soft">
            Front desk for
            <select
              value={system.clinic_profile.id}
              onChange={(event) => onSwitchClinic(event.target.value)}
              disabled={busy}
              data-testid="clinic-switcher"
              className="h-8 min-w-0 max-w-[260px] truncate rounded-full bg-mist px-3 text-[13px] font-semibold text-night outline-none ring-1 ring-rule-strong focus:ring-2 focus:ring-iris disabled:opacity-50"
            >
              {system.clinics.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name} ({choice.speciality})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="min-w-0 truncate text-[13px] text-night-soft">
            Front desk for <span className="font-semibold text-night" data-testid="clinic-name">{system?.clinic ?? "…"}</span>
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!embedded && (
            <Link
              href="/app/"
              data-testid="console-dashboard-link"
              className="rounded-full px-3 py-1 text-[12.5px] font-semibold text-iris-deep ring-1 ring-iris/25 transition-colors hover:bg-iris-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
              Open the app
            </Link>
          )}
          {/* Announced to screen readers as the call moves on. */}
          <span role="status">
            <Chip tone={PHASE[phase].tone} testId="call-phase">{PHASE[phase].label}</Chip>
          </span>
          {system && (
            <Chip tone={offline ? "haldi" : "wall"} testId="system-mode">
              {offline ? "Offline test mode · stand-in models" : "Live models"}
            </Chip>
          )}
        </div>
      </div>
    </header>
  );
}
