import { TRACK } from "./game-rules.mjs";

export function insideRect(x, y, left, top, right, bottom) {
  return x >= left && x <= right && y >= top && y <= bottom;
}

export function isTrackPoint(x, y, track = TRACK) {
  return insideRect(x, y, track.outerLeft, track.outerTop, track.outerRight, track.outerBottom)
    && !insideRect(x, y, track.innerLeft, track.innerTop, track.innerRight, track.innerBottom);
}

export function canStandOnTrack(x, y, track = TRACK) {
  return [
    [x - 4, y - 3],
    [x + 4, y - 3],
    [x - 4, y + 6],
    [x + 4, y + 6],
  ].every(([footX, footY]) => isTrackPoint(footX, footY, track));
}

export function isMapTrackPoint(map, x, y) {
  if (map?.courseType !== "linear" || !Array.isArray(map.trackPath) || map.trackPath.length < 2) {
    return isTrackPoint(x, y);
  }
  const halfWidth = Math.max(1, Number(map.trackWidth) || 1) / 2;
  for (let index = 1; index < map.trackPath.length; index += 1) {
    const start = map.trackPath[index - 1];
    const end = map.trackPath[index];
    if (pointSegmentDistance(x, y, start.x, start.y, end.x, end.y) <= halfWidth) return true;
  }
  return false;
}

export function canStandOnMap(map, x, y) {
  return [
    [x - 4, y - 3],
    [x + 4, y - 3],
    [x - 4, y + 6],
    [x + 4, y + 6],
  ].every(([footX, footY]) => isMapTrackPoint(map, footX, footY));
}

export function getTrackFallTarget(x, y, distance = 18, track = TRACK) {
  const fallDistance = Math.max(0, Number(distance) || 0);
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum));

  if (!insideRect(x, y, track.outerLeft, track.outerTop, track.outerRight, track.outerBottom)) {
    const nearestX = clamp(x, track.outerLeft, track.outerRight);
    const nearestY = clamp(y, track.outerTop, track.outerBottom);
    const deltaX = x - nearestX;
    const deltaY = y - nearestY;
    const length = Math.max(1, Math.hypot(deltaX, deltaY));
    return {
      x: x + deltaX / length * fallDistance,
      y: y + deltaY / length * fallDistance,
    };
  }

  const candidates = [];
  if (insideRect(x, y, track.innerLeft, track.innerTop, track.innerRight, track.innerBottom)) {
    candidates.push(
      { distance: x - track.innerLeft, x: 1, y: 0 },
      { distance: track.innerRight - x, x: -1, y: 0 },
      { distance: y - track.innerTop, x: 0, y: 1 },
      { distance: track.innerBottom - y, x: 0, y: -1 },
    );
  } else {
    candidates.push(
      { distance: y - track.outerTop, x: 0, y: -1 },
      { distance: track.outerBottom - y, x: 0, y: 1 },
      { distance: x - track.outerLeft, x: -1, y: 0 },
      { distance: track.outerRight - x, x: 1, y: 0 },
    );
    if (x >= track.innerLeft && x <= track.innerRight) {
      if (y <= track.innerTop) candidates.push({ distance: track.innerTop - y, x: 0, y: 1 });
      if (y >= track.innerBottom) candidates.push({ distance: y - track.innerBottom, x: 0, y: -1 });
    }
    if (y >= track.innerTop && y <= track.innerBottom) {
      if (x <= track.innerLeft) candidates.push({ distance: track.innerLeft - x, x: 1, y: 0 });
      if (x >= track.innerRight) candidates.push({ distance: x - track.innerRight, x: -1, y: 0 });
    }
  }

  const direction = candidates.reduce((nearest, candidate) => (
    candidate.distance < nearest.distance ? candidate : nearest
  ));
  return {
    x: x + direction.x * fallDistance,
    y: y + direction.y * fallDistance,
  };
}

export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abX = bx - ax;
  const abY = by - ay;
  const denominator = abX * abX + abY * abY;
  const progress = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abX + (py - ay) * abY) / denominator));
  return Math.hypot(px - (ax + abX * progress), py - (ay + abY * progress));
}
