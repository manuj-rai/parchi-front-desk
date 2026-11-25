"""Appointments: the book on disk, the board's queue, and what the agent does with a caller's bookings.

    cd working-slice
    python -m unittest tests.test_appointments -v

Every test runs on a fixed day, so the result does not depend on the weekday (the demo clinics
close on Sunday or Thursday).
"""

import tempfile
import unittest
import uuid
from datetime import date, timedelta
from pathlib import Path

from parchi.appointments import AppointmentBook
from parchi.call_graph import build_call_graph
from parchi.clinic_profile import load_clinic
from parchi.clinic_state import ClinicState
from tests.test_call_graph import FakeAgents, understood

WEDNESDAY = date(2026, 11, 25)
SATURDAY = date(2026, 11, 28)
SUNDAY = date(2026, 11, 29)                    # the general physician is closed
PHONE = "+919000000001"


class Clock:
    """A day the test can move forward."""

    def __init__(self, day: date):
        self.day = day

    def __call__(self) -> date:
        return self.day


def clinic_on(day: date = WEDNESDAY, clinic_id: str = "general-physician", **fields) -> ClinicState:
    clock = Clock(day)
    clinic = ClinicState(profile=load_clinic(clinic_id), appointments=AppointmentBook(clock=clock), **fields)
    clinic.clock = clock                       # so a test can move to the next day
    return clinic


def say_from(clinic: ClinicState, phone: str | None, understanding, text: str = "(caller)", safety_tier="none") -> dict:
    """One sentence on a fresh call from `phone`, with the agents reading it as `understanding`."""
    graph = build_call_graph(clinic, **_agents(FakeAgents(understanding, safety_tier)))
    return graph.invoke({"text": text, "history": [f"Caller: {text}"], "phone": phone, "call_id": "c1"},
                        config={"configurable": {"thread_id": uuid.uuid4().hex}})


def _agents(fakes: FakeAgents) -> dict:
    return {"front_desk": fakes.front_desk, "safety": fakes.safety}


# ---- the book itself -------------------------------------------------------------------------
class Book(unittest.TestCase):
    def test_tokens_are_numbered_from_one_each_day_and_each_clinic(self):
        book = AppointmentBook(clock=lambda: WEDNESDAY)
        self.assertEqual([book.add("dental", WEDNESDAY, n, "walk-in").number for n in "ab"], [1, 2])
        self.assertEqual(book.add("dental", WEDNESDAY + timedelta(days=1), "c", "phone").number, 1)
        self.assertEqual(book.add("ent", WEDNESDAY, "d", "walk-in").number, 1)

    def test_a_restart_loses_nothing(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "appointments.sqlite"
            first = AppointmentBook(path, clock=lambda: WEDNESDAY)
            first.add("dental", WEDNESDAY, "Ramesh", "phone", phone=PHONE, call_id="c9")
            first.save_board("dental", WEDNESDAY, "in", "10:15")
            first._db.close()
            again = AppointmentBook(path, clock=lambda: WEDNESDAY)
            (token,) = again.for_phone("dental", PHONE, WEDNESDAY)
            self.assertEqual((token.name, token.call_id, token.status), ("Ramesh", "c9", "waiting"))
            self.assertEqual(again.board("dental", WEDNESDAY), ("in", "10:15"))
            again._db.close()

    def test_old_bookings_are_deleted_with_the_call_log(self):
        book = AppointmentBook(clock=lambda: WEDNESDAY)
        book.add("dental", WEDNESDAY - timedelta(days=100), "old", "phone", phone=PHONE)
        book.add("dental", WEDNESDAY, "new", "phone", phone=PHONE)
        self.assertEqual(book.purge_older_than(90), 1)
        self.assertEqual([t.name for t in book.for_phone("dental", PHONE, WEDNESDAY - timedelta(days=200))], ["new"])


# ---- the board's queue ------------------------------------------------------------------------------
class Queue(unittest.TestCase):
    def test_next_patient_takes_see_first_patients_first_and_skips_cancelled_ones(self):
        clinic = clinic_on()
        one, two = clinic.walk_in(), clinic.walk_in()
        urgent = clinic.book("Asha", see_first=True)
        clinic.cancel(one, by="test")
        self.assertEqual(clinic.next_patient().number, urgent.number)
        self.assertEqual(clinic.now_serving, urgent.number)
        self.assertEqual(clinic.next_patient().number, two.number)
        self.assertEqual([t.status for t in clinic.tokens], ["cancelled", "seeing", "seen"])
        self.assertIsNone(clinic.next_patient())                       # nobody left; the last one is seen
        self.assertEqual(clinic.waiting(), 0)

    def test_how_many_are_ahead_counts_who_actually_goes_first(self):
        clinic = clinic_on()
        first, second = clinic.walk_in(), clinic.walk_in()
        late_but_urgent = clinic.book("Asha", see_first=True)
        mine = clinic.book("Ramesh", phone=PHONE)
        clinic.cancel(second, by="test")
        clinic.next_patient()                                           # the urgent one goes in first
        self.assertEqual(clinic.ahead_of(mine), 2)                      # the urgent one (in now) and the first walk-in
        self.assertEqual(clinic.ahead_of(first), 1)
        self.assertEqual(clinic.ahead_of(late_but_urgent), 0)

    def test_each_day_starts_fresh(self):
        clinic = clinic_on()
        clinic.walk_in()
        clinic.set_doctor("left")
        clinic.clock.day = WEDNESDAY + timedelta(days=1)
        self.assertEqual(clinic.tokens, [])
        self.assertEqual((clinic.doctor, clinic.eta), ("expected", clinic.profile.posted_start))
        self.assertIn("aaye nahin", clinic.status_line())

    def test_the_board_survives_a_restart(self):
        book = AppointmentBook(clock=lambda: WEDNESDAY)
        ClinicState(profile=load_clinic("dental"), appointments=book).set_doctor("expected", "12:15")
        self.assertEqual(ClinicState(profile=load_clinic("dental"), appointments=book).eta, "12:15")


class ClosedDays(unittest.TestCase):
    def test_on_a_closed_day_callers_hear_when_it_opens_and_bookings_go_there(self):
        clinic = clinic_on(SUNDAY)
        self.assertIn("band", clinic.status_line())
        self.assertIn("kal 10:00", clinic.status_line())               # Monday is tomorrow
        self.assertEqual(clinic.booking_day(), SUNDAY + timedelta(days=1))

    def test_on_saturday_evening_the_next_day_is_named(self):
        clinic = clinic_on(SATURDAY)
        clinic.set_doctor("left")
        self.assertIn("somvaar ko 10:00", clinic.status_line())        # Sunday is closed: "on Monday"
        result = say_from(clinic, PHONE, understood("book"))
        self.assertIn("somvaar ke liye", result["reply"])

    def test_a_board_set_on_a_closed_day_means_the_clinic_opened(self):
        clinic = clinic_on(SUNDAY)
        clinic.set_doctor("expected", "11:00")
        self.assertIn("11:00", clinic.status_line())
        self.assertEqual(clinic.booking_day(), SUNDAY)

    def test_tomorrow_skips_a_closed_day(self):
        self.assertEqual(clinic_on(SATURDAY).booking_day("tomorrow"), SUNDAY + timedelta(days=1))

    def test_after_the_doctor_leaves_bookings_are_for_the_next_open_day(self):
        clinic = clinic_on()
        clinic.set_doctor("left")
        self.assertEqual(clinic.booking_day(), WEDNESDAY + timedelta(days=1))
        self.assertIn("kal", clinic.status_line())


# ---- the agent with a caller's bookings ----------------------------------------------------------------
class CallersOwnBookings(unittest.TestCase):
    def test_the_agent_is_told_this_callers_bookings(self):
        clinic = clinic_on()
        clinic.book("Ramesh", phone=PHONE)
        self.assertEqual(clinic.facts(PHONE)["this caller's bookings"], "token 1 today for Ramesh (waiting)")
        self.assertEqual(clinic.facts("+919999999999")["this caller's bookings"], "none from this number")
        self.assertIn("withheld", clinic.facts(None)["this caller's bookings"])

    def test_my_token_is_read_from_the_book(self):
        clinic = clinic_on(eta="11:30")
        clinic.walk_in()
        say_from(clinic, PHONE, understood("book", name="Ramesh"))
        result = say_from(clinic, PHONE, understood("my_booking"), "mera number kya hai?")
        self.assertEqual(result["route"], "my_booking")
        self.assertIn("Aapka number 2 hai", result["reply"])
        self.assertIn("11:30", result["reply"])

    def test_once_the_doctor_is_in_the_caller_hears_how_many_are_ahead(self):
        clinic = clinic_on()
        clinic.walk_in()
        clinic.walk_in()
        say_from(clinic, PHONE, understood("book"))
        clinic.set_doctor("in")
        clinic.next_patient()
        self.assertIn("aapse pehle 2 log", say_from(clinic, PHONE, understood("my_booking"))["reply"])

    def test_no_booking_from_this_number(self):
        result = say_from(clinic_on(), PHONE, understood("my_booking"))
        self.assertIn("koi number nahin laga", result["reply"])

    def test_a_withheld_number_goes_to_the_receptionist(self):
        for intent in ("my_booking", "cancel"):
            clinic = clinic_on()
            self.assertEqual(say_from(clinic, None, understood(intent))["route"], intent)
            self.assertEqual(clinic.alerts[0]["kind"], "call back")

    def test_the_same_person_asking_again_gets_the_same_token(self):
        clinic = clinic_on()
        say_from(clinic, PHONE, understood("book", name="Ramesh"))
        again = say_from(clinic, PHONE, understood("book", name="ramesh"))
        self.assertIn("pehle se laga", again["reply"])
        self.assertEqual(len(clinic.tokens), 1)

    def test_someone_else_in_the_family_gets_their_own_token(self):
        clinic = clinic_on()
        say_from(clinic, PHONE, understood("book", name="Ramesh"))
        say_from(clinic, PHONE, understood("book", name="Sita"))
        self.assertEqual([t.name for t in clinic.tokens], ["Ramesh", "Sita"])

    def test_a_booking_for_tomorrow_is_for_tomorrow(self):
        clinic = clinic_on()
        result = say_from(clinic, PHONE, understood("book", day="tomorrow"), "kal subah ka number laga do")
        self.assertIn("kal ke liye", result["reply"])
        self.assertIn("kal 10:00 baje", result["reply"])
        self.assertEqual(clinic.tokens, [])                                    # not on today's board
        self.assertEqual(clinic.snapshot()["later"][0]["day"], (WEDNESDAY + timedelta(days=1)).isoformat())

    def test_cancel_frees_the_token_and_tells_the_board(self):
        clinic = clinic_on()
        say_from(clinic, PHONE, understood("book", name="Ramesh"))
        result = say_from(clinic, PHONE, understood("cancel"), "aaj nahin aa paunga, cancel kar dijiye")
        self.assertIn("aaj ka aapka number 1 cancel", result["reply"])
        self.assertEqual(clinic.tokens[0].status, "cancelled")
        self.assertEqual(clinic.alerts[0]["kind"], "cancelled")
        self.assertIn("koi number nahin laga", say_from(clinic, PHONE, understood("my_booking"))["reply"])

    def test_with_two_family_tokens_cancel_needs_a_name_or_a_person(self):
        clinic = clinic_on()
        say_from(clinic, PHONE, understood("book", name="Ramesh"))
        say_from(clinic, PHONE, understood("book", name="Sita"))
        self.assertEqual(say_from(clinic, PHONE, understood("cancel"))["route"], "cancel")
        self.assertEqual([t.status for t in clinic.tokens], ["waiting", "waiting"])   # nothing cancelled: a person asks
        say_from(clinic, PHONE, understood("cancel", name="Sita"))
        self.assertEqual([t.status for t in clinic.tokens], ["waiting", "cancelled"])

    def test_nothing_to_cancel(self):
        self.assertIn("kuch nahin hai", say_from(clinic_on(), PHONE, understood("cancel"))["reply"])

    def test_a_see_today_call_marks_the_existing_token_instead_of_adding_one(self):
        clinic = clinic_on()
        say_from(clinic, PHONE, understood("book"))
        result = say_from(clinic, PHONE, understood("medical"), "bachche ko tez bukhar hai", safety_tier="see_today")
        self.assertEqual(result["route"], "urgent")
        self.assertEqual(len(clinic.tokens), 1)
        self.assertTrue(clinic.tokens[0].see_first)
        self.assertIn("token 1 marked: see first", result["actions"])

    def test_every_number_a_caller_hears_comes_from_the_book(self):
        clinic = clinic_on()
        u = understood("book")
        u.reply = "Aapka number 99 hai."                                   # a model that invents a token
        result = say_from(clinic, PHONE, u)
        self.assertNotIn("99", result["reply"])
        self.assertIn("Aapka number 1 hai", result["reply"])


if __name__ == "__main__":
    unittest.main()
