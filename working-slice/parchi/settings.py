"""All configuration, in one typed and validated place.

Values come from, highest priority first:
  1. real environment variables (how production and CI set them)
  2. working-slice/.env (local development; never committed)
  3. the defaults below

Every app setting is prefixed PARCHI_. API keys keep their providers' standard names.
Keys are SecretStr: they never appear in logs, errors or the API.

    python -m parchi.settings      print the effective settings, keys masked, and any problems
"""

import shutil
import tempfile
import time
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SLICE_ROOT = Path(__file__).resolve().parent.parent
PROVIDERS = ("openai", "anthropic", "google", "deepgram")
TEST_DATA_ROOT = Path(tempfile.gettempdir()) / "parchi-test"
STALE_TEST_DATA_S = 24 * 3600


def fresh_test_data_dir() -> Path:
    """A new, empty data folder for one test run, never the real one.

    Folders from earlier runs are removed here rather than at exit: on Windows the run's own
    SQLite files are still open at exit and cannot be deleted. Only folders a day old are
    removed, so a run going on in parallel (the browser tests' server) keeps its folder.
    """
    TEST_DATA_ROOT.mkdir(exist_ok=True)
    for old in TEST_DATA_ROOT.iterdir():
        try:
            if time.time() - old.stat().st_mtime > STALE_TEST_DATA_S:
                shutil.rmtree(old, ignore_errors=True)
        except OSError:
            pass                      # another run removed it first
    return Path(tempfile.mkdtemp(dir=TEST_DATA_ROOT))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PARCHI_", env_file=SLICE_ROOT / ".env", env_file_encoding="utf-8", extra="ignore",
        hide_input_in_errors=True,   # a validation error must never print the values, which include keys
    )

    # ---- runtime ------------------------------------------------------------------
    env: Literal["development", "test", "production"] = "development"
    host: str = "127.0.0.1"
    port: int = Field(8765, ge=1, le=65535)
    log_level: Literal["debug", "info", "warning", "error"] = "warning"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"   # the UI's dev server
    fake_models: bool = False            # offline test mode: stand-in models, no keys, no cost

    # ---- product ------------------------------------------------------------------
    # Which clinic this server answers for: a file in working-slice/clinics/ (without .toml).
    # It holds the clinic's facts, what its doctor treats, and the doctor's urgency rules.
    clinic: str = "general-physician"
    silence_limit_s: float = Field(2.0, gt=0)     # callers who heard >2 s of silence hung up 3x as often
    confidence_floor: float = Field(0.6, ge=0, le=1)
    tts_voice: str = "coral"
    # Tell OpenAI speech-to-text the language. Without it, Hindi sometimes came back in Urdu
    # script, which the danger-word list could not read. Empty means "detect it".
    stt_language: str = "hi"

    # ---- model routing: "provider:model", in order of preference -------------------
    models_front_desk: str = "openai:gpt-5.4-mini,anthropic:claude-haiku-5-5,openai:gpt-4.1-mini"   # chosen by evaluation, 23 Nov: fastest with 51/51 intents
    models_safety: str = "openai:gpt-4.1-mini,anthropic:claude-haiku-5-5,openai:gpt-5.4-mini"       # best at catching danger alone (11/12)
    models_stt: str = "deepgram:nova-3,openai:gpt-4o-mini-transcribe"
    models_tts: str = "openai:gpt-4o-mini-tts"
    timeout_agent_s: float = Field(5.0, gt=0)     # one attempt, before falling back
    timeout_stt_s: float = Field(5.0, gt=0)
    timeout_tts_s: float = Field(8.0, gt=0)

    # ---- the call log and staff access ----------------------------------------------
    # Calls, transcripts and recordings are kept here (SQLite and audio files). Never committed.
    # In PARCHI_ENV=test each run always gets a fresh temporary folder, whatever .env says.
    data_dir: Path = SLICE_ROOT / "data"
    retention_days: int = Field(90, ge=1, le=3650)    # older calls and their recordings are deleted at start-up
    clinic_utc_offset_minutes: int = Field(330, ge=-720, le=840)   # India: UTC+5:30, no daylight saving
    max_upload_mb: float = Field(5, gt=0, le=50)        # one recorded caller turn
    session_hours: float = Field(12, gt=0, le=72)       # a staff sign-in lasts one working day
    # Staff passwords, stored only as hashes. Make one with: python -m parchi.auth hash
    doctor_password_hash: SecretStr | None = None
    reception_password_hash: SecretStr | None = None
    # Test sign-ins (doctor/doctor-test, reception/reception-test) for trying everything locally.
    # Always on in offline test mode; refused in production.
    demo_logins: bool = False

    # ---- provider keys (standard names, no prefix) ----------------------------------
    openai_api_key: SecretStr | None = Field(None, validation_alias="OPENAI_API_KEY")
    anthropic_api_key: SecretStr | None = Field(None, validation_alias="ANTHROPIC_API_KEY")
    google_api_key: SecretStr | None = Field(None, validation_alias="GOOGLE_API_KEY")
    deepgram_api_key: SecretStr | None = Field(None, validation_alias="DEEPGRAM_API_KEY")

    @field_validator("models_front_desk", "models_safety", "models_stt", "models_tts")
    @classmethod
    def _known_providers(cls, value: str) -> str:
        for spec in split_list(value):
            provider, _, model = spec.partition(":")
            if provider not in PROVIDERS or not model:
                raise ValueError(f"'{spec}' must look like provider:model, with provider one of {PROVIDERS}")
        if not split_list(value):
            raise ValueError("needs at least one model")
        return value

    @field_validator("openai_api_key", "anthropic_api_key", "google_api_key", "deepgram_api_key",
                     "doctor_password_hash", "reception_password_hash", mode="before")
    @classmethod
    def _blank_is_none(cls, value):
        return value or None                     # "OPENAI_API_KEY=" in .env means "not set"

    @field_validator("clinic")
    @classmethod
    def _clinic_file_loads(cls, value: str) -> str:
        from .clinic_profile import load_clinic     # loads and checks the clinic's file now, not mid-call
        load_clinic(value)
        return value

    @field_validator("data_dir")
    @classmethod
    def _relative_to_the_slice(cls, value: Path) -> Path:
        return value if value.is_absolute() else SLICE_ROOT / value   # not wherever the server was started

    @field_validator("doctor_password_hash", "reception_password_hash")
    @classmethod
    def _looks_like_a_hash(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            parts = value.get_secret_value().split("$")
            if len(parts) != 4 or parts[0] != "pbkdf2_sha256" or not parts[1].isdigit():
                raise ValueError("must be a hash from `python -m parchi.auth hash`, not a password")
        return value

    @model_validator(mode="after")
    def _can_run(self) -> "Settings":
        if self.fake_models:
            if self.env == "production":
                raise ValueError("PARCHI_FAKE_MODELS=1 is a test mode and is not allowed when PARCHI_ENV=production")
            return self
        problems = [f"no API key for any model in {job} ({', '.join(models)})"
                    for job, models in self.model_lists().items() if not any(self.key_for(m) for m in models)]
        if problems:
            raise ValueError("; ".join(problems) + ". Add a key to working-slice/.env, "
                             "or set PARCHI_FAKE_MODELS=1 for offline test mode.")
        return self

    @model_validator(mode="after")
    def _safe_staff_access(self) -> "Settings":
        """Runs after _can_run, so offline test mode in production is reported first."""
        if self.env == "production":
            if self.demo_logins:
                raise ValueError("PARCHI_DEMO_LOGINS=1 is for testing and is not allowed when PARCHI_ENV=production")
            if not self.doctor_password_hash:
                raise ValueError("production needs PARCHI_DOCTOR_PASSWORD_HASH (python -m parchi.auth hash)")
            for name in ("doctor_password_hash", "reception_password_hash"):
                secret = getattr(self, name)
                if secret and int(secret.get_secret_value().split("$")[1]) < 600_000:
                    raise ValueError(f"{name} uses too few iterations for production; make it again with parchi.auth")
        if self.env == "test":
            # Always, even when .env names a folder: a test run must never write into real calls.
            # (.env.example once set PARCHI_DATA_DIR=data, and tests then filled the real call log.)
            self.data_dir = fresh_test_data_dir()
        return self

    # ---- helpers -------------------------------------------------------------------
    def model_lists(self) -> dict[str, list[str]]:
        return {"front_desk_agent": split_list(self.models_front_desk), "safety_agent": split_list(self.models_safety),
                "speech_to_text": split_list(self.models_stt), "text_to_speech": split_list(self.models_tts)}

    def key_for(self, spec: str) -> str | None:
        secret = getattr(self, f"{spec.partition(':')[0]}_api_key", None)
        return secret.get_secret_value() if secret else None

    def cors_origin_list(self) -> list[str]:
        return split_list(self.cors_origins)

    @property
    def test_logins(self) -> bool:
        """Test sign-ins: asked for, or offline test mode (which production already refuses)."""
        return self.demo_logins or self.fake_models


def split_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """The settings, read once. Tests that change the environment call get_settings.cache_clear()."""
    return Settings()


def describe(settings: Settings) -> str:
    """The effective settings, keys masked. Safe to print or log."""
    lines = []
    for name, value in settings.model_dump().items():
        if name.endswith(("_api_key", "_hash")):
            value = "set" if value else "not set"
        lines.append(f"  {name:<20} {value}")
    return "\n".join(lines)


def explain(error: ValidationError) -> str:
    """One line per problem, without the input values."""
    lines = []
    for problem in error.errors(include_input=False, include_url=False):
        where = ".".join(str(part) for part in problem["loc"]) or "settings"
        lines.append(f"  - {where}: {problem['msg'].removeprefix('Value error, ')}")
    return "Settings are not valid:\n" + "\n".join(lines)


if __name__ == "__main__":
    try:
        current = get_settings()
    except ValidationError as error:
        raise SystemExit(explain(error)) from None
    print(f"Settings for PARCHI_ENV={current.env} (environment variables override {SLICE_ROOT / '.env'}):")
    print(describe(current))
