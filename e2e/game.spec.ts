import { expect, test, type Page } from "@playwright/test";
import { mockProfile } from "./fixtures";

interface DebugState {
  phase: string;
  status: string;
  score: number;
  kills: number;
  shotsFired: number;
  x: number;
  time: number;
  sector: number;
}

async function state(page: Page): Promise<DebugState> {
  return page.evaluate(() => {
    const handle = (window as unknown as { __GITARCADE__: { engine: any; store: any } }).__GITARCADE__; // eslint-disable-line @typescript-eslint/no-explicit-any
    const e = handle.engine;
    return {
      phase: handle.store.getState().phase,
      status: e.status,
      score: e.stats.score,
      kills: e.stats.kills,
      shotsFired: e.stats.shotsFired,
      x: e.player.x,
      time: e.stats.time,
      sector: e.sectorIndex,
    };
  });
}

const root = (page: Page) => page.getByTestId("game-root");

test.beforeEach(async ({ page }) => {
  await page.route("**/api/github/contributions**", async (route) => {
    const username = new URL(route.request().url()).searchParams.get("username") ?? "";
    if (username === "ghost-user") {
      await route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "We couldn't find that GitHub user. Check the spelling, or try the demo." } } });
      return;
    }
    await route.fulfill({ json: mockProfile(username) });
  });
});

test("landing page validates input", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Space Shooter");
  await page.getByRole("button", { name: "Generate game" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter a GitHub username" })).toBeVisible();
  await page.getByLabel("GitHub username or profile URL").fill("https://github.com/octocat/hello-world");
  await page.getByRole("button", { name: "Generate game" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "repository" })).toBeVisible();
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("heading", { name: "How to play" })).toBeVisible();
});

test("unknown user shows a friendly error with a demo fallback", async ({ page }) => {
  await page.goto("/play/ghost-user");
  await expect(page.getByRole("alert").filter({ hasText: "Signal lost" })).toContainText("couldn't find that GitHub user");
  await page.getByRole("link", { name: "Play demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("SIMULATED DATA").first()).toBeVisible();
});

test("full session: generate, play, pause, restart, game over, share", async ({ page }) => {
  // 1-3. Landing page, enter a profile URL, generate the game.
  await page.goto("/");
  await page.getByLabel("GitHub username or profile URL").fill("https://github.com/octo-tester");
  await page.getByRole("button", { name: "Generate game" }).click();
  await expect(page).toHaveURL(/\/play\/octo-tester$/);

  // 4. Battlefield loads with the briefing over the contribution graph.
  await expect(root(page)).toHaveAttribute("data-phase", "INTRO");
  await expect(page.getByRole("heading", { name: "@octo-tester" })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();

  // 5. Start the game (skip the intro animation to keep the test short).
  await page.getByRole("button", { name: "Launch" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "PLAYING");
  const start = await state(page);
  expect(start.status).toBe("running");

  // 6. Move the spaceship.
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await state(page)).x).toBeGreaterThan(start.x + 1);
  await page.keyboard.up("ArrowRight");

  // 7. Fire projectiles.
  await page.keyboard.down("Space");
  await expect.poll(async () => (await state(page)).shotsFired).toBeGreaterThan(0);

  // 8. Destroy enemies: sweep under the formation while firing.
  let direction = "ArrowLeft";
  await expect
    .poll(
      async () => {
        await page.keyboard.down(direction);
        await page.waitForTimeout(900);
        await page.keyboard.up(direction);
        direction = direction === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
        return (await state(page)).kills;
      },
      { timeout: 90_000, intervals: [100] },
    )
    .toBeGreaterThan(0);
  await page.keyboard.up("Space");
  expect((await state(page)).score).toBeGreaterThan(0);

  // 9. Pause stops the simulation; resume continues it.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  const paused = (await state(page)).time;
  await page.waitForTimeout(700);
  expect((await state(page)).time).toBe(paused);
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "PLAYING");
  await expect.poll(async () => (await state(page)).time).toBeGreaterThan(paused);

  // 10. Restart resets the run without refetching GitHub data.
  let apiCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/github/contributions")) apiCalls++;
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Restart run" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "PLAYING");
  const restarted = await state(page);
  expect(restarted.kills).toBe(0);
  expect(restarted.score).toBe(0);
  expect(restarted.sector).toBe(0);

  // 11. Reach game over (debug helper removes the remaining lives).
  await page.evaluate(() => (window as unknown as { __GITARCADE__: { engine: { debugKillPlayer(): void } } }).__GITARCADE__.engine.debugKillPlayer());
  await expect(page.getByRole("dialog", { name: "Game Over" })).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-phase", "GAME_OVER");

  // 12. Share result: card preview, copy text, download image.
  await page.getByRole("button", { name: "Share result" }).click();
  await expect(page.getByTestId("share-panel")).toBeVisible();
  await page.getByRole("button", { name: "Copy text" }).click();
  await expect(page.getByText("Result text copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("@octo-tester");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image" }).click();
  expect((await download).suggestedFilename()).toBe("gitarcade-octo-tester.png");

  // Play again from the result screen, still without refetching.
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "PLAYING");
  expect(apiCalls).toBe(0);
});

test("touch layout shows on-screen controls", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/demo");
  await page.getByRole("button", { name: "Launch" }).tap();
  await page.getByRole("button", { name: "Skip intro" }).tap();
  await expect(root(page)).toHaveAttribute("data-phase", "PLAYING");
  await expect(page.getByRole("button", { name: "Fire laser (hold)" })).toBeVisible();
  await expect(page.getByRole("application", { name: /Virtual joystick/ })).toBeVisible();
  const fire = page.getByRole("button", { name: "Fire laser (hold)" });
  await fire.dispatchEvent("pointerdown", { pointerId: 1 });
  await expect.poll(async () => (await state(page)).shotsFired).toBeGreaterThan(0);
  await fire.dispatchEvent("pointerup", { pointerId: 1 });
  await page.getByRole("button", { name: "Pause game" }).tap();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await context.close();
});
