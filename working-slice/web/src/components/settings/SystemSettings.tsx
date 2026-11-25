"use client";

import { ModelRoutes } from "@/components/trace/ModelRoutes";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import type { SystemInfo, SystemSettings as Settings } from "@/lib/types";
import { SettingRow } from "./SettingRow";

function offset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** What this server runs with. Read-only on purpose: these live in .env, beside the keys, and
 *  the server checks them when it starts, so a browser can never weaken them. */
export function SystemSettings({ settings, system }: { settings: Settings | null; system: SystemInfo | null }) {
  if (!settings) {
    return <div className="h-72 animate-pulse rounded-[24px] bg-frost/60" aria-hidden />;
  }
  const offline = settings.mode === "offline-test";
  return (
    <div className="space-y-4" data-testid="settings-system">
      <p className="rounded-2xl bg-iris-wash/70 px-4 py-3 text-[13px] text-iris-deep">
        These are set in <code className="font-semibold">working-slice/.env</code> and checked when the server starts. They
        are shown here, not changed here, so that a browser can never weaken them. API keys and password hashes are never shown.
      </p>
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <Panel eyebrow="This server" title="Running"
          aside={<Chip tone={offline ? "haldi" : "wall"} testId="system-mode-chip">{offline ? "Offline test mode" : "Live models"}</Chip>}>
          <dl className="divide-y divide-rule px-5">
            <SettingRow label="Environment" value={settings.environment} testId="system-environment"
              about="Production refuses test mode, test sign-ins, and a missing doctor's password." />
            <SettingRow label="Clinic" value={system?.clinic ?? settings.clinic} about="The clinic this server answers for." />
            <SettingRow label="Clinic's time zone" value={offset(settings.clinic_utc_offset_minutes)} about="Decides 'today' and 'yesterday'." />
            <SettingRow label="Keep calls for" value={`${settings.retention_days} days`}
              about="Calls, recordings and appointments older than this are deleted at start-up." />
            <SettingRow label="Largest recording" value={`${settings.max_upload_mb} MB`} about="One caller turn." />
          </dl>
        </Panel>
        <Panel eyebrow="On every call" title="Voice and agents">
          <dl className="divide-y divide-rule px-5">
            <SettingRow label="Silence limit" value={`${settings.silence_limit_s} s`}
              about="Callers who heard more silence hung up three times as often." />
            <SettingRow label="Unsure below" value={settings.confidence_floor.toFixed(2)}
              about="Under this, Parchi asks one either-or question, then hands to a person." />
            <SettingRow label="Voice" value={settings.tts_voice} />
            <SettingRow label="Speech language" value={settings.stt_language || "detected"}
              about="Keeps Hindi in Devanagari, which the danger word list reads." />
          </dl>
        </Panel>
      </div>
      {system && (
        <Panel eyebrow="Each AI job, in order" title="Models">
          <div className="p-4">
            <ModelRoutes system={system} />
          </div>
        </Panel>
      )}
    </div>
  );
}
