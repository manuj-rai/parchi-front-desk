# A five-minute walkthrough

The brief asks for a recording: why this piece, it working, and it failing. There is no recording. This walkthrough covers the same three points, and you can follow it yourself in about five minutes.

**Start it.** From `working-slice/`, run `run.bat offline` on Windows, or follow the quick start in [README.md](README.md). Then open <http://127.0.0.1:8765/demo/> and click **Reset demo** at the top right.

- **Offline test mode** needs no key. Stand-in models give fixed answers, so everything below works, but the timings are not real.
- **Live models:** put an OpenAI key in `.env` and run `run.bat live`. You hear Parchi speak, can talk to it yourself, and see real timings.

The screen has three columns:

- **The caller** (left): the conversation, the talk button, and the brief's calls as buttons.
- **Inside Parchi** (middle): what each agent decided, the decision, and how long each step took.
- **The clinic** (right): Sunita's token board and the doctor's WhatsApp.

## Why this piece

v1 lets software handle most calls. The riskiest part is a caller who says anything, in Hindi or Hinglish, and hangs up after two seconds of silence. If Parchi misunderstands them, or is too slow, nothing else matters. So the slice is the live call: speech in, two agents, speech out.

The **Model routing** table in the middle shows each AI job's models in order, across providers. If one fails or runs out of time, the next answers. Models crossed out have no key on this machine.

## It working

Click **Start a call**. Then click one of the brief's calls, type what the caller says, or hold the talk button (or Space) and speak.

1. **The greeting.** Parchi answers at once with its name and the doctor's status: the answer 44% of callers want. It is made in advance, so there is no wait.
2. **1 · Is the doctor in?** ("Doctor sahab aa gaye kya?"). Route: status. The answer comes from Sunita's board, not the model, so it cannot invent a time. Click **Doctor aa gaye** on the board and ask again: the answer changes because the data changed.
3. **5 · Chest pain in a booking** ("Shaam ka number chahiye, naam Ramesh. Subah se seene mein thoda dard hai."). Chest pain, mentioned in passing. The safety panel turns red: emergency. Parchi says the doctor's own sentence, stops the booking so there is no token to wait for, and the alert appears on the doctor's WhatsApp.
4. **7 · Don't message me** ("...Is number pe message mat bhejna."). The token is marked no call, no message, and the decision shows the WhatsApp confirmation blocked.
5. **Are you a robot?** Parchi does not announce that it is AI, but it never lies when asked: it says it is the clinic's AI assistant and that the doctor reviews the recording.

## It failing

6. **Speed.** The big number and the red line in the middle. With live models, answers start 2.1 to 3.9 seconds after the caller stops (median 2.7), against a 2-second limit. Pre-made first sentences and models chosen by measurement cut it from 3.8 to 6.5 seconds, but speech-to-text plus the two agents is still over 2 seconds. Streaming speech-to-text is the next fix.
7. **Mumbled** ("haan woh... matlab... kal wala"). Unsure: one either-or question. Click it again: still unsure, so the caller goes to a person, with a callback on the board. It never asks a third time.
8. **What testing caught**, each now fixed and tested: a sales rep's "when is the doctor free?" was read as a status question, which is call 6's failure; the transcriber writes Hindi in Devanagari or Urdu script, which the backup word list could not match; a cold start made the first caller wait 7.5 seconds; a settings error printed part of an API key.

## What it does not prove

167 code tests and 44 browser tests run offline with stand-in models. The live evaluation used 74 caller lines, 14 of them urgent, and fourteen is not the three hundred a real clinic needs first. The models' reading varies between runs. There is no real phone line, no Marathi and no noisy calls. And the build went over the brief's two-hour cap: the first day alone took about three hours twenty.

The staff app is at <http://127.0.0.1:8765/app/> (test sign-ins `doctor-test` and `reception-test`): every call with its transcript and recording, emergencies first, and taking over a live call.
