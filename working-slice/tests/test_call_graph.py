"""Tests for the call graph, with stand-in agents. No internet and no API key needed.

    cd working-slice
    python -m unittest -v
"""

import unittest
import uuid
from datetime import date, timedelta

from parchi.appointments import AppointmentBook
from parchi.agents import Safety, Understanding
from parchi.clinic_state import ClinicState
from parchi.call_graph import build_call_graph
from parchi.llm_router import AllModelsFailed
from parchi.model_routes import Served


def understood(intent="status", confidence=0.95, name=None, no_messages=False, reply="(agent reply)", area=None,
               day="today"):
    return Understanding(thinking="(test)", concern=area, problem_area=area, intent=intent, booking_day=day,
                         language="hindi", name=name, wants_no_messages=no_messages, confidence=confidence, reply=reply)


# A fixed Wednesday, so the tests give the same answer on any day (the clinics close on Sunday or Thursday).
WEDNESDAY = date(2026, 11, 25)


def clinic_state(profile=None, clock=lambda: WEDNESDAY, **fields) -> ClinicState:
    """A clinic with its own in-memory appointment book, on a fixed day."""
    if profile is not None:
        fields["profile"] = profile
    return ClinicState(appointments=AppointmentBook(clock=clock), **fields)


class FakeAgents:
    """Plays the two agents. Tests set what each one 'hears'."""

    def __init__(self, understanding=None, safety_tier="none"):
        self.understanding = understanding or understood()
        self.safety_tier = safety_tier

    def front_desk(self, text, profile, facts, history):
        if self.understanding == "down":
            raise AllModelsFailed("front_desk_agent: all models down")
        return Served(self.understanding, "fake:front-desk", 1)

    def safety(self, text, profile):
        if self.safety_tier == "down":
            raise AllModelsFailed("safety_agent: all models down")
        return Served(Safety(tier=self.safety_tier, sign=None if self.safety_tier == "none" else "test sign"),
                      "fake:safety", 1)


def call(clinic, fakes, *sentences):
    """Run sentences through one call. Returns the last turn's result."""
    graph = build_call_graph(clinic, front_desk=fakes.front_desk, safety=fakes.safety)
    config = {"configurable": {"thread_id": uuid.uuid4().hex}}
    result = None
    for text in sentences:
        result = graph.invoke({"text": text, "history": [f"Caller: {text}"]}, config=config)
    return result


class Routing(unittest.TestCase):
    def test_status_answer_comes_from_the_clinic_data_not_the_model(self):
        clinic = clinic_state(doctor="expected", eta="11:30")
        fakes = FakeAgents(understood("status", reply="Haan, doctor sahab aa gaye hain"))  # the model is wrong
        result = call(clinic, fakes, "doctor sahab aa gaye kya?")
        self.assertEqual(result["route"], "status")
        self.assertIn("abhi aaye nahin hain, 11:30", result["reply"])
        self.assertNotIn("aa gaye hain", result["reply"])

    def test_booking_makes_a_token(self):
        clinic = clinic_state()
        result = call(clinic, FakeAgents(understood("book", name="Ramesh")), "number laga do")
        self.assertEqual(len(clinic.tokens), 1)
        self.assertIn("number 1", result["reply"])

    def test_report_and_other_go_to_a_person(self):
        for intent in ("report", "other"):
            clinic = clinic_state()
            result = call(clinic, FakeAgents(understood(intent)), "kuch bhi")
            self.assertEqual(result["route"], "handoff")
            self.assertEqual(clinic.alerts[0]["kind"], "call back")

    def test_medical_question_goes_to_the_doctor_without_advice(self):
        clinic = clinic_state()
        result = call(clinic, FakeAgents(understood("medical")), "pet mein halka dard hai, kya karun?")
        self.assertEqual(result["route"], "medical")
        self.assertIn("salah nahin de sakti", result["reply"])
        self.assertEqual(clinic.alerts[0]["kind"], "question for doctor")


class UrgentSigns(unittest.TestCase):
    def test_safety_wins_over_a_booking(self):
        clinic = clinic_state()
        fakes = FakeAgents(understood("book", name="Ramesh"), safety_tier="emergency")
        result = call(clinic, fakes, "shaam ka number chahiye, subah se seene mein thoda dard hai")
        self.assertEqual(result["route"], "urgent")
        self.assertIn("emergency", result["reply"])
        self.assertTrue(clinic.alerts[0]["kind"].startswith("URGENT"))
        self.assertEqual(clinic.tokens, [])                        # hospital now: no token to wait for (call 5)
        self.assertNotIn("number", result["reply"].lower())
        self.assertIn("booking stopped: sent to hospital, no token", result["actions"])

    def test_word_list_catches_what_the_model_missed(self):
        clinic = clinic_state()
        fakes = FakeAgents(understood("book"), safety_tier="none")  # the safety model misses it
        result = call(clinic, fakes, "number chahiye, seene mein dard hai thoda")
        self.assertEqual(result["route"], "urgent")
        self.assertEqual(result["safety"]["words_said"], "emergency")

    def test_word_list_works_on_devanagari_transcripts(self):
        # Found in the end-to-end voice test: the transcriber writes Hindi in Devanagari.
        clinic = clinic_state()
        fakes = FakeAgents(understood("book"), safety_tier="none")
        result = call(clinic, fakes, "शाम का नंबर लगवाना है, सुबह से सीने में थोड़ा दर्द है।")
        self.assertEqual(result["safety"]["words_said"], "emergency")
        self.assertEqual(result["route"], "urgent")

    def test_word_list_works_on_urdu_script_transcripts(self):
        # Found while comparing transcription models: Hindi sometimes comes back in Urdu script.
        result = call(clinic_state(), FakeAgents(understood("book"), safety_tier="none"), "صبح سے سینے میں درد ہے")
        self.assertEqual(result["safety"]["words_said"], "emergency")

    def test_child_fever_gets_the_doctors_sentence_and_an_early_token(self):
        clinic = clinic_state()
        fakes = FakeAgents(understood("medical"), safety_tier="see_today")
        result = call(clinic, fakes, "bachche ko kal raat se 102 bukhar hai, abhi laun ya shaam ko?")
        self.assertIn("aaj hi dikhana chahiye", result["reply"])
        self.assertTrue(clinic.tokens[0].see_first)


class Unsure(unittest.TestCase):
    def test_one_clarification_then_a_person(self):
        clinic = clinic_state()
        fakes = FakeAgents(understood("unclear", confidence=0.3, reply="Number lagwana hai ya report?"))
        graph = build_call_graph(clinic, front_desk=fakes.front_desk, safety=fakes.safety)
        config = {"configurable": {"thread_id": "same-call"}}
        first = graph.invoke({"text": "haan woh kal wala", "history": ["Caller: haan woh kal wala"]}, config=config)
        second = graph.invoke({"text": "woh hi", "history": ["Caller: woh hi"]}, config=config)
        self.assertEqual(first["route"], "clarify")
        self.assertEqual(second["route"], "handoff")               # never asks a third time
        self.assertEqual(len(second["history"]), 4)                # the checkpointer kept the call

    def test_low_confidence_counts_as_unclear(self):
        result = call(clinic_state(), FakeAgents(understood("book", confidence=0.4)), "mmm number")
        self.assertEqual(result["route"], "clarify")


class Privacy(unittest.TestCase):
    def test_call_7_do_not_contact_is_stored_and_no_message_is_sent(self):
        clinic = clinic_state()
        fakes = FakeAgents(understood("book", no_messages=True))
        result = call(clinic, fakes, "akele mein milna hai, is number pe message mat bhejna")
        self.assertTrue(clinic.tokens[0].no_contact)
        self.assertIn("WhatsApp confirmation blocked", result["actions"])
        self.assertIn("number yaad rakhiye", result["reply"])


class WhenModelsFail(unittest.TestCase):
    def test_front_desk_down_hands_the_caller_to_a_person(self):
        clinic = clinic_state()
        result = call(clinic, FakeAgents("down"), "doctor sahab aa gaye kya?")
        self.assertEqual(result["route"], "handoff")
        self.assertEqual(clinic.alerts[0]["kind"], "call back")

    def test_safety_model_down_word_list_still_raises_the_alarm(self):
        clinic = clinic_state()
        result = call(clinic, FakeAgents(understood("book"), safety_tier="down"), "seene mein dard hai")
        self.assertEqual(result["route"], "urgent")
        self.assertEqual(result["safety"]["model_said"], "unavailable")

    def test_records_which_model_served_each_agent(self):
        result = call(clinic_state(), FakeAgents(), "doctor sahab aa gaye kya?")
        self.assertEqual(result["served_by"]["front_desk"]["model"], "fake:front-desk")
        self.assertEqual(result["served_by"]["safety"]["model"], "fake:safety")


class AboutTheAssistant(unittest.TestCase):
    def test_answers_honestly_when_asked(self):
        result = call(clinic_state(), FakeAgents(understood("about_assistant")), "aap robot ho kya?")
        self.assertIn("AI sahayak", result["reply"])
        self.assertIn("record", result["reply"])               # and the doctor reviews the recording


if __name__ == "__main__":
    unittest.main()


# ---- what each clinic treats: no false hope -----------------------------------------------
from parchi.clinic_profile import load_clinic  # noqa: E402


def clinic_of(clinic_id):
    return clinic_state(load_clinic(clinic_id))


class WhatThisDoctorTreats(unittest.TestCase):
    def test_a_dentist_does_not_book_a_childs_fever(self):
        clinic = clinic_of("dental")
        result = call(clinic, FakeAgents(understood("book", area="fever, cough and cold")), "bachche ko bukhar hai")
        self.assertEqual(result["route"], "not_here")
        self.assertEqual(clinic.tokens, [])                               # no token, no false hope
        self.assertIn("daant ka clinic", result["reply"])
        self.assertIn("general physician", result["reply"])
        self.assertIn("aspataal", result["reply"])                        # the safety net is always said

    def test_a_dentist_books_toothache(self):
        clinic = clinic_of("dental")
        result = call(clinic, FakeAgents(understood("book", area="teeth and gums")), "daant mein dard hai")
        self.assertEqual(result["route"], "book")
        self.assertEqual(result["scope"]["verdict"], "treated")
        self.assertEqual(len(clinic.tokens), 1)

    def test_a_general_physician_sends_toothache_to_a_dentist(self):
        result = call(clinic_of("general-physician"), FakeAgents(understood("book", area="teeth and gums")), "daant")
        self.assertEqual(result["route"], "not_here")
        self.assertIn("daant ke doctor", result["reply"])

    def test_a_status_question_with_an_untreated_problem_is_told_not_here(self):
        result = call(clinic_of("ent"), FakeAgents(understood("status", area="eyes")), "doctor aa gaye? aankh dard")
        self.assertEqual(result["route"], "not_here")

    def test_an_emergency_wins_at_every_clinic_and_books_no_token_where_untreated(self):
        clinic = clinic_of("dental")
        fakes = FakeAgents(understood("book", area="body ache and headache"), safety_tier="emergency")
        result = call(clinic, fakes, "seene mein dard hai, number chahiye")
        self.assertEqual(result["route"], "urgent")
        self.assertIn("emergency", result["reply"])
        self.assertEqual(clinic.tokens, [])

    def test_see_today_applies_only_to_what_the_doctor_treats(self):
        clinic = clinic_of("dental")
        fakes = FakeAgents(understood("medical", area="stomach and digestion"), safety_tier="see_today")
        result = call(clinic, fakes, "pet mein sujan hai")
        self.assertEqual(result["route"], "not_here")                     # not the dentist's rule to apply
        self.assertEqual(clinic.tokens, [])

    def test_a_problem_that_fits_no_area_goes_to_the_doctor_without_a_token(self):
        clinic = clinic_of("general-physician")
        u = Understanding(thinking="(test)", concern="strange tingling", problem_area=None, intent="book",
                          booking_day="today",
                          language="hindi", name=None, wants_no_messages=False, confidence=0.9, reply="Ji.")
        result = call(clinic, FakeAgents(u), "ajeeb si jhanjhanahat hai, number chahiye")
        self.assertEqual(result["route"], "medical")
        self.assertEqual(result["scope"]["verdict"], "unknown")
        self.assertEqual(clinic.tokens, [])

    def test_an_unknown_label_from_the_model_is_not_trusted(self):
        result = call(clinic_of("dental"), FakeAgents(understood("book", area="made-up area")), "kuch")
        self.assertEqual(result["scope"]["verdict"], "unknown")             # the model never decides scope
        self.assertEqual(result["route"], "medical")

    def test_booking_without_a_health_problem_books(self):
        clinic = clinic_of("ent")
        result = call(clinic, FakeAgents(understood("book")), "kal ka number laga do")
        self.assertEqual(result["route"], "book")
        self.assertEqual(result["scope"]["verdict"], "none")


class ClinicFiles(unittest.TestCase):
    def test_every_clinic_file_loads_and_treats_something(self):
        from parchi.clinic_profile import available_clinics
        for clinic_id in available_clinics():
            profile = load_clinic(clinic_id)
            self.assertTrue(profile.doctor.treats, clinic_id)
            self.assertTrue(profile.see_today.keywords, clinic_id)

    def test_every_untreated_area_names_who_to_see(self):
        from parchi.call_graph import fixed_replies
        for clinic_id in ("general-physician", "dental", "ent"):
            for sentence in fixed_replies(load_clinic(clinic_id)):
                self.assertNotIn("{", sentence)                           # every placeholder was filled

    def test_every_prompt_is_filled_for_every_clinic(self):
        import re
        from parchi.agents import front_desk_prompt, safety_prompt
        from parchi.clinic_profile import available_clinics
        for clinic_id in available_clinics():
            profile = load_clinic(clinic_id)
            for prompt in (front_desk_prompt(profile, clinic_state(profile=profile).facts()), safety_prompt(profile)):
                self.assertIsNone(re.search(r"\{[a-z_]+\}", prompt), clinic_id)   # no placeholder left
            self.assertIn(profile.doctor.speciality, front_desk_prompt(profile, profile.facts()))

    def test_a_missing_value_in_a_spoken_line_fails_loudly(self):
        from parchi.prompt_loader import say
        with self.assertRaises(KeyError):
            say("not_here", clinic_kind="daant ka clinic")             # problem and see are missing

    def test_a_clinic_treating_an_unknown_area_is_refused(self):
        from parchi.clinic_profile import ClinicProfile
        good = load_clinic("dental").model_dump()
        good["doctor"]["treats"] = ["teeth", "time-travel"]
        with self.assertRaisesRegex(ValueError, "unknown areas"):
            ClinicProfile(**good)
