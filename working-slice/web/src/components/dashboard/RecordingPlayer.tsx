"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { staffApi } from "@/lib/api";
import type { Clip } from "@/lib/types";

/**
 * The call's recording: the greeting, then each turn's caller audio and Parchi's reply, played
 * in order. The pieces are stored separately; this plays them back to back.
 */
export function RecordingPlayer({ clips }: { clips: Clip[] }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<number | null>(null);   // index into clips

  if (!clips.length) {
    return (
      <p className="rounded-2xl bg-haze px-4 py-3 text-[13px] text-night-soft ring-1 ring-rule" data-testid="recording-none">
        No recording for this call. Typed turns have no voice, and offline test mode is silent; speak into the console
        to record the caller.
      </p>
    );
  }

  const playFrom = (index: number) => {
    const element = audio.current;
    if (!element || index >= clips.length) {
      setPlaying(null);
      return;
    }
    element.src = staffApi.clipUrl(clips[index].id);
    setPlaying(index);
    element.play().catch(() => setPlaying(null));
  };

  const stop = () => {
    audio.current?.pause();
    setPlaying(null);
  };

  const now = playing === null ? null : clips[playing];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-haze px-4 py-3 ring-1 ring-rule" data-testid="recording-player">
      <Button
        size="sm"
        variant={playing === null ? "primary" : "secondary"}
        onClick={() => (playing === null ? playFrom(0) : stop())}
        data-testid="recording-play"
      >
        {playing === null ? "Play the call" : "Stop"}
      </Button>
      <p className="text-[13px] text-night-soft" aria-live="polite">
        {now
          ? `Playing ${playing! + 1} of ${clips.length}: ${now.speaker === "caller" ? "the caller" : "Parchi"}${now.turn === 0 ? " (greeting)" : `, turn ${now.turn}`}`
          : `${clips.length} piece${clips.length === 1 ? "" : "s"} of audio`}
      </p>
      <audio ref={audio} onEnded={() => playFrom((playing ?? -1) + 1)} onError={() => playFrom((playing ?? -1) + 1)} preload="none" />
    </div>
  );
}
