"""The HTTP API, end to end, in offline test mode. No keys, no network, same result every run.

    cd working-slice
    python -m unittest -v

Each test is one of the brief's calls, sent the way the UI sends it.
"""

import os
import unittest
import unittest.mock

os.environ["PARCHI_FAKE_MODELS"] = "1"       # offline test mode, before the server reads its settings
os.environ["PARCHI_ENV"] = "test"

from fastapi.testclient import TestClient  # noqa: E402

from parchi.settings import get_settings  # noqa: E402

get_settings.cache_clear()                   # another test may have read the settings already

from parchi import server  # noqa: E402
from parchi.clinic_profile import load_clinic  # noqa: E402


class Api(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(server.app)
        # Name the clinic: a test that switches clinic must not leak into the next one.
        self.client.post("/api/clinic", json={"action": "reset", "clinic": get_settings().clinic})
        # The receptionist sets the board: the clinic is open today, whatever the weekday.
        self.client.post("/api/clinic", json={"action": "eta", "eta": load_clinic(get_settings().clinic).posted_start})
        self.call_id = self.client.post("/api/call/start").json()["call_id"]

    def say(self, text: str) -> dict:
        response = self.client.post(f"/api/call/{self.call_id}/text", json={"text": text})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_system_reports_offline_mode_and_routes(self):
        system = self.client.get("/api/system").json()
        self.assertEqual(system["mode"], "offline-test")
        self.assertEqual(system["silence_limit_s"], 2.0)
        self.assertIn("safety_agent", system["routes"])

    def test_call_1_status_comes_from_the_board(self):
        self.client.post("/api/clinic", json={"action": "eta", "eta": "11:30"})
        turn = self.say("Doctor sahab aa gaye kya?")
        self.assertEqual(turn["route"], "status")
        self.assertIn("11:30", turn["reply"])
        self.client.post("/api/clinic", json={"action": "arrived"})
        self.assertIn("clinic mein hain", self.say("doctor sahab aa gaye kya?")["reply"])

    def test_call_2_child_fever_is_see_today_and_first_in_queue(self):
        turn = self.say("Mera bachcha do saal ka hai, kal raat se 102 bukhar hai. Abhi lana zaroori hai?")
        self.assertEqual(turn["route"], "urgent")
        self.assertEqual(turn["safety"]["tier"], "see_today")
        self.assertTrue(turn["clinic"]["tokens"][0]["see_first"])

    def test_call_5_chest_pain_inside_a_booking_is_an_emergency(self):
        turn = self.say("Shaam ka number chahiye, naam Ramesh. Subah se seene mein thoda dard hai.")
        self.assertEqual(turn["route"], "urgent")
        self.assertIn("emergency", turn["reply"])
        self.assertTrue(turn["clinic"]["alerts"][0]["kind"].startswith("URGENT"))

    def test_call_7_do_not_contact_blocks_the_whatsapp(self):
        turn = self.say("Number laga do, par is number pe message mat bhejna.")
        self.assertEqual(turn["route"], "book")
        self.assertIn("WhatsApp confirmation blocked", turn["actions"])
        self.assertTrue(turn["clinic"]["tokens"][0]["no_contact"])

    def test_call_6_sales_rep_does_not_get_the_doctors_time(self):
        turn = self.say("Hello, I am a medical representative. When is the doctor free to meet?")
        self.assertEqual(turn["route"], "handoff")
        self.assertNotIn("11:30", turn["reply"])

    def test_unclear_twice_goes_to_a_person(self):
        self.assertEqual(self.say("haan woh... kal wala")["route"], "clarify")
        self.assertEqual(self.say("woh hi")["route"], "handoff")

    def test_every_turn_reports_timings_and_which_model_served(self):
        turn = self.say("consultation fees kitni hai?")
        self.assertEqual(set(turn["timings_ms"]), {"speech_to_text", "agents", "text_to_speech", "first_sound"})
        self.assertGreaterEqual(len(turn["reply_sentences"]), 1)
        self.assertEqual(turn["served_by"]["front_desk"]["model"], "fake:front-desk")

    def test_reply_starts_with_a_pre_made_sentence_and_the_rest_can_be_spoken(self):
        turn = self.say("kal subah ka number laga do")
        self.assertEqual(turn["reply_sentences"][0], "Ji, ho gaya.")       # pre-made at start-up
        spoken = self.client.post("/api/speak", json={"text": turn["reply_sentences"][1]}).json()
        self.assertEqual(set(spoken), {"audio", "ms"})

    def test_reply_sentences_split_hindi_full_stops_too(self):
        self.assertEqual(server.sentences_of("सुबह से दर्द है। अभी आइए?"), ["सुबह से दर्द है।", "अभी आइए?"])

    def test_speech_endpoint_accepts_audio(self):
        response = self.client.post(f"/api/call/{self.call_id}/speech", content=b"fake-audio",
                                    headers={"Content-Type": "audio/webm"})
        self.assertEqual(response.json()["route"], "status")

    def test_board_actions(self):
        self.client.post("/api/clinic", json={"action": "walk_in"})
        self.client.post("/api/clinic", json={"action": "walk_in"})
        board = self.client.post("/api/clinic", json={"action": "next"}).json()
        self.assertEqual((len(board["tokens"]), board["now_serving"]), (2, 1))

    def test_board_refuses_a_malformed_time_or_an_unknown_action(self):
        # Callers hear the doctor's time, so a typo must be refused rather than read out.
        for body in ({"action": "eta", "eta": "11.30"}, {"action": "eta", "eta": "25:00"}, {"action": "dance"}):
            self.assertEqual(self.client.post("/api/clinic", json=body).status_code, 422, body)
        posted = self.client.get("/api/system").json()["clinic_profile"]
        self.assertEqual(self.client.get("/api/clinic").json()["eta"], load_clinic(posted["id"]).posted_start)
        board = self.client.post("/api/clinic", json={"action": "eta", "eta": "17:45"}).json()
        self.assertIn("17:45", board["status_line"])


class EachClinicAnswersForItsOwnDoctor(unittest.TestCase):
    """What a caller hears depends on the clinic's file: its doctor, what he treats, its fees."""

    def setUp(self):
        self.client = TestClient(server.app)

    def tearDown(self):
        self.client.post("/api/clinic", json={"action": "reset", "clinic": get_settings().clinic})

    def call(self, clinic_id: str, text: str) -> dict:
        board = self.client.post("/api/clinic", json={"action": "reset", "clinic": clinic_id})
        self.assertEqual(board.status_code, 200, board.text)
        self.client.post("/api/clinic", json={"action": "eta", "eta": load_clinic(clinic_id).posted_start})
        call_id = self.client.post("/api/call/start").json()["call_id"]
        return self.client.post(f"/api/call/{call_id}/text", json={"text": text}).json()

    def test_the_system_lists_the_clinics_and_the_doctor_in_use(self):
        system = self.client.get("/api/system").json()
        self.assertEqual({c["id"] for c in system["clinics"]}, {"general-physician", "dental", "ent"})
        self.assertTrue(system["clinic_switching"])
        self.assertIn("treats", system["clinic_profile"])

    def test_a_dentist_sends_a_fever_elsewhere_without_a_token(self):
        turn = self.call("dental", "Bachche ko kal se bukhar hai, dikhana hai")
        self.assertEqual(turn["route"], "not_here")
        self.assertEqual(turn["scope"]["verdict"], "not_treated")
        self.assertEqual(turn["clinic"]["tokens"], [])
        self.assertIn("general physician", turn["reply"])

    def test_a_dentist_books_a_toothache(self):
        turn = self.call("dental", "Daant mein dard hai, number chahiye")
        self.assertEqual((turn["route"], turn["scope"]["verdict"]), ("book", "treated"))
        self.assertEqual(len(turn["clinic"]["tokens"]), 1)

    def test_chest_pain_at_a_dentist_is_still_an_emergency(self):
        turn = self.call("dental", "Seene mein dard ho raha hai, aapke yahan dikha sakta hoon?")
        self.assertEqual(turn["route"], "urgent")
        self.assertIn("emergency", turn["reply"])

    def test_fees_come_from_the_clinic_file(self):
        turn = self.call("ent", "consultation fees kitni hai?")
        self.assertEqual(turn["reply"], load_clinic("ent").fees)

    def test_the_greeting_names_the_clinic(self):
        self.client.post("/api/clinic", json={"action": "reset", "clinic": "ent"})
        start = self.client.post("/api/call/start").json()
        self.assertIn(load_clinic("ent").name, start["greeting"])

    def test_an_unknown_clinic_is_refused(self):
        response = self.client.post("/api/clinic", json={"action": "reset", "clinic": "../settings"})
        self.assertEqual(response.status_code, 422)

    def test_a_production_server_will_not_switch_clinics(self):
        with unittest.mock.patch.object(server.SETTINGS, "env", "production"):
            response = self.client.post("/api/clinic", json={"action": "reset", "clinic": "dental"})
        self.assertEqual(response.status_code, 403)


class AppointmentsOverHttp(unittest.TestCase):
    """A caller books, calls back to ask their number, and cancels; the receptionist sees it all."""

    def setUp(self):
        self.client = TestClient(server.app)
        self.client.post("/api/clinic", json={"action": "reset", "clinic": get_settings().clinic})
        self.client.post("/api/clinic", json={"action": "eta", "eta": "11:30"})

    def call_from(self, phone: str, text: str) -> dict:
        call_id = self.client.post("/api/call/start", json={"phone": phone}).json()["call_id"]
        return self.client.post(f"/api/call/{call_id}/text", json={"text": text}).json()

    def test_a_caller_books_asks_their_number_and_cancels(self):
        booked = self.call_from("9000000031", "Number chahiye, naam hai Kamla")
        self.assertEqual(booked["route"], "book")
        self.assertEqual(booked["clinic"]["tokens"][0]["name"], "Kamla")

        asked = self.call_from("9000000031", "Mera number kya tha?")
        self.assertEqual(asked["route"], "my_booking")
        self.assertIn("Aapka number 1 hai", asked["reply"])

        again = self.call_from("9000000031", "Number chahiye")
        self.assertIn("pehle se laga", again["reply"])
        self.assertEqual(len(again["clinic"]["tokens"]), 1)            # one token per person per day

        cancelled = self.call_from("9000000031", "Aaj nahin aa paunga, cancel kar dijiye")
        self.assertEqual(cancelled["route"], "cancel")
        self.assertEqual(cancelled["clinic"]["tokens"][0]["status"], "cancelled")

    def test_a_booking_for_tomorrow_is_kept_for_tomorrow(self):
        turn = self.call_from("9000000032", "Kal subah ka number laga do")
        self.assertEqual(turn["clinic"]["tokens"], [])
        self.assertEqual(len(turn["clinic"]["later"]), 1)
        self.assertIn("ke liye", turn["reply"])

    def test_the_receptionist_cancels_from_the_board(self):
        self.client.post("/api/clinic", json={"action": "walk_in"})
        board = self.client.post("/api/clinic", json={"action": "cancel", "number": 1}).json()
        self.assertEqual(board["tokens"][0]["status"], "cancelled")
        self.assertEqual(self.client.post("/api/clinic", json={"action": "cancel", "number": 1}).status_code, 404)
        self.assertEqual(self.client.post("/api/clinic", json={"action": "cancel"}).status_code, 404)

    def test_the_board_lists_each_token_with_its_status(self):
        self.client.post("/api/clinic", json={"action": "walk_in"})
        self.client.post("/api/clinic", json={"action": "walk_in"})
        board = self.client.post("/api/clinic", json={"action": "next"}).json()
        self.assertEqual([t["status"] for t in board["tokens"]], ["seeing", "waiting"])
        self.assertTrue(board["open_today"])

    def test_production_never_clears_the_book(self):
        with unittest.mock.patch.object(server.SETTINGS, "env", "production"):
            response = self.client.post("/api/clinic", json={"action": "reset"})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
