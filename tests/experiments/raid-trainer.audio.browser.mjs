import { chromium, expect } from "@playwright/test";

// Real Web Audio nodes with delayed asset responses exercise cancellation and mixing controls.
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  window.sampleStarts = [];
  const original = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer && !this.loop)
      window.sampleStarts.push({
        duration: this.buffer.duration,
        at: performance.now(),
      });
    return original.apply(this, args);
  };
});
let releaseAssets;
const held = new Promise((resolve) => {
  releaseAssets = resolve;
});
let requests = 0;
await page.route("**/raid-trainer/audio/**", async (route) => {
  requests++;
  await held;
  await route.continue();
});
await page.goto(
  `${process.env.RAID_TRAINER_BASE_URL ?? "http://127.0.0.1:3000"}/raid-trainer`,
);
await page.getByRole("button", { name: /Start game/ }).click();
await page.getByRole("button", { name: /Mechanic guide/ }).click();
await page.getByText("Sound studio", { exact: true }).click();
await page.getByRole("button", { name: "▶ Preview countdown" }).click();
await page
  .getByRole("button", { name: "Back to practice", exact: true })
  .click();
await page.getByRole("button", { name: /Restart pull/ }).click();
await page.locator("canvas").press("Space");
releaseAssets();
await expect.poll(() => requests).toBe(13);
await expect
  .poll(() =>
    page.evaluate(async () => {
      const paths = [
        "count-1",
        "count-2",
        "count-3",
        "count-4",
        "count-5",
        "spread",
        "target",
        "other",
        "damage",
        "regroup",
        "complete",
        "failed",
      ];
      const context = new AudioContext();
      const lengths = await Promise.all(
        paths.map(async (name) => {
          const response = await fetch(`/raid-trainer/audio/${name}.mp3`);
          const buffer = await context.decodeAudioData(
            await response.arrayBuffer(),
          );
          return buffer.duration;
        }),
      );
      const horn = await fetch("/raid-trainer/audio/air-horn.ogg");
      const buffer = await context.decodeAudioData(await horn.arrayBuffer());
      lengths.push(buffer.duration);
      await context.close();
      return lengths.every((length) => length > 0.05 && length < 5);
    }),
  )
  .toBe(true);
expect(await page.evaluate(() => window.sampleStarts)).toEqual([]);
await page.getByRole("button", { name: /Resume pull/ }).click();
await expect
  .poll(() => page.evaluate(() => window.sampleStarts.length))
  .toBeGreaterThan(0);
await page.getByRole("button", { name: "Sound on", exact: true }).click();
await page.getByRole("button", { name: "Exit focus" }).click();
await page.getByRole("button", { name: /Start game/ }).click();
await expect(
  page.getByRole("button", { name: "Sound off", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: /Mechanic guide/ }).click();
await page.getByText("Sound studio", { exact: true }).click();
await page.getByRole("slider", { name: "Master volume" }).fill("25");
await page
  .getByRole("checkbox", { name: "Spoken countdowns & callouts" })
  .uncheck();
await page
  .getByRole("button", { name: "Back to practice", exact: true })
  .click();
await page.getByRole("button", { name: "Exit focus" }).click();
await page.getByRole("button", { name: /Start game/ }).click();
await page.getByRole("button", { name: /Mechanic guide/ }).click();
await page.getByText("Sound studio", { exact: true }).click();
await expect(page.getByRole("slider", { name: "Master volume" })).toHaveValue(
  "25",
);
await expect(
  page.getByRole("checkbox", { name: "Spoken countdowns & callouts" }),
).not.toBeChecked();
expect(errors).toEqual([]);
console.log(
  JSON.stringify({
    result: "PASS",
    checks: [
      "13 audio files decode",
      "delayed preview cancellation",
      "retry cancellation",
      "paused silence",
      "resume plays actual samples",
      "mute persists between modes",
      "volume and voice preferences persist",
    ],
    errors,
  }),
);
await browser.close();
