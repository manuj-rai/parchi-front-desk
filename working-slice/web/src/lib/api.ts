import type {
  BoardAction,
  CallDetail,
  CallStart,
  CallsResponse,
  ClinicDetails,
  ClinicSettingsView,
  ClinicSnapshot,
  Role,
  SpokenSentence,
  StaffAccounts,
  RelayedTurn,
  SelfTestReport,
  SystemSettings,
  StaffUser,
  SystemInfo,
  Turn,
} from "./types";

// In development the UI runs on its own server (localhost:3000) and calls the Python API
// directly; "localhost" on both keeps the staff cookie same-site. In the built UI both are
// served by the Python server, so paths are relative.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? (process.env.NODE_ENV === "development" ? "http://localhost:8765" : "");

/** A failed API call, with the server's own explanation when it gave one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { credentials: API_BASE ? "include" : "same-origin", ...init });
  } catch {
    throw new ApiError(0, "Cannot reach the Parchi server. Is `python -m parchi.server` running?");
  }
  if (!response.ok) {
    throw new ApiError(response.status, await explain(response, init?.method ?? "GET", path));
  }
  return response.json() as Promise<T>;
}

/** FastAPI puts the reason in `detail`: a sentence, or a list of validation problems. */
async function explain(response: Response, method: string, path: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | { msg: string }[] };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg.replace(/^Value error, /, "");
  } catch {
    // not JSON: fall through
  }
  return `${method} ${path} failed with ${response.status}`;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  system: () => request<SystemInfo>("/api/system"),
  clinic: () => request<ClinicSnapshot>("/api/clinic"),
  /** A tap on the receptionist's board. `number`: today's token to cancel; `clinic`: demo and tests only. */
  updateBoard: (action: BoardAction, options: { eta?: string; clinic?: string; number?: number } = {}) =>
    postJson<ClinicSnapshot>("/api/clinic", { action, ...options }),
  startCall: (phone: string | null) => postJson<CallStart>("/api/call/start", { phone }),
  endCall: (callId: string) => postJson<{ ended: boolean }>(`/api/call/${callId}/end`, {}),
  sayText: (callId: string, text: string) => postJson<Turn | RelayedTurn>(`/api/call/${callId}/text`, { text }),
  speak: (text: string) => postJson<SpokenSentence>("/api/speak", { text }),
  saySpeech: (callId: string, audio: Blob) =>
    request<Turn | RelayedTurn>(`/api/call/${callId}/speech`, {
      method: "POST",
      headers: { "Content-Type": audio.type || "audio/webm" },
      body: audio,
    }),
  /** The caller's line: what staff say once they take over (server-sent events). */
  eventsUrl: (callId: string) => `${API_BASE}/api/call/${callId}/events`,
};

export const staffApi = {
  accounts: () => request<StaffAccounts>("/api/staff/accounts"),
  me: () => request<StaffUser>("/api/staff/me"),
  login: (role: Role, password: string) => postJson<StaffUser>("/api/staff/login", { role, password }),
  logout: () => postJson<{ signed_out: boolean }>("/api/staff/logout", {}),
  calls: (days = 14) => request<CallsResponse>(`/api/staff/calls?days=${days}`),
  call: (id: string) => request<CallDetail>(`/api/staff/calls/${id}`),
  review: (id: string, note: string) => postJson<CallDetail>(`/api/staff/calls/${id}/review`, { note }),
  addTestCalls: () => postJson<{ added: number }>("/api/staff/test-calls", {}),
  // ---- the Test lab and the server's settings ----
  selfTest: () => postJson<SelfTestReport>("/api/staff/self-test", {}),
  system: () => request<SystemSettings>("/api/staff/system"),
  // ---- the doctor's clinic settings ----
  clinicSettings: () => request<ClinicSettingsView>("/api/staff/clinic-settings"),
  saveClinicSettings: (details: ClinicDetails) => postJson<ClinicSettingsView>("/api/staff/clinic-settings", details),
  restoreClinicSettings: () => postJson<ClinicSettingsView>("/api/staff/clinic-settings/restore", {}),
  clipUrl: (clipId: number) => `${API_BASE}/api/staff/clips/${clipId}`,
  // ---- a live call ----
  liveUrl: (id: string) => `${API_BASE}/api/staff/calls/${id}/live`,
  takeOver: (id: string) => postJson<CallDetail>(`/api/staff/calls/${id}/takeover`, {}),
  handBack: (id: string) => postJson<CallDetail>(`/api/staff/calls/${id}/handback`, {}),
  say: (id: string, text: string) => postJson<{ turn: number }>(`/api/staff/calls/${id}/say`, { text }),
  sayAudio: (id: string, audio: Blob) =>
    request<{ turn: number; heard: string }>(`/api/staff/calls/${id}/say-audio`, {
      method: "POST",
      headers: { "Content-Type": audio.type || "audio/webm" },
      body: audio,
    }),
};
