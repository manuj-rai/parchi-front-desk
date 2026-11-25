"""The doctor's own settings: the store on its own, then over HTTP from the dashboard.

    cd working-slice
    python -m unittest tests.test_clinic_settings -v
"""

import os
import tempfile
import unittest
from pathlib import Path

os.environ["PARCHI_FAKE_MODELS"] = "1"       # offline test mode: test sign-ins are on
os.environ["PARCHI_ENV"] = "test"            # a fresh temporary data folder

from fastapi.testclient import TestClient  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from parchi.settings import get_settings  # noqa: E402

get_settings.cache_clear()

from parchi import server  # noqa: E402
from parchi.auth import TEST_PASSWORDS  # noqa: E402
from parchi.clinic_profile import load_clinic, problem_areas  # noqa: E402
from parchi.clinic_settings import ClinicDetails, ClinicSettings  # noqa: E402


def details_of(clinic_id: str, **changes) -> dict:
    values = ClinicDetails.of(load_clinic(clinic_id)).model_dump()
    for key, value in changes.items():
        section, _, field = key.partition("__")
        if field:
            values[section][field] = value
        else:
            values[key] = value
    return values


class Store(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.store = ClinicSettings(Path(self.folder.name))

    def tearDown(self):
        self.folder.cleanup()

    def test_with_no_changes_the_clinic_is_the_shipped_file(self):
        self.assertEqual(self.store.profile("dental"), load_clinic("dental"))
        self.assertFalse(self.store.changed("dental"))

    def test_a_saved_change_is_kept_and_recorded(self):
        self.store.save("dental", ClinicDetails(**details_of("dental", fees="Consultation 400 rupees.")), by="Dr. Mehta")
        again = ClinicSettings(Path(self.folder.name))                  # as after a restart
        self.assertEqual(again.profile("dental").fees, "Consultation 400 rupees.")
        self.assertEqual(again.history("dental")[0]["changed"], ["fees"])
        self.assertEqual(again.history("dental")[0]["by"], "Dr. Mehta")

    def test_what_the_doctor_treats_changes_the_scope(self):
        details = details_of("dental", doctor__treats=["teeth", "ent"])
        profile = self.store.save("dental", ClinicDetails(**details), by="Dr. Mehta")
        self.assertTrue(profile.treats("ent"))
        self.assertFalse(load_clinic("dental").treats("ent"))          # the shipped file is untouched

    def test_changing_the_see_today_rule_signs_it_with_the_doctors_name(self):
        details = details_of("dental", see_today__signs="swelling of the face or jaw, a knocked-out tooth")
        profile = self.store.save("dental", ClinicDetails(**details), by="Dr. Mehta")
        self.assertTrue(profile.see_today.approved_by.startswith("Dr. Mehta, "))

    def test_other_changes_keep_the_old_signature(self):
        profile = self.store.save("dental", ClinicDetails(**details_of("dental", fees="200")), by="Dr. Mehta")
        self.assertEqual(profile.see_today.approved_by, load_clinic("dental").see_today.approved_by)

    def test_saving_nothing_new_records_nothing(self):
        self.store.save("dental", ClinicDetails(**details_of("dental")), by="Dr. Mehta")
        self.assertEqual(self.store.history("dental"), [])

    def test_the_doctor_sets_the_days_the_clinic_is_closed(self):
        details = details_of("dental", closed_days=["Sunday", "Thursday", "Sunday"])
        profile = self.store.save("dental", ClinicDetails(**details), by="Dr. Mehta")
        self.assertEqual(profile.closed_days, ["Thursday", "Sunday"])
        self.assertEqual(self.store.history("dental")[0]["changed"], ["days closed"])
        for bad in (["Funday"], ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]):
            with self.assertRaises(ValidationError):
                ClinicDetails(**details_of("dental", closed_days=bad))

    def test_alarm_words_are_cleaned(self):
        details = details_of("dental", see_today__keywords=["  Sujan ", "sujan", "", "KHOON"])
        profile = self.store.save("dental", ClinicDetails(**details), by="Dr. Mehta")
        self.assertEqual(profile.see_today.keywords, ["sujan", "khoon"])

    def test_a_bad_change_is_refused_and_nothing_is_kept(self):
        for bad in (details_of("dental", doctor__treats=[]), details_of("dental", see_today__keywords=[" "]),
                    details_of("dental", posted_start="25:00"), details_of("dental", fees=" "),
                    {**details_of("dental"), "surprise": "field"}):
            with self.assertRaises(ValidationError):
                ClinicDetails(**bad)
        with self.assertRaises(ValueError):                              # an unknown area fails the clinic's checks
            self.store.save("dental", ClinicDetails(**details_of("dental", doctor__treats=["time-travel"])), by="x")
        self.assertFalse(self.store.changed("dental"))

    def test_restore_brings_back_the_shipped_file_and_keeps_the_history(self):
        self.store.save("dental", ClinicDetails(**details_of("dental", fees="200")), by="Dr. Mehta")
        self.assertEqual(self.store.restore("dental", by="Dr. Mehta"), load_clinic("dental"))
        self.assertEqual([h["changed"] for h in self.store.history("dental")],
                         [["restored the original details"], ["fees"]])


def signed_in(role: str) -> TestClient:
    client = TestClient(server.app)
    response = client.post("/api/staff/login", json={"role": role, "password": TEST_PASSWORDS[role]})
    assert response.status_code == 200, response.text
    return client


class OverHttp(unittest.TestCase):
    def setUp(self):
        server.throttle.succeeded("testclient")
        self.caller = TestClient(server.app)
        self.caller.post("/api/clinic", json={"action": "reset", "clinic": get_settings().clinic})
        # The receptionist sets the board: the clinic is open today, whatever the weekday.
        self.caller.post("/api/clinic", json={"action": "eta", "eta": "11:30"})
        self.doctor = signed_in("doctor")
        self.clinic_id = get_settings().clinic

    def tearDown(self):
        self.doctor.post("/api/staff/clinic-settings/restore")

    def save(self, client: TestClient, **changes):
        return client.post("/api/staff/clinic-settings", json=details_of(self.clinic_id, **changes))

    def ask(self, text: str, call_id: str | None = None) -> dict:
        call_id = call_id or self.caller.post("/api/call/start").json()["call_id"]
        return self.caller.post(f"/api/call/{call_id}/text", json={"text": text}).json()

    def test_both_roles_can_read_the_settings_but_only_the_doctor_may_change_them(self):
        reception = signed_in("reception")
        seen = reception.get("/api/staff/clinic-settings").json()
        self.assertFalse(seen["can_edit"])
        self.assertEqual(len(seen["areas"]), len(problem_areas()))
        self.assertEqual(self.save(reception, fees="1 rupee").status_code, 403)
        self.assertTrue(self.doctor.get("/api/staff/clinic-settings").json()["can_edit"])

    def test_no_sign_in_no_settings(self):
        self.assertEqual(self.caller.get("/api/staff/clinic-settings").status_code, 401)
        self.assertEqual(self.save(self.caller, fees="1 rupee").status_code, 401)

    def test_new_fees_are_what_the_next_caller_hears(self):
        self.assertEqual(self.save(self.doctor, fees="Consultation 350 rupees.").status_code, 200)
        self.assertEqual(self.ask("consultation fees kitni hai?")["reply"], "Consultation 350 rupees.")

    def test_a_problem_the_doctor_stops_treating_is_sent_elsewhere(self):
        treats = [area for area in load_clinic(self.clinic_id).doctor.treats if area != "skin"]
        self.assertEqual(self.save(self.doctor, doctor__treats=treats).status_code, 200)
        turn = self.ask("Skin pe khujli aur daane hain, dikhana hai")
        self.assertEqual(turn["route"], "not_here")
        self.assertEqual(turn["clinic"]["tokens"], [])

    def test_a_call_under_way_keeps_its_memory_when_the_doctor_saves(self):
        call_id = self.caller.post("/api/call/start").json()["call_id"]
        self.assertEqual(self.ask("haan woh... matlab", call_id)["route"], "clarify")
        self.save(self.doctor, fees="Consultation 350 rupees.")
        self.assertEqual(self.ask("hmm... haan", call_id)["route"], "handoff")   # the second "unclear" goes to a person

    def test_the_new_doctor_name_is_used_at_sign_in(self):
        self.save(self.doctor, doctor__name="Dr. Verma")
        self.assertEqual(signed_in("doctor").get("/api/staff/me").json()["name"], "Dr. Verma")

    def test_a_bad_change_is_refused_with_a_reason(self):
        response = self.save(self.doctor, doctor__treats=["time-travel"])
        self.assertEqual(response.status_code, 422)
        self.assertIn("time-travel", response.json()["detail"])
        self.assertEqual(self.save(self.doctor, posted_start="9.30").status_code, 422)

    def test_the_history_shows_who_changed_what(self):
        self.save(self.doctor, timings="Morning 9 to 1 only.")
        history = self.doctor.get("/api/staff/clinic-settings").json()["history"]
        self.assertEqual(history[0]["changed"], ["timings"])
        self.assertEqual(history[0]["by"], load_clinic(self.clinic_id).doctor.name)

    def test_restore_returns_to_the_shipped_file(self):
        self.save(self.doctor, fees="200")
        restored = self.doctor.post("/api/staff/clinic-settings/restore").json()
        self.assertFalse(restored["changed_from_original"])
        self.assertEqual(restored["details"]["fees"], load_clinic(self.clinic_id).fees)


if __name__ == "__main__":
    unittest.main()
