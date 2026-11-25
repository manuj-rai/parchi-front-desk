"""The clinic's appointments: every token, by day, kept on disk.

A token is a place in the doctor's queue on one day. Each has a status:

    waiting    booked, not yet seen
    seeing     with the doctor now
    seen       done
    cancelled  by the caller (on a call) or by the receptionist (on the board)

Tokens are numbered from 1 each day, per clinic. A phone booking keeps the caller's number,
which is how Parchi finds "my token" when they call again. The doctor's status on the board
(in, expected at a time, left) is kept per day too, so a restart loses nothing and each new
day starts fresh.

    book = AppointmentBook(data_dir / "appointments.sqlite")    # None: in memory (tests)
    token = book.add("dental", day, "Ramesh", "phone", phone="+919000000001")
    book.on_day("dental", day)                                   # the day's queue, in order
    book.for_phone("dental", "+919000000001", from_day=day)      # this caller's bookings
"""

import sqlite3
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

Status = Literal["waiting", "seeing", "seen", "cancelled"]
ACTIVE: tuple[Status, ...] = ("waiting", "seeing")

SCHEMA = """
CREATE TABLE IF NOT EXISTS appointments (
    id          INTEGER PRIMARY KEY,
    clinic      TEXT NOT NULL,
    day         TEXT NOT NULL,                 -- YYYY-MM-DD, the clinic's own date
    number      INTEGER NOT NULL,              -- the token number, from 1 each day
    name        TEXT NOT NULL,
    source      TEXT NOT NULL,                 -- 'phone' or 'walk-in'
    phone       TEXT,                          -- +91XXXXXXXXXX for phone bookings
    no_contact  INTEGER NOT NULL DEFAULT 0,    -- the caller asked not to be messaged or called
    see_first   INTEGER NOT NULL DEFAULT 0,    -- the doctor's see-today rule: take early
    status      TEXT NOT NULL DEFAULT 'waiting',
    call_id     TEXT,                          -- the call that booked it, if any
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE (clinic, day, number)
);
CREATE INDEX IF NOT EXISTS appointments_by_phone ON appointments (clinic, phone, day);
CREATE TABLE IF NOT EXISTS board (
    clinic  TEXT NOT NULL,
    day     TEXT NOT NULL,
    doctor  TEXT NOT NULL,                     -- 'expected', 'in' or 'left'
    eta     TEXT NOT NULL,                     -- HH:MM
    PRIMARY KEY (clinic, day)
);
"""


@dataclass(frozen=True)
class Appointment:
    id: int
    clinic: str
    day: str
    number: int
    name: str
    source: str
    phone: str | None
    no_contact: bool
    see_first: bool
    status: Status
    call_id: str | None

    @property
    def active(self) -> bool:
        return self.status in ACTIVE

    def public(self) -> dict:
        """For the board and the API: no clinic id, no call id."""
        return {"id": self.id, "day": self.day, "number": self.number, "name": self.name, "source": self.source,
                "phone": self.phone, "no_contact": self.no_contact, "see_first": self.see_first,
                "status": self.status}


class AppointmentBook:
    def __init__(self, path: Path | None = None, utc_offset_minutes: int = 330,
                 clock: Callable[[], date] | None = None):
        """`clock` gives "today" in tests, so they pass whatever the weekday."""
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(str(path) if path else ":memory:", check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(SCHEMA)
        self._lock = threading.Lock()
        self.clinic_tz = timezone(timedelta(minutes=utc_offset_minutes))
        self._clock = clock

    def today(self) -> date:
        return self._clock() if self._clock else datetime.now(self.clinic_tz).date()

    # ---- reading ------------------------------------------------------------------------
    def on_day(self, clinic: str, day: date) -> list[Appointment]:
        return self._select("clinic = ? AND day = ? ORDER BY number", (clinic, day.isoformat()))

    def after(self, clinic: str, day: date) -> list[Appointment]:
        """Bookings on later days, soonest first."""
        return self._select("clinic = ? AND day > ? ORDER BY day, number", (clinic, day.isoformat()))

    def for_phone(self, clinic: str, phone: str, from_day: date) -> list[Appointment]:
        """This caller's bookings from `from_day` on, soonest first (every status)."""
        return self._select("clinic = ? AND phone = ? AND day >= ? ORDER BY day, number",
                            (clinic, phone, from_day.isoformat()))

    def get(self, appointment_id: int) -> Appointment | None:
        found = self._select("id = ?", (appointment_id,))
        return found[0] if found else None

    # ---- changing -----------------------------------------------------------------------
    def add(self, clinic: str, day: date, name: str, source: str, *, phone: str | None = None,
            no_contact: bool = False, see_first: bool = False, call_id: str | None = None) -> Appointment:
        now = _now()
        with self._lock, self._db:
            number = self._db.execute("SELECT COALESCE(MAX(number), 0) + 1 FROM appointments WHERE clinic = ? AND day = ?",
                                      (clinic, day.isoformat())).fetchone()[0]
            cursor = self._db.execute(
                "INSERT INTO appointments (clinic, day, number, name, source, phone, no_contact, see_first, call_id,"
                " created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (clinic, day.isoformat(), number, name, source, phone, int(no_contact), int(see_first), call_id, now, now))
            new_id = cursor.lastrowid
        return self.get(new_id)

    def set_status(self, appointment_id: int, status: Status) -> None:
        with self._lock, self._db:
            self._db.execute("UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?",
                             (status, _now(), appointment_id))

    def set_see_first(self, appointment_id: int) -> None:
        with self._lock, self._db:
            self._db.execute("UPDATE appointments SET see_first = 1, updated_at = ? WHERE id = ?",
                             (_now(), appointment_id))

    def clear(self, clinic: str) -> None:
        """Demo and tests only: every appointment and board of one clinic."""
        with self._lock, self._db:
            self._db.execute("DELETE FROM appointments WHERE clinic = ?", (clinic,))
            self._db.execute("DELETE FROM board WHERE clinic = ?", (clinic,))

    def purge_older_than(self, days: int) -> int:
        """Names and numbers are personal data: kept as long as the call log, no longer."""
        cutoff = (self.today() - timedelta(days=days)).isoformat()
        with self._lock, self._db:
            removed = self._db.execute("DELETE FROM appointments WHERE day < ?", (cutoff,)).rowcount
            self._db.execute("DELETE FROM board WHERE day < ?", (cutoff,))
        return removed

    # ---- the doctor's status, per day ----------------------------------------------------
    def board(self, clinic: str, day: date) -> tuple[str, str] | None:
        """(doctor, eta) as last set on that day, or None if nothing was set."""
        row = self._db.execute("SELECT doctor, eta FROM board WHERE clinic = ? AND day = ?",
                               (clinic, day.isoformat())).fetchone()
        return (row["doctor"], row["eta"]) if row else None

    def save_board(self, clinic: str, day: date, doctor: str, eta: str) -> None:
        with self._lock, self._db:
            self._db.execute("INSERT INTO board (clinic, day, doctor, eta) VALUES (?, ?, ?, ?) "
                             "ON CONFLICT (clinic, day) DO UPDATE SET doctor = excluded.doctor, eta = excluded.eta",
                             (clinic, day.isoformat(), doctor, eta))

    def _select(self, where: str, values: tuple) -> list[Appointment]:
        with self._lock:
            rows = self._db.execute(f"SELECT * FROM appointments WHERE {where}", values).fetchall()
        return [Appointment(id=r["id"], clinic=r["clinic"], day=r["day"], number=r["number"], name=r["name"],
                            source=r["source"], phone=r["phone"], no_contact=bool(r["no_contact"]),
                            see_first=bool(r["see_first"]), status=r["status"], call_id=r["call_id"]) for r in rows]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
