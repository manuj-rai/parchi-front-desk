"use client";

import { useCallback, useEffect, useRef } from "react";
import { staffApi } from "@/lib/api";

/** Plays recording clips one after another as they arrive, so a live call is heard in order. */
export function useClipQueue() {
  const queue = useRef<number[]>([]);
  const playing = useRef(false);
  const advance = useRef<() => void>(() => {});
  const element = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    const playNext = () => {
      const clipId = queue.current.shift();
      if (clipId === undefined) {
        playing.current = false;
        return;
      }
      playing.current = true;
      audio.src = staffApi.clipUrl(clipId);
      // A refusal to play (no click on the page yet) stops the queue; the next clip tries again.
      audio.play().catch(() => {
        playing.current = false;
      });
    };
    audio.onended = playNext;
    audio.onerror = playNext;                                   // a clip that will not load is skipped
    advance.current = playNext;
    element.current = audio;
    return () => {
      audio.pause();
      queue.current = [];
      playing.current = false;
      advance.current = () => {};
      element.current = null;
    };
  }, []);

  const enqueue = useCallback((clipId: number) => {
    queue.current.push(clipId);
    if (!playing.current) advance.current();
  }, []);

  const stop = useCallback(() => {
    queue.current = [];
    element.current?.pause();
    playing.current = false;
  }, []);

  return { enqueue, stop };
}
