"""Offline test mode only: fill the call log with the brief's calls on earlier days, so the
dashboard's "Yesterday" and older days can be tried without waiting a day.

They are not made up: each goes through the real call graph (with the stand-in models) on a
separate token board, so the real board is untouched. Each is marked as a test call.
"""

import secrets
from datetime import datetime, time, timedelta

from .call_graph import build_call_graph
from .call_log import CallLog
from .clinic_state import ClinicState

# (days ago, clinic time, caller's number or None if withheld, what the caller says, turn by turn)
TEST_CALLS: list[tuple[int, str, str | None, list[str]]] = [
    (1, "09:12", "+919000000001", ["Doctor sahab aa gaye kya?"]),
    (1, "09:40", "+919000000005", ["Shaam ka number chahiye, naam Ramesh. Subah se seene mein thoda dard hai."]),
    (1, "10:05", "+919000000002", ["Mera bachcha do saal ka hai, kal raat se 102 bukhar hai. "
                                   "Abhi lana zaroori hai ya shaam tak ruk sakte hain?"]),
    (1, "17:20", "+919000000003", ["Main Verma bol raha hoon, pichle hafte aaya tha, report aa gayi kya?"]),
    (2, "09:30", "+919000000007", ["Number laga do, mujhe doctor se akele mein milna hai. Is number pe message mat bhejna."]),
    (2, "10:15", "+919000000005", ["Consultation fees kitni hai?"]),          # Ramesh again: known by his number
    (2, "11:02", None, ["haan woh... matlab... kal wala", "haan woh... matlab... kal wala"]),
    (3, "18:05", "+919000000006", ["Hello, I am a medical representative. When is the doctor free to meet?"]),
]


def add_test_calls(log: CallLog, agents: dict, now: datetime | None = None) -> int:
    """Adds the test calls. Returns how many."""
    graph = build_call_graph(ClinicState(), **agents)
    today = log.today(now)
    for days_ago, clock, phone, lines in TEST_CALLS:
        day = datetime.fromisoformat(today).date() - timedelta(days=days_ago)
        start = datetime.combine(day, time.fromisoformat(clock), log.clinic_tz)
        call_id = secrets.token_hex(8)
        caller = log.start_call(call_id, phone, at=start, test=True)
        moment = start
        for text in lines:
            moment += timedelta(seconds=12)
            _, name = log.caller(call_id)
            result = graph.invoke({"text": text, "history": [f"Caller: {text}"], "phone": phone,
                                   "caller_name": name or caller["name"]},
                                  config={"configurable": {"thread_id": call_id}})
            log.record_turn(call_id, text, result, at=moment)
        log.end_call(call_id, at=moment + timedelta(seconds=8))
    return len(TEST_CALLS)
