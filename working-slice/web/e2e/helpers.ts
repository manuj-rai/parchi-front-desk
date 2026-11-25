import { expect, type Page } from "@playwright/test";

/** Signs in to the app, landing on Calls, with a test sign-in (doctor-test, reception-test: test mode only). */
export async function signIn(page: Page, role: "doctor" | "reception") {
  await page.goto("/app/calls/");
  await page.getByTestId(`signin-role-${role}`).check({ force: true });
  await page.getByTestId("signin-password").fill(`${role}-test`);
  await page.getByTestId("signin-submit").click();
  await expect(page.getByTestId("app-page-name")).toHaveText("Calls");   // visible at every width
}

/** Opens one of the app's pages by its address (the sidebar is a drawer on a phone). */
export async function openPage(page: Page, path: "/app/" | "/app/calls/" | "/app/appointments/" | "/app/test-lab/" | "/app/settings/") {
  await page.goto(path);
  await expect(page.getByTestId("app-page-name")).toBeVisible();
}

/** Starts a call in the console from `number`, and waits for the caller's turn. */
export async function startCallFrom(page: Page, number: string) {
  await page.goto("/demo/");
  await page.getByTestId("caller-number").fill(number);
  await page.getByTestId("start-call").click();
  await expect(page.getByTestId("call-phase")).toHaveText("Caller's turn");
}
