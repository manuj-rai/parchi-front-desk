"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/app/Icon";
import { PageHeader } from "@/components/app/PageHeader";
import { useStaffContext } from "@/components/app/StaffProvider";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { AccessSettings } from "./AccessSettings";
import { ClinicSettings } from "./ClinicSettings";
import { SystemSettings } from "./SystemSettings";

type Tab = "clinic" | "access" | "system";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "clinic", label: "Clinic", icon: "building" },
  { id: "access", label: "Access and security", icon: "shield" },
  { id: "system", label: "System", icon: "server" },
];

/** Everything that controls Parchi: the clinic (the doctor edits it), access, and the server. */
export function SettingsPage() {
  const staff = useStaffContext();
  const system = useSystemSettings(staff.failed);
  const [tab, setTab] = useState<Tab>("clinic");

  // A tab can be linked to (#access, #system) and survives a reload.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as Tab;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (TABS.some((item) => item.id === fromHash)) setTab(fromHash);
  }, []);
  const choose = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  };

  return (
    <>
      <PageHeader title="Settings">
        The clinic&apos;s details and the doctor&apos;s rules change what callers hear from their next sentence. Access and
        the server&apos;s settings are shown so you can check them.
      </PageHeader>
      <div role="tablist" aria-label="Settings" className="mb-4 inline-flex flex-wrap gap-1 rounded-full bg-frost/80 p-1 ring-1 ring-iris-wash">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            onClick={() => choose(item.id)}
            data-testid={`settings-tab-${item.id}`}
            className={`flex h-9 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${tab === item.id ? "bg-linear-to-r from-iris to-orchid text-white shadow-sm shadow-iris/30" : "text-night-soft hover:text-night"}`}
          >
            <Icon name={item.icon} className="size-4" />
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "clinic" && <ClinicSettings onFailure={staff.failed} />}
        {tab === "access" && <AccessSettings accounts={staff.accounts} settings={system.settings} />}
        {tab === "system" && <SystemSettings settings={system.settings} system={system.system} />}
      </div>
    </>
  );
}
