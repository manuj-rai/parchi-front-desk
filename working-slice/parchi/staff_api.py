"""The staff API, behind sign-in: the call log for the doctor and the receptionist.

    POST /api/staff/login                  {role, password} -> session cookie
    POST /api/staff/logout
    GET  /api/staff/me
    GET  /api/staff/accounts               which roles can sign in (public: the sign-in page needs it)
    GET  /api/staff/calls?days=14          calls, newest first, with a summary for today
    GET  /api/staff/calls/{id}             one call: transcript, recording clips, activity
    GET  /api/staff/clips/{clip_id}        one piece of a recording (audio)
    POST /api/staff/calls/{id}/review      doctor only: the final review, with an optional note
    POST /api/staff/test-calls             offline test mode only: add the brief's calls on earlier days
    POST /api/staff/self-test              the Test lab: play the brief's calls through the call graph, pass or fail
    GET  /api/staff/system                 the server's settings that are safe to show (never a key or a hash)

Both roles can read; only the doctor reviews. Every sign-in, opened call and review is audited.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .auth import COOKIE, Accounts, Role, Sessions, Staff, Throttle
from .call_log import CALL_ID, CallLog
from .security import require_same_origin


class Login(BaseModel):
    role: Role
    password: str = Field(min_length=1, max_length=200)


class Review(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class Guards:
    """The checks staff endpoints depend on, shared by the call-log and live-call routers."""

    def __init__(self, sessions: Sessions, allowed_origins: list[str]):
        def same_origin(request: Request) -> None:
            require_same_origin(request, allowed_origins)

        def signed_in(request: Request) -> Staff:
            staff = sessions.read(request.cookies.get(COOKIE))
            if staff is None:
                raise HTTPException(status_code=401, detail="Sign in to see the call log.")
            return staff

        def doctor(staff: Annotated[Staff, Depends(signed_in)]) -> Staff:
            if staff.role != "doctor":
                raise HTTPException(status_code=403, detail="Only the doctor can do this.")
            return staff

        self.same_origin, self.signed_in, self.doctor = same_origin, signed_in, doctor


def staff_router(log: CallLog, sessions: Sessions, accounts: Accounts, throttle: Throttle, guards: Guards, *,
                 secure_cookies: bool, session_hours: float, test_mode: bool,
                 add_test_calls: Callable[[], int] | None = None,
                 run_checks: Callable[[], dict] | None = None,
                 system_settings: Callable[[], dict] | None = None) -> APIRouter:
    router = APIRouter(prefix="/api/staff")
    same_origin, signed_in, doctor = guards.same_origin, guards.signed_in, guards.doctor

    # ---- signing in and out ---------------------------------------------------------------
    @router.get("/accounts")
    def available_accounts() -> dict:
        return {"roles": [{"role": role, "name": accounts.names[role]} for role in accounts.roles()],
                "test_logins": accounts.test_logins, "test_mode": test_mode}

    @router.post("/login", dependencies=[Depends(same_origin)])
    def login(body: Login, request: Request, response: Response) -> dict:
        address = request.client.host if request.client else "unknown"
        wait = throttle.wait_s(address)
        if wait:
            raise HTTPException(status_code=429, detail=f"Too many wrong passwords. Try again in {wait} seconds.",
                                headers={"Retry-After": str(wait)})
        staff = accounts.check(body.role, body.password)
        if staff is None:
            throttle.failed(address)
            raise HTTPException(status_code=401, detail="That password is not right.")
        throttle.succeeded(address)
        response.set_cookie(COOKIE, sessions.issue(staff), max_age=int(session_hours * 3600), path="/api/",
                            httponly=True, samesite="strict", secure=secure_cookies)
        log.audit(staff.role, "signed in")
        return {"role": staff.role, "name": staff.name}

    @router.post("/logout", dependencies=[Depends(same_origin)])
    def logout(request: Request, response: Response) -> dict:
        staff = sessions.read(request.cookies.get(COOKIE))
        sessions.end(request.cookies.get(COOKIE))
        response.delete_cookie(COOKIE, path="/api/", httponly=True, samesite="strict", secure=secure_cookies)
        if staff:
            log.audit(staff.role, "signed out")
        return {"signed_out": True}

    @router.get("/me")
    def me(staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        return {"role": staff.role, "name": staff.name}

    # ---- the call log ------------------------------------------------------------------------
    @router.get("/calls")
    def calls(staff: Annotated[Staff, Depends(signed_in)], days: Annotated[int, Query(ge=1, le=90)] = 14) -> dict:
        listed = log.list_calls(days=days)
        today = log.today()
        open_ = [c for c in listed if not c["reviewed"]]
        return {
            "today": today,
            "calls": listed,
            "summary": {
                "calls_today": sum(c["day"] == today for c in listed),
                "live_now": sum(c["live"] for c in listed),
                "emergencies": sum(c["priority"] in ("emergency", "see_today") for c in open_),
                "needs_attention": sum(c["priority"] == "attention" for c in open_),
                "to_review": sum(not c["live"] for c in open_),
            },
        }

    @router.get("/calls/{call_id}")
    def call(call_id: str, staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        found = log.get_call(checked_call_id(call_id))
        if found is None:
            raise HTTPException(status_code=404, detail="No such call.")
        log.audit(staff.role, "opened call", call_id, once_per_minutes=30)
        return found

    @router.get("/clips/{clip_id}")
    def clip(clip_id: int, staff: Annotated[Staff, Depends(signed_in)]) -> FileResponse:
        found = log.clip_file(clip_id)
        if found is None:
            raise HTTPException(status_code=404, detail="No such recording.")
        path, mime, _ = found
        return FileResponse(path, media_type=mime)

    @router.post("/calls/{call_id}/review", dependencies=[Depends(same_origin)])
    def review(call_id: str, body: Review, staff: Annotated[Staff, Depends(doctor)]) -> dict:
        if not log.review(checked_call_id(call_id), staff.name, (body.note or "").strip()):
            raise HTTPException(status_code=404, detail="No such call.")
        log.audit(staff.role, "reviewed", call_id)
        return log.get_call(call_id)

    @router.post("/test-calls", dependencies=[Depends(same_origin)])
    def test_calls(staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        if add_test_calls is None:
            raise HTTPException(status_code=404, detail="Test calls exist only in offline test mode.")
        added = add_test_calls()
        log.audit(staff.role, f"added {added} test calls")
        return {"added": added}

    @router.post("/self-test", dependencies=[Depends(same_origin)])
    def self_test(staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        if run_checks is None:
            raise HTTPException(status_code=404, detail="Checks are not available on this server.")
        report = run_checks()
        log.audit(staff.role, f"ran the checks: {report['passed']} of {report['total']} passed")
        return report

    @router.get("/system")
    def system(staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        return system_settings() if system_settings else {}

    return router


def checked_call_id(call_id: str) -> str:
    if not CALL_ID.fullmatch(call_id):
        raise HTTPException(status_code=404, detail="No such call.")
    return call_id
