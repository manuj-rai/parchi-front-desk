"""Loads the agents' instructions and Parchi's spoken sentences from parchi/prompts/.

    instructions("front_desk", clinic_name="...")    the front-desk agent's system prompt, filled in
    say("not_here", clinic_kind="...", ...)          one spoken sentence, filled in

Keeping words out of code means they can be read, checked and corrected in one place.
A missing placeholder fails loudly, so a sentence is never spoken with a gap in it.
"""

import tomllib
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

PROMPTS = Path(__file__).resolve().parent / "prompts"


@lru_cache(maxsize=None)
def _instruction_template(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _replies() -> dict[str, str]:
    return tomllib.loads((PROMPTS / "replies.toml").read_text(encoding="utf-8"))


def instructions(name: str, **values: str) -> str:
    """An agent's system prompt from prompts/<name>.md, with its {placeholders} filled."""
    return _instruction_template(name).format(**values)


def say(name: str, **values: object) -> str:
    """One of Parchi's fixed sentences from prompts/replies.toml, with its {placeholders} filled."""
    return _replies()[name].format(**values)


def reply_names() -> list[str]:
    return [name for name, value in _replies().items() if isinstance(value, str)]


def day_words(day: date, today: date) -> dict[str, str]:
    """{day} and {day_when} for a sentence: "aaj"/"kal", or the weekday ("somvaar", "somvaar ko")."""
    words = _replies()["days"]
    if day == today:
        return {"day": words["today"], "day_when": words["today"]}
    if day == today + timedelta(days=1):
        return {"day": words["tomorrow"], "day_when": words["tomorrow"]}
    weekday = words["weekdays"][day.weekday()]
    return {"day": weekday, "day_when": f"{weekday} {words['on']}"}
