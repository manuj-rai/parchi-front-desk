"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, staffApi } from "@/lib/api";
import type { CallDetail, CallsResponse, Role, StaffAccounts, StaffUser } from "@/lib/types";

const REFRESH_MS = 10_000;   // new calls appear within ten seconds; paused while the tab is hidden

/** All state for the staff dashboard: who is signed in, the call log, and the call being read. */
export function useStaff() {
  const [accounts, setAccounts] = useState<StaffAccounts | null>(null);
  const [user, setUser] = useState<StaffUser | null | undefined>(undefined);   // undefined: still checking
  const [log, setLog] = useState<CallsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** A 401 means the session ended (expired, or signed out elsewhere): back to sign-in. */
  const failed = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) {
      setUser(null);
      setLog(null);
      setDetail(null);
      setNotice("Your sign-in has ended. Please sign in again.");
      return;
    }
    setError(failure instanceof Error ? failure.message : String(failure));
  }, []);

  useEffect(() => {
    staffApi.accounts().then(setAccounts, failed);
    staffApi.me().then(setUser, (failure) => {
      if (failure instanceof ApiError && failure.status === 401) setUser(null);
      else failed(failure);
    });
  }, [failed]);

  const refresh = useCallback(async () => {
    try {
      setLog(await staffApi.calls());
      if (selectedId) setDetail(await staffApi.call(selectedId));
      setError(null);
    } catch (failure) {
      failed(failure);
    }
  }, [failed, selectedId]);

  useEffect(() => {
    if (!user) return;
    // A synchronous setState inside an effect is not what this is: refresh() awaits the API first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [user, refresh]);

  const login = useCallback(async (role: Role, password: string) => {
    setError(null);
    setNotice(null);
    try {
      setUser(await staffApi.login(role, password));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await staffApi.logout();
    } finally {
      setUser(null);
      setLog(null);
      setSelectedId(null);
      setDetail(null);
    }
  }, []);

  const select = useCallback(
    async (id: string | null) => {
      setSelectedId(id);
      setDetail(null);
      if (!id) return;
      try {
        setDetail(await staffApi.call(id));
      } catch (failure) {
        failed(failure);
      }
    },
    [failed],
  );

  const review = useCallback(
    async (id: string, note: string) => {
      try {
        setDetail(await staffApi.review(id, note));
        setLog(await staffApi.calls());
      } catch (failure) {
        failed(failure);
      }
    },
    [failed],
  );

  /** Re-reads the open call, e.g. when a live call moves on. */
  const reloadDetail = useCallback(async () => {
    if (!selectedId) return;
    try {
      setDetail(await staffApi.call(selectedId));
    } catch (failure) {
      failed(failure);
    }
  }, [failed, selectedId]);

  const addTestCalls = useCallback(async () => {
    try {
      const { added } = await staffApi.addTestCalls();
      setNotice(`Added ${added} test calls from earlier days.`);
      setLog(await staffApi.calls());
    } catch (failure) {
      failed(failure);
    }
  }, [failed]);

  /** Clears the banner above the page: a notice, or an error the user has read. */
  const dismiss = useCallback(() => {
    setNotice(null);
    setError(null);
  }, []);

  return {
    accounts, user, log, selectedId, detail, error, notice, dismiss,
    login, logout, select, review, addTestCalls, refresh, reloadDetail,
    failed,   // for other dashboard pages: a 401 returns to sign-in, anything else is shown
  };
}

export type Staff = ReturnType<typeof useStaff>;
