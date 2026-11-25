"use client";

import { useEffect, useRef, useState } from "react";
import { staffApi } from "@/lib/api";
import type { LiveEvent } from "@/lib/types";

/**
 * Listens to a live call while `listening` is on: each turn, each piece of audio, a take-over,
 * a hand-back, the end. The browser reconnects by itself if the line drops.
 */
export function useLiveCall(callId: string, listening: boolean, onEvent: (event: LiveEvent) => void): boolean {
  const handler = useRef(onEvent);
  const [openFor, setOpenFor] = useState<string | null>(null);   // the call whose stream is open

  useEffect(() => {
    handler.current = onEvent;                                   // always the latest, without reconnecting
  });

  useEffect(() => {
    if (!listening) return;
    const stream = new EventSource(staffApi.liveUrl(callId), { withCredentials: true });
    stream.onopen = () => setOpenFor(callId);
    stream.onerror = () => setOpenFor(null);
    stream.onmessage = (message) => handler.current(JSON.parse(message.data) as LiveEvent);
    return () => stream.close();
  }, [callId, listening]);

  return listening && openFor === callId;
}
