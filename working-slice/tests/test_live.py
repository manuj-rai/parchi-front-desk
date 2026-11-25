"""Live calls: listening in, taking over from Parchi, and handing back. Offline test mode.

    cd working-slice
    python -m unittest tests.test_live -v
"""

import asyncio
import json
import os
import threading
import unittest

os.environ["PARCHI_FAKE_MODELS"] = "1"
os.environ["PARCHI_ENV"] = "test"

from fastapi.testclient import TestClient  # noqa: E402

from parchi.settings import get_settings  # noqa: E402

get_settings.cache_clear()

from parchi import server  # noqa: E402
from parchi.auth import TEST_PASSWORDS  # noqa: E402
from parchi.live import HANDBACK_LINE, LiveHub  # noqa: E402


class FakeRequest:
    """Stands in for the browser's connection: 'disconnects' once told to."""

    def __init__(self) -> None:
        self.gone = False

    async def is_disconnected(self) -> bool:
        return self.gone


class Hub(unittest.TestCase):
    def test_an_event_published_from_a_worker_thread_reaches_the_right_listener_only(self):
        async def scenario() -> list[str]:
            hub, request = LiveHub(), FakeRequest()
            staff_stream = hub.stream("c1", "staff", request)
            assert await anext(staff_stream) == "retry: 2000\n\n"      # registered and listening
            listening_now = hub.listening("c1", "staff")
            # Endpoints run in worker threads: publish from one, as they do.
            worker = threading.Thread(target=lambda: (hub.publish("c1", "caller", {"type": "not for staff"}),
                                                      hub.publish("c1", "staff", {"type": "turn", "n": 1})))
            worker.start()
            worker.join()
            received = await asyncio.wait_for(anext(staff_stream), 2)
            request.gone = True
            await staff_stream.aclose()
            return [str(listening_now), received, str(hub.listening("c1", "staff"))]

        listening, received, after = asyncio.run(scenario())
        self.assertEqual(listening, "1")
        self.assertEqual(json.loads(received.removeprefix("data: ")), {"type": "turn", "n": 1})
        self.assertEqual(after, "0")                                   # a closed stream stops listening


def signed_in(role: str) -> TestClient:
    client = TestClient(server.app)
    response = client.post("/api/staff/login", json={"role": role, "password": TEST_PASSWORDS[role]})
    assert response.status_code == 200, response.text
    return client


class TakeOver(unittest.TestCase):
    def setUp(self):
        server.throttle.succeeded("testclient")
        self.caller = TestClient(server.app)
        self.call_id = self.caller.post("/api/call/start", json={"phone": "+91 90000 00031"}).json()["call_id"]
        self.doctor = signed_in("doctor")

    def say(self, text: str) -> dict:
        response = self.caller.post(f"/api/call/{self.call_id}/text", json={"text": text})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_the_doctor_takes_over_talks_and_hands_back_and_it_is_all_in_the_transcript(self):
        taken = self.doctor.post(f"/api/staff/calls/{self.call_id}/takeover")
        self.assertEqual(taken.status_code, 200, taken.text)
        self.assertEqual(taken.json()["taken_over_by"], "Dr. Sharma")
        self.assertIn("doctor sahab se karwa rahi hoon", taken.json()["turns"][-1]["reply"])

        relayed = self.say("Doctor sahab, seene mein dard hai")         # goes to the doctor, not Parchi
        self.assertTrue(relayed["relayed"])
        self.assertEqual(self.doctor.post(f"/api/staff/calls/{self.call_id}/say",
                                          json={"text": "Abhi aspataal jaaiye."}).status_code, 200)

        self.doctor.post(f"/api/staff/calls/{self.call_id}/handback")
        back = self.say("Consultation fees kitni hai?")                  # Parchi again
        self.assertNotIn("relayed", back)
        self.assertEqual(back["route"], "info")

        turns = self.doctor.get(f"/api/staff/calls/{self.call_id}").json()["turns"]
        exchange = next(t for t in turns if t["caller_text"].startswith("Doctor sahab"))
        self.assertEqual((exchange["reply"], exchange["reply_by"]), ("Abhi aspataal jaaiye.", "Dr. Sharma"))
        self.assertEqual(exchange["safety_tier"], "emergency")           # the word list still marks danger
        self.assertIn(HANDBACK_LINE, [t["reply"] for t in turns])
        call = self.doctor.get("/api/staff/calls").json()["calls"][0]
        self.assertEqual(call["priority"], "emergency")

    def test_only_the_person_holding_the_call_speaks_on_it(self):
        reception = signed_in("reception")
        self.assertEqual(self.doctor.post(f"/api/staff/calls/{self.call_id}/say", json={"text": "hello"}).status_code, 409)
        self.doctor.post(f"/api/staff/calls/{self.call_id}/takeover")
        self.assertEqual(reception.post(f"/api/staff/calls/{self.call_id}/takeover").status_code, 409)
        self.assertEqual(reception.post(f"/api/staff/calls/{self.call_id}/say", json={"text": "hello"}).status_code, 409)

    def test_the_receptionist_can_take_over_too(self):
        reception = signed_in("reception")
        taken = reception.post(f"/api/staff/calls/{self.call_id}/takeover").json()
        self.assertIn("Sunita ji se karwa rahi hoon", taken["turns"][-1]["reply"])

    def test_staff_voice_is_kept_with_the_recording(self):
        self.doctor.post(f"/api/staff/calls/{self.call_id}/takeover")
        spoken = self.doctor.post(f"/api/staff/calls/{self.call_id}/say-audio", content=b"doctor-voice",
                                  headers={"Content-Type": "audio/webm"})
        self.assertEqual(spoken.status_code, 200, spoken.text)
        clips = self.doctor.get(f"/api/staff/calls/{self.call_id}").json()["clips"]
        self.assertIn("staff", [c["speaker"] for c in clips])

    def test_a_call_that_ended_cannot_be_taken_over_and_ending_releases_it(self):
        self.doctor.post(f"/api/staff/calls/{self.call_id}/takeover")
        self.caller.post(f"/api/call/{self.call_id}/end")
        self.assertIsNone(server.call_log.taken_over_by(self.call_id))
        self.assertEqual(self.doctor.post(f"/api/staff/calls/{self.call_id}/takeover").status_code, 409)

    def test_listening_needs_a_sign_in_and_the_callers_line_needs_a_real_call(self):
        anonymous = TestClient(server.app)
        self.assertEqual(anonymous.get(f"/api/staff/calls/{self.call_id}/live").status_code, 401)
        self.assertEqual(anonymous.post(f"/api/staff/calls/{self.call_id}/takeover").status_code, 401)
        self.assertEqual(anonymous.get("/api/call/0123456789abcdef/events").status_code, 404)


if __name__ == "__main__":
    unittest.main()
