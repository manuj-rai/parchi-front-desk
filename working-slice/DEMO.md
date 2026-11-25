# The 5-minute recording

Your screen and your own voice: **why this piece, it working, it failing.**

**Before you start:**
- Run `python -m parchi.server` with live models (your key in `.env`) and open <http://127.0.0.1:8765/demo/> (or start at the intro page, <http://127.0.0.1:8765>, and click **Try the live demo**).
- The header must say **Live models**.
- Click **Reset demo** at the top right.
- Wear headphones, so Parchi's voice doesn't feed back into the microphone.
- Start the recorder with **Win + Alt + R**.

The screen has three columns:
- **The caller** (left): the conversation and the talk button.
- **Inside Parchi** (middle): what happened on the turn.
- **The clinic** (right): Sunita's token board and the doctor's WhatsApp.

Say it in your own words. The quoted lines are a guide.

## 0:00 – 1:00 · Why this piece

"v1 lets software handle most calls. The riskiest part is a caller who says anything, in Hindi or Hinglish, and hangs up after two seconds of silence. If we misunderstand them, or are too slow, nothing else matters. So I built the live call: speech in, two agents, speech out."

Point at the **Model routing** table in the middle. "Two LangGraph agents run in parallel on every sentence. The front-desk agent works out what the caller wants; the safety agent only listens for danger. Each job has an ordered list of models from different providers, and if one fails the next answers. The crossed-out ones have no key here."

## 1:00 – 3:00 · It working

1. Click **Start a call**. "Parchi answers at once with its name and the doctor's status, the answer most callers want. The greeting is made in advance, so there is no wait."
2. Hold the button (or Space) and say **"Doctor sahab aa gaye kya?"** Point at the middle column. "Route: status. The answer comes from Sunita's board, not the model, so it can't invent a time."
3. On the board click **Doctor aa gaye**, then ask again. "The answer changed because the data changed."
4. Say **"Shaam ka number chahiye, naam Ramesh. Subah se seene mein thoda dard hai."** "Chest pain, in passing. The safety panel turns red: emergency. Parchi read the doctor's own sentence, stopped the booking so he isn't given a token to wait for, and the alert is on the doctor's WhatsApp, bottom right."
5. Say **"Number laga do, par is number pe message mat bhejna."** "Call 7. The token says no call, no message, and the decision shows the WhatsApp confirmation was blocked."
6. Say **"Aap robot ho kya?"** "It doesn't announce it's AI, as the founder wanted, but it never lies when asked: it says it's the clinic's AI assistant and that the doctor reviews the recording."

## 3:00 – 4:30 · It failing

7. Point at the big number and the red line. "This is the real problem. The red line is two seconds, and the answer starts after about two and a half to four. I cut it from over six: the first sentence of most replies is pre-made, and I picked each agent's model by measuring 51 test lines. What is left is speech-to-text plus the agents, about two and a half seconds together. The filler covers the first second. Streaming speech-to-text is the next fix, which is why Deepgram is first in the speech list."
8. Mumble **"haan woh… kal wala…"** "Unsure: one either-or question." Mumble again. "Still unsure, so it goes to a person, with a callback on the doctor's panel. It never asks a third time."
9. "Testing found real bugs, all fixed and tested. Four of them:
   - the sales rep was first read as a status question, which would have told him the doctor's free time, exactly call 6;
   - the transcriber writes Hindi in Devanagari, and sometimes in Urdu script, so my backup word list could miss a chest-pain call;
   - a cold start made the first caller wait seven seconds;
   - a settings error printed part of an API key."

## 4:30 – 5:00 · What it doesn't prove

"There are 44 browser tests and 167 code tests, and they run offline with stand-in models. But fourteen real urgent sentences is not three hundred. The model's reading also varies between runs. There's no real phone line, no Marathi and no noisy calls. Those are the gate before any real clinic. And I went over the two-hour build cap: the first day alone took about three hours twenty."

**If it goes wrong:** click **Reset demo** and redo that step. If you're running over five minutes, drop step 6.
