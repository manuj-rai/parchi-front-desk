"""Live calls: a doctor or receptionist listens in, and can take over from Parchi.

    GET  /api/staff/calls/{id}/live        staff: the call as it happens (server-sent events)
    POST /api/staff/calls/{id}/takeover    staff: Parchi steps back and tells the caller who is joining
    POST /api/staff/calls/{id}/say         staff: a typed line, spoken to the caller
    POST /api/staff/calls/{id}/say-audio   staff: their own voice, relayed to the caller
    POST /api/staff/calls/{id}/handback    staff: Parchi takes the call again
    GET  /api/call/{id}/events             the caller's line: what staff say (server-sent events)

Server-sent events are one-way pushes over plain HTTP that browsers reconnect by themselves:
enough for a clinic. Everything said, by whom, goes into the call's transcript and recording.
"""

import asyncio
import base64
import json
import threading
from collections.abc import AsyncIterator, Callable
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from .auth import Staff
from .call_log import AUDIO_TYPES, CALL_ID, CallLog
from .prompt_loader import say
from .security import read_limited
from .staff_api import Guards, checked_call_id

Audience = Literal["staff", "caller"]
KEEPALIVE_S = 15            # a comment line this often keeps proxies from closing a quiet stream


class LiveHub:
    """Fans events for a call out to whoever is listening. Safe to publish from any thread:
    the call's endpoints run in worker threads, the streams in the event loop."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._listeners: dict[str, set[tuple[Audience, asyncio.AbstractEventLoop, asyncio.Queue]]] = {}

    def publish(self, call_id: str, audience: Audience, event: dict) -> None:
        with self._lock:
            listeners = [entry for entry in self._listeners.get(call_id, ()) if entry[0] == audience]
        for _, loop, queue in listeners:
            loop.call_soon_threadsafe(_offer, queue, event)

    def listening(self, call_id: str, audience: Audience) -> int:
        with self._lock:
            return sum(entry[0] == audience for entry in self._listeners.get(call_id, ()))

    async def stream(self, call_id: str, audience: Audience, request: Request) -> AsyncIterator[str]:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        entry = (audience, asyncio.get_running_loop(), queue)
        with self._lock:
            self._listeners.setdefault(call_id, set()).add(entry)
        try:
            yield "retry: 2000\n\n"                          # reconnect after 2 s if the line drops
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), KEEPALIVE_S)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        finally:
            with self._lock:
                listeners = self._listeners.get(call_id, set())
                listeners.discard(entry)
                if not listeners:
                    self._listeners.pop(call_id, None)


def _offer(queue: asyncio.Queue, event: dict) -> None:
    try:
        queue.put_nowait(event)
    except asyncio.QueueFull:                                # a listener that stopped reading loses events
        pass


# ---- what Parchi says when a person joins or leaves ------------------------------------------
def joining_line(staff: Staff) -> str:
    who = "doctor sahab" if staff.role == "doctor" else f"{staff.name} ji"
    return say("staff_joining", who=who)


HANDBACK_LINE = say("staff_handback")


class StaffLine(BaseModel):
    text: str = Field(min_length=1, max_length=400)


def _sse(stream: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(stream, media_type="text/event-stream",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


def live_router(log: CallLog, hub: LiveHub, guards: Guards, *, synthesize: Callable, transcribe: Callable,
                max_upload_bytes: int) -> APIRouter:
    router = APIRouter()
    same_origin, signed_in = guards.same_origin, guards.signed_in

    def live_call(call_id: str) -> dict:
        call = log.get_call(checked_call_id(call_id))
        if call is None:
            raise HTTPException(status_code=404, detail="No such call.")
        if not call["live"]:
            raise HTTPException(status_code=409, detail="This call has ended.")
        return call

    def holding(call_id: str, staff: Staff) -> None:
        if log.taken_over_by(call_id) != staff.name:
            raise HTTPException(status_code=409, detail="Take over the call before speaking on it.")

    def speak_to_caller(call_id: str, turn: int, staff: Staff, text: str | None, audio: bytes, mime: str) -> None:
        clip = log.add_clip(call_id, turn, 50, "staff", mime, audio)
        hub.publish(call_id, "caller", {"type": "staff_said", "who": staff.name, "text": text,
                                        "audio": base64.b64encode(audio).decode("ascii"), "mime": mime})
        hub.publish(call_id, "staff", {"type": "turn", "n": turn})
        if clip:
            hub.publish(call_id, "staff", {"type": "clip", "clip_id": clip, "speaker": "staff", "turn": turn})

    # ---- staff --------------------------------------------------------------------------------
    @router.get("/api/staff/calls/{call_id}/live")
    async def listen(call_id: str, request: Request, staff: Annotated[Staff, Depends(signed_in)]) -> StreamingResponse:
        await run_in_threadpool(live_call, call_id)
        await run_in_threadpool(log.audit, staff.role, "listened live", call_id, 30)
        return _sse(hub.stream(call_id, "staff", request))

    @router.post("/api/staff/calls/{call_id}/takeover", dependencies=[Depends(same_origin)])
    def take_over(call_id: str, staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        live_call(call_id)
        holder = log.taken_over_by(call_id)
        if holder and holder != staff.name:
            raise HTTPException(status_code=409, detail=f"{holder} is already on this call.")
        log.set_takeover(call_id, staff.name)
        line = joining_line(staff)
        turn = log.record_turn(call_id, "", {"route": "handover", "reply": line})
        audio = synthesize(line).output
        log.add_clip(call_id, turn, 1, "parchi", "audio/mpeg", audio)
        hub.publish(call_id, "caller", {"type": "staff_joined", "who": staff.name, "line": line,
                                        "audio": base64.b64encode(audio).decode("ascii")})
        hub.publish(call_id, "staff", {"type": "takeover", "by": staff.name})
        log.audit(staff.role, "took over the call", call_id)
        return log.get_call(call_id)

    @router.post("/api/staff/calls/{call_id}/say", dependencies=[Depends(same_origin)])
    def say(call_id: str, body: StaffLine, staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        live_call(call_id)
        holding(call_id, staff)
        text = body.text.strip()
        turn = log.add_staff_line(call_id, staff.name, text)
        speak_to_caller(call_id, turn, staff, text, synthesize(text).output, "audio/mpeg")
        return {"turn": turn}

    @router.post("/api/staff/calls/{call_id}/say-audio", dependencies=[Depends(same_origin)])
    async def say_audio(call_id: str, request: Request, staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        await run_in_threadpool(live_call, call_id)
        await run_in_threadpool(holding, call_id, staff)
        mime = request.headers.get("content-type", "audio/webm").split(";")[0].strip().lower()
        if mime not in AUDIO_TYPES:
            raise HTTPException(status_code=415, detail="Send the recording as WebM, Ogg, MP3, WAV or MP4 audio.")
        audio = await read_limited(request, max_upload_bytes)
        heard = await run_in_threadpool(transcribe, audio, mime)            # for the transcript
        turn = await run_in_threadpool(log.add_staff_line, call_id, staff.name, heard.output or "(spoke)")
        await run_in_threadpool(speak_to_caller, call_id, turn, staff, heard.output, audio, mime)
        return {"turn": turn, "heard": heard.output}

    @router.post("/api/staff/calls/{call_id}/handback", dependencies=[Depends(same_origin)])
    def hand_back(call_id: str, staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        live_call(call_id)
        holding(call_id, staff)
        log.set_takeover(call_id, None)
        turn = log.record_turn(call_id, "", {"route": "handover", "reply": HANDBACK_LINE})
        audio = synthesize(HANDBACK_LINE).output
        log.add_clip(call_id, turn, 1, "parchi", "audio/mpeg", audio)
        hub.publish(call_id, "caller", {"type": "staff_left", "who": staff.name, "line": HANDBACK_LINE,
                                        "audio": base64.b64encode(audio).decode("ascii")})
        hub.publish(call_id, "staff", {"type": "handback"})
        log.audit(staff.role, "handed back to Parchi", call_id)
        return log.get_call(call_id)

    # ---- the caller's line ------------------------------------------------------------------------
    @router.get("/api/call/{call_id}/events")
    async def caller_events(call_id: str, request: Request) -> StreamingResponse:
        if not CALL_ID.fullmatch(call_id) or not await run_in_threadpool(log.exists, call_id):
            raise HTTPException(status_code=404, detail="No such call.")
        return _sse(hub.stream(call_id, "caller", request))

    return router
