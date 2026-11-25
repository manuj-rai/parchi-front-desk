# Parchi front desk UI

The UI for the working slice: Next.js, React, TypeScript and Tailwind. It is built to static files in `out/`, which the Python server serves: the intro page at <http://127.0.0.1:8765> and the console at <http://127.0.0.1:8765/demo/>. See [../README.md](../README.md) for the whole slice.

| Command | What it does |
| --- | --- |
| `npm install` | Install once |
| `npm run build` | Build to `out/`; the Python server then shows the new UI |
| `npm run dev` | Live-reloading UI at <http://localhost:3000>; needs `python -m parchi.server` running |
| `npm run lint` · `npm run typecheck` | Code checks |
| `npm run test:e2e` | Build, then 44 browser tests in offline test mode (no key, no cost) |
| `npm run test:e2e:live` | The same tests against live models from `../.env` |
| `npm run test:e2e:report` | Open the last test report |

## Layout of `src/`

```
app/            layout (fonts), page.tsx (the intro page, /), demo/page.tsx (the call simulator, /demo/),
                app/ (the staff app: layout.tsx signs in once for every page; /app/, calls/, appointments/,
                test-lab/, settings/), dashboard/page.tsx (the old address: leads to /app/calls/),
                globals.css (the design tokens)
components/
  landing/      the intro page: hero, the brief's figures, how a call works, the staff app, measured results
  console/      FrontDeskConsole (the three columns), ConsoleHeader
  call/         the caller's column: conversation, talk button, typed line, the brief's calls
  trace/        the middle column: latency against 2 s, the two agents, decision, model routing
  clinic/       the clinic's column: token board, token slips, doctor's WhatsApp
  app/          the app's shell: sidebar (a drawer on a phone), top bar, page header, sign-in state for every page
  overview/     Overview: today's figures, the two queues, the board, the latest calls
  dashboard/    Calls: sign-in, emergencies and needs-attention queues, calls by day, one call in full, live take-over
  appointments/ Appointments: the token board as a page
  testlab/      Test lab: "Run all checks", test data, the embedded call simulator
  settings/     Settings: clinic (edited by the doctor), access and security, system
  ui/           Panel, Button, Chip
hooks/          useFrontDesk (the simulator's state), useStaff (the app's sign-in and call log), useBoard,
                useSystemSettings, usePushToTalk (the microphone), and others
scripts/        flatten-segments.mjs: after next build, names each page's navigation data as the browser
                asks for it, so moving between the app's pages is instant, not a full page load
lib/            api client, API types, labels and colour tones, audio playback, test sentences
e2e/            Playwright browser tests
```

**Design tokens** (`app/globals.css`): one palette for both pages. Surfaces `lilac`, `haze`, `frost`, `mist`; text `night` (with `-soft`, `-faint`, `-ghost`); the accent `iris` and `orchid` (its gradient); and three colours that carry meaning only: `stamp` (danger and the 2-second line), `wall` (within limit), `haldi` (unsure). Every text colour passes WCAG AA. Use these, not raw colours.
