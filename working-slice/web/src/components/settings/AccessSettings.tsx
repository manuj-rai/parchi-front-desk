"use client";

import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import type { Role, StaffAccounts, SystemSettings } from "@/lib/types";
import { SettingRow } from "./SettingRow";

const CAN: Record<Role, string> = {
  doctor: "Review calls, listen to and take over live calls, change the clinic's settings.",
  reception: "Read calls, listen to and take over live calls, run the board. Cannot review or change settings.",
};

interface AccessSettingsProps {
  accounts: StaffAccounts | null;
  settings: SystemSettings | null;
}

/** Who can sign in, as what, and how sign-in is protected. Passwords change in .env, never here. */
export function AccessSettings({ accounts, settings }: AccessSettingsProps) {
  const passwordSet: Record<Role, boolean> = {
    doctor: settings?.doctor_password_set ?? false,
    reception: settings?.reception_password_set ?? false,
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start" data-testid="settings-access">
      <Panel eyebrow="Staff" title="Who can sign in">
        <ul className="divide-y divide-rule px-5">
          {(accounts?.roles ?? []).map(({ role, name }) => (
            <li key={role} className="flex flex-wrap items-start gap-3 py-4" data-testid={`access-${role}`}>
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-iris-wash text-[15px] font-bold text-iris-deep">
                {name.replace(/^Dr\.?\s*/, "")[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-night">
                  {name} <span className="font-normal text-night-soft">({role === "doctor" ? "doctor" : "receptionist"})</span>
                </span>
                <span className="block text-[13px] text-night-soft">{CAN[role]}</span>
              </span>
              {passwordSet[role] ? (
                <Chip tone="wall">Own password</Chip>
              ) : accounts?.test_logins ? (
                <Chip tone="haldi">Test sign-in: {role}-test</Chip>
              ) : (
                <Chip tone="stamp">Not set up</Chip>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="space-y-4">
        <Panel eyebrow="Built in" title="How sign-in is protected">
          <dl className="divide-y divide-rule px-5">
            <SettingRow label="Passwords" value="Stored only as hashes" about="PBKDF2-SHA256, 600,000 iterations." />
            <SettingRow label="Wrong passwords" value="5 tries in 10 minutes" about="Then that address must wait." />
            <SettingRow label="Sessions" value={settings ? `${settings.session_hours} hours` : "…"} testId="access-session-hours"
              about="An HttpOnly, SameSite=Strict cookie. Signing out ends it at once." />
            <SettingRow label="Secure cookies" value={settings?.secure_cookies ? "On" : "Off (not production)"}
              about="On in production, which needs HTTPS." />
            <SettingRow label="Audit" value="Every sign-in, opened call, take-over and review" about="Shown on each call as 'Who has seen this call'." />
          </dl>
        </Panel>
        <Panel eyebrow="For whoever runs the server" title="Set or change a password">
          <ol className="list-decimal space-y-1.5 py-4 pl-10 pr-5 text-[13px] text-night-soft">
            <li>On the server, run <code className="rounded bg-mist px-1.5 py-0.5 text-[12.5px] text-night">python -m parchi.auth hash</code>.</li>
            <li>Put the line it prints in <code className="rounded bg-mist px-1.5 py-0.5 text-[12.5px] text-night">working-slice/.env</code> as PARCHI_DOCTOR_PASSWORD_HASH or PARCHI_RECEPTION_PASSWORD_HASH.</li>
            <li>Restart the server. Everyone is signed out.</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
