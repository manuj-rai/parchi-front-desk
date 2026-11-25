"""The clinic's live state: the doctor's status, the token queue, and alerts for staff.

This is the receptionist's token board (the "calendar"). In the product it is a page on her
phone; here it is the right-hand panel of the demo. It belongs to one clinic (its profile).

Tokens are appointments in the appointment book (appointments.py): kept on disk, by day,
with a status, and with the caller's number for phone bookings. So a restart loses nothing,
each day starts fresh, and a caller can ask about or cancel their own token. Every sentence
here comes from prompts/replies.toml, and every number in it from the book, never a model.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from .appointments import Appointment, AppointmentBook
from .clinic_profile import ClinicProfile, load_clinic
from .prompt_loader import day_words, say
from .settings import get_settings

Token = Appointment       # a token on the board is an appointment


def _default_profile() -> ClinicProfile:
    return load_clinic(get_settings().clinic)


@dataclass
class ClinicState:
    profile: ClinicProfile = field(default_factory=_default_profile)
    appointments: AppointmentBook = field(default_factory=AppointmentBook)   # in memory unless given a file
    doctor: str = "expected"  # "expected", "in" or "left"
    eta: str = ""             # the doctor's expected time; until the receptionist sets one, the posted time
    alerts: list[dict] = field(default_factory=list)
    _day: date | None = field(default=None, init=False, repr=False)
    _set_today: bool = field(default=False, init=False, repr=False)   # the receptionist set the board today

    def __post_init__(self) -> None:
        self._day = self.today()
        saved = self.appointments.board(self.profile.id, self._day)
        self._set_today = saved is not None or bool(self.eta)
        if saved:
            self.doctor, self.eta = saved
        self.eta = self.eta or self.profile.posted_start

    def today(self) -> date:
        return self.appointments.today()

    # ---- the day --------------------------------------------------------------------------
    def _roll_over(self) -> None:
        """At midnight the board starts fresh: the doctor expected at the posted time."""
        today = self.today()
        if today != self._day:
            self._day = today
            saved = self.appointments.board(self.profile.id, today)
            self._set_today = saved is not None
            self.doctor, self.eta = saved or ("expected", self.profile.posted_start)

    def open_today(self) -> bool:
        """Open by the clinic's days, or because the receptionist set the board today."""
        self._roll_over()
        return self._set_today or self.profile.is_open(self._day)

    def next_open_day(self) -> date:
        return self.profile.next_open_day(self.today() + timedelta(days=1))

    # ---- what the receptionist taps ---------------------------------------------------------
    def set_doctor(self, status: str, eta: str | None = None) -> None:
        self._roll_over()
        self.doctor = status
        if eta:
            self.eta = eta
        self._set_today = True
        self.appointments.save_board(self.profile.id, self._day, self.doctor, self.eta)

    def walk_in(self) -> Appointment:
        return self.appointments.add(self.profile.id, self.today(), "Walk-in", "walk-in")

    def next_patient(self) -> Appointment | None:
        """The patient with the doctor is done; the next goes in: see-first patients first, then by number."""
        tokens = self.tokens
        for token in tokens:
            if token.status == "seeing":
                self.appointments.set_status(token.id, "seen")
        waiting = [t for t in tokens if t.status == "waiting"]
        if not waiting:
            return None
        chosen = min(waiting, key=lambda t: (not t.see_first, t.number))
        self.appointments.set_status(chosen.id, "seeing")
        return chosen

    def cancel_number(self, number: int, by: str) -> Appointment | None:
        """The receptionist cancels today's token `number` from the board."""
        found = next((t for t in self.tokens if t.number == number and t.active), None)
        if found:
            self.cancel(found, by)
        return found

    # ---- the queue today --------------------------------------------------------------------
    @property
    def tokens(self) -> list[Appointment]:
        """Today's tokens, every status, by number."""
        self._roll_over()
        return self.appointments.on_day(self.profile.id, self._day)

    @property
    def now_serving(self) -> int:
        return next((t.number for t in self.tokens if t.status == "seeing"), 0)

    def waiting(self) -> int:
        return sum(t.status == "waiting" for t in self.tokens)

    def ahead_of(self, appointment: Appointment) -> int:
        """How many patients go in before this one today: who is in now, see-first ones, then by number."""
        def order(t: Appointment) -> tuple:
            return (t.status != "seeing", not t.see_first, t.number)
        return sum(order(t) < order(appointment) for t in self.tokens if t.active and t.id != appointment.id)

    # ---- what the agents use ------------------------------------------------------------------
    def booking_day(self, wanted: str = "today") -> date:
        """The day a new phone booking is for: today, unless the caller asks for tomorrow, the doctor
        has left for the day, or the clinic is closed today. Never a day the clinic is closed."""
        today = self.today()
        if wanted == "tomorrow" or self.doctor == "left" or not self.open_today():
            return self.next_open_day()
        return today

    def book(self, name: str | None, no_contact: bool = False, see_first: bool = False, phone: str | None = None,
             day: date | None = None, call_id: str | None = None) -> Appointment:
        return self.appointments.add(self.profile.id, day or self.today(), name or "Phone caller", "phone",
                                     phone=phone, no_contact=no_contact, see_first=see_first, call_id=call_id)

    def bookings_for(self, phone: str | None) -> list[Appointment]:
        """This caller's bookings from today on, every status, soonest first. None if the number is withheld."""
        return self.appointments.for_phone(self.profile.id, phone, self.today()) if phone else []

    def existing_booking(self, phone: str | None, name: str | None, day: date) -> Appointment | None:
        """An active booking from this number on that day for the same person (or one booked without a name).
        A different name is someone else in the family, who gets their own token."""
        for booking in self.bookings_for(phone):
            same_person = (not name or booking.name.lower() == name.lower()
                           or (booking.source == "phone" and booking.name == "Phone caller"))
            if booking.active and booking.day == day.isoformat() and same_person:
                return booking
        return None

    def cancel(self, appointment: Appointment, by: str) -> None:
        self.appointments.set_status(appointment.id, "cancelled")
        self.alert("cancelled", f"Token {appointment.number} for {appointment.name} ({appointment.day}) cancelled by {by}")

    def alert(self, kind: str, text: str) -> None:
        self.alerts.insert(0, {"at": datetime.now(self.appointments.clinic_tz).strftime("%H:%M:%S"),
                               "kind": kind, "text": text})

    # ---- what callers hear --------------------------------------------------------------------
    def status_line(self) -> str:
        """The truthful status sentence. Built from the data, never written by a model."""
        self._roll_over()
        if self.doctor == "in":
            return say("status_in", now_serving=self.now_serving, waiting=self.waiting())
        if self.doctor == "left":
            return say("status_left", posted_start=self.profile.posted_start, **self._words(self.next_open_day()))
        if not self.open_today():
            return say("status_closed", posted_start=self.profile.posted_start, **self._words(self.next_open_day()))
        return say("status_expected", eta=self.eta)

    def token_line(self, appointment: Appointment) -> str:
        """"Your number is 3." or, for a later day, "Your number is 3, for tomorrow."."""
        if appointment.day == self.today().isoformat():
            return say("token_number", number=appointment.number)
        return say("token_number_on", number=appointment.number, **self._words(date.fromisoformat(appointment.day)))

    def when_to_come(self, appointment: Appointment) -> str:
        day = date.fromisoformat(appointment.day)
        if day != self.today() or self.doctor == "left":
            later = day if day != self.today() else self.next_open_day()
            return say("come_on_day", posted_start=self.profile.posted_start, **self._words(later))
        if self.doctor == "in":
            return say("come_now", ahead=self.ahead_of(appointment))
        return say("come_later", eta=self.eta)

    def describe_booking(self, appointment: Appointment) -> str:
        """What a caller hears about one of their own bookings."""
        if appointment.status == "seeing":
            return say("booking_seeing", number=appointment.number)
        if appointment.status == "seen":
            return say("booking_seen", number=appointment.number)
        return f"{self.token_line(appointment)} {self.when_to_come(appointment)}"

    # ---- what the agent and the board are told ----------------------------------------------------
    def facts(self, phone: str | None = None) -> dict:
        """What the front-desk agent is told about the clinic, and about this caller's bookings."""
        return {**self.profile.facts(), "doctor_status": self.status_line(),
                "tokens booked today": sum(t.active for t in self.tokens),
                "this caller's bookings": self._bookings_fact(phone)}

    def snapshot(self) -> dict:
        today = self.today()
        return {"clinic": self.profile.id, "day": today.isoformat(), "open_today": self.open_today(),
                "doctor": self.doctor, "eta": self.eta, "now_serving": self.now_serving,
                "status_line": self.status_line(), "tokens": [t.public() for t in self.tokens],
                "later": [t.public() for t in self.appointments.after(self.profile.id, today) if t.active],
                "alerts": self.alerts[:12]}

    def _bookings_fact(self, phone: str | None) -> str:
        if not phone:
            return "the caller's number is withheld, so their bookings cannot be looked up"
        bookings = self.bookings_for(phone)
        if not bookings:
            return "none from this number"
        today = self.today().isoformat()
        return "; ".join(f"token {b.number} {'today' if b.day == today else 'on ' + b.day} for {b.name} ({b.status})"
                         for b in bookings)

    def _words(self, day: date) -> dict[str, str]:
        return day_words(day, self.today())
