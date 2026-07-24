import type { TrackBounds } from "./game-rules.mjs";

export function insideRect(x: number, y: number, left: number, top: number, right: number, bottom: number): boolean;
export function isTrackPoint(x: number, y: number, track?: TrackBounds): boolean;
export function canStandOnTrack(x: number, y: number, track?: TrackBounds): boolean;
export function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number;
