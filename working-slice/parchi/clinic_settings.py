"""The doctor's own changes to the clinic's details and rules, made on the dashboard.

The shipped file clinics/<id>.toml holds the starting values. When the doctor saves changes,
they are kept in <data_dir>/clinic-settings/<id>.json and laid over the shipped file, so they
survive a restart and an update of the shipped files. Deleting that file restores the original.

    store = ClinicSettings(data_dir)
    store.profile("dental")                           the clinic as callers meet it now
    store.save("dental", details, by="Dr. Mehta")     checked like a clinic file, then kept
    store.history("dental")                           who changed what, and when

Every save is checked exactly as a clinic file is, so the doctor cannot save a clinic that
treats an unknown problem area or has an empty "see today" rule. A change to the "see today"
rule is signed with the doctor's name and the date, because Parchi speaks it as the doctor's rule.
"""

import json
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from collections.abc import Callable
from pathlib import Path
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from .clinic_profile import WEEKDAYS, ClinicProfile, build_profile, clinic_data

HISTORY_KEPT = 50


def _text(max_length: int):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)]


def _clean_days(days: list[str]) -> list[str]:
    unknown = [d for d in days if d not in WEEKDAYS]
    if unknown:
        raise ValueError(f"Unknown days: {', '.join(unknown)}.")
    if len(set(days)) == len(WEEKDAYS):
        raise ValueError("The clinic must be open at least one day a week.")
    return sorted(set(days), key=WEEKDAYS.index)


def _clean_keywords(words: list[str]) -> list[str]:
    """Lower case (calls are matched in lower case), no blanks, no repeats, order kept."""
    cleaned = [w.strip().lower() for w in words if w.strip()]
    if not cleaned:
        raise ValueError("Give at least one word that should raise the alarm.")
    return list(dict.fromkeys(cleaned))


class DoctorDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: _text(60)
    speciality: _text(60)
    treats: list[str] = Field(min_length=1, max_length=30, description="problem-area ids this doctor treats")


class SeeTodayRule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    signs: _text(400)                    # for the safety agent: what should not wait until evening
    keywords: Annotated[list[Annotated[str, StringConstraints(max_length=40)]],
                        Field(min_length=1, max_length=80), AfterValidator(_clean_keywords)]
    say: _text(400)                      # spoken to the caller, word for word


class ClinicDetails(BaseModel):
    """What the doctor may change. Callers hear most of it, so each field is short and checked."""
    model_config = ConfigDict(extra="forbid")
    name: _text(80)
    kind: _text(80)                      # spoken: "yeh <kind> hai"
    receptionist: _text(40)
    address: _text(200)
    fees: _text(200)
    timings: _text(200)
    posted_start: str = Field(pattern=r"^([01]?\d|2[0-3]):[0-5]\d$")
    # No tokens are booked for these days; a booking moves to the next open day.
    closed_days: Annotated[list[str], Field(max_length=7), AfterValidator(_clean_days)] = []
    doctor: DoctorDetails
    see_today: SeeTodayRule

    @classmethod
    def of(cls, profile: ClinicProfile) -> "ClinicDetails":
        rule = profile.see_today
        return cls(name=profile.name, kind=profile.kind, receptionist=profile.receptionist, address=profile.address,
                   fees=profile.fees, timings=profile.timings, posted_start=profile.posted_start,
                   closed_days=profile.closed_days,
                   doctor=profile.doctor.model_dump(),
                   see_today={"signs": rule.signs, "keywords": rule.keywords, "say": rule.say})


class ClinicSettings:
    def __init__(self, data_dir: Path, utc_offset_minutes: int = 330):
        self.folder = data_dir / "clinic-settings"
        self.folder.mkdir(parents=True, exist_ok=True)
        self.clinic_tz = timezone(timedelta(minutes=utc_offset_minutes))
        self._lock = threading.Lock()

    # ---- reading ---------------------------------------------------------------------------
    def profile(self, clinic_id: str) -> ClinicProfile:
        """The clinic as callers meet it: the shipped file with the doctor's saved changes on top."""
        return build_profile(clinic_id, {**clinic_data(clinic_id), **self._saved(clinic_id)})

    def changed(self, clinic_id: str) -> bool:
        return self._file(clinic_id).is_file()

    def history(self, clinic_id: str) -> list[dict]:
        """Newest first: {at, by, changed}."""
        path = self._history_file(clinic_id)
        if not path.is_file():
            return []
        lines = path.read_text(encoding="utf-8").splitlines()
        return [json.loads(line) for line in reversed(lines[-HISTORY_KEPT:]) if line.strip()]

    # ---- changing ----------------------------------------------------------------------------
    def save(self, clinic_id: str, details: ClinicDetails, by: str) -> ClinicProfile:
        """Checks and keeps the doctor's changes. Raises ValueError (nothing kept) if they do not check out."""
        with self._lock:
            before = self.profile(clinic_id)
            values = details.model_dump()
            rule_changed = values["see_today"] != ClinicDetails.of(before).see_today.model_dump()
            # Parchi speaks this rule as the doctor's own, so whoever changes it signs it.
            values["see_today"]["approved_by"] = (f"{by}, {self._now():%d %b %Y}" if rule_changed
                                                  else before.see_today.approved_by)
            profile = build_profile(clinic_id, {**clinic_data(clinic_id), **values})     # the same checks as a file
            changed = _changed_fields(ClinicDetails.of(before), details)
            if not changed:
                return before
            _write_atomically(self._file(clinic_id), json.dumps(values, ensure_ascii=False, indent=1))
            self._remember(clinic_id, by, changed)
            return profile

    def restore(self, clinic_id: str, by: str) -> ClinicProfile:
        """Back to the shipped file: the doctor's changes are removed (the history stays)."""
        with self._lock:
            if self._file(clinic_id).is_file():
                _patiently(self._file(clinic_id).unlink)
                self._remember(clinic_id, by, ["restored the original details"])
            return self.profile(clinic_id)

    # ---- files -------------------------------------------------------------------------------
    def _saved(self, clinic_id: str) -> dict:
        path = self._file(clinic_id)
        return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}

    def _remember(self, clinic_id: str, by: str, changed: list[str]) -> None:
        line = json.dumps({"at": self._now().isoformat(timespec="seconds"), "by": by, "changed": changed},
                          ensure_ascii=False)
        with self._history_file(clinic_id).open("a", encoding="utf-8") as history:
            history.write(line + "\n")

    def _file(self, clinic_id: str) -> Path:
        return self.folder / f"{clinic_id}.json"

    def _history_file(self, clinic_id: str) -> Path:
        return self.folder / f"{clinic_id}.history.jsonl"

    def _now(self) -> datetime:
        return datetime.now(self.clinic_tz)


FIELD_NAMES = {
    "name": "clinic name", "kind": "kind of clinic", "receptionist": "receptionist", "address": "address",
    "fees": "fees", "timings": "timings", "posted_start": "start time", "closed_days": "days closed", "doctor.name": "doctor's name",
    "doctor.speciality": "speciality", "doctor.treats": "what the doctor treats",
    "see_today.signs": "see-today signs", "see_today.keywords": "see-today words",
    "see_today.say": "see-today sentence",
}


def _changed_fields(before: ClinicDetails, after: ClinicDetails) -> list[str]:
    old, new = _flat(before.model_dump()), _flat(after.model_dump())
    return [FIELD_NAMES.get(key, key) for key in new if new[key] != old.get(key)]


def _flat(values: dict, prefix: str = "") -> dict:
    flat = {}
    for key, value in values.items():
        if isinstance(value, dict):
            flat.update(_flat(value, f"{prefix}{key}."))
        else:
            flat[f"{prefix}{key}"] = sorted(value) if key == "treats" else value
    return flat


def _write_atomically(path: Path, text: str) -> None:
    """A crash mid-write leaves the old file, never half a file."""
    temporary = path.with_suffix(".tmp")
    temporary.write_text(text, encoding="utf-8")
    _patiently(lambda: os.replace(temporary, path))


def _patiently(action: Callable[[], object], tries: int = 8) -> None:
    """On Windows a virus scanner or indexer may hold a just-written file for a moment."""
    for attempt in range(tries):
        try:
            action()
            return
        except PermissionError:
            if attempt == tries - 1:
                raise
            time.sleep(0.05 * (attempt + 1))
