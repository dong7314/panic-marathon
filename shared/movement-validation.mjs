import {
  PLAYER_BASE_SPEED,
  RUN_SPEED_MULTIPLIER,
  SLOW_SPEED_MULTIPLIER,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./game-rules.mjs";
import { canStandOnMap, canStandOnTrack } from "./geometry.mjs";

export function getMovementLimit(elapsedMs, slowed = false, running = false, skillSpeedMultiplier = 1) {
  const safeElapsed = Math.max(16, Number.isFinite(elapsedMs) ? elapsedMs : 16);
  const movementScale = skillSpeedMultiplier * (slowed ? SLOW_SPEED_MULTIPLIER : 1) * (running ? RUN_SPEED_MULTIPLIER : 1);
  return Math.min(42, 12 + PLAYER_BASE_SPEED * safeElapsed / 1000 * movementScale);
}

export function isMovementAllowed(fromX, fromY, toX, toY, elapsedMs, slowed = false, running = false, skillSpeedMultiplier = 1, mapOrAllowOffTrack = false) {
  if (![fromX, fromY, toX, toY].every(Number.isFinite)) return false;
  const map = typeof mapOrAllowOffTrack === "object" && mapOrAllowOffTrack ? mapOrAllowOffTrack : undefined;
  const worldWidth = map?.worldWidth ?? WORLD_WIDTH;
  const worldHeight = map?.worldHeight ?? WORLD_HEIGHT;
  if (toX < 0 || toX > worldWidth || toY < 0 || toY > worldHeight) return false;
  const allowOffTrack = map ? map.trackBoundary === "fall" : mapOrAllowOffTrack === true;
  if (!allowOffTrack && !(map ? canStandOnMap(map, toX, toY) : canStandOnTrack(toX, toY))) return false;
  return Math.hypot(toX - fromX, toY - fromY) <= getMovementLimit(elapsedMs, slowed, running, skillSpeedMultiplier);
}
