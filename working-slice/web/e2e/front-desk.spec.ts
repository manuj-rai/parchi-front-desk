import { expect, test, type Page } from "@playwright/test";

// Each test is a moment from the brief, driven through the UI the way a person would.
// Tests marked "offline only" check exact wording from the stand-in models; the rest must
// also hold with live models, because they are about safety and truth, not phrasing.

const live = process.env.PARCHI_E2E_LIVE === "1";

// Every test starts at the general physician's clinic with the doctor expected at 11:30, so a
// test that switches clinic, or changes the time, cannot leak into the next one.
test.beforeEach(async ({ page, request }) => {
  await request.post("/api/clinic", { data: { action: "reset", clinic: "general-physician" } });
  await request.post("/api/clinic", { data: { action: "eta", eta: "11:30" } });
  await page.goto("/demo/");
  await expect(page.getByTestId("status-line")).toBeVisible();
});

// The next spec file must not find the server at another clinic.
test.afterEach(async ({ request }) => {
  await request.post("/api/clinic", { data: { action: "reset", clinic: "general-physician" } });
});

async function startCall(page: Page) {
  await page.getByTestId("start-call").click();
  await expect(page.getByTestId("greeting")).toBeVisible();
  await expectCallerTurn(page);
}

/** Waits until Parchi has finished speaking and the caller may talk again. */
async function expectCallerTurn(page: Page) {
  await expect(page.getByTestId("call-phase")).toHaveText("Caller's turn");
}

async function say(page: Page, scenarioId: string, turnNumber: number) {
  await page.getByTestId(`scenario-${scenarioId}`).click();
  await expect(page.getByTestId(`reply-${turnNumber}`)).toBeVisible();
  await expectCallerTurn(page);
}

test("the console loads, shows its mode and the token board", async ({ page }) => {
  await expect(page.getByTestId("system-mode")).toHaveText(live ? "Live models" : /Offline test mode/);
  await expect(page.getByTestId("status-line")).toContainText("11:30");
  await expect(page.getByTestId("model-routes")).toContainText("Safety agent");
});

test("call 1: the status answer comes from the board, and changes when the board does", async ({ page }) => {
  await startCall(page);
  await expect(page.getByTestId("greeting")).toContainText("main Parchi");     // it says who it is,
  await expect(page.getByTestId("greeting")).toContainText("11:30");           // the doctor's status, then listens
  await say(page, "call-1", 1);
  await expect(page.getByTestId("reply-1")).toContainText("11:30");
  await expect(page.getByTestId("route-chip")).toContainText("status");

  await page.getByTestId("board-arrived").click();
  await expect(page.getByTestId("status-line")).toContainText("clinic mein hain");
  await say(page, "call-1", 2);
  await expect(page.getByTestId("reply-2")).toContainText("clinic mein hain");
});

test("call 2: a child's fever gets the doctor's own words and is seen first", async ({ page }) => {
  await startCall(page);
  await say(page, "call-2", 1);
  await expect(page.getByTestId("route-chip")).toContainText("urgent");
  await expect(page.getByTestId("reply-1")).toContainText("Doctor sahab ke niyam");
  await expect(page.getByTestId("token-board")).toContainText("see first");
  await expect(page.getByTestId("alert-urgent").first()).toBeVisible();
});

test("call 5: chest pain inside a booking is an emergency and alerts the doctor", async ({ page }) => {
  await startCall(page);
  await say(page, "call-5", 1);
  await expect(page.getByTestId("route-chip")).toContainText("urgent");
  await expect(page.getByTestId("safety-tier")).toHaveText("Emergency");
  await expect(page.getByTestId("alert-urgent").first()).toContainText("emergency");
});

test("call 7: 'don't message me' is stored and the WhatsApp confirmation is blocked", async ({ page }) => {
  await startCall(page);
  await say(page, "call-7", 1);
  await expect(page.getByTestId("actions")).toContainText("WhatsApp confirmation blocked");
  await expect(page.getByTestId("token-board")).toContainText("no call · no message");
});

test("call 6: a sales rep is not told the doctor's time", async ({ page }) => {
  await startCall(page);
  await say(page, "call-6", 1);
  await expect(page.getByTestId("route-chip")).toContainText("handoff");
  await expect(page.getByTestId("reply-1")).not.toContainText("11:30");
});

test("asked if it is a robot, it says it is AI and that the doctor reviews the recording", async ({ page }) => {
  await startCall(page);
  await say(page, "robot", 1);
  await expect(page.getByTestId("reply-1")).toContainText("AI sahayak");
  await expect(page.getByTestId("reply-1")).toContainText("record");
});

test("the caller can type instead of speaking", async ({ page }) => {
  await startCall(page);
  await page.getByTestId("typed-line").fill("Consultation fees kitni hai?");
  await page.getByTestId("say-typed").click();
  await expect(page.getByTestId("reply-1")).toBeVisible();
  await expect(page.getByTestId("route-chip")).toContainText("info");
});

test("unsure twice: one either-or question, then a person (offline only)", async ({ page }) => {
  test.skip(live, "A live model may understand a mumble; this checks the rule, not the model.");
  await startCall(page);
  await say(page, "mumbled", 1);
  await expect(page.getByTestId("route-chip")).toContainText("clarify");
  await say(page, "mumbled", 2);
  await expect(page.getByTestId("route-chip")).toContainText("handoff");
  await expect(page.getByTestId("doctor-alerts")).toContainText("call back");
});

test("every turn shows its timing against the 2-second line and which model served it", async ({ page }) => {
  await startCall(page);
  await say(page, "call-1", 1);
  await expect(page.getByTestId("latency-total")).toHaveText(/\d+\.\d\d s/);
  await expect(page.getByTestId("latency-verdict")).toContainText("2-second limit");
  await expect(page.getByTestId("agent-readout")).toContainText(live ? "openai:" : "fake:front-desk");
});

test("the token board: walk-ins and next patient update the queue", async ({ page }) => {
  await page.getByTestId("board-walk-in").click();
  await page.getByTestId("board-walk-in").click();
  await expect(page.getByTestId("waiting")).toHaveText("2");
  await page.getByTestId("board-next").click();
  await expect(page.getByTestId("now-serving")).toHaveText("1");
  await expect(page.getByTestId("waiting")).toHaveText("1");
});

test("the doctor's time must be a real time before callers hear it", async ({ page }) => {
  const input = page.getByTestId("board-eta-input");
  await input.fill("11.30");
  await expect(page.getByTestId("board-eta-error")).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("board-eta")).toBeDisabled();

  await input.fill("12:15");
  await expect(page.getByTestId("board-eta-error")).toBeHidden();
  await page.getByTestId("board-eta").click();
  await expect(page.getByTestId("status-line")).toContainText("12:15");
});

test("reset demo clears the call and the board", async ({ page }) => {
  await startCall(page);
  await say(page, "call-7", 1);
  await page.getByTestId("reset-demo").click();
  await expect(page.getByTestId("start-call")).toHaveText("Start a call");
  await expect(page.getByTestId("token-board")).toContainText("No tokens yet");
});

// ---- what this doctor treats: no token, and no false hope, for anything else ----------------

test("a problem this doctor does not treat gets no token, and the caller is told who to see", async ({ page }) => {
  await expect(page.getByTestId("doctor-scope")).toContainText("General physician");
  await startCall(page);
  await say(page, "toothache", 1);
  await expect(page.getByTestId("route-chip")).toContainText("not_here");
  await expect(page.getByTestId("scope-verdict")).toHaveText("Not treated here");
  await expect(page.getByTestId("token-board")).toContainText("No tokens yet today");   // no token was booked
  if (!live) await expect(page.getByTestId("reply-1")).toContainText("daant ke doctor");
  await expect(page.getByTestId("reply-1")).toContainText("aspataal");         // the safety net, always
});

test("at a dentist's clinic a toothache is booked, and a child's fever is sent elsewhere", async ({ page }) => {
  await page.getByTestId("clinic-switcher").selectOption("dental");
  await expect(page.getByTestId("doctor-scope")).toContainText("Dentist");
  await expect(page.getByTestId("clinic-panel")).toContainText("Pooja's token board");
  await startCall(page);
  await expect(page.getByTestId("greeting")).toContainText("Muskaan Dental Clinic");
  await say(page, "toothache", 1);
  await expect(page.getByTestId("route-chip")).toContainText("book");
  await expect(page.getByTestId("scope-verdict")).toHaveText("Treated here");
  await say(page, "child-fever-booking", 2);
  await expect(page.getByTestId("route-chip")).toContainText("not_here");
  await expect(page.getByTestId("reply-2")).toContainText("general physician");
});

test("chest pain is an emergency even at a dentist's clinic", async ({ page }) => {
  await page.getByTestId("clinic-switcher").selectOption("dental");
  await expect(page.getByTestId("doctor-scope")).toContainText("Dentist");
  await startCall(page);
  await say(page, "call-5", 1);
  await expect(page.getByTestId("route-chip")).toContainText("urgent");
  await expect(page.getByTestId("safety-tier")).toHaveText("Emergency");
});

// ---- appointments: the caller's own token, from the book ---------------------------------------

async function callFrom(page: Page, number: string) {
  await page.getByTestId("caller-number").fill(number);
  await page.getByTestId("start-call").click();
  await expect(page.getByTestId("greeting")).toBeVisible();
  await expectCallerTurn(page);
}

async function hangUp(page: Page) {
  await page.getByTestId("end-call").click();
  await expect(page.getByTestId("start-call")).toBeVisible();
}

test("a caller books, calls back to ask their number, then cancels it", async ({ page }) => {
  await callFrom(page, "9000000041");
  await say(page, "call-7", 1);                                                // books token 1
  await expect(page.getByTestId("token-1")).toHaveAttribute("data-status", "waiting");
  await hangUp(page);

  await callFrom(page, "9000000041");
  await say(page, "my-token", 1);
  await expect(page.getByTestId("route-chip")).toContainText("my_booking");
  await expect(page.getByTestId("reply-1")).toContainText("Aapka number 1 hai");
  await say(page, "cancel", 2);
  await expect(page.getByTestId("route-chip")).toContainText("cancel");
  await expect(page.getByTestId("token-1")).toHaveAttribute("data-status", "cancelled");
});

test("the receptionist cancels a token, and next patient skips it", async ({ page }) => {
  await page.getByTestId("board-walk-in").click();
  await page.getByTestId("board-walk-in").click();
  await page.getByTestId("token-1-cancel").click();
  await expect(page.getByTestId("token-1-cancelled")).toBeVisible();
  await page.getByTestId("board-next").click();
  await expect(page.getByTestId("now-serving")).toHaveText("2");
  await expect(page.getByTestId("token-2")).toContainText("with the doctor");
});
