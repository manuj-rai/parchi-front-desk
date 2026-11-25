"""The call, as a LangGraph.

Every time the caller speaks:

    START --> front_desk agent --+
      |                          +--> decide --> status | book | my_booking | cancel | info | medical
      +-----> safety agent ------+                | not_here | urgent | about | clarify | handoff --> END

- The two agents run in parallel, so the safety check costs no extra waiting time.
- `decide` routes on their structured output and on the clinic's data:
    1. An emergency always wins, at every clinic: hospital now, the doctor alerted, and no
       token, even inside a booking (call 5), so nothing suggests the caller can wait.
    2. The doctor's own "see today" rule applies to problems this clinic treats.
    3. A health problem this doctor does not treat gets no token and no false hope: Parchi
       says who to see instead (not_here). Whether the doctor treats it comes from the
       clinic's file, never from the model, which only names the problem area.
    4. A problem that fits no area goes to the doctor as a question: no token, no promise.
- If an agent's models all fail, the call degrades instead of breaking: the safety
  word list still runs, and an unanswerable turn goes to a person.
- Bookings live in the appointment book. The front-desk agent is told this caller's bookings
  (found by their number) and says what they want; the nodes read and change the book, so
  every token number and day a caller hears comes from the data: no second token for the
  same person on the same day, "my token?" and "cancel it" answered from the book.
- A checkpointer keeps each call's memory, keyed by the call's id.
- Every spoken sentence comes from prompts/replies.toml.
"""

import operator
from datetime import date
from typing import Annotated, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from . import agents
from .clinic_profile import ClinicProfile
from .clinic_state import ClinicState
from .llm_router import AllModelsFailed
from .prompt_loader import day_words, say
from .settings import get_settings

CALL_ROUTES = ["status", "book", "my_booking", "cancel", "info", "medical", "not_here", "urgent", "about", "clarify",
               "handoff"]
# Intents of a patient seeking care: if their problem is not treated here, they are told so.
CARE_INTENTS = {"book", "medical", "status", "info"}


def fixed_replies(profile: ClinicProfile) -> list[str]:
    """Every reply with no number in it, for this clinic. Turned into audio once at start-up."""
    not_here = [say("not_here", clinic_kind=profile.kind, problem=area.spoken, see=area.see)
                for area in profile.areas.values() if not profile.treats(area.id)]
    return [say("handoff", receptionist=profile.receptionist), say("booked"), say("no_advice"),
            say("about", clinic=profile.name, receptionist=profile.receptionist), say("safety_net"),
            *(rule.say for rule in profile.urgency().values()), *not_here]


def _merge(old: dict | None, new: dict) -> dict:
    """Both agents write `served_by` at the same time; keep both entries."""
    return {**(old or {}), **new}


class CallState(TypedDict, total=False):
    text: str                                     # what the caller just said
    call_id: str | None                           # kept on any token this call books
    phone: str | None                             # the caller's number, if the line passed it on
    caller_name: str | None                       # the name on record for that number, if any
    history: Annotated[list[str], operator.add]   # the whole call, kept by the checkpointer
    understanding: dict
    safety: dict
    scope: dict                                   # does this clinic treat the problem? decided from data
    clarifications: int                           # how many times Parchi had to ask again
    route: str
    reply: str
    actions: list[str]                            # what Parchi did this turn
    served_by: Annotated[dict, _merge]            # which model answered for each agent


def scope_of(understanding: dict | None, profile: ClinicProfile) -> dict:
    """Does this clinic treat what the caller mentioned? From the clinic's file, not the model.

    verdict: "treated", "not_treated", "unknown" (a health problem that fits no area), or "none".
    """
    if not understanding:
        return {"verdict": "none", "area": None, "see": None}
    area = profile.area_for(understanding.get("problem_area"))
    if area:
        treated = profile.treats(area.id)
        return {"verdict": "treated" if treated else "not_treated", "area": area.label,
                "see": None if treated else area.see}
    if understanding.get("concern"):
        return {"verdict": "unknown", "area": None, "see": None}
    return {"verdict": "none", "area": None, "see": None}


def build_call_graph(clinic: ClinicState, front_desk=agents.front_desk_agent, safety=agents.safety_agent,
                     checkpointer=None):
    profile = clinic.profile

    # ---- the two agents, in parallel ---------------------------------------------
    def front_desk_node(state: CallState) -> dict:
        try:
            served = front_desk(state["text"], profile, clinic.facts(state.get("phone")), state.get("history", []))
        except AllModelsFailed:
            return {"understanding": None, "served_by": {"front_desk": _unavailable()}}
        return {"understanding": served.output.model_dump(), "served_by": {"front_desk": _record(served)}}

    def safety_node(state: CallState) -> dict:
        word_tier = agents.keyword_check(state["text"], profile)
        try:
            served = safety(state["text"], profile)
            model_tier, sign, record = served.output.tier, served.output.sign, _record(served)
        except AllModelsFailed:
            model_tier, sign, record = "unavailable", None, _unavailable()
        tier = _most_serious(model_tier, word_tier)
        return {"safety": {"tier": tier, "sign": sign, "model_said": model_tier, "words_said": word_tier},
                "served_by": {"safety": record}}

    # ---- routing ---------------------------------------------------------------------
    def decide(state: CallState) -> dict:
        u = state["understanding"]
        scope = scope_of(u, profile)
        tier = state["safety"]["tier"]
        if tier == "emergency":
            return {"route": "urgent", "scope": scope}                 # an emergency always wins
        if tier == "see_today" and scope["verdict"] != "not_treated":
            return {"route": "urgent", "scope": scope}                 # the doctor's rule, for what he treats
        if u is None:
            return {"route": "handoff", "scope": scope}                # no model could understand: a person will
        if u["intent"] == "unclear" or u["confidence"] < get_settings().confidence_floor:
            return {"route": "clarify" if state.get("clarifications", 0) == 0 else "handoff", "scope": scope}
        if u["intent"] in CARE_INTENTS and scope["verdict"] == "not_treated":
            return {"route": "not_here", "scope": scope}               # no token, no false hope
        if u["intent"] in {"book", "medical"} and scope["verdict"] == "unknown":
            return {"route": "medical", "scope": scope}                # the doctor decides; no token yet
        by_intent = {"status": "status", "book": "book", "my_booking": "my_booking", "cancel": "cancel",
                     "info": "info", "medical": "medical", "about_assistant": "about"}
        return {"route": by_intent.get(u["intent"], "handoff"), "scope": scope}   # report and other: a person

    # ---- what each route does --------------------------------------------------------
    def status_node(state: CallState) -> dict:
        return _reply(clinic.status_line(), [])                  # from the data, never from the model

    def book_node(state: CallState) -> dict:
        u = state["understanding"]
        phone = state.get("phone")
        day = clinic.booking_day(u.get("booking_day", "today"))
        existing = clinic.existing_booking(phone, u["name"], day)
        if existing:                                               # the same person, the same day: one token
            return _reply(f"{say('already_booked')} {clinic.token_line(existing)} {clinic.when_to_come(existing)}",
                          [f"already booked: token {existing.number} ({existing.day})", "no second token"])
        token = clinic.book(u["name"] or state.get("caller_name"), no_contact=u["wants_no_messages"], phone=phone,
                            day=day, call_id=state.get("call_id"))
        text = f"{say('booked')} {clinic.token_line(token)} {clinic.when_to_come(token)}"
        booked = f"booked token {token.number}" + ("" if day == clinic.today() else f" for {token.day}")
        if token.no_contact:
            text += f" {say('no_contact', number=token.number)}"
            actions = [booked, "marked: do not contact", "WhatsApp confirmation blocked"]
        else:
            actions = [booked, "WhatsApp confirmation sent"]
        return _reply(text, actions)

    def my_booking_node(state: CallState) -> dict:
        phone = state.get("phone")
        if not phone:                                              # a withheld number cannot be looked up
            return _handoff(state, "asked about their token; number withheld")
        bookings = clinic.bookings_for(phone)
        active = [b for b in bookings if b.active]
        if active:
            return _reply(" ".join(clinic.describe_booking(b) for b in active[:2]),
                          [f"read token {b.number} ({b.day}) from the book" for b in active[:2]])
        seen = [b for b in bookings if b.status == "seen"]
        if seen:
            return _reply(clinic.describe_booking(seen[-1]), [f"token {seen[-1].number} already seen"])
        return _reply(say("no_booking"), ["no booking from this number"])

    def cancel_node(state: CallState) -> dict:
        phone = state.get("phone")
        if not phone:
            return _handoff(state, "wants to cancel a token; number withheld")
        waiting = [b for b in clinic.bookings_for(phone) if b.status == "waiting"]
        name = state["understanding"].get("name")
        named = [b for b in waiting if name and b.name.lower() == name.lower()]
        choices = named or waiting
        if not choices:
            return _reply(say("nothing_to_cancel"), ["nothing to cancel"])
        if len(choices) > 1:                                       # two family members booked: a person asks which
            return _handoff(state, f"wants to cancel one of tokens {', '.join(str(b.number) for b in choices)}")
        token = choices[0]
        clinic.cancel(token, by="the caller, on the phone")
        words = day_words(date.fromisoformat(token.day), clinic.today())
        return _reply(say("cancelled", number=token.number, **words),
                      [f"cancelled token {token.number} ({token.day})", "receptionist's board updated"])

    def info_node(state: CallState) -> dict:
        return _reply(state["understanding"]["reply"], [])       # the agent answered from the clinic facts

    def medical_node(state: CallState) -> dict:
        clinic.alert("question for doctor", state["text"])
        return _reply(f"{say('no_advice')} {clinic.status_line()}", ["question sent to the doctor", "no token yet"])

    def not_here_node(state: CallState) -> dict:
        area = profile.area_for(state["scope"]["area"])
        text = (f"{say('not_here', clinic_kind=profile.kind, problem=area.spoken, see=area.see)} "
                f"{say('safety_net')}")
        return _reply(text, [f"no token: {profile.doctor.name} does not treat {area.label}",
                             f"told to see {area.see}"])

    def urgent_node(state: CallState) -> dict:
        tier = state["safety"]["tier"]
        u = state["understanding"] or {}
        clinic.alert(f"URGENT ({tier})", f"{state['safety']['sign'] or 'warning sign'}: \"{state['text']}\"")
        text = profile.urgency()[tier].say                       # the doctor's own sentence
        actions = [f"urgent alert to doctor and receptionist ({tier})"]
        if tier == "emergency":
            # Hospital now, and nothing else: a token would tell him he can wait for it (call 5).
            if u.get("intent") == "book":
                actions.append("booking stopped: sent to hospital, no token")
            return _reply(text, actions)
        if tier == "see_today":
            phone = state.get("phone")
            day = clinic.today()                                   # the doctor's see-today rule means today
            token = clinic.existing_booking(phone, u.get("name"), day)
            if token is None:
                token = clinic.book(u.get("name") or state.get("caller_name"), see_first=True,
                                    phone=phone, day=day, call_id=state.get("call_id"))
                actions.append(f"booked token {token.number}, see first")
            elif not token.see_first:
                clinic.appointments.set_see_first(token.id)
                actions.append(f"token {token.number} marked: see first")
            text += f" {clinic.token_line(token)}"
        return _reply(text, actions)

    def about_node(state: CallState) -> dict:
        return _reply(say("about", clinic=profile.name, receptionist=profile.receptionist), [])

    def clarify_node(state: CallState) -> dict:
        update = _reply(state["understanding"]["reply"], ["asked one either-or question"])
        update["clarifications"] = state.get("clarifications", 0) + 1
        return update

    def handoff_node(state: CallState) -> dict:
        return _handoff(state, None)

    def _handoff(state: CallState, why: str | None) -> dict:
        clinic.alert("call back", f"{why}: \"{state['text']}\"" if why else state["text"])
        return _reply(say("handoff", receptionist=profile.receptionist), ["handed to the receptionist with a callback"])

    # ---- wiring ------------------------------------------------------------------------
    graph = StateGraph(CallState)
    graph.add_node("front_desk", front_desk_node)
    graph.add_node("safety", safety_node)
    graph.add_node("decide", decide)
    for name, node in [("status", status_node), ("book", book_node), ("my_booking", my_booking_node),
                       ("cancel", cancel_node), ("info", info_node),
                       ("medical", medical_node), ("not_here", not_here_node), ("urgent", urgent_node),
                       ("about", about_node), ("clarify", clarify_node), ("handoff", handoff_node)]:
        graph.add_node(name, node)
        graph.add_edge(name, END)
    graph.add_edge(START, "front_desk")
    graph.add_edge(START, "safety")
    graph.add_edge(["front_desk", "safety"], "decide")          # wait for both agents
    graph.add_conditional_edges("decide", lambda state: state["route"], {r: r for r in CALL_ROUTES})
    return graph.compile(checkpointer=checkpointer or InMemorySaver())


def _reply(text: str, actions: list[str]) -> dict:
    update = {"reply": text, "actions": actions, "history": [f"Parchi: {text}"]}
    if not any(a.startswith("asked one") for a in actions):
        update["clarifications"] = 0                            # a real answer resets the count
    return update


def _record(served) -> dict:
    return {"model": served.model, "ms": served.ms, "fallbacks": list(served.fallbacks)}


def _unavailable() -> dict:
    return {"model": "none: all models failed", "ms": 0, "fallbacks": []}


def _most_serious(model_tier: str, word_tier: str) -> str:
    order = ["none", "unavailable", "see_today", "emergency"]
    tier = max(model_tier, word_tier, key=order.index)
    return "none" if tier == "unavailable" else tier
