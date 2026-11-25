"use client";

import { useCallback, useEffect } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { useStaffContext } from "@/components/app/StaffProvider";
import { CallDetailPanel } from "./CallDetailPanel";
import { CallList } from "./CallList";
import { PriorityQueue } from "./PriorityQueue";
import { SummaryTiles } from "./SummaryTiles";

/**
 * Every call: what needs the doctor first (emergencies, then calls that need attention), then
 * every call by day, each with its recording, transcript and the doctor's review. A live call
 * can be heard and taken over from its detail. `?call=<id>` opens one call (from Overview).
 */
export function CallsPage() {
  const staff = useStaffContext();
  const { select } = staff;
  const close = useCallback(() => void select(null), [select]);
  const choose = useCallback((id: string) => void select(id), [select]);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("call");
    if (wanted) void select(wanted);
  }, [select]);

  const log = staff.log;
  const user = staff.user;
  if (!log || !user) {
    return (
      <div className="space-y-4 pt-6" aria-hidden>
        <div className="h-20 animate-pulse rounded-[20px] bg-frost/60" />
        <div className="h-48 animate-pulse rounded-[24px] bg-frost/60" />
      </div>
    );
  }
  const open = log.calls.filter((call) => !call.reviewed);
  const emergencies = open.filter((call) => call.priority === "emergency" || call.priority === "see_today");
  const attention = open.filter((call) => call.priority === "attention");

  return (
    <>
      <PageHeader title="Calls">
        Every call, with its recording and transcript, for the doctor&apos;s final review. The most serious come first.
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-start">
        <div className="min-w-0 space-y-4">
          <SummaryTiles summary={log.summary} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PriorityQueue
              title="Emergencies"
              tone="stamp"
              calls={emergencies}
              today={log.today}
              empty="None waiting. Callers with an emergency sign, or a child to be seen today, appear here first."
              selectedId={staff.selectedId}
              onSelect={choose}
              testId="queue-emergencies"
            />
            <PriorityQueue
              title="Needs attention"
              tone="haldi"
              calls={attention}
              today={log.today}
              empty="None waiting. Questions for the doctor and callbacks appear here."
              selectedId={staff.selectedId}
              onSelect={choose}
              testId="queue-attention"
            />
          </div>
          <CallList calls={log.calls} today={log.today} selectedId={staff.selectedId} onSelect={choose} />
        </div>
        {staff.selectedId ? (
          <CallDetailPanel
            call={staff.detail}
            loading={!staff.detail}
            today={log.today}
            user={user}
            onClose={close}
            onReview={(note) => staff.review(staff.selectedId!, note)}
            onChanged={staff.reloadDetail}
          />
        ) : (
          <p className="hidden rounded-[24px] border border-dashed border-rule-strong bg-frost/50 px-6 py-10 text-center text-[13.5px] text-night-soft xl:sticky xl:top-24 xl:block">
            Choose a call to hear its recording, read the transcript and review it.
          </p>
        )}
      </div>
    </>
  );
}
