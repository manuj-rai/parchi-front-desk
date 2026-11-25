import { expect, test, type Page } from "@playwright/test";

// The intro page at / is the way into the console at /demo/. These tests check the way in,
// the way back, and that both pages work at phone width.

/** True when the page is no wider than the window: nothing to scroll sideways. */
async function fitsTheWindow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

test("the intro page opens the live console", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Even In The Morning Rush");
  await expect(page.getByTestId("latency-card")).toContainText("2 s limit");
  await page.getByTestId("hero-demo-link").click();
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page.getByTestId("status-line")).toBeVisible();
});

test("the console links back to the intro page", async ({ page }) => {
  await page.goto("/demo/");
  await page.getByTestId("console-home-link").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("at phone width neither page scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByTestId("hero-demo-link")).toBeVisible();
  expect(await fitsTheWindow(page)).toBe(true);

  await page.goto("/demo/");
  await expect(page.getByTestId("status-line")).toBeVisible();
  await expect(page.getByTestId("push-to-talk")).toBeVisible();
  expect(await fitsTheWindow(page)).toBe(true);
});

test("the landing page's 'Open the app' leads to staff sign-in", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hero-app-link").click();
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByTestId("signin-submit")).toBeVisible();
});

test("the menu stays at the top while scrolling, and the footer leads to the staff app", async ({ page }) => {
  await page.goto("/");
  const footerLink = page.getByTestId("footer-dashboard-link");
  await footerLink.scrollIntoViewIfNeeded();
  await expect(page.getByTestId("nav-signin")).toBeInViewport();
  await footerLink.click();
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByTestId("signin-submit")).toBeVisible();
});
