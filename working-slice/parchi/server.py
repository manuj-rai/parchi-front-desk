"""The API server (FastAPI). It also serves the built UI from web/out.

    cd working-slice
    python -m parchi.server        settings from working-slice/.env and the environment (see settings.py)

Then open http://127.0.0.1:8765. Each call gets its own LangGraph thread (its memory).
Every call is kept in the call log (call_log.py) with its recording, for the doctor's review
on the staff dashboard (staff_api.py, behind sign-in).
"""

import base64
import logging
import mimetypes
import re
import secrets
import threading
import time
from typing import Literal

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, SecretStr, ValidationError, field_validator
from langgraph.checkpoint.memory import InMemorySaver
from starlette.concurrency import run_in_threadpool

from . import agents, fake_models, llm_router, speech_router
from .appointments import AppointmentBook
from .auth import Accounts, Sessions, Throttle
from .call_graph import build_call_graph, fixed_replies
from .call_log import AUDIO_TYPES, CALL_ID, CallLog, normalize_phone
from .clinic_profile import ClinicProfile, available_clinics
from .clinic_settings import ClinicSettings
from .clinic_settings_api import clinic_settings_router
from .clinic_state import ClinicState
from .model_routes import configured, routes
from .prompt_loader import say
from .security import SecurityHeaders, read_limited
from .settings import SLICE_ROOT, describe, explain, get_settings
from .live import LiveHub, live_router
from .staff_api import Guards, staff_router
from .self_test import run_checks as run_self_checks
from .test_calls import add_test_calls

log = logging.getLogger("parchi")

try:
    SETTINGS = get_settings()        # validated once at start-up: the server refuses to start if wrong
except ValidationError as error:
    raise SystemExit(explain(error)) from None
OFFLINE = SETTINGS.fake_models
WEB_BUILD = SLICE_ROOT / "web" / "out"   # the built UI, served at /
if OFFLINE:
    AGENTS = {"front_desk": fake_models.front_desk, "safety": fake_models.safety}
    transcribe, synthesize = fake_models.transcribe, fake_models.synthesize
else:
    AGENTS = {}
    transcribe, synthesize = speech_router.transcribe, speech_router.synthesize

FILLER = say("filler")             # played the instant the caller stops talking: no silence

app = FastAPI(title="Parchi front desk")
app.add_middleware(SecurityHeaders, production=SETTINGS.env == "production")
app.add_middleware(CORSMiddleware, allow_origins=SETTINGS.cors_origin_list(), allow_credentials=True,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

# ---- the clinic: its shipped file, with the doctor's own changes from the dashboard on top ------
clinic_settings = ClinicSettings(SETTINGS.data_dir, SETTINGS.clinic_utc_offset_minutes)
# Every token, by day, on disk: a restart loses no patient's booking.
APPOINTMENTS = AppointmentBook(SETTINGS.data_dir / "appointments.sqlite", SETTINGS.clinic_utc_offset_minutes)
APPOINTMENTS.purge_older_than(SETTINGS.retention_days)
clinic = ClinicState(profile=clinic_settings.profile(SETTINGS.clinic), appointments=APPOINTMENTS)
# One memory for every call, kept when the graph is rebuilt, so a call under way when the
# doctor saves a change carries on where it was.
CALL_MEMORY = InMemorySaver()
graph = build_call_graph(clinic, checkpointer=CALL_MEMORY, **AGENTS)

# ---- the call log, and the staff who may read it ---------------------------------------------
call_log = CallLog(SETTINGS.data_dir, SETTINGS.clinic_utc_offset_minutes)
call_log.purge_older_than(SETTINGS.retention_days)


def _secret(value: SecretStr | None) -> str | None:
    return value.get_secret_value() if value else None


accounts = Accounts(hashes={"doctor": _secret(SETTINGS.doctor_password_hash),
                            "reception": _secret(SETTINGS.reception_password_hash)},
                    names={"doctor": clinic.profile.doctor.name, "reception": clinic.profile.receptionist},
                    test_logins=SETTINGS.test_logins)
throttle = Throttle()           # module-level so tests can clear it between cases
sessions = Sessions(SETTINGS.session_hours)
guards = Guards(sessions, SETTINGS.cors_origin_list())
hub = LiveHub()                 # staff listening in, and the caller's line while a person holds the call


def _system_settings() -> dict:
    """For the Settings page: what this server runs with. Keys and password hashes are never
    included, only whether they are set. These change in .env, not from the browser."""
    return {
        "environment": SETTINGS.env, "mode": "offline-test" if OFFLINE else "live", "clinic": SETTINGS.clinic,
        "silence_limit_s": SETTINGS.silence_limit_s, "confidence_floor": SETTINGS.confidence_floor,
        "retention_days": SETTINGS.retention_days, "session_hours": SETTINGS.session_hours,
        "max_upload_mb": SETTINGS.max_upload_mb, "clinic_utc_offset_minutes": SETTINGS.clinic_utc_offset_minutes,
        "stt_language": SETTINGS.stt_language, "tts_voice": SETTINGS.tts_voice,
        "test_logins": SETTINGS.test_logins, "secure_cookies": SETTINGS.env == "production",
        "doctor_password_set": SETTINGS.doctor_password_hash is not None,
        "reception_password_set": SETTINGS.reception_password_hash is not None,
    }


def _self_checks() -> dict:
    """The Test lab's checks, on the brief's clinic as callers hear it (the doctor's saved settings)."""
    clinic_id = "general-physician" if "general-physician" in available_clinics() else SETTINGS.clinic
    return {**run_self_checks(clinic_settings.profile(clinic_id), AGENTS), "mode": "offline-test" if OFFLINE else "live"}


app.include_router(staff_router(
    call_log, sessions, accounts, throttle, guards,
    secure_cookies=SETTINGS.env == "production", session_hours=SETTINGS.session_hours, test_mode=OFFLINE,
    add_test_calls=(lambda: add_test_calls(call_log, AGENTS)) if OFFLINE else None,
    run_checks=_self_checks, system_settings=_system_settings,
))
app.include_router(live_router(call_log, hub, guards, synthesize=synthesize, transcribe=transcribe,
                               max_upload_bytes=int(SETTINGS.max_upload_mb * 1_000_000)))


def use_profile(profile: ClinicProfile) -> None:
    """The doctor saved a change: the next sentence of every call is answered with it.
    The token board (tokens, the doctor's time) is kept."""
    global graph
    clinic.profile = profile
    graph = build_call_graph(clinic, checkpointer=CALL_MEMORY, **AGENTS)
    accounts.names.update(doctor=profile.doctor.name, reception=profile.receptionist)
    threading.Thread(target=_prepare_fixed_audio, daemon=True).start()


app.include_router(clinic_settings_router(clinic_settings, call_log, guards,
                                          current_clinic=lambda: clinic.profile.id, apply=use_profile))


class StartCall(BaseModel):
    # The caller's number, as the phone line passes it on. None: the number was withheld.
    phone: str | None = Field(default=None, max_length=20)

    @field_validator("phone")
    @classmethod
    def _indian_mobile(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value else None


class TypedTurn(BaseModel):
    text: str = Field(min_length=1, max_length=400)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=400)


class BoardAction(BaseModel):
    action: Literal["arrived", "eta", "left", "next", "walk_in", "cancel", "reset"]
    # With "cancel": today's token number to cancel.
    number: int | None = Field(default=None, ge=1, le=999)
    # The doctor's time, 24-hour "HH:MM". Callers hear it, so a typo is refused, not stored.
    eta: str | None = Field(default=None, pattern=r"^([01]?\d|2[0-3]):[0-5]\d$")
    # With "reset": start a fresh board for another clinic (a file in clinics/). Demo and tests only.
    clinic: str | None = Field(default=None, max_length=60)

    @field_validator("clinic")
    @classmethod
    def _known_clinic(cls, value: str | None) -> str | None:
        if value is not None and value not in available_clinics():
            raise ValueError(f"unknown clinic; available: {available_clinics()}")
        return value


# ---- about the system ---------------------------------------------------------------
@app.get("/api/system")
def system() -> dict:
    """The mode, the silence limit, and each AI job's models in order (with which can run here)."""
    table = {role: {"order": list(route.models), "active": configured(role), "timeout_s": route.timeout_s}
             for role, route in routes().items()}
    return {"mode": "offline-test" if OFFLINE else "live", "environment": SETTINGS.env,
            "silence_limit_s": SETTINGS.silence_limit_s, "clinic": clinic.profile.name,
            "clinic_profile": clinic.profile.summary(),
            "clinics": [{"id": c, "name": p.name, "speciality": p.doctor.speciality}
                        for c, p in ((c, clinic_settings.profile(c)) for c in available_clinics())],
            "clinic_switching": SETTINGS.env != "production", "routes": table}


# ---- the patient's call ---------------------------------------------------------------
@app.post("/api/call/start")
def start_call(body: StartCall | None = None) -> dict:
    """A call comes in. The caller is identified by their number; a known number brings its name."""
    call_id = secrets.token_hex(8)
    caller = call_log.start_call(call_id, body.phone if body else None)
    text = greeting()
    audio = synthesize(text).output
    call_log.add_clip(call_id, 0, 0, "parchi", "audio/mpeg", audio)
    return {"call_id": call_id, "caller": caller, "greeting": text,
            "greeting_audio": _b64(audio), "filler_audio": _b64(synthesize(FILLER).output)}


@app.post("/api/call/{call_id}/speech")
async def speech_turn(call_id: str, request: Request) -> dict:
    _known_call(call_id)
    mime = request.headers.get("content-type", "audio/webm").split(";")[0].strip().lower()
    if mime not in AUDIO_TYPES:
        raise HTTPException(status_code=415, detail="Send the recording as WebM, Ogg, MP3, WAV or MP4 audio.")
    audio = await read_limited(request, int(SETTINGS.max_upload_mb * 1_000_000))
    heard = await run_in_threadpool(transcribe, audio, mime)
    if call_log.taken_over_by(call_id):
        return await run_in_threadpool(_relay, call_id, heard.output or "(silence)", (mime, audio))
    return await run_in_threadpool(_turn, call_id, heard.output or "(silence)", heard.ms, heard.model, (mime, audio))


@app.post("/api/call/{call_id}/text")
def text_turn(call_id: str, body: TypedTurn) -> dict:
    _known_call(call_id)
    if call_log.taken_over_by(call_id):
        return _relay(call_id, body.text.strip())
    return _turn(call_id, body.text.strip(), 0, "typed")


@app.post("/api/call/{call_id}/end")
def end_call(call_id: str) -> dict:
    """The caller hung up. The call goes to the doctor's review list."""
    _known_call(call_id)
    call_log.set_takeover(call_id, None)
    call_log.end_call(call_id)
    hub.publish(call_id, "staff", {"type": "ended"})
    return {"ended": True}


def _relay(call_id: str, text: str, caller_audio: tuple[str, bytes] | None = None) -> dict:
    """A person holds the call: the caller's words go to them, not to Parchi. The word list
    still runs, so danger is marked for the person and for the review."""
    tier = agents.keyword_check(text, clinic.profile)
    sign = "warning sign (word list)" if tier != "none" else None
    n = call_log.record_turn(call_id, text, {"route": "staff", "reply": "", "safety": {"tier": tier, "sign": sign}})
    _publish_turn(call_id, n, caller_audio)
    return {"relayed": True, "turn": n, "transcript": text, "taken_over_by": call_log.taken_over_by(call_id)}


def _publish_turn(call_id: str, n: int, caller_audio: tuple[str, bytes] | None) -> None:
    """Keeps the caller's audio and tells anyone listening that the call moved on."""
    if caller_audio:
        clip = call_log.add_clip(call_id, n, 0, "caller", *caller_audio)
        if clip:
            hub.publish(call_id, "staff", {"type": "clip", "clip_id": clip, "speaker": "caller", "turn": n})
    hub.publish(call_id, "staff", {"type": "turn", "n": n})


def _known_call(call_id: str) -> None:
    if not CALL_ID.fullmatch(call_id) or not call_log.exists(call_id):
        raise HTTPException(status_code=404, detail="No such call. Start a call first.")


def _turn(call_id: str, text: str, stt_ms: int, stt_model: str, caller_audio: tuple[str, bytes] | None = None) -> dict:
    phone, name = call_log.caller(call_id)
    start = time.perf_counter()
    result = graph.invoke({"text": text, "history": [f"Caller: {text}"], "phone": phone, "caller_name": name,
                           "call_id": call_id},
                          config={"configurable": {"thread_id": call_id}})
    agents_ms = _ms(start)
    # Only the first sentence is spoken before replying: the caller hears the answer start
    # while the UI fetches the rest from /api/speak. Most first sentences are pre-made.
    sentences = sentences_of(result["reply"])
    start = time.perf_counter()
    first = synthesize(sentences[0])
    first_tts_ms = _ms(start)
    # Keep the turn for the doctor: the words, what Parchi did, and the recording.
    n = call_log.record_turn(call_id, text, result)
    _publish_turn(call_id, n, caller_audio)
    _keep_parchi_clip(call_id, n, 1, first.output)
    if len(sentences) > 1:
        threading.Thread(target=_record_rest, args=(call_id, n, sentences[1:]), daemon=True).start()
    return {
        "turn": n,
        "transcript": text, "route": result["route"], "reply": result["reply"], "reply_sentences": sentences,
        "actions": result["actions"], "understanding": result["understanding"], "safety": result["safety"],
        "scope": result["scope"],
        "served_by": {**result["served_by"], "speech_to_text": {"model": stt_model, "ms": stt_ms, "fallbacks": []},
                      "text_to_speech": {"model": first.model, "ms": first_tts_ms, "fallbacks": []}},
        "timings_ms": {"speech_to_text": stt_ms, "agents": agents_ms, "text_to_speech": first_tts_ms,
                       "first_sound": stt_ms + agents_ms + first_tts_ms},
        "audio": _b64(first.output), "clinic": clinic.snapshot(),
    }


def _record_rest(call_id: str, turn: int, sentences: list[str]) -> None:
    """The reply's other sentences, for the recording. Cached, so the UI's /api/speak costs nothing more."""
    try:
        for seq, sentence in enumerate(sentences, start=2):
            _keep_parchi_clip(call_id, turn, seq, synthesize(sentence).output)
    except Exception:                                      # a gap in a recording must not break the call
        log.exception("could not record the rest of turn %s of call %s", turn, call_id)


def _keep_parchi_clip(call_id: str, turn: int, seq: int, audio: bytes) -> None:
    clip = call_log.add_clip(call_id, turn, seq, "parchi", "audio/mpeg", audio)
    if clip:
        hub.publish(call_id, "staff", {"type": "clip", "clip_id": clip, "speaker": "parchi", "turn": turn})


@app.post("/api/speak")
def speak(body: SpeakRequest) -> dict:
    """Audio for one sentence of a reply (cached: a sentence said before costs nothing)."""
    start = time.perf_counter()
    clip = synthesize(body.text.strip())
    return {"audio": _b64(clip.output), "ms": _ms(start)}


def sentences_of(text: str) -> list[str]:
    parts = [part for part in re.split(r"(?<=[.?!।])\s+", text.strip()) if part]
    return parts or [text]


# ---- the receptionist's token board ---------------------------------------------------
@app.get("/api/clinic")
def clinic_state() -> dict:
    return clinic.snapshot()


@app.post("/api/clinic")
def board(body: BoardAction) -> dict:
    global clinic, graph
    actions = {"arrived": lambda: clinic.set_doctor("in"), "eta": lambda: clinic.set_doctor("expected", body.eta),
               "left": lambda: clinic.set_doctor("left"), "next": clinic.next_patient, "walk_in": clinic.walk_in}
    if body.action == "reset":
        if SETTINGS.env == "production":
            # A production server answers for one clinic (PARCHI_CLINIC), and its bookings are real patients'.
            raise HTTPException(status_code=403, detail="Resetting the board and switching clinics are only for demos and tests.")
        clinic_id = body.clinic or clinic.profile.id
        APPOINTMENTS.clear(clinic_id)                    # a demo starts with an empty book
        clinic = ClinicState(profile=clinic_settings.profile(clinic_id), appointments=APPOINTMENTS)
        graph = build_call_graph(clinic, checkpointer=CALL_MEMORY, **AGENTS)
        accounts.names.update(doctor=clinic.profile.doctor.name, reception=clinic.profile.receptionist)
        threading.Thread(target=_prepare_fixed_audio, daemon=True).start()
    elif body.action == "cancel":
        if body.number is None or clinic.cancel_number(body.number, by=clinic.profile.receptionist) is None:
            raise HTTPException(status_code=404, detail="No token with that number is waiting today.")
    elif body.action in actions:
        actions[body.action]()
    _prepare_audio()
    return clinic.snapshot()


def greeting() -> str:
    # Parchi says who it is, then the doctor's status from the board (44% of calls ask only
    # that), then asks how it can help. Decision of 25 Nov, replacing introduction-only.
    return say("greeting", clinic=clinic.profile.name, status=clinic.status_line())


def _prepare_fixed_audio() -> None:
    """Every fixed sentence for this clinic, made into audio once, so it plays instantly."""
    for sentence in [greeting(), FILLER, clinic.status_line(),
                     *(part for reply in fixed_replies(clinic.profile) for part in sentences_of(reply))]:
        synthesize(sentence)


def _prepare_audio() -> None:
    """The status changed: make its audio now, before any caller asks. The answer to the
    commonest question is then instant and needs no model."""
    for sentence in (clinic.status_line(), greeting()):
        threading.Thread(target=synthesize, args=(sentence,), daemon=True).start()


def _b64(audio: bytes) -> str:
    return base64.b64encode(audio).decode("ascii")


def _ms(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


# ---- the UI ----------------------------------------------------------------------------
# Python takes file types from the OS, and Windows can map .js to text/plain. With nosniff,
# browsers then refuse the UI's scripts, so the types the UI needs are set here.
for _type, _extension in [("text/javascript", ".js"), ("text/javascript", ".mjs"), ("text/css", ".css"),
                          ("image/svg+xml", ".svg"), ("font/woff2", ".woff2"), ("application/json", ".json")]:
    mimetypes.add_type(_type, _extension)

if WEB_BUILD.exists():
    app.mount("/", StaticFiles(directory=WEB_BUILD, html=True), name="ui")
else:
    @app.get("/", response_class=HTMLResponse)
    def ui_not_built() -> str:
        return ("<p style='font-family:sans-serif'>The UI is not built yet. Run <code>npm run build</code> "
                "in <code>working-slice/web</code>, or <code>npm run dev</code> there and open "
                "<a href='http://localhost:3000'>localhost:3000</a>.</p>")


def main() -> None:
    if not OFFLINE:
        print("Loading model providers, opening connections, and preparing the fixed audio...")
        llm_router.preload()
        agents.warm_up(clinic.profile)
        _prepare_fixed_audio()
    mode = "OFFLINE TEST MODE (stand-in models)" if OFFLINE else "live models"
    print(f"Settings ({SETTINGS.env}), keys masked:")
    print(describe(SETTINGS))
    print(f"Parchi front desk, {mode}: http://{SETTINGS.host}:{SETTINGS.port}   (Ctrl+C to stop)")
    # Live-call streams never end by themselves: give open connections 5 s to close on shutdown.
    uvicorn.run(app, host=SETTINGS.host, port=SETTINGS.port, log_level=SETTINGS.log_level,
                timeout_graceful_shutdown=5)


if __name__ == "__main__":
    main()
