import type { Actor, Point, Session } from "./model";

export function moveActor(
  session: Session,
  actor: Actor,
  direction: Point,
  distance: number,
) {
  const length = Math.hypot(direction.x, direction.y);
  if (!length) return;
  const scale = Math.min(1, length);
  actor.x += (direction.x / length) * distance * scale;
  actor.y += (direction.y / length) * distance * scale;
  const { center, radius } = session.encounter.arena;
  const fromCenter = Math.hypot(actor.x - center.x, actor.y - center.y);
  if (fromCenter > radius - actor.radius - 5) {
    const ratio = (radius - actor.radius - 5) / fromCenter;
    actor.x = center.x + (actor.x - center.x) * ratio;
    actor.y = center.y + (actor.y - center.y) * ratio;
  }
}

export function moveRaid(session: Session, dt: number) {
  const { center } = session.encounter.arena;
  const approaching = session.encounter.timeline.find((event) => {
    const ability = session.encounter.abilities[event.abilityId];
    return (
      session.elapsed >= event.at - ability.warningSeconds &&
      session.elapsed < event.at + ability.regroupAfterSeconds
    );
  });
  for (const actor of session.actors.filter((a) => a.role === "raid")) {
    let goal: Point = actor.home;
    if (approaching) {
      goal = {
        x: center.x + (actor.home.x - center.x) * 1.8,
        y: center.y + (actor.home.y - center.y) * 1.5,
      };
    }
    const targeted = session.casts.find(
      (cast) => cast.targetId === actor.id && session.elapsed < cast.regroupAt,
    );
    if (targeted) {
      const side = session.seed % 2 === 0 ? -1 : 1;
      goal = {
        x: center.x + side * 180,
        y: center.y + (targeted.resolved ? 155 : 65),
      };
    }
    let dx = goal.x - actor.x,
      dy = goal.y - actor.y;
    for (const pool of session.pools) {
      const px = actor.x - pool.x,
        py = actor.y - pool.y;
      const gap = Math.hypot(px, py);
      if (gap < pool.radius + 36) {
        // Escape radially when inside; follow the boundary on the way back.
        const ux = gap > 0.01 ? px / gap : 1;
        const uy = gap > 0.01 ? py / gap : 0;
        if (gap < pool.radius + actor.radius + 10) {
          dx = ux * 125;
          dy = uy * 125;
        } else if (dx * ux + dy * uy < 0) {
          const sign = dx * -uy + dy * ux >= 0 ? 1 : -1;
          dx = -uy * sign * 80 + ux * 20;
          dy = ux * sign * 80 + uy * 20;
        }
      }
    }
    const distance = Math.hypot(dx, dy);
    if (distance > 1)
      moveActor(session, actor, { x: dx, y: dy }, Math.min(100 * dt, distance));
  }
}
