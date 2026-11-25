// Human words and colour tones for the API's values, kept in one place so every panel agrees.

import type { Priority, Route, SafetyTier, Scope } from "./types";

export type Tone = "neutral" | "iris" | "stamp" | "wall" | "haldi";

export const ROUTE_LABEL: Record<Route, string> = {
  status: "Answered status from the board",
  book: "Booked a token",
  my_booking: "Read the caller's token from the book",
  cancel: "Cancelled the caller's token",
  info: "Answered from clinic facts",
  medical: "Passed question to the doctor",
  not_here: "Not treated here: told who to see",
  urgent: "Urgent: doctor's own advice + alert",
  about: "Said it is automated",
  clarify: "Asked one either-or question",
  handoff: "Handed to the receptionist",
  staff: "A person answered",
  handover: "Handed over",
};

export const ROUTE_TONE: Record<Route, Tone> = {
  status: "iris",
  book: "iris",
  my_booking: "iris",
  cancel: "neutral",
  info: "iris",
  medical: "haldi",
  not_here: "neutral",
  urgent: "stamp",
  about: "neutral",
  clarify: "haldi",
  handoff: "haldi",
  staff: "wall",
  handover: "neutral",
};

export const TIER_LABEL: Record<SafetyTier | "unavailable", string> = {
  emergency: "Emergency",
  see_today: "See today",
  none: "No danger",
  unavailable: "Model unavailable",
};

export const JOB_LABEL: Record<string, string> = {
  speech_to_text: "Speech to text",
  front_desk_agent: "Front-desk agent",
  safety_agent: "Safety agent",
  text_to_speech: "Text to speech",
};

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Short names for what a caller wanted, for the call log. */
export const ROUTE_SHORT: Record<Route, string> = {
  status: "Doctor's status",
  book: "Booking",
  my_booking: "Asked about their token",
  cancel: "Cancelled a token",
  info: "Fees or timings",
  medical: "Medical question",
  not_here: "Not treated here",
  urgent: "Urgent",
  about: "Asked if AI",
  clarify: "Unclear",
  handoff: "Callback",
  staff: "With a person",
  handover: "Hand-over",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  emergency: "Emergency",
  see_today: "See today",
  attention: "Needs attention",
  routine: "Routine",
};

export const PRIORITY_TONE: Record<Priority, Tone> = {
  emergency: "stamp",
  see_today: "stamp",
  attention: "haldi",
  routine: "neutral",
};

/** Whether this clinic treats what the caller mentioned (decided from the clinic's file). */
export const SCOPE_LABEL: Record<Scope["verdict"], string> = {
  treated: "Treated here",
  not_treated: "Not treated here",
  unknown: "Fits no area: doctor decides",
  none: "No health problem mentioned",
};

export const SCOPE_TONE: Record<Scope["verdict"], Tone> = {
  treated: "wall",
  not_treated: "stamp",
  unknown: "haldi",
  none: "neutral",
};
