import { getArenaAsset } from "./arena-assets";
import type {
  EncounterDefinition,
  Point,
  Snapshot,
  TrainingMode,
} from "./model";

const PAPER_SCENE_SIZE = 840;
const WALKABLE_FLOOR_RATIO = 0.82;

export type ArenaCamera = {
  sceneSize: number;
  floorDiameter: number;
  scale: number;
  origin: Point;
};

export type ArenaRenderOptions = {
  showTrail?: boolean;
  showGrowth?: boolean;
  recordedTrail?: Point[];
  highlightedEvent?: {
    at: number;
    x: number;
    y: number;
    text: string;
    label?: string;
    detail?: string;
  } | null;
};

/**
 * The artwork occupies the complete Paper scene, while its walkable floor
 * occupies 82% of that square. Keeping this transform separate from world
 * state lets the simulation retain its original collision coordinates.
 */
export function createArenaCamera(
  arena: Pick<EncounterDefinition["arena"], "center" | "radius">,
): ArenaCamera {
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

export function worldToScene(camera: ArenaCamera, point: Point): Point {
  return {
    x: camera.origin.x + point.x * camera.scale,
    y: camera.origin.y + point.y * camera.scale,
  };
}

export function sceneToWorld(camera: ArenaCamera, point: Point): Point {
  return {
    x: (point.x - camera.origin.x) / camera.scale,
    y: (point.y - camera.origin.y) / camera.scale,
  };
}

export function worldRadiusToScene(camera: ArenaCamera, radius: number) {
  return radius * camera.scale;
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
  encounter: EncounterDefinition,
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

function drawPools(
  ctx: CanvasRenderingContext2D,
  camera: ArenaCamera,
  encounter: EncounterDefinition,
  state: Snapshot,
  showGrowth: boolean,
  review: boolean,
) {
  const player = state.actors.find((actor) => actor.role === "player");
  for (const pool of state.pools) {
    const ability = encounter.abilities[pool.abilityId];
    const playerInside =
      player &&
      Math.hypot(pool.x - player.x, pool.y - player.y) <
        pool.radius + player.radius;
    const position = worldToScene(camera, pool);
    const radius = worldRadiusToScene(camera, pool.radius);
    const originalRadius = worldRadiusToScene(camera, ability.mechanic.radius);
    const growthVisible = showGrowth && pool.growths > 0;

    ctx.save();
    ctx.lineWidth = playerInside ? 2 : 1.5;
    circle(
      ctx,
      position.x,
      position.y,
      radius,
      "#251b34eb",
      playerInside ? "#f58d88" : "#a282beaa",
    );
    circle(ctx, position.x, position.y, radius * 0.56, "#33214199");

    if (growthVisible && pool.radius > ability.mechanic.radius) {
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      circle(
        ctx,
        position.x,
        position.y,
        originalRadius,
        undefined,
        review ? "#c1a6d5" : "#a282be73",
      );
      ctx.setLineDash([]);
    }

    const personalFailure =
      state.status === "failed" && state.stats.personalHits >= 6;
    const growth = growthVisible ? ` · +${pool.growths} GROWTH` : "";
    const poolLabel = personalFailure
      ? `${state.stats.personalHits} TICKS · PULL ENDED`
      : `${ability.name.toUpperCase()}${growth}`;
    if (!review && (pool.growths > 0 || personalFailure)) {
      label(
        ctx,
        poolLabel,
        position.x,
        position.y + radius + 24,
        personalFailure ? "#dda5ae" : "#bba5cf",
        12,
        500,
      );
    }
    ctx.restore();
  }
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

function drawBoss(
  ctx: CanvasRenderingContext2D,
  camera: ArenaCamera,
  encounter: EncounterDefinition,
) {
  const boss = encounter.boss;
  const position = worldToScene(camera, boss);
  ctx.save();
  ctx.shadowColor = "#7ab6d530";
  ctx.shadowBlur = 24;
  ctx.lineWidth = 1;
  circle(ctx, position.x, position.y, 34, "#0c151d", "#6890a8");
  ctx.shadowBlur = 0;
  if (
    !drawPortrait(ctx, getArenaAsset(boss.portrait), position.x, position.y, 29)
  ) {
    label(ctx, "♛", position.x, position.y + 11, "#acd1e5", 34);
  }
  ctx.letterSpacing = "1.02px";
  label(
    ctx,
    boss.name,
    position.x,
    position.y - 47,
    "#c6d8e4",
    17,
    600,
    '"Barlow Condensed", sans-serif',
  );
  ctx.letterSpacing = "0px";

  ctx.restore();
}

function drawActor(
  ctx: CanvasRenderingContext2D,
  camera: ArenaCamera,
  actor: Snapshot["actors"][number],
  targeted: boolean,
  inPool: boolean,
) {
  const position = worldToScene(camera, actor);
  const isPlayer = actor.role === "player";
  const ringRadius = isPlayer ? 17 : 15;
  const iconRadius = isPlayer ? 13 : 11;

  ctx.save();
  if (targeted && !isPlayer) {
    ctx.lineWidth = 1.5;
    circle(ctx, position.x, position.y, 21, undefined, "#e6bf78");
    ctx.fillStyle = "#e6bf78";
    ctx.beginPath();
    ctx.moveTo(position.x, position.y - 33);
    ctx.lineTo(position.x + 5, position.y - 28);
    ctx.lineTo(position.x, position.y - 23);
    ctx.lineTo(position.x - 5, position.y - 28);
    ctx.closePath();
    ctx.fill();
  }

  if (isPlayer) {
    ctx.shadowColor = "#e6bf7826";
    ctx.shadowBlur = targeted && !inPool ? 14 : 0;
    ctx.lineWidth = 2;
    circle(
      ctx,
      position.x,
      position.y,
      26,
      targeted && !inPool ? "#e6bf7814" : undefined,
      inPool ? "#f58d88" : targeted ? "#e6bf78" : "#9cd6f0",
    );
    ctx.shadowBlur = 0;
  }

  ctx.lineWidth = 2;
  circle(ctx, position.x, position.y, ringRadius, "#090a0c", actor.color);
  if (
    !drawPortrait(
      ctx,
      getArenaAsset(actor.classIcon),
      position.x,
      position.y,
      iconRadius,
    )
  ) {
    circle(
      ctx,
      position.x,
      position.y,
      iconRadius,
      inPool ? "#f18b82" : actor.color,
    );
    label(
      ctx,
      actor.name.slice(0, 1),
      position.x,
      position.y + 4,
      "#090a0c",
      9,
    );
  }
  if (inPool) {
    ctx.lineWidth = 1.5;
    circle(ctx, position.x, position.y, ringRadius + 2, undefined, "#f58d88");
  }
  label(
    ctx,
    actor.name,
    position.x,
    position.y + (isPlayer ? 46 : 29),
    isPlayer ? "#f4e6ba" : "#c6d2da",
    isPlayer ? 14 : 12,
    isPlayer ? 600 : 400,
  );
  ctx.restore();
}

function drawEventMarker(
  ctx: CanvasRenderingContext2D,
  event: NonNullable<ArenaRenderOptions["highlightedEvent"]>,
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
  const boxHeight = 58;
  const boxX = Math.max(
    8,
    Math.min(event.x - 74, camera.sceneSize - boxWidth - 8),
  );
  const boxY = Math.max(8, event.y - 132);
  const markerY = event.y - 57;

  ctx.save();
  ctx.strokeStyle = "#f58d88";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(event.x, markerY);
  ctx.lineTo(event.x, boxY + 48);
  ctx.stroke();
  circle(ctx, event.x, markerY, 3, "#f58d88");

  ctx.lineWidth = 1;
  roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 5, "#261c21", "#86535c");
  ctx.textAlign = "left";
  ctx.font = "500 11px Inter, sans-serif";
  ctx.letterSpacing = "0.55px";
  ctx.fillStyle = "#f4a79e";
  ctx.fillText(heading, boxX + 12, boxY + 22);
  ctx.font = "400 13px Inter, sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#f3f4f5";
  ctx.fillText(detail, boxX + 12, boxY + 48);
  ctx.restore();
}

export function drawArena(
  canvas: HTMLCanvasElement,
  encounter: EncounterDefinition,
  state: Snapshot,
  _mode: TrainingMode,
  review = false,
  options: ArenaRenderOptions = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const camera = createArenaCamera(encounter.arena);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const backingSize = camera.sceneSize * ratio;
  if (canvas.width !== backingSize || canvas.height !== backingSize) {
    canvas.width = backingSize;
    canvas.height = backingSize;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawPlatform(ctx, encounter, camera);

  const activeCast = state.casts.find((cast) => !cast.resolved);

  if (review && options.showTrail) {
    drawTrail(ctx, camera, options.recordedTrail ?? state.trail);
  }
  drawPools(
    ctx,
    camera,
    encounter,
    state,
    review ? Boolean(options.showGrowth) : true,
    review,
  );
  drawBoss(ctx, camera, encounter);

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!reducedMotion) {
    for (let i = 0; i < 12; i++) {
      const point = worldToScene(camera, {
        x: (i * 137 + state.elapsed * (3 + (i % 3))) % encounter.arena.width,
        y: (i * 83 + state.elapsed * (5 + (i % 4))) % encounter.arena.height,
      });
      circle(ctx, point.x, point.y, i % 4 === 0 ? 1 : 0.55, "#c5e8ff25");
    }
  }

  for (const actor of state.actors) {
    const targeted = activeCast?.targetId === actor.id;
    const inPool = state.pools.some(
      (pool) =>
        Math.hypot(pool.x - actor.x, pool.y - actor.y) <
        pool.radius + actor.radius,
    );
    drawActor(ctx, camera, actor, targeted, inPool);
  }
  if (options.highlightedEvent) {
    drawEventMarker(
      ctx,
      {
        ...options.highlightedEvent,
        ...worldToScene(camera, options.highlightedEvent),
      },
      camera,
    );
  }
}
