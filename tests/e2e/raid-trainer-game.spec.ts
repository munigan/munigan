import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.setTimeout(180_000);
async function begin(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: new Date("2026-09-10T16:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-10T16:00:01Z"));
  await page.goto("/raid-trainer");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /Start game/ }).click();
  await page.clock.runFor(150);
}
const clock = (page: Page) => page.locator(".rt-live-clock strong");
async function capture(page: Page, name: string) {
  await mkdir(".cache/raid-trainer/verified", { recursive: true });
  await page.screenshot({ path: `.cache/raid-trainer/verified/${name}.png` });
}

test("countdown, frozen pause/resume, failure, event replay and practicing the recorded cast", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page);
  await expect(page.getByLabel("Pull in 3", { exact: true })).toBeVisible();
  expect(
    await page
      .locator(".rt-game")
      .evaluate(
        (el) => document.elementFromPoint(80, 40)?.closest(".rt-game") === el,
      ),
  ).toBe(true);
  await capture(page, "countdown");
  await page.keyboard.press("Escape");
  await page.clock.runFor(150);
  await expect(
    page.getByRole("heading", { name: "Master Defile." }),
  ).toBeVisible();
  expect(await page.locator(".rt-ready-panel").boundingBox()).toMatchObject({
    x: 448,
    y: 230,
    width: 544,
  });
  await expect(
    page.getByRole("group", { name: "Coaching mode" }),
  ).toBeVisible();
  await capture(page, "ready");
  await page.getByRole("button", { name: /Start pull/ }).click();
  await page.clock.runFor(7000);
  await expect(page.locator(".rt-instruction")).toContainText(
    "Find your escape route",
  );
  await capture(page, "anticipate");
  const pausedAt = await clock(page).textContent();
  await page.locator("canvas").press("Space");
  await page.clock.runFor(100);
  await expect(
    page.getByRole("dialog", { name: "Take a breath." }),
  ).toBeVisible();
  expect(await page.locator(".rt-pause-panel").boundingBox()).toMatchObject({
    x: 456,
    y: 272,
    width: 528,
  });
  await expect(page.locator(".rt-instruction")).toHaveCount(0);
  await capture(page, "paused");
  await page.clock.runFor(4000);
  await expect(clock(page)).toHaveText(pausedAt!);
  await page.getByRole("button", { name: /Resume pull/ }).click();
  await page.clock.runFor(1800);
  await expect(clock(page)).toHaveText(pausedAt!);
  await page.clock.runFor(5500);
  await expect(page.locator(".rt-instruction")).toContainText(
    "Move away from the raid",
  );
  const cast = page.locator(".rt-dbm-timer.is-cast");
  await expect(cast).toBeVisible();
  const geometry = await cast.evaluate((el) => {
    const bar = el.querySelector(".rt-dbm-bar")!.getBoundingClientRect(),
      icon = el.querySelector("img")!.getBoundingClientRect();
    return {
      joined: Math.abs(bar.left - icon.right) < 1,
      equal: Math.abs(bar.height - icon.height) < 1,
      shadow: getComputedStyle(el).boxShadow,
      textLayer: getComputedStyle(el.querySelector("strong")!).zIndex,
      textPosition: getComputedStyle(el.querySelector("strong")!).position,
    };
  });
  expect(geometry).toEqual({
    joined: true,
    equal: true,
    shadow: "none",
    textLayer: "1",
    textPosition: "relative",
  });
  await expect(cast).toContainText("Defile on you");
  expect(await page.locator(".rt-arena-scene").boundingBox()).toEqual({
    x: 300,
    y: 24,
    width: 840,
    height: 840,
  });
  expect(await page.locator(".rt-instruction").boundingBox()).toMatchObject({
    x: 494,
    y: 102,
    width: 452,
  });
  expect(await page.locator(".rt-boss-timers").boundingBox()).toMatchObject({
    x: 1096,
    y: 320,
    width: 304,
  });
  await capture(page, "targeted");
  await page.clock.runFor(3900);
  await expect(page.locator(".rt-instruction")).toContainText(
    "Get out of the pool",
  );
  await capture(page, "missed");
  await page.clock.runFor(6000);
  await expect(
    page.getByRole("heading", { name: "Defile caught you." }),
  ).toBeVisible();
  await expect(page.locator(".rt-result-stats")).toContainText("6");
  await expect(page.locator(".rt-cast-row:disabled")).toHaveCount(2);
  expect(await page.locator(".rt-result-summary").boundingBox()).toMatchObject({
    x: 40,
    y: 224,
    width: 312,
  });
  expect(await page.locator(".rt-cast-review").boundingBox()).toMatchObject({
    x: 1096,
    y: 288,
    width: 304,
  });
  await capture(page, "failure");
  await page.getByRole("button", { name: "Review first mistake" }).click();
  await page.clock.runFor(100);
  const slider = page.getByRole("slider", { name: "Replay timeline" });
  expect(Number(await slider.inputValue())).toBeCloseTo(10, 0);
  await expect(
    page.getByRole("button", { name: "Replay sound off" }),
  ).toBeVisible();
  const transport = await page.locator(".rt-replay-transport").boundingBox();
  expect(transport).toEqual({ x: 360, y: 748, width: 720, height: 142 });
  const controls = await page
    .locator(".rt-replay-transport")
    .evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      play: getComputedStyle(el.querySelector(".rt-white")!).backgroundColor,
      divider: getComputedStyle(el.querySelector(".rt-replay-buttons")!)
        .borderTopWidth,
      timeline: el.querySelector("svg")!.getBoundingClientRect().height,
    }));
  expect(controls).toEqual({
    background: "rgb(23, 25, 29)",
    play: "rgb(236, 241, 244)",
    divider: "0px",
    timeline: 40,
  });
  await capture(page, "replay");
  await page.getByRole("button", { name: "2×", exact: true }).click();
  await page.getByRole("button", { name: /^Play/ }).click();
  await page.clock.runFor(1000);
  expect(Number(await slider.inputValue())).toBeGreaterThan(11.8);
  await slider.fill("9");
  await page.clock.runFor(200);
  const sought = await slider.inputValue();
  await page.clock.runFor(1000);
  await expect(slider).toHaveValue(sought);
  await page.getByRole("button", { name: /^Play/ }).click();
  await page.clock.runFor(6000);
  await expect(
    page.getByRole("button", { name: /Replay again/ }),
  ).toBeVisible();
  expect(Number(await slider.inputValue())).toBeCloseTo(
    Number(await slider.getAttribute("max")),
    1,
  );
  await capture(page, "replay-ended");
  await page.getByRole("button", { name: "Practice cast 1" }).click();
  await page.clock.runFor(100);
  await expect(clock(page)).toHaveText("00:06");
  await expect(page.locator(".rt-instruction")).toContainText(
    "Same cast · same setup",
  );
  await page.clock.runFor(1500);
  await expect(clock(page)).toHaveText("00:06");
  await page.clock.runFor(1800);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.runFor(100);
  await expect(
    page.getByRole("heading", { name: "Paused when you switched tabs." }),
  ).toBeVisible();
  await capture(page, "focus-lost");
  await page.getByRole("button", { name: "Exit focus" }).click();
  await expect(page.getByRole("button", { name: /Start game/ })).toBeFocused();
  expect(errors).toEqual([]);
});

test("recovery, clean completion, timers-only cues and clean replay", async ({
  page,
}) => {
  await begin(page);
  // Move clear after the first damaging tick, then inspect the recovery feedback.
  await page.clock.runFor(15100);
  await page.keyboard.down("d");
  await page.clock.runFor(1100);
  await page.keyboard.up("d");
  await expect(page.locator(".rt-instruction")).toContainText("You’re clear");
  await capture(page, "recovered");
  await page.keyboard.down("w");
  await page.clock.runFor(3500);
  await page.keyboard.up("w");
  await page.clock.runFor(25000);
  await page.keyboard.down("a");
  await page.clock.runFor(5000);
  await page.keyboard.up("a");
  await page.clock.runFor(11000);
  await expect(
    page.getByRole("heading", { name: "Finished. Now refine it." }),
  ).toBeVisible();
  await capture(page, "imperfect-completion");
  await page.locator("canvas").press("KeyR");
  await page.clock.runFor(100);
  // A complete clean pull, with movement continuing beyond both pool placements.
  await page.clock.runFor(7300);
  await page.keyboard.down("d");
  await page.clock.runFor(1500);
  await page.keyboard.up("d");
  await page.clock.runFor(2300);
  await page.keyboard.down("w");
  await page.clock.runFor(4000);
  await page.keyboard.up("w");
  await page.clock.runFor(15300);
  await expect(page.locator(".rt-instruction")).toContainText(
    "You are not the target",
  );
  await capture(page, "ally-targeted");
  await page.clock.runFor(14200);
  await page.keyboard.down("a");
  await page.clock.runFor(5000);
  await page.keyboard.up("a");
  await page.clock.runFor(12300);
  await expect(
    page.getByRole("heading", { name: "Clean pull." }),
  ).toBeVisible();
  await expect(page.locator(".rt-cast-row")).toHaveCount(3);
  await expect(page.locator(".rt-result-stats")).toHaveText(
    "Your ticks0Raid ticks0Growth+0",
  );
  await capture(page, "clean");
  for (const index of [1, 2]) {
    await page.locator(".rt-cast-row").nth(index).click();
    await page.clock.runFor(100);
    await expect(
      page.getByRole("button", { name: `Practice cast ${index + 1}` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to results" }).click();
  }
  await page
    .locator(".rt-game-dock")
    .getByRole("button", { name: /^Replay/ })
    .click();
  await page.clock.runFor(100);
  await expect(page.locator(".rt-replay-summary")).toContainText("No damage");
  await capture(page, "replay-clean");
  await page.getByRole("button", { name: "Back to results" }).click();
  await page.getByRole("button", { name: "Try Timers only" }).click();
  await page.clock.runFor(7000);
  await expect(page.locator(".rt-instruction")).toHaveCount(0);
  await page.clock.runFor(4300);
  await expect(page.locator(".rt-instruction")).toContainText(
    "Move away from the raid",
  );
});

test("mobile controls, guide, sound options and results remain reachable", async ({
  page,
}) => {
  await begin(page, 390);
  await page.clock.runFor(3100);
  await expect(
    page.getByRole("button", { name: "Move right", exact: true }),
  ).toBeInViewport();
  const playerX = () =>
    page.locator("canvas").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0,
        count = 0;
      for (
        let i = canvas.width * Math.floor(canvas.height * 0.5) * 4;
        i < pixels.length;
        i += 4
      ) {
        if (
          pixels[i] === 156 &&
          pixels[i + 1] === 214 &&
          pixels[i + 2] === 240
        ) {
          sum += (i / 4) % canvas.width;
          count++;
        }
      }
      return { x: sum / count, count };
    });
  const before = await playerX();
  const right = await page
    .getByRole("button", { name: "Move right", exact: true })
    .boundingBox();
  await page.mouse.move(
    right!.x + right!.width / 2,
    right!.y + right!.height / 2,
  );
  await page.mouse.down();
  await page.clock.runFor(700);
  await page.mouse.up();
  const after = await playerX();
  expect(before.count).toBeGreaterThan(20);
  expect(after.x - before.x).toBeGreaterThan(75);
  await capture(page, "mobile-live");
  expect(
    await page
      .locator(".rt-game")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: /Mechanic guide/ }).click();
  await page.getByRole("button", { name: "Close mechanic guide" }).focus();
  await page.keyboard.press("KeyR");
  await page.clock.runFor(3300);
  await expect(page.locator(".rt-game")).toHaveClass(/is-paused/);
  await page.getByText("Sound studio", { exact: true }).click();
  await page.getByRole("slider", { name: "Master volume" }).fill("25");
  await page
    .getByRole("checkbox", { name: "Spoken countdowns & callouts" })
    .uncheck();
  await page
    .getByRole("button", { name: "Back to practice", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Resume pull/ })).toBeFocused();
  await page.getByRole("button", { name: /Restart pull/ }).focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(21100);
  await page
    .getByRole("button", { name: "Review first mistake" })
    .scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Review first mistake" }).click();
  await page.clock.runFor(100);
  await page
    .getByRole("slider", { name: "Replay timeline" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("slider", { name: "Replay timeline" }),
  ).toBeInViewport();
  const timelineLabels = await page
    .locator(".rt-time-axis span")
    .evaluateAll((labels) =>
      labels.map((label) => {
        const { left, right } = label.getBoundingClientRect();
        return { left, right };
      }),
    );
  for (let index = 1; index < timelineLabels.length; index++) {
    expect(timelineLabels[index].left).toBeGreaterThan(
      timelineLabels[index - 1].right,
    );
  }
  expect(
    await page
      .locator(".rt-game")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await capture(page, "mobile-replay");
});

for (const width of [800, 1100]) {
  test(`replay arena, transport and analysis do not overlap at ${width}px`, async ({
    page,
  }) => {
    await begin(page, width);
    await page.setViewportSize({ width, height: 650 });
    await page.clock.runFor(21000);
    await page.getByRole("button", { name: "Review first mistake" }).click();
    await page.clock.runFor(100);
    const arena = await page.locator(".rt-arena-scene").boundingBox();
    const transport = await page.locator(".rt-replay-transport").boundingBox();
    const summary = await page.locator(".rt-replay-summary").boundingBox();
    const inspector = await page.locator(".rt-event-inspector").boundingBox();
    expect(transport!.y).toBeGreaterThanOrEqual(arena!.y + arena!.height);
    expect(summary!.y).toBeGreaterThanOrEqual(transport!.y + transport!.height);
    expect(inspector!.y).toBeGreaterThanOrEqual(summary!.y + summary!.height);
    await page
      .getByRole("button", { name: "Practice cast 1" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Practice cast 1" }),
    ).toBeInViewport();
    expect(
      await page
        .locator(".rt-game")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await capture(page, `replay-${width}`);
  });
}
