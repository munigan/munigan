import type { Point } from "./scenario-model";

/** Project a platform position outward, keeping the central pickup fallback deterministic. */
export function radialPlatformEdge(
  position: Point,
  arenaRadius: number,
): Point {
  const distance = Math.hypot(position.x, position.y);
  if (distance <= 1e-8) return { x: 0, y: -arenaRadius };
  return {
    x: (position.x / distance) * arenaRadius,
    y: (position.y / distance) * arenaRadius,
  };
}
