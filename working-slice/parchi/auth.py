"""Staff sign-in for the dashboard: the doctor and the receptionist.

- Passwords are stored only as PBKDF2-SHA256 hashes (600,000 iterations), in settings.
- A sign-in gets a random session token in an HttpOnly, SameSite=Strict cookie. The server
  keeps only a hash of it, so signing out ends the session at once. Sessions live in memory:
  restarting the server signs everyone out. (Several server processes would need a shared store.)
- After 5 wrong passwords from one address in 10 minutes, that address waits.

    python -m parchi.auth hash        asks for a password and prints the hash to put in .env
"""

import base64
import getpass
import hashlib
import hmac
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Literal

Role = Literal["doctor", "reception"]
ROLES: tuple[Role, ...] = ("doctor", "reception")
COOKIE = "parchi_staff"
ITERATIONS = 600_000
TEST_PASSWORDS: dict[Role, str] = {"doctor": "doctor-test", "reception": "reception-test"}


# ---- passwords ---------------------------------------------------------------------------
def hash_password(password: str, iterations: int = ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, digest = stored.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), _unb64(salt), int(iterations))
        return hmac.compare_digest(candidate, _unb64(digest))
    except (ValueError, TypeError):
        return False


# ---- sessions ------------------------------------------------------------------------------
@dataclass(frozen=True)
class Staff:
    role: Role
    name: str


class Sessions:
    def __init__(self, hours: float):
        self.lifetime = hours * 3600
        self._lock = threading.Lock()
        self._live: dict[str, tuple[Staff, float]] = {}       # hash of token -> (who, expires at)

    def issue(self, staff: Staff) -> str:
        token = secrets.token_urlsafe(32)
        with self._lock:
            self._forget_expired()
            self._live[_digest(token)] = (staff, time.time() + self.lifetime)
        return token

    def read(self, token: str | None) -> Staff | None:
        if not token or len(token) > 100:
            return None
        with self._lock:
            entry = self._live.get(_digest(token))
            if entry is None or entry[1] < time.time():
                return None
            return entry[0]

    def end(self, token: str | None) -> None:
        if token:
            with self._lock:
                self._live.pop(_digest(token), None)

    def _forget_expired(self) -> None:
        now = time.time()
        for key in [k for k, (_, expires) in self._live.items() if expires < now]:
            del self._live[key]


# ---- the brake on guessing -------------------------------------------------------------------
class Throttle:
    def __init__(self, attempts: int = 5, window_s: float = 600):
        self.attempts, self.window_s = attempts, window_s
        self._lock = threading.Lock()
        self._failures: dict[str, list[float]] = {}

    def wait_s(self, address: str) -> int:
        """Seconds this address must wait before trying again; 0 if it may try now."""
        with self._lock:
            recent = self._recent(address)
            if len(recent) < self.attempts:
                return 0
            return max(1, round(recent[0] + self.window_s - time.time()))

    def failed(self, address: str) -> None:
        with self._lock:
            self._failures[address] = [*self._recent(address), time.time()]

    def succeeded(self, address: str) -> None:
        with self._lock:
            self._failures.pop(address, None)

    def _recent(self, address: str) -> list[float]:
        cutoff = time.time() - self.window_s
        return [t for t in self._failures.get(address, []) if t > cutoff]


# ---- who may sign in ---------------------------------------------------------------------------
class Accounts:
    """Checks a role's password against its hash in settings, or the test password in test mode."""

    def __init__(self, hashes: dict[Role, str | None], names: dict[Role, str], test_logins: bool):
        self.hashes, self.names, self.test_logins = hashes, names, test_logins

    def roles(self) -> list[Role]:
        return [role for role in ROLES if self.hashes.get(role) or self.test_logins]

    def check(self, role: Role, password: str) -> Staff | None:
        stored = self.hashes.get(role)
        if stored:
            ok = verify_password(password, stored)
        elif self.test_logins:
            ok = hmac.compare_digest(password.encode(), TEST_PASSWORDS[role].encode())
        else:
            ok = False
        return Staff(role, self.names[role]) if ok else None


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text.encode("ascii"), validate=True)


if __name__ == "__main__":
    import sys

    if sys.argv[1:] != ["hash"]:
        raise SystemExit("usage: python -m parchi.auth hash")
    first = getpass.getpass("New staff password (12 characters or more): ")
    if len(first) < 12:
        raise SystemExit("Too short: use 12 characters or more.")
    if getpass.getpass("Again: ") != first:
        raise SystemExit("The two passwords differ.")
    print("Put this in working-slice/.env, as PARCHI_DOCTOR_PASSWORD_HASH or PARCHI_RECEPTION_PASSWORD_HASH:")
    print(hash_password(first))
