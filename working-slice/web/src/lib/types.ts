// Shapes of the Python API's responses (working-slice/parchi/server.py).

export type Mode = "live" | "offline-test";
export type Route = "status" | "book" | "my_booking" | "cancel" | "info" | "medical" | "not_here" | "urgent" | "about"
  | "clarify" | "handoff"
  | "staff"       // a person held the call: the caller's line, and their answer
  | "handover";   // Parchi handing the call to a person, or taking it back
export type SafetyTier = "emergency" | "see_today" | "none";
export type BoardAction = "arrived" | "eta" | "left" | "next" | "walk_in" | "cancel" | "reset";
export type Stage = "speech_to_text" | "front_desk" | "safety" | "text_to_speech";

export interface RouteInfo {
  order: string[];          // "provider:model", in order of preference
  active: string[];         // the ones whose provider key is set
  timeout_s: number;
}

/** The clinic in use, from its file (with the doctor's saved changes). */
export interface ClinicProfileSummary {
  id: string;
  name: string;
  doctor: string;
  speciality: string;
  receptionist: string;
  treats: string[];                 // problem-area labels this doctor treats
  refers: Record<string, string>;   // every other problem area -> who Parchi tells the caller to see
}

export interface ClinicChoice {
  id: string;
  name: string;
  speciality: string;
}

export interface SystemInfo {
  mode: Mode;
  environment: string;
  silence_limit_s: number;
  clinic: string;
  clinic_profile: ClinicProfileSummary;
  clinics: ClinicChoice[];
  clinic_switching: boolean;        // demo and tests only; a production server answers for one clinic
  routes: Record<string, RouteInfo>;
}

/** waiting: booked; seeing: with the doctor now; seen: done; cancelled: by the caller or the receptionist. */
export type TokenStatus = "waiting" | "seeing" | "seen" | "cancelled";

/** A token is an appointment: one place in the doctor's queue on one day. */
export interface Token {
  id: number;
  day: string;              // YYYY-MM-DD, the clinic's date
  number: number;           // from 1 each day
  status: TokenStatus;
  name: string;
  source: "walk-in" | "phone";
  no_contact: boolean;
  see_first: boolean;
  phone: string | null;     // +91XXXXXXXXXX for phone bookings: how the patient is identified
}

export interface Alert {
  at: string;
  kind: string;
  text: string;
}

export interface ClinicSnapshot {
  clinic: string;           // the clinic's id
  day: string;              // today, YYYY-MM-DD
  open_today: boolean;      // by the clinic's days, or because the board was set today
  later: Token[];           // bookings on later days (tomorrow, or after a closed day), not cancelled
  doctor: "expected" | "in" | "left";
  eta: string;
  now_serving: number;
  status_line: string;
  tokens: Token[];
  alerts: Alert[];
}

/** Who is calling, as the call log knows them by their number. */
export interface Caller {
  phone: string | null;
  phone_display: string;    // "+91 90000 00001", or "Number withheld"
  name: string | null;      // the name on record for this number
  known: boolean;
  earlier_calls: number;
}

export interface CallStart {
  call_id: string;
  caller: Caller;
  greeting: string;
  greeting_audio: string;   // base64 MP3; empty in offline test mode
  filler_audio: string;
}

export interface Understanding {
  thinking: string;               // the agent's one-line reasoning, written before it decides
  concern: string | null;         // the health problem the caller mentioned
  problem_area: string | null;    // the problem area the agent matched it to
  intent: string;
  booking_day: "today" | "tomorrow";
  language: string;
  name: string | null;
  wants_no_messages: boolean;
  confidence: number;
  reply: string;
}

export interface SafetyReading {
  tier: SafetyTier;
  sign: string | null;
  model_said: string;       // the safety agent's tier, or "unavailable"
  words_said: string;       // the word list's tier
}

/** Does this clinic treat what the caller mentioned? Decided from the clinic's file, not by a model. */
export interface Scope {
  verdict: "treated" | "not_treated" | "unknown" | "none";
  area: string | null;
  see: string | null;       // who the caller is told to see, when it is not treated here
}

export interface ServedBy {
  model: string;
  ms: number;
  fallbacks: string[];      // models that failed before this one answered
}

export interface Turn {
  turn: number;
  transcript: string;
  route: Route;
  reply: string;
  reply_sentences: string[];  // the reply split into sentences; audio comes for the first one only
  actions: string[];
  understanding: Understanding | null;
  safety: SafetyReading;
  scope: Scope;
  served_by: Record<Stage, ServedBy>;
  /** text_to_speech is for the first sentence; first_sound is when the caller starts hearing the answer. */
  timings_ms: { speech_to_text: number; agents: number; text_to_speech: number; first_sound: number };
  audio: string;              // base64 MP3 of the first sentence
  clinic: ClinicSnapshot;
}

/** The answer to a caller's turn while a person holds the call: their words went to that person. */
export interface RelayedTurn {
  relayed: true;
  turn: number;
  transcript: string;
  taken_over_by: string | null;
}

/** What the caller's line hears from the server while a person joins, speaks and leaves. */
export type LineEvent =
  | { type: "staff_joined"; who: string; line: string; audio: string }
  | { type: "staff_said"; who: string; text: string | null; audio: string; mime: string }
  | { type: "staff_left"; who: string; line: string; audio: string };

/** What staff listening to a live call hear about it. */
export type LiveEvent =
  | { type: "turn"; n: number }
  | { type: "clip"; clip_id: number; speaker: "caller" | "parchi" | "staff"; turn: number }
  | { type: "takeover"; by: string }
  | { type: "handback" }
  | { type: "ended" };

export interface SpokenSentence {
  audio: string;
  ms: number;
}

// ---- the staff dashboard (working-slice/parchi/staff_api.py) ----------------------------

export type Role = "doctor" | "reception";
export type Priority = "routine" | "attention" | "see_today" | "emergency";

export interface StaffUser {
  role: Role;
  name: string;
}

export interface StaffAccounts {
  roles: StaffUser[];
  test_logins: boolean;     // offline test mode: doctor/doctor-test, reception/reception-test
  test_mode: boolean;
}

export interface CallSummary {
  id: string;
  phone: string | null;
  phone_display: string;
  name: string | null;          // the name heard on this call, else the number's name
  number_name: string | null;   // set when the number is known under another name
  number_calls: number;
  started_at: string;
  day: string;                  // YYYY-MM-DD in the clinic's time
  time: string;                 // HH:MM in the clinic's time
  duration_s: number;
  live: boolean;
  taken_over_by: string | null;   // a staff member speaking instead of Parchi, while live
  priority: Priority;
  reason: string | null;
  routes: Route[];
  turn_count: number;
  first_words: string | null;
  test: boolean;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface LoggedTurn {
  n: number;
  at: string;
  caller_text: string;
  reply: string;
  route: Route;
  reply_by: string | null;        // null: Parchi answered; else the staff member who did
  safety_tier: SafetyTier;
  safety_sign: string | null;
  actions: string[];
}

export interface Clip {
  id: number;
  turn: number;                 // 0 is the greeting
  seq: number;
  speaker: "caller" | "parchi" | "staff";
}

export interface CallDetail extends CallSummary {
  turns: LoggedTurn[];
  clips: Clip[];
  activity: { at: string; who: string; action: string }[];
}

export interface CallsResponse {
  today: string;
  calls: CallSummary[];
  summary: { calls_today: number; live_now: number; emergencies: number; needs_attention: number; to_review: number };
}

// ---- the doctor's clinic settings (working-slice/parchi/clinic_settings_api.py) ----------

export interface ClinicDetails {
  name: string;
  kind: string;               // spoken: "yeh <kind> hai"
  receptionist: string;
  address: string;
  fees: string;
  timings: string;
  posted_start: string;       // "HH:MM"
  closed_days: string[];      // weekday names; no tokens are booked for these days
  doctor: { name: string; speciality: string; treats: string[] };
  see_today: { signs: string; keywords: string[]; say: string };
}

export interface ProblemAreaInfo {
  id: string;
  label: string;
  describes: string;
  see: string;                // who callers are sent to when this doctor does not treat it
}

export interface SettingsChange {
  at: string;
  by: string;
  changed: string[];
}

export interface ClinicSettingsView {
  clinic_id: string;
  details: ClinicDetails;
  see_today_approved_by: string;
  areas: ProblemAreaInfo[];
  emergency: { signs: string; approved_by: string };
  changed_from_original: boolean;
  history: SettingsChange[];
  can_edit: boolean;          // only the doctor changes the settings; the receptionist reads them
}

// ---- the Test lab and the Settings page (parchi/self_test.py, staff_api.py) ------------------

export interface CheckTurn {
  said: string;
  route: Route;
  tier: SafetyTier;
  reply: string;
  actions: string[];
}

export interface CheckResult {
  id: string;
  label: string;
  why: string;            // what the check protects
  passed: boolean;
  problems: string[];     // empty when it passed
  turns: CheckTurn[];
  ms: number;
}

export interface SelfTestReport {
  clinic: string;
  mode: Mode;
  passed: number;
  total: number;
  results: CheckResult[];
}

/** What the server runs with. Set in working-slice/.env; never a key or a password hash. */
export interface SystemSettings {
  environment: "development" | "test" | "production";
  mode: Mode;
  clinic: string;
  silence_limit_s: number;
  confidence_floor: number;
  retention_days: number;
  session_hours: number;
  max_upload_mb: number;
  clinic_utc_offset_minutes: number;
  stt_language: string;
  tts_voice: string;
  test_logins: boolean;
  secure_cookies: boolean;
  doctor_password_set: boolean;
  reception_password_set: boolean;
}
