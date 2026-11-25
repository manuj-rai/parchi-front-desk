"""Speech in and speech out, from more than one provider, with fallbacks.

The pipeline is cascaded: speech-to-text, then the agents, then text-to-speech.
Real-time speech-to-speech was ruled out: Rs 6.00 a minute against Rs 1.80 [U2][U3],
and it leaves no text step at which the safety agent can check what was said.
"""

import logging
import time
from functools import lru_cache

import httpx
from openai import OpenAI

from .model_routes import Served, api_key, configured, routes, split
from .settings import get_settings

log = logging.getLogger("parchi.speech")

VOICE_STYLE = ("A warm, friendly clinic receptionist in Indore, on the phone. Natural, conversational Hindi "
               "with a person's small pauses, not an announcer's. Calm and clear, not too fast.")
VOCABULARY = "Doctor sahab, number, token, report, fees, bukhar, seene mein dard, saans, Sunita ji."
EXTENSIONS = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mp4": "mp4", "audio/mpeg": "mp3"}


class SpeechFailed(RuntimeError):
    """Every configured speech model failed."""


# ---- speech to text -------------------------------------------------------------
def transcribe(audio: bytes, mime: str) -> Served[str]:
    mime = mime.split(";")[0].strip() or "audio/webm"
    return _first_that_works("speech_to_text", lambda spec, timeout: _TRANSCRIBERS[split(spec)[0]](spec, audio, mime, timeout))


def _openai_transcribe(spec: str, audio: bytes, mime: str, timeout: float) -> str:
    client = OpenAI(api_key=api_key(spec), timeout=timeout, max_retries=0)
    file = (f"speech.{EXTENSIONS.get(mime, 'webm')}", audio, mime)
    language = get_settings().stt_language or None     # e.g. "hi": keeps Hindi in Devanagari, not Urdu script
    options = {"language": language} if language else {}
    return client.audio.transcriptions.create(model=split(spec)[1], file=file, prompt=VOCABULARY, **options).text.strip()


def _deepgram_transcribe(spec: str, audio: bytes, mime: str, timeout: float) -> str:
    """Deepgram pre-recorded API. language=multi handles Hindi mixed with English."""
    response = httpx.post(
        "https://api.deepgram.com/v1/listen",
        params={"model": split(spec)[1], "language": "multi", "smart_format": "true"},
        headers={"Authorization": f"Token {api_key(spec)}", "Content-Type": mime},
        content=audio, timeout=timeout)
    response.raise_for_status()
    return response.json()["results"]["channels"][0]["alternatives"][0]["transcript"].strip()


_TRANSCRIBERS = {"openai": _openai_transcribe, "deepgram": _deepgram_transcribe}


# ---- text to speech -------------------------------------------------------------
@lru_cache(maxsize=256)
def synthesize(text: str) -> Served[bytes]:
    """Text to MP3. Cached: a sentence made once (the greeting, the status line) replays
    instantly and costs nothing more. This is the "pre-generated audio" in the cost sheet."""
    return _first_that_works("text_to_speech", lambda spec, timeout: _openai_speak(spec, text, timeout))


def _openai_speak(spec: str, text: str, timeout: float) -> bytes:
    client = OpenAI(api_key=api_key(spec), timeout=timeout, max_retries=0)
    response = client.audio.speech.create(model=split(spec)[1], voice=get_settings().tts_voice, input=text,
                                          instructions=VOICE_STYLE, response_format="mp3")
    return response.read()


# ---- shared ---------------------------------------------------------------------
def _first_that_works(role: str, attempt) -> Served:
    timeout = routes()[role].timeout_s
    failed: list[str] = []
    for spec in configured(role):
        if split(spec)[0] not in ("openai", "deepgram"):
            failed.append(f"{spec} (provider not supported for speech)")
            continue
        start = time.perf_counter()
        try:
            output = attempt(spec, timeout)
        except Exception as error:
            failed.append(f"{spec} ({type(error).__name__})")
            log.warning("%s: %s failed with %s, falling back", role, spec, type(error).__name__)
            continue
        return Served(output, spec, round((time.perf_counter() - start) * 1000), tuple(failed))
    raise SpeechFailed(f"{role}: no model answered. Tried: {failed or 'none configured'}")
