"""The Test lab's checks: the brief's calls through the call graph, pass or fail.

    cd working-slice
    python -m unittest tests.test_self_test -v
"""

import os
import unittest

os.environ["PARCHI_FAKE_MODELS"] = "1"       # offline test mode: stand-in models, test sign-ins
os.environ["PARCHI_ENV"] = "test"            # a fresh temporary data folder

from fastapi.testclient import TestClient  # noqa: E402

from parchi.settings import get_settings  # noqa: E402

get_settings.cache_clear()

from parchi import fake_models, server  # noqa: E402
from parchi.auth import TEST_PASSWORDS  # noqa: E402
from parchi.clinic_profile import load_clinic  # noqa: E402
from parchi.self_test import CHECKS, run_checks, summary_line  # noqa: E402

STAND_INS = {"front_desk": fake_models.front_desk, "safety": fake_models.safety}


def signed_in(role: str = "doctor") -> TestClient:
    server.throttle.succeeded("testclient")
    client = TestClient(server.app)
    response = client.post("/api/staff/login", json={"role": role, "password": TEST_PASSWORDS[role]})
    assert response.status_code == 200, response.text
    return client


class Checks(unittest.TestCase):
    def test_every_check_passes_with_the_stand_in_models(self):
        report = run_checks(load_clinic("general-physician"), STAND_INS)
        failed = [(r["id"], r["problems"]) for r in report["results"] if not r["passed"]]
        self.assertEqual(failed, [])
        self.assertEqual(summary_line(report), f"{len(CHECKS)} of {len(CHECKS)} checks passed")

    def test_a_model_that_breaks_fails_the_checks_instead_of_crashing(self):
        def broken(*_args, **_kwargs):
            raise RuntimeError("provider down")

        report = run_checks(load_clinic("general-physician"), {"front_desk": broken, "safety": broken})
        self.assertEqual(report["total"], len(CHECKS))
        self.assertLess(report["passed"], report["total"])
        self.assertTrue(all(r["problems"] for r in report["results"] if not r["passed"]))

    def test_each_check_says_what_it_protects_and_has_an_expectation_per_line(self):
        for check in CHECKS:
            self.assertTrue(check.why.endswith("."), check.id)
            self.assertEqual(len(check.lines), len(check.expect), check.id)


class Isolation(unittest.TestCase):
    def test_a_test_run_never_writes_into_the_real_data_folder(self):
        # .env may name a data folder (PARCHI_DATA_DIR=data); in test mode it must be ignored.
        from parchi.settings import SLICE_ROOT, Settings

        settings = Settings(env="test", fake_models=True, data_dir=SLICE_ROOT / "data")
        self.assertNotEqual(settings.data_dir.resolve(), (SLICE_ROOT / "data").resolve())
        self.assertNotEqual(server.SETTINGS.data_dir.resolve(), (SLICE_ROOT / "data").resolve())


class OverHttp(unittest.TestCase):
    def test_the_checks_need_a_sign_in_and_pass_offline(self):
        self.assertEqual(TestClient(server.app).post("/api/staff/self-test").status_code, 401)
        report = signed_in("reception").post("/api/staff/self-test").json()
        self.assertEqual((report["passed"], report["total"], report["mode"]), (len(CHECKS), len(CHECKS), "offline-test"))

    def test_running_the_checks_leaves_the_real_board_alone(self):
        server.clinic.walk_in()
        before = server.clinic.snapshot()["tokens"]
        signed_in().post("/api/staff/self-test")
        self.assertEqual(server.clinic.snapshot()["tokens"], before)

    def test_the_system_view_needs_a_sign_in_and_never_shows_a_secret(self):
        self.assertEqual(TestClient(server.app).get("/api/staff/system").status_code, 401)
        system = signed_in().get("/api/staff/system").json()
        self.assertEqual(system["mode"], "offline-test")
        self.assertIsInstance(system["doctor_password_set"], bool)
        for value in system.values():
            self.assertFalse(isinstance(value, str) and value.startswith(("pbkdf2", "sk-")), value)


if __name__ == "__main__":
    unittest.main()
