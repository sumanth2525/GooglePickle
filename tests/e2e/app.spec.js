import { test, expect } from "@playwright/test";

test.describe("App smoke – initial testing", () => {
  test("loads and shows app shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Pickleball Community/i);
    const main = page.locator("#main");
    await expect(main).toBeVisible();
  });

  test("bottom nav is visible and has Home, Players, Chat, Profile", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("#bottom-nav");
    await expect(nav).toBeVisible();
    await expect(page.getByText("Home", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Players", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Chat", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Profile", { exact: true }).first()).toBeVisible();
  });

  test("home shows Events or welcome content", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    const main = page.locator("#main");
    await expect(main).toBeVisible();
    const hasEvents = await main.locator("#home-event-cards").isVisible();
    const hasWelcome = await main.getByText("Welcome back").first().isVisible();
    expect(hasEvents || hasWelcome).toBeTruthy();
  });

  test("navigating to Courts works", async ({ page }) => {
    await page.goto("/#home");
    await page.click("a[href='#courts']");
    await page.waitForURL(/\#courts/);
    await expect(page.locator("#main")).toContainText(/Courts|Pickleball/i);
  });

  test("navigating to Chat works", async ({ page }) => {
    await page.goto("/#home");
    await page.click("a[data-nav='chat']");
    await page.waitForURL(/\#chat/);
    await expect(page.locator("#main")).toBeVisible();
  });

  test("navigating to Profile works", async ({ page }) => {
    await page.goto("/#home");
    await page.click("a[data-nav='profile']");
    await page.waitForURL(/\#profile/);
    await expect(page.locator("#main")).toContainText(/Profile|Log in|Sign/i);
  });
});
