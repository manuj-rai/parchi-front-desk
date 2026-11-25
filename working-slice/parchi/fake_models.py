"""Stand-in models for offline test mode (PARCHI_FAKE_MODELS=1).

They replace the two agents and the speech models with simple word rules, so the API and UI
tests run without API keys, cost nothing, and give the same answer every run. They read the
same clinic files as the real agents (problem areas from each area's `words`), so the offline
tests exercise the real routing rules. They are test doubles, not the product.
"""

import re

from .agents import Safety, Understanding, keyword_check
from .clinic_profile import ClinicProfile
from .model_routes import Served

# Checked in this order; the first match wins.
INTENT_WORDS = [
    ("about_assistant", ["robot", "machine", "insaan", "are you ai"]),
    ("other", ["representative", "galat number", "wrong number", "bol dena", "bol dijiye"]),
    ("info", ["fees", "fee ", "khula", "timing", "address", "sunday", "kitne paise"]),
    ("report", ["report"]),
    ("cancel", ["cancel", "nahin aa paunga", "nahi aa paunga", "nahin aa paungi", "nahi aa paungi", "nahin aa sakta"]),
    ("my_booking", ["mera number kya", "mera number kab", "kaunsa number", "mera token", "number kya tha",
                    "number laga hai kya", "number laga tha"]),
    ("book", ["number laga", "number chahiye", "number lagwana", "number milega", "token", "booking", "dikhana hai",
              "dikhana tha", "appointment"]),
    ("status", ["aa gaye", "kab tak", "baithe", "aayenge", "kitna time"]),
    ("medical", ["dard", "bukhar", "takleef", "pain", "fever", "khansi", "dawai", "kya karun"]),
]
CLARIFY = "Aap number lagwana chahte hain, ya doctor sahab ke baare mein pooch rahe hain?"
# "kal" alone also means "yesterday" ("kal se bukhar"), so only these ask for tomorrow.
TOMORROW_WORDS = ["kal ka", "kal ke liye", "kal subah", "kal shaam", "tomorrow"]
# The child area is checked last: "bachche ke daant" is about teeth, not a child's general illness.
LAST_AREAS = ("children",)


def front_desk(text: str, profile: ClinicProfile, facts: dict, history: list[str]) -> Served[Understanding]:
    lowered = f" {text.lower()} "
    intent = next((name for name, words in INTENT_WORDS if any(w in lowered for w in words)), "unclear")
    area = _problem_area(lowered, profile)
    if area and intent == "unclear":
        intent = "medical"                                   # a health problem with no clear ask
    name = re.search(r"naam (?:hai )?(\w+)", lowered)
    reply = CLARIFY if intent == "unclear" else _info_reply(lowered, profile) if intent == "info" else "Ji."
    understanding = Understanding(
        thinking=f"stand-in: intent {intent}" + (f", problem area {area.label}" if area else ""),
        concern=area.label if area else None, problem_area=area.label if area else None,
        intent=intent, booking_day="tomorrow" if any(w in lowered for w in TOMORROW_WORDS) else "today",
        language="english" if lowered.strip().startswith(("hello", "hi ", "i ")) else "hindi",
        name=name.group(1).title() if name else None, wants_no_messages="message mat" in lowered,
        confidence=0.3 if intent == "unclear" else 0.9, reply=reply)
    return Served(understanding, "fake:front-desk", 5)


def safety(text: str, profile: ClinicProfile) -> Served[Safety]:
    tier = keyword_check(text, profile)
    return Served(Safety(tier=tier, sign=None if tier == "none" else "warning sign (word list)"), "fake:safety", 5)


def transcribe(audio: bytes, mime: str) -> Served[str]:
    """Offline mode cannot hear. Every recording is treated as the commonest question."""
    return Served("Doctor sahab aa gaye kya?", "fake:speech-to-text", 5)


def synthesize(text: str) -> Served[bytes]:
    """Offline mode is silent: no audio is returned, and the UI shows the text instead."""
    return Served(b"", "fake:text-to-speech", 0)


def _problem_area(lowered: str, profile: ClinicProfile):
    ordered = sorted(profile.areas.values(), key=lambda area: area.id in LAST_AREAS)
    return next((area for area in ordered if any(word in lowered for word in area.words)), None)


def _info_reply(lowered: str, profile: ClinicProfile) -> str:
    if "fee" in lowered or "paise" in lowered:
        return profile.fees
    if "address" in lowered:
        return profile.address
    return profile.timings
