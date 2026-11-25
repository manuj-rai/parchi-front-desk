import { expect, test } from "@playwright/test";
import { signIn, startCallFrom } from "./helpers";

// A doctor joins a live call: two pages, the caller's console and the doctor's dashboard,
// talking through the real server.

test("listening live shows the call as it happens, without waiting for a refresh", async ({ browser }) => {
  const context = await browser.newContext();
  const caller = await context.newPage();
  const doctor = await context.newPage();

  await startCallFrom(caller, "+91 90000 00042");
  await signIn(doctor, "doctor");
  await doctor.getByRole("button", { name: /\+91 90000 00042/ }).first().click();
  await doctor.getByTestId("live-listen").click();
  await expect(doctor.getByTestId("live-status")).toHaveText("Listening");

  await caller.getByTestId("typed-line").fill("Consultation fees kitni hai?");
  await caller.getByTestId("say-typed").click();
  // The list refreshes every 10 s; this must arrive sooner, pushed by the server.
  await expect(doctor.getByTestId("transcript")).toContainText("Consultation fees", { timeout: 4_000 });
  await context.close();
});

test("a doctor takes over, talks with the caller, and hands back to Parchi", async ({ browser }) => {
  const context = await browser.newContext();
  const caller = await context.newPage();
  const doctor = await context.newPage();

  await startCallFrom(caller, "+91 90000 00041");
  await signIn(doctor, "doctor");
  await doctor.getByRole("button", { name: /\+91 90000 00041/ }).first().click();
  await doctor.getByTestId("live-takeover").click();
  await expect(doctor.getByTestId("live-handback")).toBeVisible();

  // The caller hears who is joining, and Parchi steps back.
  await expect(caller.getByTestId("staff-joined")).toContainText("Dr. Sharma");
  await expect(caller.getByTestId("conversation")).toContainText("doctor sahab se karwa rahi hoon");

  // The doctor speaks (typed, spoken for them); the caller sees and hears it.
  await doctor.getByTestId("staff-say-input").fill("Namaste, main Dr. Sharma. Bataiye, kya takleef hai?");
  await doctor.getByTestId("staff-say-send").click();
  await expect(caller.getByTestId("conversation")).toContainText("kya takleef hai?");

  // The caller answers: it reaches the doctor, not Parchi, and danger is still marked.
  await caller.getByTestId("typed-line").fill("Doctor sahab, seene mein dard hai");
  await caller.getByTestId("say-typed").click();
  await expect(doctor.getByTestId("transcript")).toContainText("seene mein dard hai");
  await expect(caller.getByTestId("reply-1")).toHaveCount(0);                      // Parchi did not answer

  // Back to Parchi, which answers the next line itself.
  await doctor.getByTestId("live-handback").click();
  await expect(caller.getByTestId("staff-joined")).toHaveCount(0);
  await expect(caller.getByTestId("conversation")).toContainText("phir se aapke saath hoon");
  await caller.getByTestId("typed-line").fill("Consultation fees kitni hai?");
  await caller.getByTestId("say-typed").click();
  await expect(caller.getByTestId("reply-1")).toBeVisible();
  await expect(doctor.getByTestId("call-activity")).toContainText("Doctor: took over the call");
  await context.close();
});
