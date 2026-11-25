"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { playClip, stopClip } from "@/lib/audio";
import type { BoardAction, Caller, ClinicSnapshot, LineEvent, RelayedTurn, SystemInfo, Turn } from "@/lib/types";

/** Where the call is right now. Drives the caller panel and the header. */
export type CallPhase = "idle" | "connecting" | "ready" | "listening" | "thinking" | "speaking";

/** One line of the call as the caller lived it, in order. */
export type Entry =
  | { kind: "turn"; index: number }                      // the caller spoke and Parchi answered: turns[index]
  | { kind: "caller"; text: string }                     // the caller spoke to a person holding the call
  | { kind: "staff"; who: string; text: string | null }  // that person spoke
  | { kind: "parchi"; text: string };                    // Parchi handing over, or taking the call back

/** All state for the console, and the actions that change it. One place, so every panel agrees. */
export function useFrontDesk() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [clinic, setClinic] = useState<ClinicSnapshot | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [caller, setCaller] = useState<Caller | null>(null);   // who called; kept after the call ends
  const [greeting, setGreeting] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [staffOnLine, setStaffOnLine] = useState<string | null>(null);   // a person holding the call
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null); // null: follow the latest
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const fillerAudio = useRef("");
  const turnCount = useRef(0);

  useEffect(() => {
    Promise.all([api.system(), api.clinic()])
      .then(([systemInfo, snapshot]) => {
        setSystem(systemInfo);
        setClinic(snapshot);
      })
      .catch((failure: Error) => setError(failure.message));
  }, []);

  // The caller's line: when a doctor or receptionist joins, speaks or leaves, the server says so.
  useEffect(() => {
    if (!callId) return;
    const line = new EventSource(api.eventsUrl(callId));
    line.onmessage = (message) => {
      const event = JSON.parse(message.data) as LineEvent;
      if (event.type === "staff_joined") {
        setStaffOnLine(event.who);
        setEntries((earlier) => [...earlier, { kind: "parchi", text: event.line }]);
        void playClip(event.audio);
      } else if (event.type === "staff_said") {
        setEntries((earlier) => [...earlier, { kind: "staff", who: event.who, text: event.text }]);
        void playClip(event.audio, event.mime);
      } else if (event.type === "staff_left") {
        setStaffOnLine(null);
        setEntries((earlier) => [...earlier, { kind: "parchi", text: event.line }]);
        void playClip(event.audio);
      }
    };
    return () => line.close();
  }, [callId]);

  /** Runs an action; any failure is shown once and the call returns to a usable state. */
  const guarded = useCallback(async (action: () => Promise<void>, phaseAfterError: CallPhase) => {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setPhase(phaseAfterError);
    }
  }, []);

  const clearCall = useCallback(() => {
    setTurns([]);
    setEntries([]);
    setStaffOnLine(null);
    setSelectedTurn(null);
    turnCount.current = 0;
  }, []);

  /** A call comes in from `phone` (null: the number was withheld). */
  const startCall = useCallback(
    (phone: string | null) =>
      guarded(async () => {
        stopClip();
        setPhase("connecting");
        const call = await api.startCall(phone);
        fillerAudio.current = call.filler_audio;
        clearCall();
        setCallId(call.call_id);
        setCaller(call.caller);
        setGreeting(call.greeting);
        setPhase("speaking");
        await playClip(call.greeting_audio);
        setPhase("ready");
      }, "idle"),
    [clearCall, guarded],
  );

  /** One caller turn: the filler plays at once (no silence), then Parchi's answer. While a person
   *  holds the call, the words go to them instead, and there is nothing for Parchi to say. */
  const respond = useCallback(
    (send: (id: string) => Promise<Turn | RelayedTurn>) =>
      guarded(async () => {
        if (!callId) return;
        setPhase("thinking");
        if (!staffOnLine) void playClip(fillerAudio.current);
        const result = await send(callId);
        if ("relayed" in result) {
          setEntries((earlier) => [...earlier, { kind: "caller", text: result.transcript }]);
          setPhase("ready");
          return;
        }
        const index = turnCount.current++;
        setTurns((earlier) => [...earlier, result]);
        setEntries((earlier) => [...earlier, { kind: "turn", index }]);
        setSelectedTurn(null);
        setClinic(result.clinic);
        setPhase("speaking");
        // The first sentence arrived with the turn. Ask for the others now, so each is
        // ready by the time the one before it finishes playing.
        const rest = result.reply_sentences.slice(1).map((sentence) => api.speak(sentence));
        await playClip(result.audio);
        for (const pending of rest) {
          await playClip((await pending).audio);
        }
        setPhase("ready");
      }, "ready"),
    [callId, guarded, staffOnLine],
  );

  /** The caller hangs up. The call stays on screen and goes to the doctor's review list. */
  const endCall = useCallback(
    () =>
      guarded(async () => {
        stopClip();
        if (callId) await api.endCall(callId);
        setCallId(null);
        setStaffOnLine(null);
        setPhase("idle");
      }, phase),
    [callId, guarded, phase],
  );

  const sayText = useCallback((text: string) => respond((id) => api.sayText(id, text)), [respond]);
  const saySpeech = useCallback((audio: Blob) => respond((id) => api.saySpeech(id, audio)), [respond]);

  const updateBoard = useCallback(
    (action: BoardAction, eta?: string, clinicId?: string) =>
      guarded(async () => {
        setClinic(await api.updateBoard(action, { eta, clinic: clinicId }));
        if (action === "reset") {
          stopClip();
          setCallId(null);
          setCaller(null);
          setGreeting(null);
          clearCall();
          setPhase("idle");
          // The clinic may be another one now, or the doctor may have changed its details.
          setSystem(await api.system());
        }
      }, phase),
    [clearCall, guarded, phase],
  );

  /** The receptionist cancels one of today's tokens (the patient rang, or told her at the desk). */
  const cancelToken = useCallback(
    (number: number) =>
      guarded(async () => {
        setClinic(await api.updateBoard("cancel", { number }));
      }, phase),
    [guarded, phase],
  );

  /** Demo and tests only: answer for another clinic (another doctor, who treats other things). */
  const switchClinic = useCallback((clinicId: string) => updateBoard("reset", undefined, clinicId), [updateBoard]);

  return {
    system,
    clinic,
    callId,
    caller,
    greeting,
    turns,
    entries,
    staffOnLine,
    phase,
    error,
    selectedTurn,
    shownTurn: turns.length ? turns[selectedTurn ?? turns.length - 1] : null,
    shownTurnNumber: turns.length ? (selectedTurn ?? turns.length - 1) + 1 : 0,
    setSelectedTurn,
    setPhase,
    startCall,
    endCall,
    sayText,
    saySpeech,
    updateBoard,
    switchClinic,
    cancelToken,
  };
}

export type FrontDesk = ReturnType<typeof useFrontDesk>;
