"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { usePushToTalk } from "@/hooks/usePushToTalk";

interface StaffTalkProps {
  onSay: (text: string) => Promise<void>;
  onSayAudio: (clip: Blob) => Promise<void>;
}

/** The person holding the call talks to the caller: their own voice, or typed and spoken for them. */
export function StaffTalk({ onSay, onSayAudio }: StaffTalkProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const recorded = useCallback((clip: Blob) => void onSayAudio(clip), [onSayAudio]);
  const talk = usePushToTalk(recorded, true, false);          // no space bar here: it would fight the page's buttons

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onPointerDown={talk.start}
        onPointerUp={talk.stop}
        onPointerLeave={() => talk.recording && talk.stop()}
        aria-pressed={talk.recording}
        data-testid="staff-ptt"
        className={`flex h-12 w-full touch-none select-none items-center justify-center gap-2.5 rounded-full text-[14.5px] font-semibold text-white transition-[filter,transform] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${talk.recording ? "bg-stamp shadow-lg shadow-stamp/30" : "bg-dusk shadow-lg shadow-dusk/25 hover:brightness-110"}`}
      >
        <span aria-hidden className={`size-2.5 rounded-full bg-white ${talk.recording ? "animate-pulse" : ""}`} />
        {talk.recording ? "Speaking to the caller. Let go to send" : "Hold to speak to the caller"}
      </button>
      {talk.micError && <p role="alert" className="text-[12.5px] text-stamp">{talk.micError}</p>}
      <form
        className="flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!text.trim()) return;
          setSending(true);
          await onSay(text.trim());
          setSending(false);
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={400}
          placeholder="…or type, and Parchi's voice says it"
          aria-label="What to say to the caller"
          data-testid="staff-say-input"
          className="h-10 min-w-0 flex-1 rounded-full bg-frost px-4 text-[14px] text-night outline-none ring-1 ring-rule-strong placeholder:text-night-faint focus:ring-2 focus:ring-iris"
        />
        <Button type="submit" disabled={sending || !text.trim()} data-testid="staff-say-send">
          Say
        </Button>
      </form>
    </div>
  );
}
