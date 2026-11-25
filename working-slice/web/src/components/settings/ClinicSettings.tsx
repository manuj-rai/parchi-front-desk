"use client";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { useClinicSettings, wordsOf } from "@/hooks/useClinicSettings";
import type { ClinicDetails } from "@/lib/types";
import { ClosedDays } from "./ClosedDays";
import { SettingsField } from "./SettingsField";
import { SettingsHistory } from "./SettingsHistory";
import { TreatsChecklist } from "./TreatsChecklist";

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * The doctor's own page: the clinic's details, what the doctor treats, and the doctor's
 * "see today" rule. Callers meet the saved version from their next sentence. The
 * receptionist can read it; only the doctor changes it. The emergency rule is the same at
 * every clinic, so it is shown here but not changed here.
 */
export function ClinicSettings({ onFailure }: { onFailure: (failure: unknown) => void }) {
  const settings = useClinicSettings(onFailure);
  const { view, draft } = settings;

  if (!view || !draft) {
    return (
      <div className="space-y-4" aria-hidden>
        <div className="h-48 animate-pulse rounded-[24px] bg-frost/60" />
        <div className="h-72 animate-pulse rounded-[24px] bg-frost/60" />
      </div>
    );
  }

  const locked = !view.can_edit || settings.saving;
  const set = (change: Partial<ClinicDetails>) => settings.setDraft({ ...draft, ...change });
  const setDoctor = (change: Partial<ClinicDetails["doctor"]>) => set({ doctor: { ...draft.doctor, ...change } });
  const setRule = (change: Partial<ClinicDetails["see_today"]>) => set({ see_today: { ...draft.see_today, ...change } });
  const timeProblem = TIME.test(draft.posted_start.trim()) ? null : "Type the time as hours and minutes, like 10:00 or 17:30.";
  const wordsProblem = wordsOf(settings.keywordText).length ? null : "Give at least one word that should raise the alarm.";
  const blank = [draft.name, draft.kind, draft.receptionist, draft.address, draft.fees, draft.timings,
    draft.doctor.name, draft.doctor.speciality, draft.see_today.signs, draft.see_today.say].some((value) => !value.trim());
  const canSave = view.can_edit && settings.unsaved && !settings.saving && !timeProblem && !wordsProblem && !blank
    && draft.doctor.treats.length > 0 && draft.closed_days.length < 7;

  return (
    <div className="grid gap-4 pb-28 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start" data-testid="clinic-settings">
      <div className="min-w-0 space-y-4">
        {!view.can_edit && (
          <p className="rounded-2xl bg-haldi-wash px-4 py-2.5 text-[13px] font-medium text-haldi" data-testid="settings-read-only">
            Only the doctor can change these. Ask the doctor if something here is wrong.
          </p>
        )}

        <Panel eyebrow="What callers are told" title="The clinic" testId="settings-clinic">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <SettingsField label="Clinic name" value={draft.name} onChange={(name) => set({ name })} disabled={locked}
              maxLength={80} spoken testId="settings-name" hint="Parchi says it in the greeting." />
            <SettingsField label="Kind of clinic (spoken)" value={draft.kind} onChange={(kind) => set({ kind })} disabled={locked}
              maxLength={80} spoken testId="settings-kind" hint={`"Yeh ${draft.kind || "…"} hai": said when a problem is not treated here.`} />
            <SettingsField label="Fees" value={draft.fees} onChange={(fees) => set({ fees })} disabled={locked}
              maxLength={200} spoken testId="settings-fees" />
            <SettingsField label="Timings" value={draft.timings} onChange={(timings) => set({ timings })} disabled={locked}
              maxLength={200} spoken testId="settings-timings" />
            <SettingsField label="Address" value={draft.address} onChange={(address) => set({ address })} disabled={locked}
              maxLength={200} spoken testId="settings-address" />
            <div className="grid grid-cols-2 gap-4">
              <SettingsField label="Usual start" value={draft.posted_start} onChange={(posted_start) => set({ posted_start })}
                disabled={locked} maxLength={5} inputMode="numeric" testId="settings-start" invalid={timeProblem}
                hint="When no time is set on the board." />
              <SettingsField label="Receptionist" value={draft.receptionist} onChange={(receptionist) => set({ receptionist })}
                disabled={locked} maxLength={40} spoken testId="settings-receptionist" />
            </div>
            <div className="sm:col-span-2">
              <ClosedDays closed={draft.closed_days} onChange={(closed_days) => set({ closed_days })} disabled={locked} />
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Who the clinic is for" title="The doctor" testId="settings-doctor">
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Doctor's name" value={draft.doctor.name} onChange={(name) => setDoctor({ name })}
                disabled={locked} maxLength={60} testId="settings-doctor-name" />
              <SettingsField label="Speciality" value={draft.doctor.speciality} onChange={(speciality) => setDoctor({ speciality })}
                disabled={locked} maxLength={60} testId="settings-speciality" hint="The front-desk agent is told this." />
            </div>
            <TreatsChecklist areas={view.areas} treats={draft.doctor.treats} onChange={(treats) => setDoctor({ treats })}
              disabled={locked} />
          </div>
        </Panel>

        <Panel
          eyebrow="The doctor's own rule"
          title="See today, do not wait"
          testId="settings-see-today"
          aside={<span className="text-right text-[12px] text-night-faint" data-testid="settings-approved-by">Signed: {view.see_today_approved_by}</span>}
        >
          <div className="space-y-4 p-5">
            <p className="text-[12.5px] text-night-soft">
              For problems this clinic treats. When a caller describes one of these signs, Parchi says the sentence below word for
              word, gives a token marked &quot;see first&quot; and alerts you. Saving a change signs the rule with your name and today&apos;s date.
            </p>
            <SettingsField label="Signs (for the safety agent)" value={draft.see_today.signs} onChange={(signs) => setRule({ signs })}
              disabled={locked} maxLength={400} multiline testId="settings-signs" />
            <SettingsField label="Words that raise the alarm on their own" value={settings.keywordText}
              onChange={settings.setKeywordText} disabled={locked} maxLength={2000} multiline testId="settings-keywords"
              invalid={wordsProblem} hint="Separate with commas. Add the Devanagari spelling too: calls are often written down in it." />
            <SettingsField label="What Parchi says" value={draft.see_today.say} onChange={(say) => setRule({ say })}
              disabled={locked} maxLength={400} multiline spoken testId="settings-say" />
          </div>
        </Panel>
      </div>

      <div className="min-w-0 space-y-4 xl:sticky xl:top-4">
        <Panel eyebrow="The same at every clinic" title="Emergency: go to hospital now" testId="settings-emergency"
          aside={<Chip tone="stamp">Always first</Chip>}>
          <div className="space-y-2 p-5 text-[13px]">
            <p className="text-night">{view.emergency.signs}</p>
            <p className="text-[12px] text-night-faint">Signed: {view.emergency.approved_by}. Changed for every clinic together, not here.</p>
          </div>
        </Panel>
        <Panel eyebrow="Kept for the record" title="Changes" testId="settings-changes"
          aside={view.changed_from_original ? <Chip tone="iris">Changed</Chip> : <Chip>As shipped</Chip>}>
          <SettingsHistory history={view.history} />
        </Panel>
      </div>

      {view.can_edit && (
        <div className="fixed bottom-0 left-0 right-0 z-10 p-3 sm:p-4 lg:left-[272px]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-[20px] bg-frost/95 px-4 py-3 shadow-lg shadow-night/10 ring-1 ring-iris-wash backdrop-blur">
            <p role="status" className="min-w-0 flex-1 text-[13px]" data-testid="settings-status">
              {settings.error ? (
                <span className="font-medium text-stamp" data-testid="settings-error">{settings.error}</span>
              ) : settings.notice && !settings.unsaved ? (
                <span className="font-medium text-wall" data-testid="settings-notice">{settings.notice}</span>
              ) : settings.unsaved ? (
                <span className="text-night">Unsaved changes.</span>
              ) : (
                <span className="text-night-soft">Everything is saved.</span>
              )}
            </p>
            {view.changed_from_original && !settings.unsaved && (
              <Button size="sm" variant="quiet" onClick={settings.restore} disabled={settings.saving} data-testid="settings-restore">
                Restore the original
              </Button>
            )}
            {settings.unsaved && (
              <Button size="sm" variant="quiet" onClick={settings.discard} disabled={settings.saving} data-testid="settings-discard">
                Discard
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={settings.save} disabled={!canSave} data-testid="settings-save">
              {settings.saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
