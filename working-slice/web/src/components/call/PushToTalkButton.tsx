"use client";

import type { CallPhase } from "@/hooks/useFrontDesk";

const HINT: Record<CallPhase, string> = {
  idle: "Start a call first",
  connecting: "Connecting…",
  ready: "Hold to talk, or hold the space bar",
  listening: "Listening. Let go to send",
  thinking: "Parchi is thinking. “Ji, ek second” is playing",
  speaking: "Parchi is speaking",
};

const BARS = [0.5, 0.85, 1, 0.65, 0.9];

interface PushToTalkButtonProps {
  phase: CallPhase;
  recording: boolean;
  onPress: () => void;
  onRelease: () => void;
}

/** The one thing a caller does: hold, speak, let go. The focal control of the console. */
export function PushToTalkButton({ phase, recording, onPress, onRelease }: PushToTalkButtonProps) {
  const usable = phase === "ready" || recording;
  const busy = phase === "thinking" || phase === "speaking";
  const label = recording ? HINT.listening : HINT[phase];
  const look = recording
    ? "bg-stamp text-white shadow-lg shadow-stamp/30"
    : usable
      ? "bg-linear-to-r from-iris to-orchid text-white shadow-lg shadow-iris/30 hover:brightness-110"
      : busy
        ? "bg-iris-wash text-iris-deep"
        : "bg-mist text-night-faint";

  return (
    <button
      type="button"
      disabled={!usable}
      onPointerDown={onPress}
      onPointerUp={onRelease}
      onPointerLeave={() => recording && onRelease()}
      data-testid="push-to-talk"
      data-phase={recording ? "listening" : phase}
      aria-pressed={recording}
      className={`flex h-14 w-full touch-none select-none items-center justify-center gap-3 rounded-full px-5 text-[15px] font-semibold transition-[background-color,filter,transform] duration-150 active:scale-[0.98] disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${look}`}
    >
      {recording ? (
        <span aria-hidden className="flex h-5 items-center gap-[3px]">
          {BARS.map((height, i) => (
            <span key={i} className="voice-bar w-[3px] rounded-full bg-white" style={{ height: `${height * 20}px`, animationDelay: `${i * -0.17}s` }} />
          ))}
        </span>
      ) : (
        <span
          aria-hidden
          className={`size-2.5 rounded-full ${busy ? "animate-pulse bg-iris" : usable ? "bg-white" : "bg-night-ghost"}`}
        />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}
