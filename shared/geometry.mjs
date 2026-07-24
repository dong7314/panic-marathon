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

export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abX = bx - ax;
  const abY = by - ay;
  const denominator = abX * abX + abY * abY;
  const progress = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abX + (py - ay) * abY) / denominator));
  return Math.hypot(px - (ax + abX * progress), py - (ay + abY * progress));
}
