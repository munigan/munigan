import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";

let bundle: string;
test.beforeAll(async () => {
  bundle = (
    await build({
      entryPoints: ["tests/support/raid-review-browser.tsx"],
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      jsx: "automatic",
    })
  ).outputFiles[0].text;
});
test.beforeEach(async ({ page }) => {
  const css = readFileSync("src/features/raid-trainer/trainer.css", "utf8");
  const fonts = [
    ["Inter", "inter", 400],
    ["Inter", "inter", 500],
    ["Inter", "inter", 600],
    ["Barlow Condensed", "barlow-condensed", 600],
  ]
    .map(
      ([family, slug, weight]) =>
        `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${slug}/files/${slug}-latin-${weight}-normal.woff2`).toString("base64")})}`,
    )
    .join("");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/__raid-review?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><style>${fonts}${css}body{margin:0;--color-canvas:#07080A}</style><div id="root"></div>`,
    }),
  );
});

test("route miss stays imperfect and long arena annotations fit their bubbles", async ({
  page,
}) => {
  await page.goto("/__raid-review?case=route");
  await page.addScriptTag({ content: bundle });
  const row = page.getByRole("button", { name: /Defile 1/ });
  await expect(row).toContainText("pool overlapped the planned route");
  await expect(row).toContainText("0 ticks");
  await expect(row).not.toContainText("Clean");
  await page.screenshot({
    path: ".cache/raid-trainer/execution/final-fix-route-result.png",
  });
  // Inspect actual canvas text metrics, leaving renderer and recorded state intact.
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const rect = proto.roundRect,
      fill = proto.fillText;
    const evidence = {
      box: null as null | number[],
      overflow: [] as string[],
      text: [] as string[],
    };
    Object.assign(window, { annotationEvidence: evidence });
    proto.roundRect = function (x, y, w, h, ...args) {
      evidence.box = [x, y, w, h];
      evidence.overflow = [];
      evidence.text = [];
      return rect.call(this, x, y, w, h, ...args);
    };
    proto.fillText = function (text, x, y, ...args) {
      if (
        evidence.box &&
        ["#f4a79e", "#f3f4f5"].includes(String(this.fillStyle))
      ) {
        const [bx, by, w, h] = evidence.box;
        evidence.text.push(text);
        if (
          x < bx ||
          x + this.measureText(text).width > bx + w ||
          y > by + h ||
          y - 13 < by ||
          bx < 0 ||
          by < 0 ||
          bx + w > 840 ||
          by + h > 840
        )
          evidence.overflow.push(text);
      }
      return fill.call(this, text, x, y, ...args);
    };
  });
  await row.click();
  await expect(page.getByRole("checkbox", { name: /Your path/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { annotationEvidence: { text: string[] } })
            .annotationEvidence.text.length,
      ),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { annotationEvidence: { overflow: string[] } })
          .annotationEvidence.overflow,
    ),
  ).toEqual([]);
  await expect(page.getByLabel("Event inspector")).toContainText(
    "pool overlapped the planned route",
  );
  await page.screenshot({
    path: ".cache/raid-trainer/execution/final-fix-route-annotation.png",
  });
  const rescue = page
    .getByRole("combobox", { name: "Recorded event" })
    .locator("option")
    .filter({ hasText: "passenger rescued" })
    .first();
  await page
    .getByRole("combobox", { name: "Recorded event" })
    .selectOption((await rescue.getAttribute("value"))!);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { annotationEvidence: { text: string[] } }
        ).annotationEvidence.text.join(" "),
      ),
    )
    .toMatch(/Val’kyr/);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { annotationEvidence: { overflow: string[] } })
          .annotationEvidence.overflow,
    ),
  ).toEqual([]);
  await page.screenshot({
    path: ".cache/raid-trainer/execution/final-fix-supporting-annotation.png",
  });
});

test("neighbor replay labels the target path and keeps compact transport geometry through selection and toggle", async ({
  page,
}) => {
  await page.goto("/__raid-review?case=neighbor");
  await page.addScriptTag({ content: bundle });
  const path = page.getByRole("checkbox", { name: /raid-07.*path/ });
  await expect(path).toBeChecked();
  const transport = page.getByRole("region", { name: "Replay controls" });
  const box = await transport.boundingBox();
  expect(box!.height).toBe(142);
  await page.screenshot({
    path: ".cache/raid-trainer/execution/final-fix-neighbor-replay.png",
  });
  const image = await page.locator("canvas").screenshot();
  await path.uncheck();
  expect((await page.locator("canvas").screenshot()).equals(image)).toBe(false);
  await path.check();
  expect((await page.locator("canvas").screenshot()).equals(image)).toBe(true);
  const damage = page
    .getByRole("combobox", { name: "Recorded event" })
    .locator("option")
    .filter({ hasText: "Defile hit you" })
    .first();
  await page
    .getByRole("combobox", { name: "Recorded event" })
    .selectOption((await damage.getAttribute("value"))!);
  await expect(path).toBeChecked();
  expect(await transport.boundingBox()).toEqual(box);
  await page.screenshot({
    path: ".cache/raid-trainer/execution/final-fix-neighbor-victim-replay.png",
  });
});
