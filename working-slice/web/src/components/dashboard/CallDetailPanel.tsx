"use client";

import { useEffect, useRef } from "react";
import { Chip } from "@/components/ui/Chip";
import { useWideScreen } from "@/hooks/useWideScreen";
import { clock, dayLabel, duration } from "@/lib/days";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/labels";
import type { CallDetail, StaffUser } from "@/lib/types";
import { CallTranscript } from "./CallTranscript";
import { LiveCall } from "./LiveCall";
import { RecordingPlayer } from "./RecordingPlayer";
import { ReviewBox } from "./ReviewBox";

interface CallDetailPanelProps {
  call: CallDetail | null;
  loading: boolean;
  today: string;
  user: StaffUser;
  onClose: () => void;
  onReview: (note: string) => Promise<void>;
  onChanged: () => Promise<void>;
}

/**
 * One call, in full: who, how serious, the recording, the transcript, and the review.
 * Beside the list on wide screens; over it, as a dialog, on smaller ones.
 */
export function CallDetailPanel({ call, loading, today, user, onClose, onReview, onChanged }: CallDetailPanelProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const wide = useWideScreen();
  const callId = call?.id;

  useEffect(() => {
    if (!wide) closeButton.current?.focus({ preventScroll: true });     // a dialog takes focus; a side panel does not
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [callId, onClose, wide]);

  return (
    <div
      role={wide ? "region" : "dialog"}
      aria-modal={wide ? undefined : true}
      aria-labelledby="call-detail-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-night/30 p-3 backdrop-blur-sm xl:sticky xl:inset-auto xl:top-24 xl:z-auto xl:max-h-[calc(100dvh-112px)] xl:bg-transparent xl:p-0 xl:backdrop-blur-none"
      data-testid="call-detail"
    >
      <article className="mx-auto max-w-[640px] rounded-[24px] bg-frost p-5 shadow-2xl shadow-night/10 ring-1 ring-iris-wash">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="call-detail-title" className="truncate text-[18px] font-bold tracking-[-0.02em] text-night" data-testid="call-detail-name">
              {call ? call.name ?? "Name not given" : "Loading the call…"}
            </h2>
            {call && (
              <p className="text-[13px] tabular-nums text-night-soft" data-testid="call-detail-phone">
                {call.phone_display}
                {call.number_name && <> (this number is {call.number_name}&apos;s)</>}
                {call.phone && <> · {call.number_calls} call{call.number_calls === 1 ? "" : "s"} from this number</>}
              </p>
            )}
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close the call"
            data-testid="call-detail-close"
            className="grid size-9 shrink-0 place-items-center rounded-full text-night-soft ring-1 ring-rule-strong hover:bg-haze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {loading || !call ? (
          <div className="mt-5 space-y-3" aria-hidden>
            <div className="h-12 animate-pulse rounded-2xl bg-mist" />
            <div className="h-24 animate-pulse rounded-2xl bg-mist" />
          </div>
        ) : (
          <>
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px] text-night-soft">
              <Chip tone={PRIORITY_TONE[call.priority]} testId="call-detail-priority">{PRIORITY_LABEL[call.priority]}</Chip>
              {call.reason && <span className="font-medium text-night">{call.reason}</span>}
              <span className="tabular-nums">
                {dayLabel(call.day, today)} at {call.time}, {duration(call.duration_s)}
              </span>
              {call.live && <Chip tone="wall">On the line</Chip>}
              {call.test && <Chip>test call</Chip>}
            </p>

            {call.live && <LiveCall key={call.id} call={call} user={user} onChanged={onChanged} />}

            <section aria-labelledby="recording-title" className="mt-5">
              <h3 id="recording-title" className="mb-2 text-[13.5px] font-semibold text-night">Recording</h3>
              <RecordingPlayer key={call.id} clips={call.clips} />
            </section>

            <section aria-labelledby="transcript-title" className="mt-5">
              <h3 id="transcript-title" className="mb-2 text-[13.5px] font-semibold text-night">Transcript</h3>
              <CallTranscript turns={call.turns} />
            </section>

            <section aria-labelledby="review-title" className="mt-5 border-t border-rule pt-4">
              <h3 id="review-title" className="mb-2 text-[13.5px] font-semibold text-night">Doctor&apos;s review</h3>
              <ReviewBox key={call.id} call={call} role={user.role} onReview={onReview} />
            </section>

            {call.activity.length > 0 && (
              <section aria-labelledby="activity-title" className="mt-5">
                <h3 id="activity-title" className="mb-1.5 text-[12.5px] font-semibold text-night-soft">Who has seen this call</h3>
                <ul className="space-y-0.5 text-[12.5px] text-night-faint" data-testid="call-activity">
                  {call.activity.map((entry, index) => (
                    <li key={index}>
                      <span className="tabular-nums">{clock(entry.at)}</span> {entry.who === "doctor" ? "Doctor" : "Receptionist"}: {entry.action}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </article>
    </div>
  );
}
