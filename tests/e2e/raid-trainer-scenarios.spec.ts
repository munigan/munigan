import { expect, test } from "@playwright/test";

test("starts a selected scenario with one Start action", async ({ page }) => {
  await page.goto("/raid-trainer");
  await page.getByRole("combobox", { name: "Scenario" }).click();
  await page
    .getByRole("option", { name: "Defile during Vile Spirits", exact: true })
    .click();
  await expect(
    page.getByText("Also active: Vile Spirits", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(page.locator(".rt-game")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cancel pull/ })).toBeVisible();
});

for (const key of ["Enter", "Space"]) {
  test(`pointer cancel restores Ready keyboard start with ${key}`, async ({
    page,
  }) => {
    await page.goto("/raid-trainer");
    await page.getByRole("button", { name: /Start game/ }).click();
    await page.getByRole("button", { name: /Cancel pull/ }).click();
    await expect(page.getByLabel("Ready to practice")).toBeVisible();
    await expect(page.locator("canvas")).toBeFocused();
    await page.keyboard.press(key);
    await expect(
      page.getByRole("button", { name: /Cancel pull/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Ready to practice")).not.toBeVisible();
  });
}

const families = [
  ["Defile before Val’kyrs", "Val’kyrs", 27],
  ["Defile after Val’kyr pickups", "Val’kyrs", 26],
  ["Defile during Vile Spirits", "Vile Spirits", 35],
  ["Defile after Frostmourne return", "Vile Spirits", 58],
] as const;
for (const [label, support, duration] of families) {
  test(`${label}: truthful duration, supporting timers and focus cancellation`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/raid-trainer");
    await page.getByRole("combobox", { name: "Scenario" }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(
      page.getByText(`Also active: ${support}`, { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".rt-quick-start")).toContainText(
      `${duration} seconds · 1 cast`,
    );
    await page.getByRole("button", { name: /Start game/ }).click();
    await page.clock.pauseAt(
      new Date((await page.evaluate(() => Date.now())) + 1000),
    );
    await expect(
      page.getByRole("combobox", { name: "Practice mode" }),
    ).toHaveValue("timers");
    await expect(page.locator(".rt-variation-label")).not.toContainText(
      /-you|-neighbor/,
    );
    await expect(page.getByLabel("Boss timers")).toContainText(
      support === "Val’kyrs" ? "Val'kyr" : support,
    );
    await expect(page.locator('.rt-dbm-timer[style*="NaN"]')).toHaveCount(0);
    await page.getByRole("button", { name: /Cancel pull/ }).click();
    await expect(page.getByLabel("Ready to practice")).toBeVisible();
    await expect(page.getByLabel("Ready to practice")).toContainText(
      `${duration} seconds`,
    );
    await page.getByRole("button", { name: /Start pull/ }).click();
    await page.clock.runFor(3400);
    await expect(
      page.getByRole("button", { name: "Pause SPACE", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      page.getByRole("heading", { name: "Paused when you switched tabs." }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Resume pull/ }).click();
    await page.getByRole("button", { name: /Cancel resume/ }).click();
    await expect(
      page.getByRole("button", { name: /Resume pull/ }),
    ).toBeVisible();
  });
}

test("same situation retry, explicit new variation, replay markers, seek and speeds", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.clock.install();
  await page.goto("/raid-trainer");
  await page.getByRole("button", { name: /Start game/ }).click();
  await page.getByRole("button", { name: /Cancel pull/ }).click();
  await page.clock.runFor(150);
  const initial = await page
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole("button", { name: /Start pull/ }).click();
  await page.clock.runFor(9000);
  await page.locator("canvas").press("r");
  await page.getByRole("button", { name: /Cancel pull/ }).click();
  await page.clock.runFor(150);
  expect(
    await page
      .locator("canvas")
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
  ).toBe(initial);
  await page.getByRole("button", { name: /Start pull/ }).click();
  await page.clock.runFor(32000);
  await expect(page.getByLabel("Pull results")).toBeVisible();
  await expect(page.getByLabel("Focus findings")).toBeVisible();
  await expect(page.getByLabel("Supporting findings")).toBeVisible();
  await expect(page.locator(".rt-game")).not.toContainText(
    /six ticks|ends at 6|0 \/ 6|survived all/,
  );
  expect(
    await page
      .locator("canvas")
      .evaluate((canvas: HTMLCanvasElement) =>
        Array.from(canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data),
      ),
  ).toEqual([7, 8, 10, 255]);
  expect(
    await page
      .getByLabel("Pull results")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: ".cache/raid-trainer/task-10-results.png" });
  await page
    .getByRole("button", { name: "Review first mistake", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Replay controls" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "2×", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "2×", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("slider", { name: "Replay timeline" }).fill("12");
  await expect(
    page.getByRole("slider", { name: "Replay timeline" }),
  ).toHaveValue("12");
  const pickup = page
    .getByRole("combobox", { name: "Recorded event" })
    .locator("option")
    .filter({ hasText: "00:15.0 · Val’kyr pickup" });
  await page
    .getByRole("combobox", { name: "Recorded event" })
    .selectOption(await pickup.getAttribute("value"));
  const marker = page
    .getByRole("button", { name: /00:15.0 Val’kyr pickup/ })
    .first();
  await marker.focus();
  await marker.press("Enter");
  await expect(page.getByLabel("Event inspector")).toContainText(
    "Val’kyr pickup",
  );
  await page.screenshot({ path: ".cache/raid-trainer/task-10-replay.png" });
  await page
    .getByRole("button", { name: "Practice this moment", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Cancel pull/ })).toBeVisible();
  await page.clock.runFor(32000);
  await page
    .getByRole("button", { name: "New variation", exact: true })
    .click();
  await expect(page.locator(".rt-variation-label")).toContainText(
    "Defile after Val’kyr pickups",
  );
  await expect(page.getByRole("button", { name: /Cancel pull/ })).toBeVisible();
});

test("guide and audio fallback preserve playable visual controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", {
      value: class {
        constructor() {
          throw new Error("Audio unavailable");
        }
      },
    });
  });
  await page.goto("/raid-trainer");
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(
    page.getByRole("button", { name: "Continue without sound" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue without sound" }).click();
  await page.getByRole("button", { name: /Mechanic guide/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Mechanic guide", exact: true }),
  ).toContainText("you are not selected for pickup");
  await expect(
    page.getByRole("dialog", { name: "Mechanic guide", exact: true }),
  ).toContainText("27 seconds · 1 Defile cast");
  await page
    .getByRole("button", { name: "Back to practice", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Resume pull/ })).toBeVisible();
});

test("mobile touch movement and release remain available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date("2026-09-10T16:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-10T16:00:01Z"));
  await page.goto("/raid-trainer");
  await page.getByRole("button", { name: /Start game/ }).click();
  await page.clock.runFor(3400);
  const playerX = () =>
    page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let rightmost = -Infinity,
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
          rightmost = Math.max(rightmost, (i / 4) % canvas.width);
          count++;
        }
      }
      return { x: rightmost, count };
    });
  const before = await playerX();
  const right = page.getByRole("button", { name: "Move right", exact: true });
  await expect(right).toBeVisible();
  const point = await right.boundingBox();
  await page.mouse.move(
    point!.x + point!.width / 2,
    point!.y + point!.height / 2,
  );
  await page.mouse.down();
  await page.clock.runFor(1000);
  await page.mouse.up();
  const after = await playerX();
  expect(before.count).toBeGreaterThan(20);
  // The rightward player is the rightmost cyan ring. A pooled cyan centroid
  // also includes the soaker ring/callout and is not a player position.
  const expectedPixels = 7 * ((840 * 0.82) / 90);
  expect(Math.abs(after.x - before.x - expectedPixels)).toBeLessThanOrEqual(1);
  await page.clock.runFor(500);
  expect((await playerX()).x).toBe(after.x);
  await expect(
    page.getByRole("button", { name: "Pause SPACE", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause SPACE", exact: true }).click();
  await expect(page.getByRole("button", { name: /Resume pull/ })).toBeVisible();
});
