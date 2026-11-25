"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useClipQueue } from "@/hooks/useClipQueue";
import { useLiveCall } from "@/hooks/useLiveCall";
import { staffApi } from "@/lib/api";
import type { CallDetail, LiveEvent, StaffUser } from "@/lib/types";
import { StaffTalk } from "./StaffTalk";

interface LiveCallProps {
  call: CallDetail;
  user: StaffUser;
  onChanged: () => Promise<void>;     // re-read the call: the transcript has moved on
}

/** A call still on the line: listen in, and take over from Parchi if a person is needed. */
export function LiveCall({ call, user, onChanged }: LiveCallProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clips = useClipQueue();
  const holding = call.taken_over_by === user.name;
  const someoneElse = call.taken_over_by !== null && !holding;

  const onEvent = useCallback(
    (event: LiveEvent) => {
      // Hear the caller and Parchi; not your own voice back.
      if (event.type === "clip" && event.speaker !== "staff") clips.enqueue(event.clip_id);
      if (event.type === "ended") {
        setListening(false);
        clips.stop();
      }
      void onChanged();
    },
    [clips, onChanged],
  );
  const connected = useLiveCall(call.id, listening, onEvent);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="live-title" className="mt-4 rounded-2xl bg-wall-wash p-4 ring-1 ring-wall/20" data-testid="live-call">
      <h3 id="live-title" className="flex items-center gap-2 text-[14px] font-semibold text-wall">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-wall" />
        On the line now
        {listening && (
          <span className="ml-auto text-[12px] font-medium text-night-soft" data-testid="live-status">
            {connected ? "Listening" : "Connecting…"}
          </span>
        )}
      </h3>
      <p className="mt-1 text-[13px] text-night-soft">
        {holding
          ? "You have the call. Parchi has stepped back; hand it back when you are done."
          : someoneElse
            ? `${call.taken_over_by} has the call.`
            : "Parchi is answering. Listen in, or take over if a person is needed."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={listening ? "secondary" : "primary"}
          onClick={() => {
            if (listening) clips.stop();
            setListening(!listening);
          }}
          data-testid="live-listen"
        >
          {listening ? "Stop listening" : "Listen live"}
        </Button>
        {!call.taken_over_by && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              setListening(true);                               // you will want to hear the caller
              void act(() => staffApi.takeOver(call.id));
            }}
            data-testid="live-takeover"
          >
            Take over the call
          </Button>
        )}
        {holding && (
          <Button size="sm" disabled={busy} onClick={() => void act(() => staffApi.handBack(call.id))} data-testid="live-handback">
            Hand back to Parchi
          </Button>
        )}
      </div>

      {holding && (
        <div className="mt-3">
          <StaffTalk
            onSay={(text) => act(() => staffApi.say(call.id, text))}
            onSayAudio={(clip) => act(() => staffApi.sayAudio(call.id, clip))}
          />
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[12.5px] font-medium text-stamp" data-testid="live-error">{error}</p>}
    </section>
  );
}
