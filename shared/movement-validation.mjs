import {
  PLAYER_BASE_SPEED,
  RUN_SPEED_MULTIPLIER,
  SLOW_SPEED_MULTIPLIER,
} from "./game-rules.mjs";
import { canStandOnTrack } from "./geometry.mjs";

export function getMovementLimit(elapsedMs, slowed = false, running = false) {
  const safeElapsed = Math.max(16, Number.isFinite(elapsedMs) ? elapsedMs : 16);
  const movementScale = (slowed ? SLOW_SPEED_MULTIPLIER : 1) * (running ? RUN_SPEED_MULTIPLIER : 1);
  return Math.min(42, 12 + PLAYER_BASE_SPEED * safeElapsed / 1000 * movementScale);
}

export function isMovementAllowed(fromX, fromY, toX, toY, elapsedMs, slowed = false, running = false) {
  if (![fromX, fromY, toX, toY].every(Number.isFinite)) return false;
  if (!canStandOnTrack(toX, toY)) return false;
  return Math.hypot(toX - fromX, toY - fromY) <= getMovementLimit(elapsedMs, slowed, running);
}
