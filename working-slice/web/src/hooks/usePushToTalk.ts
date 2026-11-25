"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Records the microphone while a button or the space bar is held, then hands over the clip.
 * Like a walkie-talkie: no need to guess when the caller has finished speaking.
 */
export function usePushToTalk(onRecorded: (clip: Blob) => void, enabled: boolean, spaceBar = true) {
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    if (!enabled || recorder.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => chunks.current.push(event.data);
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const clip = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        recorder.current = null;
        if (clip.size > 0) onRecorded(clip);
      };
      recorder.current = mediaRecorder;
      mediaRecorder.start();
      setMicError(null);
      setRecording(true);
    } catch {
      setMicError("Microphone not available. Allow it in the browser, or type what the caller says.");
    }
  }, [enabled, onRecorded]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  }, []);

  // Hold the space bar to talk, except while typing in a text box.
  useEffect(() => {
    if (!spaceBar) return;
    const isTyping = (event: KeyboardEvent) =>
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTyping(event)) return;
      event.preventDefault();
      void start();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping(event)) return;
      event.preventDefault();
      stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [start, stop, spaceBar]);

  return { recording, micError, start, stop };
}
