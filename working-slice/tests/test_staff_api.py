"""The staff side, end to end over HTTP, in offline test mode: sign-in, who may do what,
the call log with caller identity and priority, recordings, and the protections.

    cd working-slice
    python -m unittest tests.test_staff_api -v
"""

import mimetypes
import os
import unittest

os.environ["PARCHI_FAKE_MODELS"] = "1"       # offline test mode: test sign-ins are on
os.environ["PARCHI_ENV"] = "test"            # a fresh temporary call log

from fastapi.testclient import TestClient  # noqa: E402

from parchi.settings import get_settings  # noqa: E402

get_settings.cache_clear()

from parchi import server  # noqa: E402
from parchi.auth import TEST_PASSWORDS, Throttle, hash_password, verify_password  # noqa: E402


def signed_in(role: str) -> TestClient:
    client = TestClient(server.app)
    response = client.post("/api/staff/login", json={"role": role, "password": TEST_PASSWORDS[role]})
    assert response.status_code == 200, response.text
    return client


class Passwords(unittest.TestCase):
    def test_a_hash_checks_the_right_password_only(self):
        stored = hash_password("correct horse battery", iterations=1_000)
        self.assertTrue(verify_password("correct horse battery", stored))
        self.assertFalse(verify_password("wrong", stored))
        self.assertFalse(verify_password("anything", "not-a-hash"))

    def test_the_throttle_makes_a_guesser_wait(self):
        throttle = Throttle(attempts=2, window_s=60)
        throttle.failed("1.2.3.4")
        self.assertEqual(throttle.wait_s("1.2.3.4"), 0)
        throttle.failed("1.2.3.4")
        self.assertGreater(throttle.wait_s("1.2.3.4"), 0)
        self.assertEqual(throttle.wait_s("5.6.7.8"), 0)


class SignIn(unittest.TestCase):
    def setUp(self):
        server.throttle.succeeded("testclient")
        self.client = TestClient(server.app)

    def test_the_call_log_needs_a_sign_in(self):
        for path in ("/api/staff/calls", "/api/staff/me", "/api/staff/clips/1"):
            self.assertEqual(self.client.get(path).status_code, 401, path)

    def test_a_wrong_password_is_refused_and_repeated_guessing_waits(self):
        for _ in range(5):
            response = self.client.post("/api/staff/login", json={"role": "doctor", "password": "guess"})
            self.assertEqual(response.status_code, 401)
        response = self.client.post("/api/staff/login", json={"role": "doctor", "password": TEST_PASSWORDS["doctor"]})
        self.assertEqual(response.status_code, 429)            # even the right password waits now
        self.assertIn("Retry-After", response.headers)
        server.throttle.succeeded("testclient")

    def test_the_session_cookie_is_http_only_and_same_site(self):
        response = self.client.post("/api/staff/login", json={"role": "doctor", "password": TEST_PASSWORDS["doctor"]})
        cookie = response.headers["set-cookie"].lower()
        self.assertIn("httponly", cookie)
        self.assertIn("samesite=strict", cookie)
        self.assertEqual(self.client.get("/api/staff/me").json(), {"role": "doctor", "name": "Dr. Sharma"})

    def test_signing_out_ends_the_session(self):
        client = signed_in("reception")
        self.assertEqual(client.get("/api/staff/me").status_code, 200)
        client.post("/api/staff/logout")
        self.assertEqual(client.get("/api/staff/me").status_code, 401)

    def test_a_request_from_another_site_is_refused(self):
        response = self.client.post("/api/staff/login", json={"role": "doctor", "password": TEST_PASSWORDS["doctor"]},
                                    headers={"Origin": "https://evil.example"})
        self.assertEqual(response.status_code, 403)

    def test_the_sign_in_page_learns_which_roles_exist(self):
        accounts = self.client.get("/api/staff/accounts").json()
        self.assertEqual([r["role"] for r in accounts["roles"]], ["doctor", "reception"])
        self.assertTrue(accounts["test_logins"])


class CallLogOverHttp(unittest.TestCase):
    def setUp(self):
        server.throttle.succeeded("testclient")
        self.caller = TestClient(server.app)          # the phone line: no sign-in
        self.caller.post("/api/clinic", json={"action": "reset", "clinic": get_settings().clinic})
        # The receptionist sets the board: the clinic is open today, whatever the weekday.
        self.caller.post("/api/clinic", json={"action": "eta", "eta": "11:30"})

    def start(self, phone: str | None = "+91 90000 00042") -> str:
        response = self.caller.post("/api/call/start", json={"phone": phone} if phone else None)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["call_id"]

    def say(self, call_id: str, text: str) -> dict:
        response = self.caller.post(f"/api/call/{call_id}/text", json={"text": text})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_the_greeting_introduces_parchi_gives_the_doctors_status_and_asks_how_to_help(self):
        self.caller.post("/api/clinic", json={"action": "eta", "eta": "11:30"})
        greeting = self.caller.post("/api/call/start").json()["greeting"]
        self.assertIn("main Parchi", greeting)
        self.assertIn("11:30", greeting)                     # the commonest question, answered first
        self.assertIn("madad", greeting)
        self.caller.post("/api/clinic", json={"action": "arrived"})
        self.assertIn("clinic mein hain", self.caller.post("/api/call/start").json()["greeting"])

    def test_the_caller_is_identified_by_number_and_the_name_they_give(self):
        call_id = self.start("09000000077")
        turn = self.say(call_id, "Shaam ka number chahiye, naam Ramesh.")
        self.assertEqual(turn["clinic"]["tokens"][-1]["phone"], "+919000000077")   # the token carries the number
        again = self.caller.post("/api/call/start", json={"phone": "+91 90000 00077"}).json()["caller"]
        self.assertEqual((again["known"], again["name"]), (True, "Ramesh"))

    def test_a_number_that_is_not_a_mobile_is_refused(self):
        self.assertEqual(self.caller.post("/api/call/start", json={"phone": "12345"}).status_code, 422)

    def test_an_emergency_is_listed_first_with_its_reason_and_the_doctor_reviews_it(self):
        call_id = self.start()
        self.say(call_id, "Shaam ka number chahiye, naam Ramesh. Subah se seene mein thoda dard hai.")
        self.caller.post(f"/api/call/{call_id}/end")

        doctor = signed_in("doctor")
        listed = doctor.get("/api/staff/calls").json()
        mine = next(c for c in listed["calls"] if c["id"] == call_id)
        self.assertEqual(mine["priority"], "emergency")
        self.assertEqual((mine["name"], mine["phone_display"]), ("Ramesh", "+91 90000 00042"))
        self.assertFalse(mine["live"])
        self.assertGreaterEqual(listed["summary"]["emergencies"], 1)

        detail = doctor.get(f"/api/staff/calls/{call_id}").json()
        self.assertEqual(detail["turns"][0]["route"], "urgent")
        reviewed = doctor.post(f"/api/staff/calls/{call_id}/review", json={"note": "Spoke to him; he went to hospital."})
        self.assertEqual(reviewed.status_code, 200)
        self.assertTrue(reviewed.json()["reviewed"])
        self.assertEqual([a["action"] for a in reviewed.json()["activity"]], ["opened call", "reviewed"])

    def test_only_the_doctor_reviews(self):
        call_id = self.start()
        reception = signed_in("reception")
        self.assertEqual(reception.get(f"/api/staff/calls/{call_id}").status_code, 200)    # she can read it
        self.assertEqual(reception.post(f"/api/staff/calls/{call_id}/review", json={}).status_code, 403)

    def test_the_callers_voice_is_recorded_and_only_staff_can_play_it(self):
        call_id = self.start()
        self.caller.post(f"/api/call/{call_id}/speech", content=b"caller-voice", headers={"Content-Type": "audio/webm"})
        doctor = signed_in("doctor")
        clips = doctor.get(f"/api/staff/calls/{call_id}").json()["clips"]
        self.assertEqual([c["speaker"] for c in clips], ["caller"])         # offline: Parchi is silent
        audio = doctor.get(f"/api/staff/clips/{clips[0]['id']}")
        self.assertEqual((audio.content, audio.headers["content-type"]), (b"caller-voice", "audio/webm"))
        self.assertEqual(self.caller.get(f"/api/staff/clips/{clips[0]['id']}").status_code, 401)

    def test_uploads_must_be_audio_and_not_too_large(self):
        call_id = self.start()
        page = self.caller.post(f"/api/call/{call_id}/speech", content=b"<html>", headers={"Content-Type": "text/html"})
        self.assertEqual(page.status_code, 415)
        huge = b"x" * (int(server.SETTINGS.max_upload_mb * 1_000_000) + 1)
        big = self.caller.post(f"/api/call/{call_id}/speech", content=huge, headers={"Content-Type": "audio/webm"})
        self.assertEqual(big.status_code, 413)

    def test_an_unknown_call_is_refused(self):
        self.assertEqual(self.caller.post("/api/call/0123456789abcdef/text", json={"text": "hi"}).status_code, 404)
        self.assertEqual(self.caller.post("/api/call/not-a-call-id/text", json={"text": "hi"}).status_code, 404)

    def test_test_mode_can_add_earlier_days(self):
        doctor = signed_in("doctor")
        self.assertEqual(doctor.post("/api/staff/test-calls").json()["added"], 8)
        listed = doctor.get("/api/staff/calls").json()
        earlier = [c for c in listed["calls"] if c["day"] != listed["today"]]
        self.assertEqual(len(earlier), 8)
        self.assertTrue(all(c["test"] for c in earlier))
        self.assertIn("emergency", {c["priority"] for c in earlier})


class Protections(unittest.TestCase):
    def test_every_response_carries_security_headers_and_api_answers_are_not_cached(self):
        response = TestClient(server.app).get("/api/system")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertEqual(response.headers["x-frame-options"], "DENY")
        self.assertIn("default-src 'self'", response.headers["content-security-policy"])
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_scripts_are_served_as_javascript_so_nosniff_does_not_block_the_ui(self):
        # Windows can map .js to text/plain; with nosniff the browser would then refuse the UI.
        self.assertEqual(mimetypes.guess_type("chunk.js")[0], "text/javascript")
        self.assertEqual(mimetypes.guess_type("app.css")[0], "text/css")


if __name__ == "__main__":
    unittest.main()
