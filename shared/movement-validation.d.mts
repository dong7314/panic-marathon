export function getMovementLimit(
  elapsedMs: number,
  slowed?: boolean,
  running?: boolean,
  skillSpeedMultiplier?: number,
): number;
export function isMovementAllowed(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  elapsedMs: number,
  slowed?: boolean,
  running?: boolean,
  skillSpeedMultiplier?: number,
  mapOrAllowOffTrack?: MapDefinition | boolean,
): boolean;
import type { MapDefinition } from "./map-catalog.mjs";
