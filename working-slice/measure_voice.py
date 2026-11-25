"""Measure a real spoken call end to end: how long until the caller hears the answer start.

Start the server with live models first, then run this in a second terminal:

    cd working-slice
    python -m parchi.server
    python measure_voice.py            (needs an OpenAI key; costs a few cents)

Each caller line is turned into speech audio once (saved in evaluation/audio/, so later runs
reuse it), sent to the server exactly as the browser sends a recording, and timed.
Results are printed and saved to evaluation/logs/.
"""

import json
import statistics
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIO = HERE / "evaluation" / "audio"
LOGS = HERE / "evaluation" / "logs"
LINES = [  # (file name, what the caller says)
    ("status", "Doctor sahab aa gaye kya?"),
    ("book", "Kal subah ka number laga do."),
    ("fees", "Consultation fees kitni hai?"),
    ("chest-pain", "Shaam ka number chahiye, naam Ramesh. Subah se seene mein thoda dard hai."),
    ("robot", "Aap robot ho kya?"),
    ("dont-message", "Number laga do, par is number pe message mat bhejna."),
]


def caller_audio(name: str, text: str) -> bytes:
    """An older man from Indore saying the line. Made once with text-to-speech, then reused."""
    path = AUDIO / f"{name}.mp3"
    if not path.exists():
        from openai import OpenAI
        from parchi.settings import get_settings
        key = get_settings().openai_api_key
        client = OpenAI(api_key=key.get_secret_value() if key else None)
        speech = client.audio.speech.create(model="gpt-4o-mini-tts", voice="ash", input=text, response_format="mp3",
                                            instructions="An older man from Indore, speaking Hindi casually on the phone.")
        AUDIO.mkdir(parents=True, exist_ok=True)
        path.write_bytes(speech.read())
    return path.read_bytes()


def post(url: str, body: bytes, content_type: str) -> dict:
    request = urllib.request.Request(url, data=body, headers={"Content-Type": content_type}, method="POST")
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read())


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
    system = json.loads(urllib.request.urlopen(f"{base}/api/system", timeout=10).read())
    if system["mode"] != "live":
        sys.exit("The server is in offline test mode. Start it with live models to measure real timings.")
    post(f"{base}/api/clinic", json.dumps({"action": "reset"}).encode(), "application/json")
    call_id = post(f"{base}/api/call/start", b"", "application/json")["call_id"]

    rows = []
    print(f"{'line':<14}{'heard':<6}{'stt':>7}{'agents':>8}{'tts':>7}{'FIRST SOUND':>13}  route")
    for name, text in LINES:
        audio = caller_audio(name, text)
        start = time.perf_counter()
        turn = post(f"{base}/api/call/{call_id}/speech", audio, "audio/mpeg")
        wall = round((time.perf_counter() - start) * 1000)
        t = turn["timings_ms"]
        rows.append({"line": name, "transcript": turn["transcript"], "route": turn["route"], "wall_ms": wall, **t})
        verdict = "ok " if t["first_sound"] <= system["silence_limit_s"] * 1000 else "OVER"
        print(f"{name:<14}{'':<6}{t['speech_to_text']:>7}{t['agents']:>8}{t['text_to_speech']:>7}"
              f"{t['first_sound']:>9} {verdict}  {turn['route']}")

    firsts = [r["first_sound"] for r in rows]
    within = sum(f <= system["silence_limit_s"] * 1000 for f in firsts)
    print(f"\nfirst sound: median {statistics.median(firsts):.0f} ms, worst {max(firsts)} ms, "
          f"within {system['silence_limit_s']} s: {within}/{len(firsts)}")
    LOGS.mkdir(parents=True, exist_ok=True)
    (LOGS / f"{datetime.now():%Y%m%d-%H%M}-voice.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False),
                                                                     encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
