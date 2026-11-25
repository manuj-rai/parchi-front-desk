"""The clinic's details and rules, on the staff dashboard. Behind sign-in.

    GET  /api/staff/clinic-settings            both roles: the details, every problem area, the history
    POST /api/staff/clinic-settings            doctor only: save changes (checked like a clinic file)
    POST /api/staff/clinic-settings/restore    doctor only: back to the shipped clinic file

A save takes effect from the caller's next sentence: the server rebuilds the call graph with
the new profile, and calls already under way keep their memory. Every save is audited.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from .auth import Staff
from .call_log import CallLog
from .clinic_profile import ClinicProfile, problem_areas
from .clinic_settings import ClinicDetails, ClinicSettings
from .staff_api import Guards


def clinic_settings_router(store: ClinicSettings, log: CallLog, guards: Guards, *,
                           current_clinic: Callable[[], str], apply: Callable[[ClinicProfile], None]) -> APIRouter:
    router = APIRouter(prefix="/api/staff/clinic-settings")
    signed_in, doctor, same_origin = guards.signed_in, guards.doctor, guards.same_origin

    def view(staff: Staff) -> dict:
        clinic_id = current_clinic()
        profile = store.profile(clinic_id)
        return {
            "clinic_id": clinic_id,
            "details": ClinicDetails.of(profile).model_dump(),
            "see_today_approved_by": profile.see_today.approved_by,
            "areas": [{"id": area.id, "label": area.label, "describes": area.describes, "see": area.see}
                      for area in problem_areas().values()],
            "emergency": {"signs": profile.emergency.signs, "approved_by": profile.emergency.approved_by},
            "changed_from_original": store.changed(clinic_id),
            "history": store.history(clinic_id),
            "can_edit": staff.role == "doctor",
        }

    @router.get("")
    def read(staff: Annotated[Staff, Depends(signed_in)]) -> dict:
        return view(staff)

    @router.post("", dependencies=[Depends(same_origin)])
    def save(details: ClinicDetails, staff: Annotated[Staff, Depends(doctor)]) -> dict:
        unknown = sorted(set(details.doctor.treats) - set(problem_areas()))
        if unknown:
            raise HTTPException(status_code=422, detail=f"Unknown problem areas: {', '.join(unknown)}.")
        try:
            profile = store.save(current_clinic(), details, by=staff.name)
        except ValidationError as error:     # the same checks as a clinic file; the doctor's own words only
            raise HTTPException(status_code=422, detail=error.errors()[0]["msg"]) from None
        apply(profile)
        log.audit(staff.role, "changed the clinic settings")
        return view(staff)

    @router.post("/restore", dependencies=[Depends(same_origin)])
    def restore(staff: Annotated[Staff, Depends(doctor)]) -> dict:
        apply(store.restore(current_clinic(), by=staff.name))
        log.audit(staff.role, "restored the original clinic settings")
        return view(staff)

    return router
