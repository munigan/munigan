import { getArenaAsset, scenarioArtwork } from "./arena-assets";
import type {
  Point,
  PublicWorld,
  RunSpec,
  ScenarioRenderOptions,
  View,
} from "./scenario-model";

const PAPER_SCENE_SIZE = 840;
const WALKABLE_FLOOR_RATIO = 0.82;

type ArenaCamera = {
  sceneSize: number;
  floorDiameter: number;
  scale: number;
  origin: Point;
};

/**
 * The artwork occupies the complete Paper scene, while its walkable floor
 * occupies 82% of that square. Keeping this transform separate from world
 * state lets the simulation retain its original collision coordinates.
 */
function createArenaCamera(arena: {
  center: Point;
  radius: number;
}): ArenaCamera {
  const floorDiameter = PAPER_SCENE_SIZE * WALKABLE_FLOOR_RATIO;
  const scale = floorDiameter / (arena.radius * 2);
  const sceneCenter = PAPER_SCENE_SIZE / 2;
  return {
    sceneSize: PAPER_SCENE_SIZE,
    floorDiameter,
    scale,
    origin: {
      x: sceneCenter - arena.center.x * scale,
      y: sceneCenter - arena.center.y * scale,
    },
  };
}

function worldToScene(camera: ArenaCamera, point: Point): Point {
  return {
    x: camera.origin.x + point.x * camera.scale,
    y: camera.origin.y + point.y * camera.scale,
  };
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill?: string | CanvasGradient,
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

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 10,
  weight = 600,
  family = "Inter, sans-serif",
) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawReferenceMarkers(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = "#be9cde";
  ctx.beginPath();
  ctx.moveTo(167, 226);
  ctx.lineTo(174, 233);
  ctx.lineTo(167, 240);
  ctx.lineTo(160, 233);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#e6bf78";
  ctx.beginPath();
  ctx.moveTo(675, 222);
  ctx.lineTo(678, 230);
  ctx.lineTo(687, 230);
  ctx.lineTo(680, 236);
  ctx.lineTo(682, 245);
  ctx.lineTo(675, 240);
  ctx.lineTo(668, 245);
  ctx.lineTo(670, 236);
  ctx.lineTo(663, 230);
  ctx.lineTo(672, 230);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  encounter: { artwork: string },
  camera: ArenaCamera,
) {
  const sceneCenter = camera.sceneSize / 2;
  const artwork = getArenaAsset(encounter.artwork);

  ctx.fillStyle = "#07080A";
  ctx.fillRect(0, 0, camera.sceneSize, camera.sceneSize);
  if (artwork) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(artwork, 0, 0, camera.sceneSize, camera.sceneSize);
    ctx.restore();
  } else {
    const ice = ctx.createRadialGradient(
      sceneCenter,
      sceneCenter - 70,
      0,
      sceneCenter,
      sceneCenter,
      camera.floorDiameter / 2,
    );
    ice.addColorStop(0, "#243c49");
    ice.addColorStop(0.7, "#182e3a");
    ice.addColorStop(1, "#10212b");
    circle(ctx, sceneCenter, sceneCenter, camera.floorDiameter / 2, ice);
  }

  // These match the 636 × 476 reference SVG at (104, 168) in Paper.
  drawReferenceMarkers(ctx);
  label(ctx, "W", 104, 414, "#96afbd", 11, 400);
  label(ctx, "E", 731, 414, "#96afbd", 11, 400);

  const vignette = ctx.createRadialGradient(
    sceneCenter,
    sceneCenter,
    0,
    sceneCenter,
    sceneCenter,
    Math.SQRT2 * sceneCenter,
  );
  vignette.addColorStop(0.4, "#07080A00");
  vignette.addColorStop(0.55, "#07080A40");
  vignette.addColorStop(0.72, "#07080Aff");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, camera.sceneSize, camera.sceneSize);
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  camera: ArenaCamera,
  trail: Point[],
) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.beginPath();
  trail.forEach((point, index) => {
    const scenePoint = worldToScene(camera, point);
    if (index) ctx.lineTo(scenePoint.x, scenePoint.y);
    else ctx.moveTo(scenePoint.x, scenePoint.y);
  });
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#9cd6f0";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
  const first = worldToScene(camera, trail[0]);
  circle(ctx, first.x, first.y, 4, "#9cd6f0");
  ctx.restore();
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  radius: number,
) {
  if (!image) return false;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
  return true;
}

function annotationLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
) {
  const lines: string[] = [];
  let rest = text;
  while (rest && lines.length < 2) {
    if (ctx.measureText(rest).width <= width) {
      lines.push(rest);
      break;
    }
    const suffix = lines.length === 1 ? "…" : "";
    let length = rest.length;
    while (
      length > 0 &&
      ctx.measureText(rest.slice(0, length) + suffix).width > width
    )
      length--;
    const space = rest.lastIndexOf(" ", length);
    const end = space > 0 ? space : length;
    lines.push(rest.slice(0, end).trimEnd() + suffix);
    rest = rest.slice(end).trimStart();
  }
  return lines;
}

function drawEventMarker(
  ctx: CanvasRenderingContext2D,
  event: Point & { at: number; text: string; label?: string; detail?: string },
  camera: ArenaCamera,
) {
  const stamp = `${Math.floor(event.at / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(event.at % 60)
    .toString()
    .padStart(2, "0")}`;
  const heading = `${stamp} · ${event.label ?? "EVENT"}`;
  const detail = event.detail ?? event.text;
  const boxWidth = 180;
  ctx.save();
  ctx.font = "500 11px Inter, sans-serif";
  ctx.letterSpacing = "0.55px";
  const headingLines = annotationLines(ctx, heading, boxWidth - 24);
  ctx.font = "400 13px Inter, sans-serif";
  ctx.letterSpacing = "0px";
  const detailLines = annotationLines(ctx, detail, boxWidth - 24);
  const detailY = 22 + headingLines.length * 16 + 10;
  const boxHeight = detailY + (detailLines.length - 1) * 18 + 10;
  const boxX = Math.max(
    8,
    Math.min(event.x - 74, camera.sceneSize - boxWidth - 8),
  );
  const boxY = Math.max(
    8,
    Math.min(event.y - 74 - boxHeight, camera.sceneSize - boxHeight - 8),
  );
  const markerY = event.y - 57;

  ctx.strokeStyle = "#f58d88";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(event.x, markerY);
  ctx.lineTo(event.x, boxY + boxHeight);
  ctx.stroke();
  circle(ctx, event.x, markerY, 3, "#f58d88");

  ctx.lineWidth = 1;
  roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 5, "#261c21", "#86535c");
  ctx.textAlign = "left";
  ctx.font = "500 11px Inter, sans-serif";
  ctx.letterSpacing = "0.55px";
  ctx.fillStyle = "#f4a79e";
  headingLines.forEach((line, index) =>
    ctx.fillText(line, boxX + 12, boxY + 22 + index * 16),
  );
  ctx.font = "400 13px Inter, sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#f3f4f5";
  detailLines.forEach((line, index) =>
    ctx.fillText(line, boxX + 12, boxY + detailY + index * 18),
  );
  ctx.restore();
}

function bossPosition(run: RunSpec, world: PublicWorld): Point {
  if (
    run.scenario.family === "before-valkyrs" ||
    run.scenario.family === "after-valkyrs"
  )
    return { x: 0, y: 4 };
  const targets = new Set(
    world.casts.filter((c) => !c.resolved).map((c) => c.targetId),
  );
  // Median of the actual formation is robust to the separated pool target and
  // raiders recovering from hazards. Replay uses the same recorded positions.
  const formation = world.actors.filter(
    (a) =>
      a.available &&
      !a.carriedBy &&
      a.control !== "player" &&
      a.role !== "soaker" &&
      a.role !== "tank" &&
      !targets.has(a.id),
  );
  const median = (values: number[]) => {
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2
      ? values[mid]
      : (values[mid - 1] + values[mid]) / 2;
  };
  if (!formation.length) return { x: 0, y: 0 };
  const center = {
    x: median(formation.map((a) => a.x)),
    y: median(formation.map((a) => a.y)),
  };
  const dx = run.scenario.strategy.spiritOrigin.x - center.x;
  const dy = run.scenario.strategy.spiritOrigin.y - center.y;
  const distance = Math.hypot(dx, dy);
  return {
    x: center.x + (distance ? (dx / distance) * 4 : 0),
    y: center.y + (distance ? (dy / distance) * 4 : -4),
  };
}

function drawBoss(ctx: CanvasRenderingContext2D, position: Point) {
  ctx.save();
  ctx.shadowColor = "#7ab6d530";
  ctx.shadowBlur = 24;
  ctx.lineWidth = 1;
  circle(ctx, position.x, position.y, 34, "#0c151d", "#6890a8");
  ctx.shadowBlur = 0;
  drawPortrait(
    ctx,
    getArenaAsset(scenarioArtwork.boss),
    position.x,
    position.y,
    29,
  );
  ctx.restore();
}

function drawBossLabel(ctx: CanvasRenderingContext2D, position: Point) {
  ctx.save();
  ctx.letterSpacing = "1.02px";
  label(
    ctx,
    "THE LICH KING",
    position.x,
    position.y - 47,
    "#c6d8e4",
    17,
    600,
    '"Barlow Condensed", sans-serif',
  );
  ctx.restore();
}

function drawHazards(
  ctx: CanvasRenderingContext2D,
  run: RunSpec,
  world: PublicWorld,
  camera: ArenaCamera,
  growth: boolean,
) {
  const you = world.actors.find((a) => a.control === "player");
  for (const pool of world.pools) {
    const p = worldToScene(camera, pool);
    const radius = pool.radius * camera.scale;
    const inside =
      you &&
      Math.hypot(you.x - pool.x, you.y - pool.y) < pool.radius + you.radius;
    ctx.lineWidth = inside ? 2 : 1.5;
    circle(
      ctx,
      p.x,
      p.y,
      radius,
      "#251b34eb",
      inside ? "#f58d88" : "#a282beaa",
    );
    circle(ctx, p.x, p.y, radius * 0.56, "#33214199");
    if (growth && pool.growths) {
      ctx.setLineDash([4, 5]);
      circle(
        ctx,
        p.x,
        p.y,
        run.profile.defile.radius * camera.scale,
        undefined,
        "#c1a6d5",
      );
      ctx.setLineDash([]);
    }
  }
  for (const spirit of world.spirits) {
    if (spirit.explodedAt === null) continue;
    const age = world.elapsed - spirit.explodedAt;
    if (age < 0 || age >= 0.6) continue;
    const p = worldToScene(camera, spirit);
    ctx.save();
    ctx.globalAlpha = 1 - age / 0.6;
    ctx.lineWidth = 1.5;
    circle(
      ctx,
      p.x,
      p.y,
      run.profile.spirits.burstRadius * camera.scale,
      "#9cd6f024",
      "#9cd6f0",
    );
    ctx.restore();
  }
  for (const event of world.events) {
    const life =
      event.kind === "return" ? 1.2 : event.kind === "release" ? 0.6 : 0;
    const age = world.elapsed - event.at;
    if (!life || age < 0 || age >= life || !event.position) continue;
    const p = worldToScene(camera, event.position);
    ctx.save();
    ctx.globalAlpha = 1 - age / life;
    ctx.lineWidth = 2;
    circle(
      ctx,
      p.x,
      p.y,
      (event.kind === "return" ? 5 : 2) * camera.scale,
      undefined,
      "#e6bf78",
    );
    ctx.restore();
  }
}

function drawSpirit(
  ctx: CanvasRenderingContext2D,
  spirit: PublicWorld["spirits"][number],
  world: PublicWorld,
  camera: ArenaCamera,
) {
  if (spirit.bornAt > world.elapsed || spirit.explodedAt !== null) return;
  const p = worldToScene(camera, spirit);
  const active = world.elapsed >= spirit.activeAt;
  ctx.save();
  ctx.globalAlpha = active ? 0.95 : 0.38;
  const image = getArenaAsset(scenarioArtwork.spirit);
  if (image) ctx.drawImage(image, p.x - 13, p.y - 16, 26, 32);
  const target = world.actors.find((a) => a.id === spirit.targetId);
  if (active && target) {
    const angle = Math.atan2(target.y - spirit.y, target.x - spirit.x);
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(19, -4);
    ctx.lineTo(24, 0);
    ctx.lineTo(19, 4);
    ctx.strokeStyle = "#9cd6f0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawCarrier(
  ctx: CanvasRenderingContext2D,
  valkyr: PublicWorld["valkyrs"][number],
  run: RunSpec,
  world: PublicWorld,
  camera: ArenaCamera,
) {
  if (valkyr.state !== "descending" && valkyr.state !== "carrying") return;
  const p = worldToScene(camera, valkyr);
  const descent =
    valkyr.state === "descending"
      ? Math.max(
          0,
          Math.min(
            1,
            (valkyr.pickupAt - world.elapsed) / run.profile.valkyrs.descent,
          ),
        )
      : 0;
  // The connector ends at the true ground coordinate. Height only illustrates
  // flight; the passenger portrait never leaves its recorded physics position.
  const height = 30 + descent * 30;
  ctx.save();
  ctx.globalAlpha = 1 - descent * 0.5;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e6bf7880";
  ctx.setLineDash(valkyr.state === "descending" ? [3, 4] : []);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 14);
  ctx.lineTo(p.x, p.y - height);
  ctx.stroke();
  ctx.setLineDash([]);
  const image = getArenaAsset(scenarioArtwork.valkyr);
  if (image) ctx.drawImage(image, p.x - 25, p.y - height - 30, 50, 38);
  ctx.restore();
}

function drawActor(
  ctx: CanvasRenderingContext2D,
  actor: PublicWorld["actors"][number],
  world: PublicWorld,
  camera: ArenaCamera,
  targeted: boolean,
) {
  const p = worldToScene(camera, actor);
  const you = actor.control === "player";
  const inPool = world.pools.some(
    (pool) =>
      Math.hypot(pool.x - actor.x, pool.y - actor.y) <
      pool.radius + actor.radius,
  );
  ctx.save();
  ctx.globalAlpha = actor.available ? 1 : 0.35;
  ctx.lineWidth = 2;
  if (you || targeted || actor.role === "soaker")
    circle(
      ctx,
      p.x,
      p.y,
      you ? 26 : 21,
      undefined,
      inPool ? "#f58d88" : targeted ? "#e6bf78" : "#9cd6f0",
    );
  circle(ctx, p.x, p.y, you ? 17 : 15, "#090a0c", actor.color);
  drawPortrait(ctx, getArenaAsset(actor.classIcon), p.x, p.y, you ? 13 : 11);
  if (inPool) circle(ctx, p.x, p.y, you ? 19 : 17, undefined, "#f58d88");
  ctx.restore();
}

function callout(
  ctx: CanvasRenderingContext2D,
  text: string,
  ground: Point,
  end: Point,
  color: string,
  size = 11,
) {
  ctx.save();
  const dx = end.x - ground.x,
    dy = end.y - ground.y;
  const distance = Math.hypot(dx, dy);
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ground.x + (dx / distance) * 27, ground.y + (dy / distance) * 27);
  ctx.lineTo(end.x, end.y - 12);
  ctx.stroke();
  ctx.font = `600 ${size}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.strokeStyle = "#07080A";
  ctx.lineWidth = 3;
  ctx.strokeText(text, end.x, end.y);
  label(ctx, text, end.x, end.y, color, size);
  ctx.restore();
}

/** All motion/targets come from the public world, and trails are supplied by
 * recorded frames. The run contributes only profile geometry and static art. */
export function drawScenario(
  canvas: HTMLCanvasElement,
  run: RunSpec,
  view: View,
  options: ScenarioRenderOptions = {},
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const camera = createArenaCamera({
    center: { x: 0, y: 0 },
    radius: run.profile.arenaRadius,
  });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== 840 * ratio || canvas.height !== 840 * ratio) {
    canvas.width = 840 * ratio;
    canvas.height = 840 * ratio;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.save();
  drawPlatform(ctx, { artwork: scenarioArtwork.arena }, camera);
  const world = view.world;
  // Ground effects may grow beyond the platform physically; their visible floor
  // footprint stops at its edge so the square canvas never becomes a hazard.
  ctx.save();
  ctx.beginPath();
  ctx.arc(
    camera.sceneSize / 2,
    camera.sceneSize / 2,
    camera.floorDiameter / 2,
    0,
    Math.PI * 2,
  );
  ctx.clip();
  drawHazards(ctx, run, world, camera, options.showGrowth ?? true);
  ctx.restore();
  if (options.showTrail) drawTrail(ctx, camera, options.recordedTrail ?? []);
  const targets = new Set(
    world.casts.filter((c) => !c.resolved && c.targetId).map((c) => c.targetId),
  );
  const priority = (a: PublicWorld["actors"][number]) =>
    a.control === "player"
      ? 4
      : targets.has(a.id)
        ? 3
        : a.role === "soaker"
          ? 2
          : a.carriedBy
            ? 1
            : 0;
  const ordered = [...world.actors].sort((a, b) => priority(a) - priority(b));
  for (const actor of ordered.filter((a) => priority(a) === 0))
    drawActor(ctx, actor, world, camera, false);
  const boss = worldToScene(camera, bossPosition(run, world));
  drawBoss(ctx, boss);
  for (const spirit of world.spirits) drawSpirit(ctx, spirit, world, camera);
  for (const valkyr of world.valkyrs)
    drawCarrier(ctx, valkyr, run, world, camera);
  for (const actor of ordered.filter((a) => priority(a) > 0))
    drawActor(ctx, actor, world, camera, targets.has(actor.id));

  // Callouts remain separate from ground coordinates so a dense, genuine
  // 25-player stack is readable without displacing any friendly token.
  drawBossLabel(ctx, boss);
  if (options.showGrowth ?? true) {
    for (const pool of world.pools.filter((pool) => pool.growths > 0)) {
      const p = worldToScene(camera, pool);
      label(
        ctx,
        `DEFILE · +${pool.growths} GROWTH`,
        p.x,
        p.y + pool.radius * camera.scale + 24,
        "#bba5cf",
        12,
        500,
      );
    }
  }
  const marker = worldToScene(camera, world.anchor);
  ctx.lineWidth = 1;
  circle(ctx, marker.x, marker.y, 4, "#e6bf78");
  callout(
    ctx,
    "◆ MARKER",
    marker,
    { x: marker.x + 100, y: marker.y - 25 },
    "#e6bf78",
    10,
  );
  for (const actor of ordered) {
    const p = worldToScene(camera, actor);
    const you = actor.control === "player";
    const target = targets.has(actor.id);
    const soaker = actor.role === "soaker";
    const stacked = world.actors.some(
      (other) =>
        other.id !== actor.id &&
        Math.hypot(other.x - actor.x, other.y - actor.y) * camera.scale < 40,
    );
    if (you) {
      const nearby = world.actors.filter(
        (other) =>
          Math.hypot(other.x - actor.x, other.y - actor.y) * camera.scale < 75,
      );
      const bottom = Math.max(
        p.y + 18,
        ...nearby.map((other) => worldToScene(camera, other).y),
      );
      callout(
        ctx,
        target ? "YOU · DEFILE" : "YOU",
        p,
        { x: p.x, y: bottom + 32 },
        "#f4e6ba",
        14,
      );
    } else if (target)
      callout(
        ctx,
        `${actor.name} · DEFILE`,
        p,
        { x: p.x + 90, y: p.y - 76 },
        "#e6bf78",
        12,
      );
    else if (soaker)
      callout(ctx, "SOAKER", p, { x: p.x - 85, y: p.y + 6 }, "#9cd6f0", 11);
    else if (!stacked)
      label(
        ctx,
        actor.carriedBy ? `${actor.name} · CARRIED` : actor.name,
        p.x,
        p.y + 29,
        "#a5b3bc",
        10,
        400,
      );
  }
  const event = options.highlightedEvent;
  if (event?.position)
    drawEventMarker(
      ctx,
      {
        ...worldToScene(camera, event.position),
        at: event.at,
        text: options.highlightedDetail ?? event.kind,
        label: options.highlightedLabel ?? event.kind.toUpperCase(),
      },
      camera,
    );
  ctx.restore();
}
