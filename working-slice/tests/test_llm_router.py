"""Model orchestration: order, skipping providers with no key, fallback on failure.
No network: the chat models are replaced by stand-ins, and settings are built in the test.

    cd working-slice
    python -m unittest -v
"""

import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from pydantic import BaseModel, SecretStr

from parchi import llm_router, model_routes
from parchi import settings as settings_module
from parchi.settings import PROVIDERS, Settings


class Answer(BaseModel):
    text: str


class StandIn:
    """Behaves like a LangChain structured model: .invoke() returns or raises."""

    def __init__(self, spec: str, fails: bool):
        self.spec, self.fails = spec, fails

    def invoke(self, messages):
        if self.fails:
            raise TimeoutError(f"{self.spec} timed out")
        return Answer(text=f"answered by {self.spec}")


def settings_with(models: list[str], keys: set[str]) -> Settings:
    """Settings for one test: the front-desk job uses `models`; only providers in `keys` have a key."""
    secrets = {f"{p}_api_key": SecretStr("test-key") if p in keys else None for p in PROVIDERS}
    return Settings.model_construct(models_front_desk=",".join(models), **secrets)


class Orchestration(unittest.TestCase):
    def run_job(self, models, keys, failing=()):
        stand_in = lambda spec, schema, timeout: StandIn(spec, spec in failing)  # noqa: E731
        with mock.patch.object(model_routes, "get_settings", lambda: settings_with(models, keys)), \
             mock.patch.object(llm_router, "_structured_model", stand_in):
            return llm_router.invoke_structured("front_desk_agent", [("human", "hi")], Answer)

    def test_first_model_answers(self):
        served = self.run_job(["openai:a", "openai:b"], {"openai"})
        self.assertEqual(served.model, "openai:a")
        self.assertEqual(served.fallbacks, ())

    def test_falls_back_to_the_next_model_when_one_fails(self):
        served = self.run_job(["openai:a", "openai:b"], {"openai"}, failing={"openai:a"})
        self.assertEqual(served.model, "openai:b")
        self.assertEqual(served.fallbacks, ("openai:a (TimeoutError)",))

    def test_falls_back_across_providers(self):
        served = self.run_job(["openai:a", "anthropic:c"], {"openai", "anthropic"}, failing={"openai:a"})
        self.assertEqual(served.model, "anthropic:c")

    def test_skips_a_provider_with_no_key(self):
        served = self.run_job(["anthropic:c", "openai:a"], {"openai"})
        self.assertEqual(served.model, "openai:a")
        self.assertEqual(served.fallbacks, ())          # not configured is not a failure

    def test_raises_when_every_model_fails(self):
        with self.assertRaises(llm_router.AllModelsFailed):
            self.run_job(["openai:a", "openai:b"], {"openai"}, failing={"openai:a", "openai:b"})

    def test_raises_when_no_provider_is_configured(self):
        with self.assertRaises(llm_router.AllModelsFailed):
            self.run_job(["anthropic:c"], set())


class ModelOptions(unittest.TestCase):
    def test_reasoning_models_do_not_think_on_a_live_call(self):
        self.assertEqual(llm_router.model_options("openai", "gpt-5.4-nano")["reasoning_effort"], "none")

    def test_other_openai_models_use_temperature_zero(self):
        self.assertEqual(llm_router.model_options("openai", "gpt-4.1-mini"), {"temperature": 0})

    def test_claude_models_get_no_temperature(self):
        self.assertNotIn("temperature", llm_router.model_options("anthropic", "claude-haiku-5-5"))


class SettingsValidation(unittest.TestCase):
    """Bad configuration is refused at start-up, with a message that says what to fix."""

    def build(self, **values):
        return Settings(_env_file=None, **values)

    def test_offline_mode_needs_no_keys(self):
        self.assertTrue(self.build(fake_models=True).fake_models)

    def test_live_mode_without_any_key_is_refused(self):
        with mock.patch.dict("os.environ", {}, clear=True), self.assertRaisesRegex(ValueError, "no API key"):
            self.build(fake_models=False)

    def test_offline_mode_is_refused_in_production(self):
        with self.assertRaisesRegex(ValueError, "not allowed when PARCHI_ENV=production"):
            self.build(fake_models=True, env="production")

    def test_a_model_must_name_a_known_provider(self):
        with self.assertRaisesRegex(ValueError, "provider:model"):
            self.build(fake_models=True, models_safety="gpt-4.1-mini")

    def test_blank_key_counts_as_not_set(self):
        settings = Settings.model_validate({"fake_models": True, "OPENAI_API_KEY": ""})
        self.assertIsNone(settings.openai_api_key)

    def test_keys_never_appear_when_printed(self):
        settings = self.build(fake_models=True, OPENAI_API_KEY="sk-very-secret")
        self.assertNotIn("sk-very-secret", repr(settings))
        self.assertNotIn("sk-very-secret", str(settings.model_dump()))

    def test_test_runs_clear_away_earlier_runs_data_but_not_a_parallel_one(self):
        settings_module.TEST_DATA_ROOT.mkdir(exist_ok=True)
        stale =Path(tempfile.mkdtemp(dir=settings_module.TEST_DATA_ROOT))
        recent = Path(tempfile.mkdtemp(dir=settings_module.TEST_DATA_ROOT))
        a_day_ago = time.time() - settings_module.STALE_TEST_DATA_S - 60
        os.utime(stale, (a_day_ago, a_day_ago))
        fresh = self.build(fake_models=True, env="test").data_dir
        self.assertEqual(fresh.parent, settings_module.TEST_DATA_ROOT)
        self.assertFalse(stale.exists())
        self.assertTrue(recent.exists())


class RoutingTable(unittest.TestCase):
    def test_every_job_has_a_model_and_a_time_limit(self):
        for job, route in model_routes.routes().items():
            self.assertTrue(route.models, job)
            self.assertGreater(route.timeout_s, 0, job)

    def test_safety_agent_has_a_second_provider(self):
        providers = {model_routes.split(s)[0] for s in model_routes.routes()["safety_agent"].models}
        self.assertGreaterEqual(len(providers), 2)


if __name__ == "__main__":
    unittest.main()
