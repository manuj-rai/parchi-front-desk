"use client";

import { useEffect, useState } from "react";
import { api, staffApi } from "@/lib/api";
import type { SystemInfo, SystemSettings } from "@/lib/types";

/** What this server runs with (from working-slice/.env), and its model routing. Read-only. */
export function useSystemSettings(onFailure: (failure: unknown) => void) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  useEffect(() => {
    staffApi.system().then(setSettings, onFailure);
    api.system().then(setSystem, onFailure);
  }, [onFailure]);
  return { settings, system };
}
