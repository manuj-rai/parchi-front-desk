"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import type { FrontDesk } from "@/hooks/useFrontDesk";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { CallerIdentity } from "./CallerIdentity";
import { isCallerNumber } from "@/lib/phone";
import { CallerNumber } from "./CallerNumber";
import { Conversation } from "./Conversation";
import { PushToTalkButton } from "./PushToTalkButton";
import { ScenarioList } from "./ScenarioList";
import { TypedLine } from "./TypedLine";

/** Left column: the patient's side of the call. */
export function CallerPanel({ desk, className = "" }: { desk: FrontDesk; className?: string }) {
  const [number, setNumber] = useState("+91 90000 00001");
  const canSpeak = desk.phase === "ready";
  const talk = usePushToTalk(desk.saySpeech, canSpeak);
  const onCall = desk.callId !== null;
  const busy = desk.phase === "connecting" || desk.phase === "thinking";
  // The latest name the caller gave on this call, if any.
  const nameHeard = [...desk.turns].reverse().find((turn) => turn.understanding?.name)?.understanding?.name ?? null;

  const title = onCall ? "On a call" : desk.greeting ? "Call ended" : "No call yet";

  return (
    <Panel
      eyebrow="The caller"
      title={title}
      testId="caller-panel"
      className={className}
      aside={
        onCall ? (
          <Button size="sm" onClick={desk.endCall} disabled={busy} data-testid="end-call">
            End call
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => desk.startCall(number.trim() || null)}
            disabled={busy || !isCallerNumber(number)}
            data-testid="start-call"
          >
            Start a call
          </Button>
        )
      }
    >
      {desk.caller && <CallerIdentity caller={desk.caller} nameHeard={nameHeard} />}
      {desk.staffOnLine && (
        <p role="status" className="flex items-center gap-2 border-b border-rule bg-wall-wash px-4 py-2 text-[13px] font-semibold text-wall" data-testid="staff-joined">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-wall" />
          {desk.staffOnLine} is on the call. Parchi has stepped back.
        </p>
      )}
      <Conversation
        greeting={desk.greeting}
        turns={desk.turns}
        entries={desk.entries}
        shownTurnNumber={desk.shownTurnNumber}
        onSelect={desk.setSelectedTurn}
      />
      <div className="space-y-3 border-t border-rule bg-haze/70 px-4 py-4">
        {!onCall && <CallerNumber value={number} onChange={setNumber} disabled={busy} />}
        <PushToTalkButton phase={desk.phase} recording={talk.recording} onPress={talk.start} onRelease={talk.stop} />
        {talk.micError && (
          <p role="alert" className="text-[12.5px] text-stamp" data-testid="mic-error">{talk.micError}</p>
        )}
        <TypedLine enabled={canSpeak} onSay={desk.sayText} />
        <ScenarioList enabled={canSpeak} onSay={desk.sayText} />
      </div>
    </Panel>
  );
}
