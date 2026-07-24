export function getMovementLimit(elapsedMs: number, slowed?: boolean, running?: boolean): number;
export function isMovementAllowed(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  elapsedMs: number,
  slowed?: boolean,
  running?: boolean,
): boolean;
