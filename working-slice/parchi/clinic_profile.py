"""A clinic, as data: who it is, what its doctor treats, and the doctor's urgency rules.

Clinic files live in working-slice/clinics/ (one .toml per clinic), with two shared files:
  problem-areas.toml   the kinds of health problem a caller may mention, and who treats each
  emergency.toml       signs that mean "go to hospital now", at every clinic

    profile = load_clinic("dental")
    profile.treats("teeth")              True
    profile.area_for("fever, cough and cold").see    "kisi general physician"

Every file is checked when it loads (pydantic), so a typo in a clinic file stops the server
at start-up with a clear message instead of reaching a caller.
"""

import tomllib
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, field_validator, model_validator

CLINICS = Path(__file__).resolve().parent.parent / "clinics"
SHARED_FILES = {"problem-areas", "emergency"}
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class ProblemArea(BaseModel):
    id: str
    label: str              # what the front-desk agent copies back
    describes: str          # helps the agent match what callers say
    spoken: str             # how Parchi names the problem out loud
    see: str                # who to see instead, out loud
    words: list[str] = []   # offline test mode only


class UrgencyRule(BaseModel):
    approved_by: str
    signs: str
    keywords: list[str] = Field(min_length=1)
    say: str


class Doctor(BaseModel):
    name: str
    speciality: str
    treats: list[str] = Field(min_length=1)     # problem-area ids


class ClinicProfile(BaseModel):
    id: str
    name: str
    kind: str                # spoken: "yeh <kind> hai"
    receptionist: str
    address: str
    fees: str
    timings: str
    posted_start: str
    closed_days: list[str] = []      # weekday names; no tokens are booked for these days
    doctor: Doctor
    see_today: UrgencyRule
    emergency: UrgencyRule
    areas: dict[str, ProblemArea]

    @field_validator("closed_days")
    @classmethod
    def _real_weekdays(cls, days: list[str]) -> list[str]:
        unknown = [d for d in days if d not in WEEKDAYS]
        if unknown:
            raise ValueError(f"closed_days has {unknown}; use day names like {WEEKDAYS[:2]}")
        if len(set(days)) == len(WEEKDAYS):
            raise ValueError("a clinic cannot be closed every day of the week")
        return sorted(set(days), key=WEEKDAYS.index)

    @model_validator(mode="after")
    def _treats_known_areas(self) -> "ClinicProfile":
        unknown = [area for area in self.doctor.treats if area not in self.areas]
        if unknown:
            raise ValueError(f"clinics/{self.id}.toml: doctor.treats has unknown areas {unknown}; "
                             f"known areas are {sorted(self.areas)}")
        return self

    # ---- scope: what this doctor treats ------------------------------------------------
    def treats(self, area_id: str) -> bool:
        return area_id in self.doctor.treats

    def area_for(self, label: str | None) -> ProblemArea | None:
        """The problem area whose label the agent copied back. None if it matches no area."""
        if not label:
            return None
        wanted = label.strip().lower()
        return next((area for area in self.areas.values() if area.label.lower() == wanted), None)

    def treated_labels(self) -> list[str]:
        return [self.areas[area].label for area in self.doctor.treats]

    # ---- days open -----------------------------------------------------------------------
    def is_open(self, day: date) -> bool:
        return WEEKDAYS[day.weekday()] not in self.closed_days

    def next_open_day(self, day: date) -> date:
        """`day` itself if the clinic is open then, else the next day it is."""
        while not self.is_open(day):
            day += timedelta(days=1)
        return day

    # ---- urgency -----------------------------------------------------------------------
    def urgency(self) -> dict[str, UrgencyRule]:
        return {"emergency": self.emergency, "see_today": self.see_today}

    # ---- what the agents and the UI are told ---------------------------------------------
    def facts(self) -> dict[str, str]:
        return {"clinic": self.name, "doctor": f"{self.doctor.name} ({self.doctor.speciality})",
                "receptionist": self.receptionist, "fees": self.fees, "timings": self.timings,
                "address": self.address, "closed on": ", ".join(self.closed_days) or "no day"}

    def summary(self) -> dict:
        return {"id": self.id, "name": self.name, "doctor": self.doctor.name,
                "speciality": self.doctor.speciality, "receptionist": self.receptionist, "treats": self.treated_labels(),
                "refers": {area.label: area.see for area in self.areas.values() if not self.treats(area.id)}}


@lru_cache(maxsize=None)
def load_clinic(clinic_id: str) -> ClinicProfile:
    """Reads clinics/<clinic_id>.toml with the shared files, and checks it all.
    The doctor's own changes from the dashboard are laid over this by clinic_settings.py."""
    return build_profile(clinic_id, clinic_data(clinic_id))


def clinic_data(clinic_id: str) -> dict:
    """The shipped clinic file, as read: the starting values before any change by the doctor."""
    path = CLINICS / f"{clinic_id}.toml"
    if clinic_id in SHARED_FILES or not path.is_file():
        raise ValueError(f"No clinic file clinics/{clinic_id}.toml. Available: {available_clinics()}")
    return _read(path)


def build_profile(clinic_id: str, data: dict) -> ClinicProfile:
    """A checked profile from one clinic's values and the shared files."""
    return ClinicProfile(id=clinic_id, emergency=_read(CLINICS / "emergency.toml"), areas=problem_areas(), **data)


def problem_areas() -> dict[str, ProblemArea]:
    return {area_id: ProblemArea(id=area_id, **fields) for area_id, fields in _read(CLINICS / "problem-areas.toml").items()}


def available_clinics() -> list[str]:
    return sorted(path.stem for path in CLINICS.glob("*.toml") if path.stem not in SHARED_FILES)


def _read(path: Path) -> dict:
    return tomllib.loads(path.read_text(encoding="utf-8"))
