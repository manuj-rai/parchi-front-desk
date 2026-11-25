import { expect, test, type Page } from "@playwright/test";
import { openPage, signIn, startCallFrom } from "./helpers";

// The doctor's dashboard: sign-in, every call with the caller's number and name, the
// emergencies and needs-attention queues, the transcript, and the doctor's review.
// The test sign-ins (doctor-test, reception-test) exist only in test mode.

/** Makes a call from `number` in the console: one typed or scenario line, then hangs up. */
async function call(page: Page, number: string, say: { scenario?: string; text?: string }) {
  await startCallFrom(page, number);
  if (say.scenario) await page.getByTestId(`scenario-${say.scenario}`).click();
  if (say.text) {
    await page.getByTestId("typed-line").fill(say.text);
    await page.getByTestId("say-typed").click();
  }
  await expect(page.getByTestId("reply-1")).toBeVisible();
  await expect(page.getByTestId("call-phase")).toHaveText("Caller's turn");
  await page.getByTestId("end-call").click();
  await expect(page.getByTestId("start-call")).toBeVisible();
}

test("the call log needs a sign-in, and a wrong password is refused", async ({ page }) => {
  await page.goto("/dashboard/");
  await expect(page.getByTestId("signin-test-hint")).toBeVisible();
  await page.getByTestId("signin-password").fill("not-the-password");
  await page.getByTestId("signin-submit").click();
  await expect(page.getByTestId("signin-error")).toHaveText("That password is not right.");
});

test("a returning caller is recognised by number, and the name is on their token", async ({ page }) => {
  await call(page, "+91 90000 00012", { text: "Kal subah ka number laga do, naam Kavita" });
  await expect(page.getByTestId("caller-name")).toHaveText("Kavita");
  await expect(page.getByTestId("token-board")).toContainText("+91 90000 00012");

  await page.getByTestId("caller-number").fill("09000000012");
  await page.getByTestId("start-call").click();
  await expect(page.getByTestId("caller-name")).toHaveText("Kavita");
  await expect(page.getByTestId("caller-known")).toHaveText("Called 1 time before");
});

test("an emergency call reaches the doctor first, with its transcript, and the doctor reviews it", async ({ page }) => {
  await call(page, "+91 90000 00011", { scenario: "call-5" });
  await signIn(page, "doctor");

  const queue = page.getByTestId("queue-emergencies");
  const item = queue.getByRole("button", { name: /\+91 90000 00011/ });
  await expect(item).toContainText("Ramesh");
  await item.click();

  const detail = page.getByTestId("call-detail");
  await expect(detail.getByTestId("call-detail-priority")).toHaveText("Emergency");
  await expect(detail.getByTestId("transcript-turn-1")).toContainText("seene mein thoda dard");
  await expect(detail.getByTestId("transcript-turn-1")).toContainText("emergency");

  await page.getByTestId("review-note").fill("Called him back; he went to hospital.");
  await page.getByTestId("review-submit").click();
  await expect(page.getByTestId("review-done")).toContainText("Reviewed by Dr. Sharma");
  await expect(queue.getByRole("button", { name: /\+91 90000 00011/ })).toHaveCount(0);
  await expect(page.getByTestId("call-activity")).toContainText("Doctor: reviewed");
});

test("the receptionist can read a call but only the doctor reviews it", async ({ page }) => {
  await call(page, "+91 90000 00013", { scenario: "call-3" });
  await signIn(page, "reception");
  await page.getByRole("button", { name: /\+91 90000 00013/ }).first().click();
  await expect(page.getByTestId("transcript-turn-1")).toContainText("Verma");
  await expect(page.getByTestId("review-waiting")).toBeVisible();
  await expect(page.getByTestId("review-submit")).toHaveCount(0);
});

test("test mode adds the brief's calls on earlier days, grouped as Yesterday and before", async ({ page }) => {
  await signIn(page, "doctor");
  await openPage(page, "/app/test-lab/");
  await page.getByTestId("dashboard-add-test-calls").click();
  await expect(page.getByTestId("dashboard-notice")).toContainText("Added 8 test calls");
  await openPage(page, "/app/calls/");
  await expect(page.getByRole("heading", { name: /^Yesterday/ })).toBeVisible();
  await page.getByTestId("call-search").fill("Verma");
  await expect(page.getByTestId("call-list-empty")).toHaveCount(0);
});

test("signing out returns to the sign-in page, and the log is closed again", async ({ page }) => {
  await signIn(page, "doctor");
  await page.getByTestId("dashboard-signout").click();
  await expect(page.getByTestId("signin-submit")).toBeVisible();
  const response = await page.request.get("/api/staff/calls");
  expect(response.status()).toBe(401);
});

test("at phone width the dashboard does not scroll sideways, and a call opens as a dialog", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, "doctor");
  await openPage(page, "/app/test-lab/");
  await page.getByTestId("dashboard-add-test-calls").click();
  await expect(page.getByTestId("dashboard-notice")).toBeVisible();
  await openPage(page, "/app/calls/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByTestId("queue-emergencies").getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
