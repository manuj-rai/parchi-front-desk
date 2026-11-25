"""Every call, kept: who called (number and name), what was said, what Parchi did, the
recording, and the doctor's review. The doctor reviews every call; the most serious first.

SQLite in PARCHI_DATA_DIR, with recordings as audio files beside it. One connection, one
lock: a clinic's calls are a few hundred a day, so this is simple and enough. Times are
stored in UTC; "today" and "yesterday" are decided in the clinic's own time zone.
"""

import json
import re
import shutil
import sqlite3
import threading
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

Priority = Literal["routine", "attention", "see_today", "emergency"]
PRIORITY_ORDER: list[Priority] = ["routine", "attention", "see_today", "emergency"]

# Call ids: 16 hex characters (64 random bits), so they cannot be guessed.
CALL_ID = re.compile(r"[0-9a-f]{16}")

# A call with no new turn for this long is treated as over, even if nobody pressed "End call".
IDLE_ENDS_CALL = timedelta(minutes=15)

# Audio types accepted for recordings, and the file extension each is stored with.
AUDIO_TYPES = {"audio/mpeg": "mp3", "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mp4": "m4a"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS patients (
    phone      TEXT PRIMARY KEY,           -- +91XXXXXXXXXX: how a patient is identified
    name       TEXT,                       -- the first name heard from this number
    first_call TEXT NOT NULL,
    last_call  TEXT NOT NULL,
    calls      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS calls (
    id            TEXT PRIMARY KEY,
    phone         TEXT,                    -- NULL when the number was withheld
    name          TEXT,                    -- the name heard on this call, else the number's name
    started_at    TEXT NOT NULL,
    last_activity TEXT NOT NULL,
    ended_at      TEXT,
    priority      TEXT NOT NULL DEFAULT 'routine',
    reason        TEXT,                    -- why it has that priority, in a few words
    test          INTEGER NOT NULL DEFAULT 0,  -- made by the test-mode "add test calls" button
    taken_over_by TEXT,                    -- a staff member speaking instead of Parchi, while live
    reviewed_by   TEXT,
    reviewed_at   TEXT,
    review_note   TEXT
);
CREATE INDEX IF NOT EXISTS calls_by_start ON calls(started_at);
CREATE INDEX IF NOT EXISTS calls_by_phone ON calls(phone);
CREATE TABLE IF NOT EXISTS turns (
    call_id     TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    n           INTEGER NOT NULL,          -- 1, 2, ...
    at          TEXT NOT NULL,
    caller_text TEXT NOT NULL,
    reply       TEXT NOT NULL,
    route       TEXT NOT NULL,             -- a call route, or staff / handover while a person is on the line
    reply_by    TEXT,                      -- who answered: NULL for Parchi, else the staff member's name
    safety_tier TEXT NOT NULL,
    safety_sign TEXT,
    actions     TEXT NOT NULL,             -- JSON list
    PRIMARY KEY (call_id, n)
);
CREATE TABLE IF NOT EXISTS clips (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    turn    INTEGER NOT NULL,              -- 0 is the greeting
    seq     INTEGER NOT NULL,              -- order within the turn
    speaker TEXT NOT NULL,                 -- caller | parchi | staff
    mime    TEXT NOT NULL,
    file    TEXT NOT NULL                  -- relative to the recordings folder; never from user input
);
CREATE INDEX IF NOT EXISTS clips_by_call ON clips(call_id, turn, seq);
CREATE TABLE IF NOT EXISTS audit (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    at      TEXT NOT NULL,
    who     TEXT NOT NULL,                 -- the staff role, e.g. doctor
    action  TEXT NOT NULL,                 -- signed in, opened call, reviewed, ...
    call_id TEXT
);
"""

# Columns added after the first release, for databases made before them.
MIGRATIONS = [("calls", "taken_over_by", "TEXT"), ("turns", "reply_by", "TEXT")]


# ---- patients' numbers ---------------------------------------------------------------
_PHONE = re.compile(r"^(?:\+?91|0)?([6-9]\d{9})$")


def normalize_phone(raw: str) -> str:
    """An Indian mobile number in any usual form, as +91XXXXXXXXXX. ValueError if it is not one."""
    digits = re.sub(r"[\s\-().]", "", raw)
    match = _PHONE.match(digits)
    if not match:
        raise ValueError("Use a 10-digit Indian mobile number, like +91 90000 00001.")
    return f"+91{match.group(1)}"


def format_phone(phone: str | None) -> str:
    """+919000000001 as +91 90000 00001, for people to read."""
    if not phone:
        return "Number withheld"
    return f"{phone[:3]} {phone[3:8]} {phone[8:]}"


# ---- priority -------------------------------------------------------------------------
def turn_priority(route: str, safety_tier: str, safety_sign: str | None) -> tuple[Priority, str | None]:
    """How urgently the doctor should see a turn, and why. Safety first, as in the call."""
    if safety_tier == "emergency":
        return "emergency", f"Emergency: {safety_sign}" if safety_sign else "Emergency sign"
    if safety_tier == "see_today" and route != "not_here":       # the doctor's rule covers only what he treats
        return "see_today", f"See today: {safety_sign}" if safety_sign else "See today"
    if route == "medical":
        return "attention", "Question for the doctor"
    if route == "handoff":
        return "attention", "Callback needed"
    if route == "not_here":
        return "routine", "Not treated here: told who to see"
    return "routine", None


def more_serious(a: Priority, b: Priority) -> bool:
    return PRIORITY_ORDER.index(a) > PRIORITY_ORDER.index(b)


# ---- the store -------------------------------------------------------------------------
class CallLog:
    def __init__(self, data_dir: Path, utc_offset_minutes: int = 330):
        self.recordings = data_dir / "recordings"
        self.recordings.mkdir(parents=True, exist_ok=True)
        self.clinic_tz = timezone(timedelta(minutes=utc_offset_minutes))
        self._lock = threading.Lock()
        self._db = sqlite3.connect(data_dir / "calls.sqlite3", check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        with self._lock:
            self._db.execute("PRAGMA journal_mode=WAL")       # survives a crash mid-write
            self._db.execute("PRAGMA foreign_keys=ON")
            self._db.executescript(SCHEMA)
            for table, column, kind in MIGRATIONS:
                columns = {row["name"] for row in self._db.execute(f"PRAGMA table_info({table})")}
                if column not in columns:
                    self._db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {kind}")

    # ---- writing, as the call happens -------------------------------------------------
    def start_call(self, call_id: str, phone: str | None, at: datetime | None = None, test: bool = False) -> dict:
        """Opens a call. Returns who is calling: their number, the name on record, and how often they called."""
        when = _iso(at or _now())
        with self._lock, self._db:
            known = None
            if phone:
                known = self._db.execute("SELECT name, calls FROM patients WHERE phone = ?", (phone,)).fetchone()
                self._db.execute(
                    "INSERT INTO patients (phone, first_call, last_call, calls) VALUES (?, ?, ?, 1) "
                    "ON CONFLICT(phone) DO UPDATE SET last_call = excluded.last_call, calls = calls + 1",
                    (phone, when, when))
            name = known["name"] if known else None
            self._db.execute(
                "INSERT INTO calls (id, phone, name, started_at, last_activity, test) VALUES (?, ?, ?, ?, ?, ?)",
                (call_id, phone, name, when, when, int(test)))
        return {"phone": phone, "phone_display": format_phone(phone), "name": name,
                "known": known is not None, "earlier_calls": known["calls"] if known else 0}

    def exists(self, call_id: str) -> bool:
        with self._lock:
            return self._db.execute("SELECT 1 FROM calls WHERE id = ?", (call_id,)).fetchone() is not None

    def caller(self, call_id: str) -> tuple[str | None, str | None]:
        """The call's number and the name on record for it."""
        with self._lock:
            row = self._db.execute("SELECT phone, name FROM calls WHERE id = ?", (call_id,)).fetchone()
        return (row["phone"], row["name"]) if row else (None, None)

    def record_turn(self, call_id: str, caller_text: str, result: dict, at: datetime | None = None,
                    reply_by: str | None = None) -> int:
        """Stores one turn and raises the call's priority if this turn is more serious. Returns the turn number."""
        when = _iso(at or _now())
        safety = result.get("safety") or {}
        tier, sign = safety.get("tier", "none"), safety.get("sign")
        priority, reason = turn_priority(result["route"], tier, sign)
        heard_name = (result.get("understanding") or {}).get("name")
        with self._lock, self._db:
            call = self._db.execute("SELECT phone, name, priority FROM calls WHERE id = ?", (call_id,)).fetchone()
            n = self._db.execute("SELECT COUNT(*) FROM turns WHERE call_id = ?", (call_id,)).fetchone()[0] + 1
            self._db.execute(
                "INSERT INTO turns (call_id, n, at, caller_text, reply, route, reply_by, safety_tier, safety_sign, actions) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (call_id, n, when, caller_text, result["reply"], result["route"], reply_by, tier, sign,
                 json.dumps(result.get("actions", []), ensure_ascii=False)))
            self._db.execute("UPDATE calls SET last_activity = ? WHERE id = ?", (when, call_id))
            if more_serious(priority, call["priority"]):
                self._db.execute("UPDATE calls SET priority = ?, reason = ? WHERE id = ?", (priority, reason, call_id))
            if heard_name:
                self._db.execute("UPDATE calls SET name = ? WHERE id = ?", (heard_name, call_id))
                if call["phone"]:      # the first name heard from a number becomes that number's name
                    self._db.execute("UPDATE patients SET name = ? WHERE phone = ? AND name IS NULL",
                                     (heard_name, call["phone"]))
        return n

    # ---- a person on the line --------------------------------------------------------------
    def taken_over_by(self, call_id: str) -> str | None:
        with self._lock:
            row = self._db.execute("SELECT taken_over_by FROM calls WHERE id = ?", (call_id,)).fetchone()
        return row["taken_over_by"] if row else None

    def set_takeover(self, call_id: str, who: str | None) -> None:
        """A staff member takes the call (who), or hands it back to Parchi (None)."""
        with self._lock, self._db:
            self._db.execute("UPDATE calls SET taken_over_by = ?, last_activity = ? WHERE id = ?",
                             (who, _iso(_now()), call_id))

    def add_staff_line(self, call_id: str, who: str, text: str) -> int:
        """What a staff member said on the call. Answers the caller's last unanswered line if there
        is one, else is a line of its own. Returns the turn number."""
        with self._lock, self._db:
            last = self._db.execute("SELECT n, reply, route FROM turns WHERE call_id = ? ORDER BY n DESC LIMIT 1",
                                    (call_id,)).fetchone()
            if last and last["route"] == "staff" and not last["reply"]:
                self._db.execute("UPDATE turns SET reply = ?, reply_by = ? WHERE call_id = ? AND n = ?",
                                 (text, who, call_id, last["n"]))
                return last["n"]
        return self.record_turn(call_id, "", {"route": "staff", "reply": text}, reply_by=who)

    def add_clip(self, call_id: str, turn: int, seq: int, speaker: str, mime: str, audio: bytes) -> int | None:
        """Keeps one piece of the recording. Silent clips (offline test mode) are skipped."""
        mime = mime.split(";")[0].strip().lower()
        if not audio or mime not in AUDIO_TYPES:
            return None
        folder = self.recordings / call_id
        folder.mkdir(exist_ok=True)
        name = f"{turn:03d}-{seq:02d}-{speaker}.{AUDIO_TYPES[mime]}"
        (folder / name).write_bytes(audio)
        with self._lock, self._db:
            cursor = self._db.execute(
                "INSERT INTO clips (call_id, turn, seq, speaker, mime, file) VALUES (?, ?, ?, ?, ?, ?)",
                (call_id, turn, seq, speaker, mime, f"{call_id}/{name}"))
        return cursor.lastrowid

    def end_call(self, call_id: str, at: datetime | None = None) -> None:
        with self._lock, self._db:
            self._db.execute("UPDATE calls SET ended_at = ? WHERE id = ? AND ended_at IS NULL",
                             (_iso(at or _now()), call_id))

    # ---- the doctor's review ------------------------------------------------------------
    def review(self, call_id: str, who: str, note: str | None) -> bool:
        with self._lock, self._db:
            changed = self._db.execute(
                "UPDATE calls SET reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?",
                (who, _iso(_now()), note or None, call_id)).rowcount
        return changed == 1

    def audit(self, who: str, action: str, call_id: str | None = None, once_per_minutes: int = 0) -> None:
        """Records who did what. With once_per_minutes, a repeat within that time is not recorded
        again (the dashboard re-reads an open call every few seconds)."""
        now = _now()
        with self._lock, self._db:
            if once_per_minutes:
                since = _iso(now - timedelta(minutes=once_per_minutes))
                if self._db.execute("SELECT 1 FROM audit WHERE who = ? AND action = ? AND call_id IS ? AND at >= ?",
                                    (who, action, call_id, since)).fetchone():
                    return
            self._db.execute("INSERT INTO audit (at, who, action, call_id) VALUES (?, ?, ?, ?)",
                             (_iso(now), who, action, call_id))

    # ---- reading, for the dashboard ------------------------------------------------------
    def today(self, now: datetime | None = None) -> str:
        """Today's date in the clinic, as YYYY-MM-DD."""
        return (now or _now()).astimezone(self.clinic_tz).date().isoformat()

    def list_calls(self, days: int = 14, now: datetime | None = None) -> list[dict]:
        """Calls from the last `days` days in the clinic's time, newest first."""
        now = now or _now()
        start = datetime.combine(now.astimezone(self.clinic_tz).date() - timedelta(days=days - 1),
                                 datetime.min.time(), self.clinic_tz)
        with self._lock:
            rows = self._db.execute(
                "SELECT c.*, p.name AS number_name, p.calls AS number_calls, "
                "(SELECT COUNT(*) FROM turns t WHERE t.call_id = c.id) AS turn_count, "
                "(SELECT t.caller_text FROM turns t WHERE t.call_id = c.id ORDER BY t.n LIMIT 1) AS first_words, "
                "(SELECT GROUP_CONCAT(route, ',') FROM (SELECT route FROM turns t WHERE t.call_id = c.id ORDER BY t.n)) AS routes "
                "FROM calls c LEFT JOIN patients p ON p.phone = c.phone "
                "WHERE c.started_at >= ? ORDER BY c.started_at DESC", (_iso(start),)).fetchall()
        return [self._summary(row, now) for row in rows]

    def get_call(self, call_id: str, now: datetime | None = None) -> dict | None:
        with self._lock:
            row = self._db.execute(
                "SELECT c.*, p.name AS number_name, p.calls AS number_calls, "
                "(SELECT COUNT(*) FROM turns t WHERE t.call_id = c.id) AS turn_count, "
                "(SELECT t.caller_text FROM turns t WHERE t.call_id = c.id ORDER BY t.n LIMIT 1) AS first_words, "
                "(SELECT GROUP_CONCAT(route, ',') FROM (SELECT route FROM turns t WHERE t.call_id = c.id ORDER BY t.n)) AS routes "
                "FROM calls c LEFT JOIN patients p ON p.phone = c.phone WHERE c.id = ?", (call_id,)).fetchone()
            if row is None:
                return None
            turns = self._db.execute("SELECT * FROM turns WHERE call_id = ? ORDER BY n", (call_id,)).fetchall()
            clips = self._db.execute("SELECT id, turn, seq, speaker FROM clips WHERE call_id = ? ORDER BY turn, seq, id",
                                     (call_id,)).fetchall()
            activity = self._db.execute("SELECT at, who, action FROM audit WHERE call_id = ? ORDER BY id",
                                        (call_id,)).fetchall()
        call = self._summary(row, now or _now())
        call["turns"] = [{"n": t["n"], "at": t["at"], "caller_text": t["caller_text"], "reply": t["reply"],
                          "route": t["route"], "reply_by": t["reply_by"], "safety_tier": t["safety_tier"],
                          "safety_sign": t["safety_sign"], "actions": json.loads(t["actions"])} for t in turns]
        call["clips"] = [dict(c) for c in clips]
        call["activity"] = [dict(a) for a in activity]
        return call

    def clip_file(self, clip_id: int) -> tuple[Path, str, str] | None:
        """The stored file for a clip id, its type, and its call. The path comes from the database only."""
        with self._lock:
            row = self._db.execute("SELECT file, mime, call_id FROM clips WHERE id = ?", (clip_id,)).fetchone()
        if row is None:
            return None
        path = (self.recordings / row["file"]).resolve()
        if not path.is_relative_to(self.recordings.resolve()) or not path.is_file():
            return None
        return path, row["mime"], row["call_id"]

    def purge_older_than(self, days: int) -> int:
        """Deletes calls, and their recordings, older than the retention period. Returns how many."""
        cutoff = _iso(_now() - timedelta(days=days))
        with self._lock, self._db:
            old = [r["id"] for r in self._db.execute("SELECT id FROM calls WHERE started_at < ?", (cutoff,))]
            for call_id in old:
                self._db.execute("DELETE FROM clips WHERE call_id = ?", (call_id,))
                self._db.execute("DELETE FROM turns WHERE call_id = ?", (call_id,))
                self._db.execute("DELETE FROM calls WHERE id = ?", (call_id,))
        for call_id in old:
            shutil.rmtree(self.recordings / call_id, ignore_errors=True)
        return len(old)

    def close(self) -> None:
        with self._lock:
            self._db.close()

    # ---- helpers ----------------------------------------------------------------------
    def _summary(self, row: sqlite3.Row, now: datetime) -> dict:
        started = datetime.fromisoformat(row["started_at"])
        last = datetime.fromisoformat(row["last_activity"])
        live = row["ended_at"] is None and now - last < IDLE_ENDS_CALL
        ended = datetime.fromisoformat(row["ended_at"]) if row["ended_at"] else min(last, now)
        name, number_name = row["name"], row["number_name"]
        return {
            "id": row["id"],
            "phone": row["phone"],
            "phone_display": format_phone(row["phone"]),
            "name": name,
            # The number is known under another name (a family phone, say): show both.
            "number_name": number_name if number_name and number_name != name else None,
            "number_calls": row["number_calls"] or 0,
            "started_at": row["started_at"],
            "day": started.astimezone(self.clinic_tz).date().isoformat(),
            "time": started.astimezone(self.clinic_tz).strftime("%H:%M"),
            "duration_s": max(0, round((ended - started).total_seconds())),
            "live": live,
            "taken_over_by": row["taken_over_by"] if live else None,
            "priority": row["priority"],
            "reason": row["reason"],
            "routes": row["routes"].split(",") if row["routes"] else [],
            "turn_count": row["turn_count"],
            "first_words": row["first_words"],
            "test": bool(row["test"]),
            "reviewed": row["reviewed_at"] is not None,
            "reviewed_by": row["reviewed_by"],
            "reviewed_at": row["reviewed_at"],
            "review_note": row["review_note"],
        }


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat(timespec="seconds")
