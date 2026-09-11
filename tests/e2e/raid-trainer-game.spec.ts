import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  successTraces,
  failureTraces,
  type InputSegment,
} from "../support/raid-scenario";

test.setTimeout(120_000);
async function capture(page: Page, name: string) {
  await mkdir(".cache/raid-trainer/scenarios", { recursive: true });
  await page.screenshot({
    path: `.cache/raid-trainer/scenarios/${name}.png`,
    fullPage: true,
  });
}
async function begin(page: Page, width = 1440, height = 900, family?: string) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: new Date("2026-09-10T16:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-10T16:00:01Z"));
  await page.goto("/raid-trainer");
  await page.evaluate(() => document.fonts.ready);
  if (family) {
    await page.getByRole("combobox", { name: "Scenario" }).click();
    await page.clock.runFor(150);
    await page.getByRole("option", { name: family, exact: true }).click();
  }
  await page.getByRole("button", { name: /Start game/ }).click();
  await page.clock.runFor(150);
}
async function ready(page: Page, guided = true) {
  await page.getByRole("button", { name: /Cancel pull/ }).click();
  if (guided)
    await page
      .getByRole("button", { name: "Guided practice", exact: true })
      .click();
}
async function go(page: Page) {
  await page.getByRole("button", { name: /Start pull/ }).click();
  await page.clock.runFor(3050);
}
const clock = (page: Page) => page.locator(".rt-live-clock strong");
async function play(page: Page, trace: readonly InputSegment[]) {
  for (const segment of trace) {
    const keys = [
      segment.direction.x > 0 ? "d" : segment.direction.x < 0 ? "a" : null,
      segment.direction.y > 0 ? "s" : segment.direction.y < 0 ? "w" : null,
    ].filter((key): key is string => key !== null);
    for (const key of keys) await page.keyboard.down(key);
    await page.clock.runFor(Math.round(segment.seconds * 1000));
    for (const key of keys) await page.keyboard.up(key);
  }
}

// Split a measured trace at absolute encounter times without changing its input.
function traceBetween(
  trace: readonly InputSegment[],
  start: number,
  end: number,
) {
  let cursor = 0;
  return trace.flatMap((segment) => {
    const duration = Math.max(
      0,
      Math.min(end, cursor + segment.seconds) - Math.max(start, cursor),
    );
    cursor += segment.seconds;
    return duration > 0
      ? [{ seconds: duration, direction: segment.direction }]
      : [];
  });
}
async function playCaptured(
  page: Page,
  trace: readonly InputSegment[],
  moments: readonly (readonly [number, string])[],
) {
  let at = 0;
  for (const [next, name] of moments) {
    await play(page, traceBetween(trace, at, next));
    await capture(page, name);
    at = next;
  }
}

test("approved guided states, frozen pause, failed result and exact replay checkpoint", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page);
  await expect(page.getByLabel("Pull in 3", { exact: true })).toBeVisible();
  await capture(page, "countdown");
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Master Defile." }),
  ).toBeVisible();
  expect(await page.locator(".rt-ready-panel").boundingBox()).toMatchObject({
    x: 448,
    y: 230,
    width: 544,
  });
  await capture(page, "ready");
  await go(page);
  await page.clock.runFor(4000);
  await expect(page.locator(".rt-instruction")).toBeVisible();
  await capture(page, "anticipate");
  const pausedAt = await clock(page).textContent();
  await page.locator("canvas").press("Space");
  await page.clock.runFor(100);
  expect(await page.locator(".rt-pause-panel").boundingBox()).toMatchObject({
    x: 456,
    y: 272,
    width: 528,
  });
  await capture(page, "paused");
  await page.clock.runFor(4000);
  await expect(clock(page)).toHaveText(pausedAt!);
  await page.getByRole("button", { name: /Resume pull/ }).click();
  await page.clock.runFor(1800);
  await expect(clock(page)).toHaveText(pausedAt!);
  await page.clock.runFor(5700);
  await expect(page.locator(".rt-instruction")).toContainText(
    "Move away from the raid",
  );
  const cast = page.locator(".rt-dbm-timer.is-cast");
  await expect(cast).toContainText("Defile");
  expect(
    await cast.evaluate((el) => {
      const bar = el.querySelector(".rt-dbm-bar")!.getBoundingClientRect(),
        icon = el.querySelector("img")!.getBoundingClientRect();
      return {
        joined: Math.abs(bar.left - icon.right) < 1,
        equal: Math.abs(bar.height - icon.height) < 1,
        shadow: getComputedStyle(el).boxShadow,
        textLayer: getComputedStyle(el.querySelector("strong")!).zIndex,
      };
    }),
  ).toEqual({ joined: true, equal: true, shadow: "none", textLayer: "1" });
  expect(await page.locator(".rt-arena-scene").boundingBox()).toEqual({
    x: 300,
    y: 24,
    width: 840,
    height: 840,
  });
  await capture(page, "targeted");
  await page.clock.runFor(2500);
  await expect(page.locator(".rt-instruction")).toContainText(
    "Get out of the pool",
  );
  await capture(page, "missed");
  await page.clock.runFor(20000);
  await expect(page.getByLabel("Pull results")).toBeVisible();
  await expect(page.getByLabel("Pull results")).toContainText("platform");
  await capture(page, "platform-overrun");
  await page
    .getByRole("button", { name: "Review first mistake", exact: true })
    .click();
  await page.clock.runFor(100);
  const slider = page.getByRole("slider", { name: "Replay timeline" });
  expect(Number(await slider.inputValue())).toBeCloseTo(8, 0);
  expect(await page.locator(".rt-replay-transport").boundingBox()).toEqual({
    x: 360,
    y: 748,
    width: 720,
    height: 142,
  });
  expect(
    await page.locator(".rt-replay-transport").evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      play: getComputedStyle(el.querySelector(".rt-white")!).backgroundColor,
      divider: getComputedStyle(el.querySelector(".rt-replay-buttons")!)
        .borderTopWidth,
      timeline: el.querySelector("svg")!.getBoundingClientRect().height,
    })),
  ).toEqual({
    background: "rgb(23, 25, 29)",
    play: "rgb(236, 241, 244)",
    divider: "0px",
    timeline: 40,
  });
  await capture(page, "replay");
  await page.getByRole("button", { name: "2×", exact: true }).click();
  await page.getByRole("button", { name: /^Play/ }).click();
  await page.clock.runFor(1000);
  expect(Number(await slider.inputValue())).toBeGreaterThanOrEqual(9.8);
  await slider.fill("9");
  await page.clock.runFor(200);
  const sought = await slider.inputValue();
  await page.clock.runFor(1000);
  await expect(slider).toHaveValue(sought);
  await page.getByRole("button", { name: /^Play/ }).click();
  await page.clock.runFor(16000);
  await expect(
    page.getByRole("button", { name: /Replay again/ }),
  ).toBeVisible();
  expect(Number(await slider.inputValue())).toBeCloseTo(
    Number(await slider.getAttribute("max")),
    1,
  );
  await capture(page, "replay-ended");
  await page
    .getByRole("button", { name: "Practice this moment", exact: true })
    .click();
  await page.clock.runFor(100);
  await expect(clock(page)).toHaveText("00:00");
  await capture(page, "practice-checkpoint");
  await page.clock.runFor(1500);
  await expect(clock(page)).toHaveText("00:00");
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

test("ordinary movement completes cleanly, captures carriers and preserves timers default", async ({
  page,
}) => {
  await begin(page);
  await ready(page, false);
  await expect(
    page.getByRole("combobox", { name: "Practice mode" }),
  ).toHaveValue("timers");
  await go(page);
  await page.clock.runFor(1000);
  await expect(page.locator(".rt-instruction")).toHaveCount(0);
  await capture(page, "timers-live");
  await page.locator("canvas").press("r");
  await page.getByRole("button", { name: /Cancel pull/ }).click();
  await page
    .getByRole("button", { name: "Guided practice", exact: true })
    .click();
  await go(page);
  const trace = successTraces["before-standard-you"];
  await playCaptured(page, trace, [
    [15.05, "valkyr-pickup"],
    [19.5, "valkyr-carry"],
    [24.05, "valkyr-release"],
    [27.2, "clean-completion"],
  ]);
  await expect(
    page.getByRole("heading", { name: "Clean pull." }),
  ).toBeVisible();
  await expect(page.getByLabel("Focus findings")).toContainText(
    "No personal Defile ticks.",
  );
  await capture(page, "clean-completion");
  await page
    .locator(".rt-game-dock")
    .getByRole("button", { name: /^Replay/ })
    .click();
  await page.clock.runFor(100);
  await expect(page.locator(".rt-replay-summary")).toContainText(
    "No positioning",
  );
  await capture(page, "clean-replay");
});

test("recovery keeps real exposure and finishes imperfectly", async ({
  page,
}) => {
  await begin(page);
  await ready(page);
  await go(page);
  await page.clock.runFor(11100);
  await play(page, [{ seconds: 1.4, direction: { x: 1, y: 0 } }]);
  await expect(page.locator(".rt-instruction")).toContainText("You’re clear");
  await capture(page, "recovered");
  await page.clock.runFor(17000);
  await expect(
    page.getByRole("heading", { name: "Finished. Now refine it." }),
  ).toBeVisible();
  await capture(page, "imperfect-completion");
});

for (const [width, height] of [
  [390, 844],
  [800, 650],
  [1100, 650],
]) {
  test(`live and replay controls remain separate at ${width}×${height}`, async ({
    page,
  }) => {
    await begin(page, width, height);
    await ready(page);
    await go(page);
    await page.clock.runFor(4000);
    await capture(page, `live-${width}`);
    expect(
      await page
        .locator(".rt-game")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.clock.runFor(30000);
    await page
      .getByRole("button", { name: "Review first mistake", exact: true })
      .click();
    await page.clock.runFor(100);
    const arena = await page.locator(".rt-arena-scene").boundingBox(),
      transport = await page.locator(".rt-replay-transport").boundingBox(),
      summary = await page.locator(".rt-replay-summary").boundingBox(),
      inspector = await page.locator(".rt-event-inspector").boundingBox();
    expect(transport!.y).toBeGreaterThanOrEqual(arena!.y + arena!.height);
    expect(summary!.y).toBeGreaterThanOrEqual(transport!.y + transport!.height);
    expect(inspector!.y).toBeGreaterThanOrEqual(summary!.y + summary!.height);
    const labels = await page
      .locator(".rt-time-axis span")
      .evaluateAll((labels) =>
        labels.map((label) => {
          const { left, right } = label.getBoundingClientRect();
          return { left, right };
        }),
      );
    for (let i = 1; i < labels.length; i++)
      expect(labels[i].left).toBeGreaterThan(labels[i - 1].right);
    await capture(page, `replay-${width}`);
    await page
      .getByRole("slider", { name: "Replay timeline" })
      .scrollIntoViewIfNeeded();
    await capture(page, `replay-${width}-transport`);
    await page
      .getByRole("button", { name: "Practice this moment", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Practice this moment", exact: true }),
    ).toBeInViewport();
    expect(
      await page
        .locator(".rt-game")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await capture(page, `replay-${width}-inspector`);
  });
}

for (const [family, id] of [
  ["Defile during Vile Spirits", "spirits-moving-you"],
  ["Defile after Frostmourne return", "frostmourne-return-you"],
]) {
  test(`${family} integrated activation, burst and return evidence`, async ({
    page,
  }) => {
    await begin(page, 1440, 900, family);
    await ready(page);
    await go(page);
    if (id.startsWith("frost")) await capture(page, "frostmourne-return");
    const trace = successTraces[id];
    await playCaptured(
      page,
      trace,
      id.startsWith("spirits")
        ? [
            [6.05, "spirit-activation"],
            [10.05, "spirits-moving-you-placement"],
            [13.4, "spirit-contact-burst"],
            [35.2, "spirits-moving-you-completed"],
          ]
        : [
            [5.05, "frostmourne-return-you-placement"],
            [10.05, "return-spirit-wave"],
            [40.05, "return-spirit-activation"],
            [47.4, "return-spirit-contact-burst"],
            [58.2, "frostmourne-return-you-completed"],
          ],
    );
    await expect(
      page.getByRole("heading", { name: "Clean pull." }),
    ).toBeVisible();
    await capture(page, `${id}-completed`);
  });
}

test("revealed ally target has integrated coaching without changing timers default", async ({
  page,
}) => {
  await begin(page, 1440, 900, "Defile before Val’kyrs");
  await ready(page);
  await go(page);
  await play(page, traceBetween(successTraces["before-standard-you"], 0, 27.2));
  await page
    .getByRole("button", { name: "New variation", exact: true })
    .click();
  await page.clock.runFor(150);
  await page.getByRole("button", { name: /Cancel pull/ }).click();
  await page
    .getByRole("button", { name: "Guided practice", exact: true })
    .click();
  await go(page);
  await page.clock.runFor(8350);
  await expect(page.locator(".rt-instruction")).toContainText(
    "You are not the target",
  );
  await capture(page, "ally-targeted");
});

test("a route-overlap path captures real raid-only Defile exposure", async ({
  page,
}) => {
  await begin(page);
  await ready(page);
  await go(page);
  await play(page, traceBetween(failureTraces.routeOverlap.trace, 0, 27.2));
  await expect(page.getByLabel("Pull results")).toBeVisible();
  const stats = page.locator(".rt-result-stats strong");
  await expect(stats.nth(0)).toHaveText("0");
  expect(Number(await stats.nth(1).textContent())).toBeGreaterThan(0);
  await expect(page.getByLabel("Focus findings")).toContainText(
    "Teammates also took exposure ticks.",
  );
  await capture(page, "raid-only-exposure");
});
