"""The call log: patient identity, priority, days in the clinic's time, recordings, review, retention.

    cd working-slice
    python -m unittest tests.test_call_log -v
"""

import shutil
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path

from parchi.call_log import CallLog, format_phone, normalize_phone, turn_priority


def turn(route="status", tier="none", sign=None, name=None, reply="Ji."):
    return {"route": route, "reply": reply, "actions": [], "safety": {"tier": tier, "sign": sign},
            "understanding": {"name": name}}


class Phones(unittest.TestCase):
    def test_usual_ways_of_writing_a_number_become_one(self):
        for raw in ("+91 90000 00001", "919000000001", "09000000001", "9000000001", "90000-00001"):
            self.assertEqual(normalize_phone(raw), "+919000000001", raw)

    def test_a_number_that_is_not_an_indian_mobile_is_refused(self):
        for raw in ("12345", "+1 415 555 0100", "5000000001", "+91 90000 0000", "abc"):
            with self.assertRaises(ValueError, msg=raw):
                normalize_phone(raw)

    def test_numbers_are_shown_grouped_and_withheld_ones_say_so(self):
        self.assertEqual(format_phone("+919000000001"), "+91 90000 00001")
        self.assertEqual(format_phone(None), "Number withheld")


class Priority(unittest.TestCase):
    def test_safety_comes_first_then_questions_and_callbacks(self):
        self.assertEqual(turn_priority("urgent", "emergency", "chest pain"), ("emergency", "Emergency: chest pain"))
        self.assertEqual(turn_priority("urgent", "see_today", None)[0], "see_today")
        self.assertEqual(turn_priority("medical", "none", None), ("attention", "Question for the doctor"))
        self.assertEqual(turn_priority("handoff", "none", None), ("attention", "Callback needed"))
        self.assertEqual(turn_priority("book", "none", None), ("routine", None))


class Log(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp(prefix="parchi-log-test-"))
        self.log = CallLog(self.folder, utc_offset_minutes=330)

    def tearDown(self):
        self.log.close()
        shutil.rmtree(self.folder, ignore_errors=True)

    def test_a_number_is_remembered_with_the_first_name_heard(self):
        first = self.log.start_call("a" * 16, "+919000000005")
        self.assertEqual((first["known"], first["name"]), (False, None))
        self.log.record_turn("a" * 16, "naam Ramesh", turn("book", name="Ramesh"))

        again = self.log.start_call("b" * 16, "+919000000005")
        self.assertEqual((again["known"], again["name"], again["earlier_calls"]), (True, "Ramesh", 1))
        self.assertEqual(self.log.caller("b" * 16), ("+919000000005", "Ramesh"))

    def test_another_name_on_a_known_number_shows_both(self):
        self.log.start_call("a" * 16, "+919000000005")
        self.log.record_turn("a" * 16, "naam Ramesh", turn("book", name="Ramesh"))
        self.log.start_call("b" * 16, "+919000000005")
        self.log.record_turn("b" * 16, "naam Sunil", turn("book", name="Sunil"))
        call = self.log.get_call("b" * 16)
        self.assertEqual((call["name"], call["number_name"]), ("Sunil", "Ramesh"))

    def test_a_withheld_number_still_makes_a_call(self):
        caller = self.log.start_call("c" * 16, None)
        self.assertEqual(caller["phone_display"], "Number withheld")
        self.assertIsNone(self.log.get_call("c" * 16)["phone"])

    def test_priority_rises_to_the_most_serious_turn_and_never_falls(self):
        self.log.start_call("a" * 16, None)
        self.log.record_turn("a" * 16, "fees?", turn("info"))
        self.log.record_turn("a" * 16, "seene mein dard", turn("urgent", "emergency", "chest pain"))
        self.log.record_turn("a" * 16, "theek hai", turn("status"))
        call = self.log.get_call("a" * 16)
        self.assertEqual((call["priority"], call["reason"]), ("emergency", "Emergency: chest pain"))
        self.assertEqual([t["n"] for t in call["turns"]], [1, 2, 3])

    def test_days_are_the_clinics_days_not_utc(self):
        # 20:00 UTC on 23 Nov is 01:30 on 24 Nov in India.
        late = datetime(2026, 11, 23, 20, 0, tzinfo=UTC)
        self.log.start_call("a" * 16, None, at=late)
        [call] = self.log.list_calls(days=2, now=late + timedelta(hours=1))
        self.assertEqual((call["day"], call["time"]), ("2026-11-24", "01:30"))
        self.assertEqual(self.log.today(now=late), "2026-11-24")

    def test_only_the_requested_days_are_listed(self):
        now = datetime(2026, 11, 24, 6, 0, tzinfo=UTC)
        self.log.start_call("a" * 16, None, at=now - timedelta(days=1))
        self.log.start_call("b" * 16, None, at=now - timedelta(days=5))
        self.assertEqual([c["id"] for c in self.log.list_calls(days=2, now=now)], ["a" * 16])
        self.assertEqual(len(self.log.list_calls(days=7, now=now)), 2)

    def test_a_call_is_live_until_it_ends_or_goes_quiet(self):
        self.log.start_call("a" * 16, None)
        self.assertTrue(self.log.get_call("a" * 16)["live"])
        self.log.end_call("a" * 16)
        self.assertFalse(self.log.get_call("a" * 16)["live"])
        self.log.start_call("b" * 16, None, at=datetime.now(UTC) - timedelta(minutes=20))
        self.assertFalse(self.log.get_call("b" * 16)["live"])

    def test_recordings_keep_audio_skip_silence_and_refuse_unknown_types(self):
        self.log.start_call("a" * 16, None)
        clip_id = self.log.add_clip("a" * 16, 1, 0, "caller", "audio/webm;codecs=opus", b"voice")
        self.assertIsNone(self.log.add_clip("a" * 16, 1, 1, "parchi", "audio/mpeg", b""))       # offline: silent
        self.assertIsNone(self.log.add_clip("a" * 16, 1, 2, "caller", "text/html", b"<script>"))
        path, mime, call_id = self.log.clip_file(clip_id)
        self.assertEqual((path.read_bytes(), mime, call_id), (b"voice", "audio/webm", "a" * 16))
        self.assertEqual(len(self.log.get_call("a" * 16)["clips"]), 1)
        self.assertIsNone(self.log.clip_file(9999))

    def test_the_doctors_review_and_the_audit_trail(self):
        self.log.start_call("a" * 16, None)
        self.assertTrue(self.log.review("a" * 16, "Dr. Sharma", "Called back, fine."))
        self.log.audit("doctor", "reviewed", "a" * 16)
        call = self.log.get_call("a" * 16)
        self.assertEqual((call["reviewed"], call["reviewed_by"], call["review_note"]), (True, "Dr. Sharma", "Called back, fine."))
        self.assertEqual(call["activity"][0]["action"], "reviewed")
        self.assertFalse(self.log.review("f" * 16, "Dr. Sharma", None))

    def test_reading_a_call_again_and_again_is_audited_once(self):
        self.log.start_call("a" * 16, None)
        for _ in range(3):
            self.log.audit("doctor", "opened call", "a" * 16, once_per_minutes=30)
        self.log.audit("reception", "opened call", "a" * 16, once_per_minutes=30)
        self.assertEqual([(a["who"], a["action"]) for a in self.log.get_call("a" * 16)["activity"]],
                         [("doctor", "opened call"), ("reception", "opened call")])

    def test_calls_older_than_the_retention_period_are_deleted_with_their_audio(self):
        self.log.start_call("a" * 16, None, at=datetime.now(UTC) - timedelta(days=100))
        self.log.add_clip("a" * 16, 1, 0, "caller", "audio/webm", b"old voice")
        self.log.start_call("b" * 16, None)
        self.assertEqual(self.log.purge_older_than(90), 1)
        self.assertIsNone(self.log.get_call("a" * 16))
        self.assertFalse((self.folder / "recordings" / ("a" * 16)).exists())
        self.assertIsNotNone(self.log.get_call("b" * 16))

    def test_the_log_survives_a_restart(self):
        self.log.start_call("a" * 16, "+919000000001")
        self.log.close()
        self.log = CallLog(self.folder)
        self.assertTrue(self.log.exists("a" * 16))


if __name__ == "__main__":
    unittest.main()
