"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, staffApi } from "@/lib/api";
import type { ClinicDetails, ClinicSettingsView } from "@/lib/types";

/** Alarm words as the doctor types them: separated by commas or new lines. */
export function wordsOf(text: string): string[] {
  return text.split(/[,\n]/).map((word) => word.trim()).filter(Boolean);
}

/**
 * The clinic settings page: what the server holds, the doctor's unsaved draft, and saving.
 * `onFailure` is the dashboard's handler, so an ended sign-in returns to the sign-in page.
 */
export function useClinicSettings(onFailure: (failure: unknown) => void) {
  const [view, setView] = useState<ClinicSettingsView | null>(null);
  const [draft, setDraft] = useState<ClinicDetails | null>(null);
  const [keywordText, setKeywordText] = useState("");     // the see-today words, as typed
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const take = useCallback((fresh: ClinicSettingsView) => {
    setView(fresh);
    setDraft(fresh.details);
    setKeywordText(fresh.details.see_today.keywords.join(", "));
  }, []);

  useEffect(() => {
    staffApi.clinicSettings().then(take, onFailure);
  }, [onFailure, take]);

  /** The draft with the typed words in place: what a save sends. */
  const outgoing = useMemo<ClinicDetails | null>(
    () => (draft ? { ...draft, see_today: { ...draft.see_today, keywords: wordsOf(keywordText) } } : null),
    [draft, keywordText],
  );
  const unsaved = Boolean(view && outgoing && JSON.stringify(outgoing) !== JSON.stringify(view.details));

  const run = useCallback(
    async (action: () => Promise<ClinicSettingsView>, done: string) => {
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        take(await action());
        setNotice(done);
      } catch (failure) {
        // A refused change (422) is the doctor's to fix, so it shows on this page.
        if (failure instanceof ApiError && failure.status === 422) setError(failure.message);
        else onFailure(failure);
      } finally {
        setSaving(false);
      }
    },
    [onFailure, take],
  );

  const save = useCallback(() => {
    if (outgoing) void run(() => staffApi.saveClinicSettings(outgoing), "Saved. Parchi uses the new details from the next sentence a caller says.");
  }, [outgoing, run]);

  const restore = useCallback(
    () => void run(() => staffApi.restoreClinicSettings(), "Restored the original details from the clinic file."),
    [run],
  );

  const discard = useCallback(() => {
    if (view) take(view);
  }, [take, view]);

  return { view, draft, setDraft, keywordText, setKeywordText, unsaved, saving, error, notice, save, restore, discard };
}

export type ClinicSettingsState = ReturnType<typeof useClinicSettings>;
