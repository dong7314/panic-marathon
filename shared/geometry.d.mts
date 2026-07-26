import type { TrackBounds } from "./game-rules.mjs";
import type { MapDefinition } from "./map-catalog.mjs";

export function insideRect(x: number, y: number, left: number, top: number, right: number, bottom: number): boolean;
export function isTrackPoint(x: number, y: number, track?: TrackBounds): boolean;
export function canStandOnTrack(x: number, y: number, track?: TrackBounds): boolean;
export function isMapTrackPoint(map: MapDefinition, x: number, y: number): boolean;
export function canStandOnMap(map: MapDefinition, x: number, y: number): boolean;
export function getTrackFallTarget(x: number, y: number, distance?: number, track?: TrackBounds): { x: number; y: number };
export function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number;
