import { expect, test } from "@playwright/test";
import { openPage, signIn, startCallFrom } from "./helpers";

// The signed-in app: one sidebar, five pages, each with its own address. The test sign-ins
// exist only in test mode.

const live = process.env.PARCHI_E2E_LIVE === "1";

test("the sidebar reaches every page, each at its own address", async ({ page }) => {
  await signIn(page, "doctor");
  const pages = [
    ["nav-overview", /\/app\/$/, "overview"],
    ["nav-appointments", /\/app\/appointments\/$/, "token-board"],
    ["nav-test-lab", /\/app\/test-lab\/$/, "testlab-checks"],
    ["nav-settings", /\/app\/settings\/$/, "clinic-settings"],
    ["nav-calls", /\/app\/calls\/$/, "queue-emergencies"],
  ] as const;
  for (const [link, address, content] of pages) {
    await page.getByTestId(link).click();
    await expect(page).toHaveURL(address);
    await expect(page.getByTestId(link)).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId(content)).toBeVisible();
  }
});

test("the Test lab plays the brief's calls and every check passes", async ({ page }) => {
  await signIn(page, "reception");
  await openPage(page, "/app/test-lab/");
  await page.getByTestId("testlab-run-checks").click();
  if (live) await page.getByTestId("testlab-confirm-run").click();    // live models cost a few cents
  await expect(page.getByTestId("testlab-checks-summary")).toContainText("checks passed", { timeout: live ? 90_000 : 15_000 });
  if (!live) {
    await expect(page.locator('[data-passed="false"]')).toHaveCount(0);
    await expect(page.getByTestId("check-chest-pain")).toHaveAttribute("data-passed", "true");
    await expect(page.getByTestId("testlab-pass-ring")).toHaveText("100%");
  }
});

test("an emergency on Overview opens that very call on the Calls page", async ({ page }) => {
  await startCallFrom(page, "+91 90000 00051");
  await page.getByTestId("scenario-call-5").click();
  await expect(page.getByTestId("reply-1")).toBeVisible();
  await expect(page.getByTestId("call-phase")).toHaveText("Caller's turn");
  await page.getByTestId("end-call").click();

  await signIn(page, "doctor");
  await openPage(page, "/app/");
  await page.getByTestId("overview-emergencies").getByRole("button", { name: /\+91 90000 00051/ }).first().click();
  await expect(page).toHaveURL(/\/app\/calls\/\?call=[0-9a-f]{16}$/);
  await expect(page.getByTestId("transcript-turn-1")).toContainText("seene mein thoda dard");
});

test("Overview's week chart counts today's calls, and gives the same numbers as a table", async ({ page }) => {
  await startCallFrom(page, "+91 90000 00052");
  await page.getByTestId("scenario-call-1").click();
  await expect(page.getByTestId("reply-1")).toBeVisible();
  await page.getByTestId("end-call").click();

  await signIn(page, "doctor");
  await openPage(page, "/app/");
  await expect(page.getByTestId("overview-week-bars").locator("li")).toHaveCount(7);
  await expect(page.getByTestId("overview-week-bars").locator("li").last()).toHaveAttribute("aria-label", /^Today, .*: [1-9]\d* calls?, /);

  await page.getByTestId("overview-week-table").click();
  const rows = page.getByTestId("overview-week").locator("tbody tr");
  await expect(rows).toHaveCount(7);
  const counts = await rows.evaluateAll((trs) => trs.map((tr) => Number(tr.querySelector("td")?.textContent)));
  const total = Number((await page.getByTestId("overview-week-total").textContent())?.match(/\d+/)?.[0]);
  expect(counts.reduce((sum, count) => sum + count, 0)).toBe(total);
  expect(counts[6]).toBeGreaterThan(0);
});

test("the Appointments page runs the receptionist's board", async ({ page }) => {
  await page.request.post("/api/clinic", { data: { action: "reset", clinic: "general-physician" } });
  await signIn(page, "reception");
  await openPage(page, "/app/appointments/");
  await expect(page.getByTestId("waiting")).toHaveText("0");
  await page.getByTestId("board-walk-in").click();
  await expect(page.getByTestId("waiting")).toHaveText("1");
  await expect(page.getByTestId("appointments-scope")).toContainText("Treats here");
});

test("Settings show who can sign in and what the server runs with", async ({ page }) => {
  await signIn(page, "doctor");
  await openPage(page, "/app/settings/");
  await page.getByTestId("settings-tab-access").click();
  await expect(page).toHaveURL(/#access$/);
  await expect(page.getByTestId("access-doctor")).toContainText("Dr.");
  await page.getByTestId("settings-tab-system").click();
  await expect(page.getByTestId("system-mode-chip")).toHaveText(live ? "Live models" : "Offline test mode");
  await expect(page.getByTestId("settings-system")).toContainText("Model routing");
  await page.reload();                                                  // the tab is kept in the address
  await expect(page.getByTestId("settings-system")).toBeVisible();
});

test("on a phone the menu is a drawer: it opens, closes with Escape, and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "doctor");
  await page.getByTestId("app-menu").click();
  await expect(page.getByTestId("app-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("app-drawer")).toHaveCount(0);
  await page.getByTestId("app-menu").click();
  await page.getByTestId("app-drawer").getByTestId("nav-appointments").click();
  await expect(page).toHaveURL(/\/app\/appointments\/$/);
  await expect(page.getByTestId("app-drawer")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the old /dashboard/ address still leads to Calls", async ({ page }) => {
  await signIn(page, "doctor");
  await page.goto("/dashboard/");
  await expect(page).toHaveURL(/\/app\/calls\/$/);
  await expect(page.getByTestId("app-page-name")).toHaveText("Calls");
});
