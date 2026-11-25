"""The two agents that listen to every sentence a caller says.

front_desk_agent : works out what the caller wants and which health problem (if any) they
                   mention, and drafts a short reply.
safety_agent     : listens only for danger, against the doctors' signed rules.

Their instructions are in parchi/prompts/ (front_desk.md, safety.md), filled from the
clinic's file. Each returns structured output (a Pydantic object) wrapped in `Served`, which
also records which model answered. Which models they use is set in model_routes.py.

The front-desk agent's fields are ordered so it reasons first: `thinking`, then the concern
and its problem area, then the intent and the reply. Whether the clinic treats that problem
is NOT the agent's call: call_graph.py decides it from the clinic's data.
"""

import logging
from typing import Literal

from pydantic import BaseModel, Field

from .clinic_profile import ClinicProfile
from .llm_router import invoke_structured
from .model_routes import Served
from .prompt_loader import instructions

log = logging.getLogger("parchi.agents")

Intent = Literal["status", "book", "my_booking", "cancel", "info", "report", "medical", "about_assistant", "other",
                 "unclear"]


class Understanding(BaseModel):
    thinking: str = Field(description="One short sentence: what the caller wants and, if they mention a health "
                                      "problem, which problem area it belongs to")
    concern: str | None = Field(description="The health problem the caller mentions, in a few English words, else null")
    problem_area: str | None = Field(description="The matching problem-area label, copied exactly from the list; "
                                                 "null if no health problem is mentioned or none fits")
    intent: Intent = Field(description="What the caller wants, in one label")
    booking_day: Literal["today", "tomorrow"] = Field(description="For a booking: \"tomorrow\" only if the caller "
                                                                  "asks for tomorrow; otherwise \"today\"")
    language: Literal["hindi", "english"] = Field(description="Reply language. Hinglish and Marathi count as hindi")
    name: str | None = Field(description="Caller's or patient's name if they said it, else null")
    wants_no_messages: bool = Field(description="True if the caller asked not to be messaged or called on this number")
    confidence: float = Field(description="0 to 1: how sure you are of the intent")
    reply: str = Field(description="One or two short spoken sentences. If unsure, an either-or question built from "
                                   "your two best guesses")


class Safety(BaseModel):
    tier: Literal["emergency", "see_today", "none"] = Field(description="Most serious tier that matches")
    sign: str | None = Field(description="The warning sign heard, in a few words, else null")


def front_desk_prompt(profile: ClinicProfile, facts: dict) -> str:
    areas = "\n".join(f'- "{area.label}": {area.describes}' for area in profile.areas.values())
    return instructions(
        "front_desk", clinic_name=profile.name, clinic_kind_english=f"a {profile.doctor.speciality.lower()}'s clinic",
        doctor_name=profile.doctor.name, speciality=profile.doctor.speciality, receptionist=profile.receptionist,
        facts="\n".join(f"- {key}: {value}" for key, value in facts.items()),
        treats="; ".join(profile.treated_labels()), areas=areas)


def safety_prompt(profile: ClinicProfile) -> str:
    return instructions("safety", emergency=profile.emergency.signs, see_today=profile.see_today.signs,
                        doctor_name=profile.doctor.name, speciality=profile.doctor.speciality)


def front_desk_agent(text: str, profile: ClinicProfile, facts: dict, history: list[str]) -> Served[Understanding]:
    earlier = "\n".join(history[-6:]) or "(start of call)"
    messages = [("system", front_desk_prompt(profile, facts)),
                ("human", f"Earlier in this call:\n{earlier}\n\nCaller now says: {text}")]
    return invoke_structured("front_desk_agent", messages, Understanding)


def safety_agent(text: str, profile: ClinicProfile) -> Served[Safety]:
    return invoke_structured("safety_agent", [("system", safety_prompt(profile)), ("human", text)], Safety)


def warm_up(profile: ClinicProfile) -> None:
    """One small call per agent at start-up, so the connections are open before the first caller.
    Measured: the first call of a run took 11.8 s, the ones after it about 1.5 s."""
    try:
        front_desk_agent("Namaste", profile, profile.facts(), [])
        safety_agent("Namaste", profile)
    except Exception as error:  # a failed warm-up must not stop the server; the router falls back later
        log.warning("warm-up call failed: %s", type(error).__name__)


def keyword_check(text: str, profile: ClinicProfile) -> str:
    """A plain word list beside the safety agent. Either one can raise the alarm."""
    lowered = text.lower()
    for tier, rule in profile.urgency().items():          # emergency first
        if any(word in lowered for word in rule.keywords):
            return tier
    return "none"
