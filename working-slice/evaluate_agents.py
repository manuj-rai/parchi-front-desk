"""Measure the two agents on real model calls. Needs an API key; costs a few cents per run.

    cd working-slice
    python evaluate_agents.py                              the models in your settings
    python evaluate_agents.py --model openai:gpt-4.1-nano  try one model for both agents

Cases are in evaluation/cases.jsonl: what a caller says, the acceptable intents, and whether
it is urgent. Lines tagged "as transcribed" are in Devanagari, as speech-to-text returns them.
Lines tagged "harmless context" contain an alarm word that should NOT raise an alarm.
Lines with "day" check the booking day the agent reads ("kal subah" is tomorrow; "kal se" is not).

Prints each case, then the measures that decide which model to route to:
intent accuracy, urgent recall, false alarms, and time. Saves a summary to evaluation/logs/.
"""

import argparse
import json
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES = HERE / "evaluation" / "cases.jsonl"
LOGS = HERE / "evaluation" / "logs"


def load_cases() -> list[dict]:
    return [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model", help="provider:model to use for both agents in this run")
    args = parser.parse_args()
    if args.model:                                   # must happen before the settings are read
        os.environ["PARCHI_MODELS_FRONT_DESK"] = os.environ["PARCHI_MODELS_SAFETY"] = args.model

    from parchi.agents import front_desk_agent, keyword_check, safety_agent, warm_up
    from parchi.call_graph import scope_of
    from parchi.clinic_profile import load_clinic
    from parchi.clinic_state import ClinicState
    from parchi.llm_router import AllModelsFailed, preload
    from parchi.settings import get_settings

    sys.stdout.reconfigure(encoding="utf-8")
    settings = get_settings()
    if settings.fake_models:
        sys.exit("Offline test mode is on (PARCHI_FAKE_MODELS=1). This script measures real models.")
    preload()
    warm_up(load_clinic(settings.clinic))            # as the server does at start-up: no cold first call

    def attempt(agent, *agent_args):
        """A model failure is a result to count, not a crash: for the safety agent it is a missed alarm."""
        try:
            return agent(*agent_args)
        except AllModelsFailed:
            return None

    rows = []
    for case in load_cases():
        start = time.perf_counter()
        with ThreadPoolExecutor(2) as pool:          # the two agents run in parallel, as in the call graph
            # Each case names its clinic (default: the one in settings), because what counts as
            # "treated here" depends on the doctor.
            profile = load_clinic(case.get("clinic", settings.clinic))
            understood = pool.submit(attempt, front_desk_agent, case["text"], profile, ClinicState(profile=profile).facts(), [])
            heard = pool.submit(attempt, safety_agent, case["text"], profile)
            front, safety = understood.result(), heard.result()
        intent = front.output.intent if front else "FAILED"
        rows.append({
            "id": case["id"], "ms": round((time.perf_counter() - start) * 1000),
            "intent": intent, "intent_ok": intent in case["intents"],
            "urgent": case["urgent"], "model_alarm": bool(safety) and safety.output.tier != "none",
            "word_alarm": keyword_check(case["text"], profile) != "none",
            "clinic": profile.id, "scope_expected": case.get("scope"),
            "scope": scope_of(front.output.model_dump() if front else None, profile)["verdict"],
            "day_expected": case.get("day"),
            "day_ok": case.get("day") is None or (bool(front) and front.output.booking_day == case["day"]),
            "no_messages_ok": case.get("no_messages") is None
                              or (bool(front) and front.output.wants_no_messages == case["no_messages"]),
            "front_desk_ms": front.ms if front else None, "safety_ms": safety.ms if safety else None,
            "failures": [name for name, served in (("front desk", front), ("safety", safety)) if served is None],
            "models": sorted({served.model for served in (front, safety) if served}),
        })
        row = rows[-1]
        alarm = row["model_alarm"] or row["word_alarm"]
        mark = "ok" if row["intent_ok"] and alarm == case["urgent"] and row["no_messages_ok"] and row["day_ok"] else "XX"
        print(f"{mark} {row['ms']:>5} ms  {row['intent']:<15} model-alarm={str(row['model_alarm']):<5} "
              f"word-alarm={str(row['word_alarm']):<5}  {case['id']}")

    summary = summarise(rows)
    print("\n" + "\n".join(f"{name:<34} {value}" for name, value in summary.items()))
    LOGS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    label = (args.model or "settings").replace(":", "_")
    (LOGS / f"{stamp}-{label}.json").write_text(json.dumps({"summary": summary, "cases": rows}, indent=1),
                                               encoding="utf-8")
    return 0


def summarise(rows: list[dict]) -> dict:
    urgent = [r for r in rows if r["urgent"]]
    scoped = [r for r in rows if r["scope_expected"]]
    calm = [r for r in rows if not r["urgent"]]
    times = sorted(r["ms"] for r in rows)
    def percent(part: int, whole: list) -> str:
        return f"{part}/{len(whole)} ({100 * part / len(whole):.0f}%)" if whole else "no cases"
    return {
        "models": ", ".join(sorted({m for r in rows for m in r["models"]})),
        "turns where a model failed": percent(sum(bool(r["failures"]) for r in rows), rows),
        "intent right": percent(sum(r["intent_ok"] for r in rows), rows),
        "'don't message me' right": percent(sum(r["no_messages_ok"] for r in rows), rows),
        "booking day right (today or tomorrow)": percent(sum(r["day_ok"] for r in rows if r["day_expected"]),
                                                         [r for r in rows if r["day_expected"]]),
        "scope right (treated here or not)": percent(sum(r["scope"] == r["scope_expected"] for r in scoped), scoped),
        "false hope: not treated, read as treated": percent(
            sum(r["scope"] == "treated" for r in scoped if r["scope_expected"] == "not_treated"),
            [r for r in scoped if r["scope_expected"] == "not_treated"]),
        "urgent caught (model or words)": percent(sum(r["model_alarm"] or r["word_alarm"] for r in urgent), urgent),
        "urgent caught by the model alone": percent(sum(r["model_alarm"] for r in urgent), urgent),
        "urgent caught by the words alone": percent(sum(r["word_alarm"] for r in urgent), urgent),
        "false alarms (model or words)": percent(sum(r["model_alarm"] or r["word_alarm"] for r in calm), calm),
        "false alarms from the model": percent(sum(r["model_alarm"] for r in calm), calm),
        "false alarms from the words": percent(sum(r["word_alarm"] for r in calm), calm),
        "agent time, median": f"{statistics.median(times)} ms",
        "  front-desk agent alone, median": f"{statistics.median(r['front_desk_ms'] for r in rows if r['front_desk_ms'])} ms",
        "  safety agent alone, median": f"{statistics.median(r['safety_ms'] for r in rows if r['safety_ms'])} ms",
        "agent time, 90th percentile": f"{times[int(0.9 * (len(times) - 1))]} ms",
    }


if __name__ == "__main__":
    sys.exit(main())
