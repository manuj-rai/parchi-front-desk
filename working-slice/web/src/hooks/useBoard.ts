"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BoardAction, ClinicSnapshot, SystemInfo } from "@/lib/types";

const REFRESH_MS = 5_000;   // calls book tokens in the background; the board catches up within seconds

/** The receptionist's token board, outside a call: read it, tap it, keep it fresh. */
export function useBoard(onFailure: (failure: unknown) => void) {
  const [clinic, setClinic] = useState<ClinicSnapshot | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);

  const reload = useCallback(async () => {
    try {
      setClinic(await api.clinic());
    } catch (failure) {
      onFailure(failure);
    }
  }, [onFailure]);

  useEffect(() => {
    api.system().then(setSystem, onFailure);
    // reload() awaits the API before setting state: not a synchronous update inside the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const timer = window.setInterval(() => {
      if (!document.hidden) void reload();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload, onFailure]);

  const updateBoard = useCallback(
    async (action: BoardAction, eta?: string) => {
      try {
        setClinic(await api.updateBoard(action, { eta }));
      } catch (failure) {
        onFailure(failure);
      }
    },
    [onFailure],
  );

  const cancelToken = useCallback(
    async (number: number) => {
      try {
        setClinic(await api.updateBoard("cancel", { number }));
      } catch (failure) {
        onFailure(failure);
      }
    },
    [onFailure],
  );

  return { clinic, system, reload, updateBoard, cancelToken };
}

export type Board = ReturnType<typeof useBoard>;
