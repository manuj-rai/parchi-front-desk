"""Which model does which job. The only module that turns settings into model choices.

Each job lists models in order of preference, written "provider:model" (set in settings.py,
overridable by PARCHI_MODELS_* variables). At run time the first model whose provider has a
key is tried; if it fails or passes the job's time limit, the next one answers. Different
providers in one list protect against one provider being down.
"""

from dataclasses import dataclass, field

from .settings import get_settings


@dataclass(frozen=True)
class Route:
    models: tuple[str, ...]   # in order of preference
    timeout_s: float          # time limit for one attempt
    why: str


WHY = {
    "front_desk_agent": "Works out what the caller wants. Fast, non-reasoning models: every second is heard.",
    "safety_agent": "Listens only for danger. A miss is the worst failure, so it has fallbacks from two providers.",
    "speech_to_text": "Deepgram first for speed when its key is set; OpenAI otherwise.",
    "text_to_speech": "A natural Hindi voice.",
}


def routes() -> dict[str, Route]:
    settings = get_settings()
    timeouts = {"front_desk_agent": settings.timeout_agent_s, "safety_agent": settings.timeout_agent_s,
                "speech_to_text": settings.timeout_stt_s, "text_to_speech": settings.timeout_tts_s}
    return {job: Route(tuple(models), timeouts[job], WHY[job]) for job, models in settings.model_lists().items()}


@dataclass(frozen=True)
class Served[T]:
    """A result plus which model produced it, how long it took, and what failed before it."""
    output: T
    model: str
    ms: int
    fallbacks: tuple[str, ...] = field(default=())


def split(spec: str) -> tuple[str, str]:
    provider, _, name = spec.partition(":")
    return provider, name


def api_key(spec: str) -> str | None:
    return get_settings().key_for(spec)


def configured(role: str) -> list[str]:
    """The models for a job that can actually run here (their provider's key is set)."""
    return [spec for spec in routes()[role].models if api_key(spec)]
