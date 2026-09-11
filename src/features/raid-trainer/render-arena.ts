import type { EncounterDefinition, Snapshot, TrainingMode } from "./model";

const images = new Map<string, HTMLImageElement>();
function asset(path?: string) {
  if (!path) return null;
  let image = images.get(path);
  if (!image) {
    image = new Image();
    image.src = path;
    images.set(path, image);
  }
  return image.complete && image.naturalWidth ? image : null;
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill?: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 10,
) {
  ctx.font = `600 ${size}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  encounter: EncounterDefinition,
) {
  const { center: c, radius: r, width, height } = encounter.arena;
  const artwork = asset(encounter.artwork);
  if (artwork) {
    ctx.fillStyle = "#070e17";
    ctx.fillRect(0, 0, width, height);
    const size = (r * 2) / 0.86;
    ctx.drawImage(artwork, c.x - size / 2, c.y - size / 2, size, size);
    ctx.fillStyle = "#04132030";
    ctx.fillRect(0, 0, width, height);
    const vignette = ctx.createRadialGradient(
      c.x,
      c.y,
      r * 0.55,
      c.x,
      c.y,
      r * 1.35,
    );
    vignette.addColorStop(0, "#02071300");
    vignette.addColorStop(1, "#050b16ef");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 1;
    circle(ctx, c.x, c.y, r - 5, undefined, "#a3dfee28");
    label(ctx, "◆", c.x - 187, c.y - 133, "#b796ee", 23);
    label(ctx, "★", c.x + 187, c.y - 133, "#e8c77b", 25);
    label(ctx, "W", c.x - r - 17, c.y + 3, "#7e9cac", 9);
    label(ctx, "E", c.x + r + 17, c.y + 3, "#7e9cac", 9);
    return;
  }
  ctx.fillStyle = "#090f17";
  ctx.fillRect(0, 0, width, height);
  const haze = ctx.createRadialGradient(c.x, c.y, r * 0.7, c.x, c.y, r * 1.3);
  haze.addColorStop(0, "#13303b");
  haze.addColorStop(1, "#090f17");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 65; i++) {
    const x = (i * 137 + 47) % width,
      y = (i * 89 + 13) % height;
    circle(ctx, x, y, i % 3 === 0 ? 1.3 : 0.6, "#b2d5e126");
  }
  // A cut-stone rim. Everything is procedural; no external game assets.
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16,
      b = a + Math.PI / 17;
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a) * (r + 3), c.y + Math.sin(a) * (r + 3));
    ctx.lineTo(
      c.x + Math.cos(a) * (r + 17 + (i % 3) * 2),
      c.y + Math.sin(a) * (r + 17 + (i % 3) * 2),
    );
    ctx.lineTo(c.x + Math.cos(b) * (r + 16), c.y + Math.sin(b) * (r + 16));
    ctx.lineTo(c.x + Math.cos(b) * (r + 3), c.y + Math.sin(b) * (r + 3));
    ctx.closePath();
    ctx.fillStyle = i % 3 === 0 ? "#325463" : "#233e4d";
    ctx.fill();
  }
  const ice = ctx.createRadialGradient(c.x, c.y - 80, 0, c.x, c.y, r);
  ice.addColorStop(0, "#243c49");
  ice.addColorStop(0.6, "#1b303c");
  ice.addColorStop(1, "#142631");
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = ice;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#85bed012";
  for (let x = c.x - r; x < c.x + r; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, c.y - r);
    ctx.lineTo(x, c.y + r);
    ctx.stroke();
  }
  for (let y = c.y - r; y < c.y + r; y += 42) {
    ctx.beginPath();
    ctx.moveTo(c.x - r, y);
    ctx.lineTo(c.x + r, y);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a) * 94, c.y + Math.sin(a) * 94);
    ctx.lineTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    ctx.strokeStyle = "#90bdca19";
    ctx.stroke();
  }
  [94, 185, r - 23, r - 6].forEach((radius) =>
    circle(ctx, c.x, c.y, radius, undefined, "#7bafc02c"),
  );
  ctx.setLineDash([2, 8]);
  circle(ctx, c.x, c.y, r - 36, undefined, "#91c6cf40");
  ctx.setLineDash([]);
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    ctx.save();
    ctx.translate(c.x + Math.cos(a) * (r - 14), c.y + Math.sin(a) * (r - 14));
    ctx.rotate(a);
    ctx.strokeStyle = "#91c8d763";
    ctx.strokeRect(-3, -3, 6, 6);
    ctx.restore();
  }
  ctx.restore();
  ctx.lineWidth = 2;
  circle(ctx, c.x, c.y, r, undefined, "#7ca8bc6b");
  ctx.lineWidth = 1;
  label(ctx, "S", c.x, c.y + r + 36, "#7799a9", 11);
  label(ctx, "W", c.x - r - 37, c.y + 4, "#7799a9", 11);
  label(ctx, "E", c.x + r + 37, c.y + 4, "#7799a9", 11);
  // Raid markers double as spatial landmarks.
  [
    [c.x - 187, c.y - 133, "#b796ee", "◆"],
    [c.x + 187, c.y - 133, "#e8c77b", "★"],
  ].forEach(([x, y, color, glyph]) => {
    label(ctx, String(glyph), Number(x), Number(y), String(color), 25);
  });
}

export function drawArena(
  canvas: HTMLCanvasElement,
  encounter: EncounterDefinition,
  state: Snapshot,
  mode: TrainingMode,
  review = false,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = encounter.arena;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawPlatform(ctx, encounter);
  const c = encounter.arena.center;
  const activeCast = state.casts.find((cast) => !cast.resolved);
  if (
    mode === "guided" &&
    activeCast &&
    state.actors.find((a) => a.id === activeCast.targetId)?.role === "player"
  ) {
    ctx.setLineDash([4, 6]);
    circle(ctx, c.x + 185, c.y + 60, 33, "#dbe9a408", "#e8fa8a55");
    ctx.setLineDash([]);
    label(ctx, "OPEN SPACE", c.x + 185, c.y + 112, "#dce9ab", 9);
  }
  for (const pool of state.pools) {
    const color = encounter.abilities[pool.abilityId].color;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    const shadow = ctx.createRadialGradient(
      pool.x,
      pool.y,
      0,
      pool.x,
      pool.y,
      pool.radius,
    );
    shadow.addColorStop(0, "#120c22");
    shadow.addColorStop(0.73, "#271637");
    shadow.addColorStop(1, "#5a386f");
    ctx.beginPath();
    ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
    ctx.fillStyle = shadow;
    ctx.fill();
    ctx.shadowBlur = 0;
    circle(ctx, pool.x, pool.y, pool.radius, undefined, "#be87e380");
    for (let i = 0; i < 7; i++) {
      const angle = (i * Math.PI * 2) / 7 + state.elapsed * 0.07;
      circle(
        ctx,
        pool.x + Math.cos(angle) * pool.radius * 0.5,
        pool.y + Math.sin(angle) * pool.radius * 0.5,
        pool.radius * 0.28,
        "#8753a012",
      );
    }
    label(
      ctx,
      encounter.abilities[pool.abilityId].name.toUpperCase(),
      pool.x,
      pool.y + pool.radius + 14,
      "#d5bae8",
      9,
    );
    if (pool.growths)
      label(ctx, `+${pool.growths} GROWTH`, pool.x, pool.y + 19, "#b789c9", 8);
    ctx.restore();
  }
  const boss = encounter.boss;
  const portrait = asset(boss.portrait);
  ctx.shadowColor = activeCast ? "#b799ee" : "#5eaece";
  ctx.shadowBlur = 22;
  circle(
    ctx,
    boss.x,
    boss.y,
    35,
    "#101823",
    activeCast ? "#c5a2f1" : "#547588",
  );
  ctx.shadowBlur = 0;
  if (portrait) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, 30, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(portrait, boss.x - 31, boss.y - 31, 62, 62);
    ctx.restore();
  } else {
    label(ctx, "♛", boss.x, boss.y + 12, "#acd1e5", 37);
  }
  ctx.lineWidth = 2;
  circle(ctx, boss.x, boss.y, 31, undefined, "#bcdaea80");
  ctx.lineWidth = 1;
  label(ctx, boss.name, boss.x, boss.y - 48, "#d1e2ee", 11);
  label(
    ctx,
    activeCast ? "CASTING" : "BOSS",
    boss.x,
    boss.y + 51,
    activeCast ? "#d9bef4" : "#7e9bb2",
    8,
  );
  if (activeCast) {
    const duration = encounter.abilities[activeCast.abilityId].castSeconds;
    const progress = Math.max(
      0,
      1 - (activeCast.resolvesAt - state.elapsed) / duration,
    );
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#d7b6ff";
    ctx.beginPath();
    ctx.arc(
      boss.x,
      boss.y,
      36,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
    );
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  if (state.trail.length > 1) {
    const trail = review ? state.trail : state.trail.slice(-45);
    ctx.beginPath();
    trail.forEach((point, i) =>
      i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
    );
    ctx.strokeStyle = review ? "#e8fa8a80" : "#e8fa8a28";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced)
    for (let i = 0; i < 24; i++) {
      const x = (i * 137 + state.elapsed * (4 + (i % 3))) % width;
      const y = (i * 83 + state.elapsed * (8 + (i % 4))) % height;
      circle(ctx, x, y, i % 4 === 0 ? 1.1 : 0.6, "#c5e8ff35");
    }
  for (const actor of state.actors) {
    const isPlayer = actor.role === "player";
    const targeted = activeCast?.targetId === actor.id;
    const inPool = state.pools.some(
      (pool) =>
        Math.hypot(pool.x - actor.x, pool.y - actor.y) <
        pool.radius + actor.radius,
    );
    circle(ctx, actor.x, actor.y + 4, actor.radius + 3, "#00000040");
    if (targeted) {
      const remaining = activeCast.resolvesAt - state.elapsed;
      circle(
        ctx,
        actor.x,
        actor.y,
        23 + (reduced ? 0 : Math.sin(state.elapsed * 8) * 2),
        "#d39ff318",
        "#dbb6ff",
      );
      label(
        ctx,
        `${remaining.toFixed(1)}s`,
        actor.x,
        actor.y - 35,
        "#ebceff",
        11,
      );
    }
    if (isPlayer && inPool) {
      ctx.save();
      ctx.lineWidth = 2;
      circle(ctx, actor.x, actor.y, 19, undefined, "#ff8174");
      label(ctx, "MOVE OUT", actor.x, actor.y - 29, "#ffb9a9", 11);
      ctx.restore();
    }
    if (isPlayer) {
      ctx.shadowColor = actor.color;
      ctx.shadowBlur = 13;
      circle(ctx, actor.x, actor.y, actor.radius + 4, undefined, "#e8fa8a75");
    }
    circle(
      ctx,
      actor.x,
      actor.y,
      actor.radius,
      inPool ? "#f18b82" : actor.color,
      isPlayer ? "#fffde4" : "#ffffff4d",
    );
    ctx.shadowBlur = 0;
    if (isPlayer) {
      ctx.fillStyle = "#233528";
      ctx.beginPath();
      ctx.moveTo(actor.x, actor.y - 5);
      ctx.lineTo(actor.x + 4, actor.y + 3);
      ctx.lineTo(actor.x - 4, actor.y + 3);
      ctx.closePath();
      ctx.fill();
    }
    label(
      ctx,
      actor.name,
      actor.x,
      actor.y + 25,
      isPlayer ? "#eff6c1" : "#aabac8",
      isPlayer ? 10 : 8,
    );
  }
}
