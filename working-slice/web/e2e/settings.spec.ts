import { expect, test } from "@playwright/test";
import { openPage, signIn } from "./helpers";

// The doctor's clinic settings, in the app's Settings page: what callers hear changes when the doctor
// saves, only the doctor can save, and the original can be restored.

test.beforeEach(async ({ request }) => {
  await request.post("/api/clinic", { data: { action: "reset", clinic: "general-physician" } });
});

// A failed test must not leave its changes for the next one: back to the clinic file.
test.afterEach(async ({ page }) => {
  await page.request.post("/api/staff/clinic-settings/restore");
});

test("the doctor changes the fees, and the next caller hears the new fees", async ({ page }) => {
  await signIn(page, "doctor");
  await openPage(page, "/app/settings/");
  await expect(page.getByTestId("settings-save")).toBeDisabled();             // nothing changed yet

  await page.getByTestId("settings-fees").fill("Consultation 450 rupees.");
  await page.getByTestId("settings-save").click();
  await expect(page.getByTestId("settings-notice")).toContainText("Saved");
  await expect(page.getByTestId("settings-history")).toContainText("changed fees");

  await page.goto("/demo/");
  await page.getByTestId("start-call").click();
  await expect(page.getByTestId("call-phase")).toHaveText("Caller's turn");
  await page.getByTestId("scenario-fees").click();
  await expect(page.getByTestId("reply-1")).toContainText("450");

  // Back to the shipped details, from the same page.
  await openPage(page, "/app/settings/");
  await page.getByTestId("settings-restore").click();
  await expect(page.getByTestId("settings-notice")).toContainText("Restored");
  await expect(page.getByTestId("settings-fees")).not.toHaveValue("Consultation 450 rupees.");
});

test("a clinic must treat something, and a malformed start time cannot be saved", async ({ page }) => {
  await signIn(page, "doctor");
  await openPage(page, "/app/settings/");
  const treats = page.getByTestId("settings-treats").locator("input[type=checkbox]:checked");
  await expect(treats.first()).toBeChecked();          // the settings have loaded: count() does not wait
  while ((await treats.count()) > 0) await treats.first().uncheck();
  await expect(page.getByTestId("treats-none")).toBeVisible();
  await expect(page.getByTestId("settings-save")).toBeDisabled();
  await page.getByTestId("settings-discard").click();
  await expect(page.getByTestId("treats-none")).toHaveCount(0);

  await page.getByTestId("settings-start").fill("9.30");
  await expect(page.getByTestId("settings-save")).toBeDisabled();
  await page.getByTestId("settings-discard").click();
});

test("the receptionist can read the settings but not change them", async ({ page }) => {
  await signIn(page, "reception");
  await openPage(page, "/app/settings/");
  await expect(page.getByTestId("settings-read-only")).toBeVisible();
  await expect(page.getByTestId("settings-fees")).toBeDisabled();
  await expect(page.getByTestId("settings-save")).toHaveCount(0);
  await expect(page.getByTestId("settings-emergency")).toContainText("hospital");
});

test("the doctor marks a closed day, and it is kept", async ({ page }) => {
  await signIn(page, "doctor");
  await openPage(page, "/app/settings/");
  await page.getByTestId("settings-closed-days").getByText("Sat").click();
  await page.getByTestId("settings-save").click();
  await expect(page.getByTestId("settings-history")).toContainText("days closed");
  await page.reload();
  await expect(page.getByTestId("closed-saturday")).toBeChecked();
});
