import { chromium, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync, mkdirSync } from "node:fs";

// Bundle the real renderer/simulation into a browser-only fixture on the Next
// origin. No fixture route or debug simulation controls ship in the application.
const root = process.cwd();
const base = process.env.RAID_TRAINER_BASE_URL ?? "http://127.0.0.1:3000";
const output = `${root}/.cache/raid-trainer/scenario-render`;
mkdirSync(output, { recursive: true });
const entry = `
import { makeRun } from './src/features/raid-trainer/scenario-content';
import { createAttempt, advanceAttempt } from './src/features/raid-trainer/scenario-runtime';
import { readAttempt, readWorldView } from './src/features/raid-trainer/scenario-view';
import { createRecording, recordStep, frameView } from './src/features/raid-trainer/scenario-recording';
import { getArenaAsset, prepareScenarioAssets } from './src/features/raid-trainer/arena-assets';
import { drawScenario } from './src/features/raid-trainer/render-scenario';
window.renderFixture = async (variant, at, replay = false) => {
 const run = makeRun(variant, variant.startsWith("spirits-settled") ? 18 : 41);
 await prepareScenarioAssets(run);
 const attempt = createAttempt(run); attempt.world.status = 'running';
 const recording = createRecording(); recordStep(recording, attempt);
 advanceAttempt(attempt, at, {x:0,y:0}, step => recordStep(recording, step));
 const view = replay ? readWorldView(run, frameView(recording, recording.frames.length-1), recording.findings) : readAttempt(attempt);
 const options = replay ? {
  showTrail: true, showGrowth: true,
  recordedTrail: recording.frames.map((_, i) => frameView(recording, i).actors.find(a=>a.id==='soaker')).filter(Boolean).map(a=>({x:a.x,y:a.y})),
  highlightedEvent: view.world.events.findLast(e=>e.kind==='explosion') ?? view.world.events.findLast(e=>e.kind==='pool'),
  highlightedLabel: 'RECORDED EVENT', highlightedDetail: 'Review this position',
 } : {};
 window.fixtureState = {run, view, options, recording};
 window.drawnImages = []; window.bossDraw = null;
 const original = CanvasRenderingContext2D.prototype.drawImage;
 CanvasRenderingContext2D.prototype.drawImage = function(img,...args) { window.drawnImages.push(img.src); if (img.src.endsWith("/lich-king.jpg")) window.bossDraw = args.slice(0,2); return original.call(this,img,...args); };
 const worldBefore = JSON.stringify(view.world);
 try { drawScenario(document.querySelector('canvas'), run, view, options); }
 finally { CanvasRenderingContext2D.prototype.drawImage = original; }
 document.querySelector('#state').textContent = variant + ' · ' + view.world.elapsed.toFixed(1) + 's';
 document.querySelector('#inspector').textContent = replay ? (options.highlightedEvent?.kind ?? 'Recorded frame') : (view.cue?.title ?? 'Hold formation');
 document.querySelector('.rt-boss-timers').innerHTML = '<div class="rt-eyebrow">Boss timers</div>' + view.timers.map(t=>
 '<div class="rt-dbm-timer is-'+t.kind+'" style="--timer-color:#9cd6f0;--timer-fill:'+Math.min(100,t.remaining/Math.max(t.duration,.01)*100)+'%"><img src="'+t.icon+'" width="38" height="38" alt=""><div class="rt-dbm-bar"><span class="rt-dbm-fill"></span><strong>'+t.label+'</strong><time>'+t.remaining.toFixed(1)+'</time></div></div>').join('');
 document.querySelector('#transport').hidden = !replay;
 return { bossDraw: window.bossDraw, unchangedWorld: worldBefore === JSON.stringify(view.world), elapsed: view.world.elapsed, actors: view.world.actors.length, carriers: view.world.valkyrs.map(v=>v.state), spirits: view.world.spirits.length, explosions: view.world.spirits.filter(s=>s.explodedAt!==null).length, protectedInterception: view.world.events.some(e=>e.kind==="explosion" && e.protectedActorIds.includes("soaker")), images: window.drawnImages, required: ['/raid-trainer/art/arena-sculpted-ice.png','/raid-trainer/art/lich-king.jpg','/raid-trainer/art/valkyr.svg','/raid-trainer/art/vile-spirit.svg',...view.world.actors.map(a=>a.classIcon)].filter(p=>!getArenaAsset(p)) };
};
window.drawFixture = () => drawScenario(document.querySelector('canvas'),window.fixtureState.run,window.fixtureState.view,window.fixtureState.options);
`;
const bundle = await build({
  stdin: { contents: entry, resolveDir: root, loader: "ts" },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
});
const css = readFileSync(
  `${root}/src/features/raid-trainer/trainer.css`,
  "utf8",
);
const fontCss = [
  ["Inter", "inter", 400],
  ["Inter", "inter", 500],
  ["Inter", "inter", 600],
  ["Barlow Condensed", "barlow-condensed", 600],
]
  .map(([family, slug, weight]) => {
    const data = readFileSync(
      `${root}/node_modules/@fontsource/${slug}/files/${slug}-latin-${weight}-normal.woff2`,
    ).toString("base64");
    return `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${data}) format("woff2")}`;
  })
  .join("");
const browser = await chromium.launch({ headless: true });
const errors = [];
let bossBeforeRelocation;
const results = [];
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/__scenario-render-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}${css}
  body{margin:0;background:#07080A} .rt-game{--color-canvas:#07080A} #state{position:absolute;left:28px;top:30px;color:#a5a8af;font-size:12px} #inspector{position:absolute;left:28px;top:100px;color:#c6d8e4;max-width:220px} #keys{position:absolute;left:28px;bottom:24px;display:flex;gap:12px} #transport{position:absolute;bottom:75px;left:50%;transform:translateX(-50%);padding:12px 20px;background:#14161a;border:1px solid #25272c;border-radius:6px;white-space:nowrap} #transport[hidden]{display:none} kbd{border:1px solid #45484f;padding:3px 6px;border-radius:3px} @media(max-width:600px){#state{top:16px;left:16px;max-width:300px}#inspector{left:16px;top:75px;font-size:12px}#keys{left:16px;font-size:11px;gap:6px}}</style></head><body><main class="rt-game"><div class="rt-arena-scene"><canvas aria-label="Scenario arena"></canvas></div><div class="rt-top-vignette"></div><div id="state"></div><div id="inspector"></div><aside class="rt-boss-timers"></aside><div id="keys"><span><kbd>W A S D</kbd> Move</span><span><kbd>Space</kbd> Pause</span><span><kbd>R</kbd> Retry</span></div><div id="transport" hidden>▶ &nbsp; 00:14 / 00:35 &nbsp; ━━━━━●━━ &nbsp; 1×</div></main></body></html>`,
      }),
    );
    await page.goto(`${base}/__scenario-render-fixture`);
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('600 17px "Barlow Condensed"'),
        document.fonts.load("400 12px Inter"),
        document.fonts.load("500 12px Inter"),
        document.fonts.load("600 14px Inter"),
      ]);
      await document.fonts.ready;
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    for (const [name, variant, at, replay] of [
      ["stack", "before-standard-you", 0, false],
      ["target-you", "before-standard-you", 8.5, false],
      ["target-neighbor", "before-standard-neighbor", 8.5, false],
      ["descent", "after-standard-you", 4.5, false],
      ["carry", "after-standard-you", 11, false],
      ["release", "after-standard-you", 14.2, false],
      ["dormant", "spirits-settled-you", 0, false],
      ["pursuit", "spirits-settled-you", 10, false],
      ["interception", "spirits-settled-you", 14.4, false],
      ["return", "frostmourne-return-you", 0.2, false],
      ["relocation-before", "spirits-moving-you", 3.98, false],
      ["relocation-start", "spirits-moving-you", 4.02, false],
      ["relocation", "spirits-moving-you", 5, false],
      ["replay", "spirits-settled-you", 14.4, true],
    ]) {
      const result = await page.evaluate(
        ([variant, at, replay]) => window.renderFixture(variant, at, replay),
        [variant, at, replay],
      );
      await page.screenshot({
        path: `${output}/${viewport.width}-${name}.png`,
      });
      expect(result.actors).toBe(25);
      expect(result.unchangedWorld).toBe(true);
      if (name === "relocation-before") bossBeforeRelocation = result.bossDraw;
      if (name === "relocation-start")
        expect(
          Math.hypot(
            result.bossDraw[0] - bossBeforeRelocation[0],
            result.bossDraw[1] - bossBeforeRelocation[1],
          ),
          "destination marker does not teleport boss",
        ).toBeLessThan(5);
      if (name === "carry")
        expect(
          result.images.some((p) => p.endsWith("/valkyr.svg")),
          "carried passenger has visible carrier artwork",
        ).toBe(true);
      if (name === "pursuit")
        expect(
          result.images.some((p) => p.endsWith("/vile-spirit.svg")),
          "active spirits have visible silhouettes",
        ).toBe(true);
      if (name === "interception") {
        expect(result.explosions).toBeGreaterThan(0);
        expect(result.protectedInterception).toBe(true);
      }
      if (implemented)
        expect(
          result.required,
          "all scenario assets decode across variation families",
        ).toEqual([]);
      results.push({
        width: viewport.width,
        name,
        ...result,
        images: undefined,
      });
    }
    // Positionless events remain available to the inspector; they must not make
    // a spurious arena bubble at the origin or elsewhere.
    const before = await page.locator("canvas").screenshot();
    await page.evaluate(() => {
      const s = window.fixtureState;
      s.options.highlightedEvent = null;
      window.drawFixture();
    });
    const noEvent = await page.locator("canvas").screenshot();
    await page.evaluate(() => {
      const s = window.fixtureState;
      s.options.highlightedEvent = {
        ...s.view.world.events[0],
        position: null,
      };
      window.drawFixture();
    });
    expect(await page.locator("canvas").screenshot()).toEqual(noEvent);
    expect(before.equals(noEvent)).toBe(false);
    expect(
      await page
        .locator("img")
        .evaluateAll((imgs) =>
          imgs.every((i) => i.complete && i.naturalWidth > 0),
        ),
    ).toBe(true);
    await page.close();
  }
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({ result: "PASS", results, errors, output }, null, 2),
  );
} finally {
  await browser.close();
}
