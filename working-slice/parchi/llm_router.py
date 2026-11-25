"""Text models from several providers behind one call, with fallbacks.

    served = invoke_structured("safety_agent", messages, Safety)
    served.output   -> a Safety object
    served.model    -> e.g. "openai:gpt-4.1-mini"
"""

import importlib
import logging
import time
from functools import lru_cache

from pydantic import BaseModel

from .model_routes import Served, api_key, configured, routes, split

log = logging.getLogger("parchi.llm")

# provider -> (LangChain package, chat class, extra settings)
PROVIDERS = {
    "openai": ("langchain_openai", "ChatOpenAI", {"temperature": 0}),
    "anthropic": ("langchain_anthropic", "ChatAnthropic", {}),  # current Claude models reject a temperature
    "google": ("langchain_google_genai", "ChatGoogleGenerativeAI", {"temperature": 0}),
}


class AllModelsFailed(RuntimeError):
    """Every configured model for a job failed or had no key."""


def preload() -> None:
    """Import each configured provider's package at start-up. A cold import measured 7.5 s
    on this machine; without this, the first caller of the day would wait for it."""
    for role in routes():
        for spec in configured(role):
            provider = split(spec)[0]
            if provider in PROVIDERS:
                importlib.import_module(PROVIDERS[provider][0])


def model_options(provider: str, name: str) -> dict:
    """Per-model settings. Reasoning models (OpenAI gpt-5 family) think before answering; on a
    live call that thinking is silence the caller hears, so it is switched off."""
    options = dict(PROVIDERS[provider][2])
    if provider == "openai" and name.startswith("gpt-5"):
        options["reasoning_effort"] = "none"
    return options


@lru_cache(maxsize=None)
def _structured_model(spec: str, schema: type[BaseModel], timeout_s: float):
    provider, name = split(spec)
    package, class_name, _ = PROVIDERS[provider]
    chat_class = getattr(importlib.import_module(package), class_name)
    # The key is passed in explicitly from settings: one source of truth, nothing read from os.environ.
    chat = chat_class(model=name, api_key=api_key(spec), timeout=timeout_s, max_retries=0,
                      **model_options(provider, name))
    return chat.with_structured_output(schema)


def invoke_structured[T: BaseModel](role: str, messages: list, schema: type[T]) -> Served[T]:
    route = routes()[role]
    failed: list[str] = []
    for spec in configured(role):
        start = time.perf_counter()
        try:
            output = _structured_model(spec, schema, route.timeout_s).invoke(messages)
        except Exception as error:  # a timeout, an outage, a bad response: try the next model
            failed.append(f"{spec} ({type(error).__name__})")
            log.warning("%s: %s failed with %s, falling back", role, spec, type(error).__name__)
            continue
        return Served(output, spec, round((time.perf_counter() - start) * 1000), tuple(failed))
    raise AllModelsFailed(f"{role}: no model answered. Tried: {failed or 'none configured'}")
