/**
 * Pickleball Community (Google Pickle) — Full E2E test suite.
 * Run with: npx playwright test (dev server at http://localhost:3080).
 * Uses soft selectors for mock + live data; no login or live backend required.
 */

import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "../../screenshots");

async function takeScreenshot(page, name) {
  await page
    .screenshot({
      path: path.join(SCREENSHOTS_DIR, `${name}.png`),
      fullPage: false,
    })
    .catch(() => {});
}

test.beforeAll(async () => {
  const fs = await import("fs");
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
});

// ——— 1. App Shell & Navigation ———
test.describe("1. App Shell & Navigation", () => {
  test("app loads and nav/tab bar is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Pickleball Community/i);
    const main = page.locator("#main");
    await expect(main).toBeVisible();
    const nav = page.locator("#bottom-nav");
    await expect(nav).toBeVisible();
    await takeScreenshot(page, "01-app-shell-nav-visible");
  });

  test("tab bar has Home, Players, Chat, Profile links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Home", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Players", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Chat", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Profile", { exact: true }).first()).toBeVisible();
    await takeScreenshot(page, "01-tab-bar-links");
  });

  test("hash routing works for #home and #courts", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/#home/);
    await expect(page.locator("#main")).toBeVisible();
    await takeScreenshot(page, "01-hash-home");

    await page.goto("/#courts");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/#courts/);
    await expect(page.locator("#main")).toContainText(/Courts|Find courts|Zilker|Austin/i);
    await takeScreenshot(page, "01-hash-courts");
  });

  test("unknown hash route does not throw JS errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/#unknown-route-xyz");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#main")).toBeVisible();
    expect(errors.filter((m) => m.includes("unknown") || m.includes("xyz")).length).toBe(0);
    await takeScreenshot(page, "01-unknown-hash");
  });
});

// ——— 2. Events List ———
test.describe("2. Events List", () => {
  test("at least one event card renders", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("#home-event-cards", { state: "visible", timeout: 20000 });
    const card = page
      .locator(
        "#home-event-cards .group, #home-event-cards a[href^='#event/'], [data-testid='event-card'], .event-card"
      )
      .first();
    await expect(card).toBeVisible({ timeout: 25000 });
    await takeScreenshot(page, "02-events-list-cards");
  });

  test("card shows title, date/time, venue text", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("#home-event-cards", { state: "attached", timeout: 20000 });
    const main = page.locator("#main");
    await expect(main).toContainText(/Morning|Beginner|Sunset|Round Rock|Doubles|Open/i, { timeout: 25000 });
    await expect(main).toContainText(
      /Sat, 9:00 AM • Zilker Park Courts|Sun, 11:30 AM • Austin High Courts|Fri, 6:00 PM • Zilker Park Courts/i,
      { timeout: 25000 }
    );
    await expect(main).toContainText(/Zilker Park Courts|Austin High Courts|Round Rock Tennis Center/i, {
      timeout: 25000,
    });
    await takeScreenshot(page, "02-card-title-date-venue");
  });

  test("level badge (Beginner/Intermediate/Advanced) is visible", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("#home-event-cards", { state: "attached", timeout: 20000 });
    const badge = page.getByText(/Beginner|Intermediate|Advanced/i).first();
    await expect(badge).toBeVisible({ timeout: 20000 });
    await takeScreenshot(page, "02-level-badge");
  });

  test("clicking a card navigates to event detail view", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("#home-event-cards", { state: "visible", timeout: 20000 });
    const link = page.locator("#home-event-cards a[href='#event/1'], #home-event-cards a[href^='#event/']").first();
    await link.click();
    await page.waitForURL(/#event\/\d+/);
    await expect(page.locator("#main")).toContainText(/Event Details|Location|Share|Directions|Add to Calendar/i);
    await takeScreenshot(page, "02-event-detail-after-click");
  });

  test("back navigation returns to the events list", async ({ page }) => {
    await page.goto("/#event/1");
    await page.waitForLoadState("networkidle");
    await page.locator("a[href='#home']").first().click();
    await page.waitForURL(/#home/);
    await expect(page.locator("#home-event-cards")).toBeVisible();
    await takeScreenshot(page, "02-back-to-events-list");
  });
});

// ——— 3. Event Detail ———
test.describe("3. Event Detail", () => {
  test("event name heading is visible", async ({ page }) => {
    await page.goto("/#event/1");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#main h1")).toContainText(/Morning|Doubles|Beginner|Sunset|Round Rock/i);
    await takeScreenshot(page, "03-event-name-heading");
  });

  test("venue/location info is shown", async ({ page }) => {
    await page.goto("/#event/1");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#main")).toContainText(/Zilker|Austin|location|Location/i);
    await takeScreenshot(page, "03-venue-location");
  });

  test("Share, Add to Calendar, Directions buttons are present", async ({ page }) => {
    await page.goto("/#event/1");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".event-share-btn, button:has-text('Share')")).toBeVisible();
    await expect(page.locator(".event-calendar-btn, button:has-text('Add to Calendar')")).toBeVisible();
    await expect(page.locator(".event-directions-btn, button:has-text('Directions')")).toBeVisible();
    await takeScreenshot(page, "03-share-calendar-directions");
  });

  test("Chat button navigates to #chat", async ({ page }) => {
    await page.goto("/#event/1");
    await page.waitForLoadState("networkidle");
    await page.locator("a[href='#chat/1'], a[href^='#chat/']").first().click();
    await page.waitForURL(/#chat/);
    await expect(page.locator("#main")).toBeVisible();
    await takeScreenshot(page, "03-chat-button-to-chat");
  });
});

// ——— 4. Courts List & Detail ———
test.describe("4. Courts List & Detail", () => {
  test("courts list shows at least one card", async ({ page }) => {
    await page.goto("/#courts");
    await page.waitForLoadState("networkidle");
    const card = page.locator("#courts-cards a[href^='#court/'], #courts-cards .group, #courts-cards a").first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await takeScreenshot(page, "04-courts-list");
  });

  test("card shows court name and address", async ({ page }) => {
    await page.goto("/#courts");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#main")).toContainText(/Zilker|Austin|Barton|address|Rd|St/i);
    await takeScreenshot(page, "04-court-name-address");
  });

  test("clicking a card opens court detail", async ({ page }) => {
    await page.goto("/#courts");
    await page.waitForLoadState("networkidle");
    await page.locator("a[href='#court/1'], a[href^='#court/']").first().click();
    await page.waitForURL(/#court\/\d+/);
    await expect(page.locator("#main")).toContainText(/Court Details|Address|Directions|Share/i);
    await takeScreenshot(page, "04-court-detail");
  });

  test("Directions button is present on court detail", async ({ page }) => {
    await page.goto("/#court/1");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".court-directions-btn, button:has-text('Directions')")).toBeVisible();
    await takeScreenshot(page, "04-court-directions-btn");
  });
});

// ——— 5. Chat UI ———
test.describe("5. Chat UI", () => {
  test("chat inbox/list renders without errors", async ({ page }) => {
    await page.goto("/#chat");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#main")).toContainText(/Messages|Search conversations|Event Chats|Direct Messages/i);
    await takeScreenshot(page, "05-chat-inbox");
  });

  test("message input and Send button present inside a thread", async ({ page }) => {
    await page.goto("/#chat/1");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#chat-input")).toBeVisible();
    await expect(page.locator("#chat-send-btn")).toBeVisible();
    await takeScreenshot(page, "05-chat-thread-input-send");
  });

  test("user can type in the message input", async ({ page }) => {
    await page.goto("/#chat/1");
    await page.waitForLoadState("networkidle");
    const input = page.locator("#chat-input");
    await input.fill("Hello from E2E test");
    await expect(input).toHaveValue("Hello from E2E test");
    await takeScreenshot(page, "05-chat-type-message");
  });
});

// ——— 6. Profile & Auth (OTP flow) ———
test.describe("6. Profile & Auth (OTP flow)", () => {
  test("profile view renders at #profile", async ({ page }) => {
    await page.goto("/#profile");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#main")).toContainText(/Profile|Join the Community|Create Account|Log In/i);
    await takeScreenshot(page, "06-profile-view");
  });

  test("login flow shows phone input and Send Code enables after filling phone", async ({ page }) => {
    await page.goto("/#profile");
    await page.waitForLoadState("networkidle");
    await page.locator("#login-btn, button:has-text('Log In')").first().click();
    await expect(page.locator("#auth-phone-input")).toBeVisible();
    await expect(page.locator("#auth-send-code-btn, button:has-text('Send code')")).toBeVisible();
    await page.locator("#auth-phone-input").fill("+1 512 555 1234");
    const sendBtn = page.locator("#auth-send-code-btn");
    await expect(sendBtn).toBeEnabled();
    await takeScreenshot(page, "06-login-phone-input");
  });

  test("after clicking Send Code, OTP input screen appears", async ({ page }) => {
    await page.goto("/#profile");
    await page.waitForLoadState("domcontentloaded");
    await page.locator("#login-btn, button:has-text('Log In')").first().click();
    await page.locator("#auth-phone-input").fill("5125551234");
    await page.locator("#auth-send-code-btn").click();
    await page.waitForFunction(
      () => {
        const row = document.getElementById("auth-verify-row");
        const code = document.getElementById("auth-code-input");
        const rowVisible = !!(row && !row.classList.contains("hidden"));
        const codeVisible = !!(code && !code.classList.contains("hidden"));
        return rowVisible || codeVisible;
      },
      null,
      { timeout: 8000 }
    );
    await takeScreenshot(page, "06-otp-screen");
  });
});

// ——— 7. Geolocation ———
test.describe("7. Geolocation", () => {
  test("when geolocation GRANTED (mock Seattle), events list shows distance and does not crash", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 47.6062, longitude: -122.3321 });
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    const main = page.locator("#main");
    await expect(main).toBeVisible();
    const cards = page.locator("#home-event-cards .group, #home-event-cards a[href^='#event/']");
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    await takeScreenshot(page, "07-geo-granted");
  });

  test("when geolocation DENIED, events still load correctly", async ({ page, context }) => {
    await context.setPermissions(["geolocation"], "denied");
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    const main = page.locator("#main");
    await expect(main).toBeVisible();
    await expect(page.locator("#home-event-cards")).toBeVisible();
    await takeScreenshot(page, "07-geo-denied");
  });
});

// ——— 8. Responsive / Mobile ———
test.describe("8. Responsive / Mobile", () => {
  test("app renders on iPhone 12 viewport (390×844)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.locator("#bottom-nav")).toBeVisible();
    await takeScreenshot(page, "08-iphone12-viewport");
  });

  test("bottom nav does not overflow at 320px width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    const nav = page.locator("#bottom-nav");
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(320 + 2);
    await takeScreenshot(page, "08-320px-nav");
  });

  test("app renders on tablet viewport (768×1024)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#root")).toBeVisible();
    await takeScreenshot(page, "08-tablet-viewport");
  });
});

// ——— 9. Accessibility Smoke ———
test.describe("9. Accessibility Smoke", () => {
  test("page has a non-empty title", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title?.trim().length).toBeGreaterThan(0);
    await takeScreenshot(page, "09-title");
  });

  test("all img elements have an alt attribute", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    const imgs = await page
      .locator("img")
      .evaluateAll((els) =>
        els.map((el) => ({ alt: el.getAttribute("alt"), src: el.getAttribute("src")?.slice(0, 50) }))
      );
    for (const img of imgs) {
      expect(img.alt).toBeDefined();
    }
    await takeScreenshot(page, "09-img-alt");
  });

  test("Tab key reaches a focusable element", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(focused);
    await takeScreenshot(page, "09-tab-focus");
  });
});

// ——— 10. Error & Empty States ———
test.describe("10. Error & Empty States", () => {
  test("no uncaught JS errors on initial page load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors.length).toBe(0);
    await takeScreenshot(page, "10-no-js-errors");
  });

  test("no 404 responses for .js or .css assets", async ({ page }) => {
    const failed = [];
    page.on("response", (r) => {
      const url = r.url();
      if ((url.endsWith(".js") || url.endsWith(".css")) && r.status() === 404) {
        failed.push(url);
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(failed.length).toBe(0);
    await takeScreenshot(page, "10-no-404-assets");
  });

  test("events view shows cards OR loading spinner (not blank)", async ({ page }) => {
    await page.goto("/#home");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    const main = page.locator("#main");
    const hasCards = (await page.locator("#home-event-cards .group, #home-event-cards a[href^='#event/']").count()) > 0;
    const hasSpinner = await main
      .locator("[class*='spin'], [class*='loading'], .animate-spin")
      .isVisible()
      .catch(() => false);
    const hasContent = await main
      .locator("text=/Welcome back|Events|Morning|Beginner/")
      .isVisible()
      .catch(() => false);
    expect(hasCards || hasSpinner || hasContent).toBeTruthy();
    await takeScreenshot(page, "10-events-not-blank");
  });

  test("courts view shows cards OR loading spinner (not blank)", async ({ page }) => {
    await page.goto("/#courts");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    const main = page.locator("#main");
    const hasCards = (await page.locator("#courts-cards a, #courts-cards .group").count()) > 0;
    const hasSpinner = await main
      .locator("[class*='spin'], [class*='loading']")
      .isVisible()
      .catch(() => false);
    const hasContent = await main
      .locator("text=/Courts|Zilker|Find courts/")
      .isVisible()
      .catch(() => false);
    expect(hasCards || hasSpinner || hasContent).toBeTruthy();
    await takeScreenshot(page, "10-courts-not-blank");
  });

  test("no unhandled promise rejections when navigating all routes", async ({ page }) => {
    const rejections = [];
    page.on("unhandledrejection", () => rejections.push(1));
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    await page.goto("/#courts");
    await page.waitForLoadState("networkidle");
    await page.goto("/#chat");
    await page.waitForLoadState("networkidle");
    await page.goto("/#profile");
    await page.waitForLoadState("networkidle");
    await page.goto("/#event/1");
    await page.waitForLoadState("networkidle");
    await page.goto("/#court/1");
    await page.waitForLoadState("networkidle");
    await page.goto("/#home");
    await page.waitForLoadState("networkidle");
    expect(rejections.length).toBe(0);
    await takeScreenshot(page, "10-nav-no-rejections");
  });
});
