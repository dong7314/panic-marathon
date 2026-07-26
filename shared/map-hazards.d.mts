import type { MapId } from "./map-catalog.mjs";

export type HazardSide = "bottom" | "right" | "top" | "left";
export type HazardAxis = "horizontal" | "vertical";
export type GeneratedPitZone = Readonly<{
  id: string;
  side: HazardSide;
  laneIndex: number;
  axis: HazardAxis;
  x: number;
  y: number;
  width: number;
  height: number;
}>;
export type GeneratedSpinner = Readonly<{
  id: string;
  side: HazardSide;
  laneIndex: number;
  axis: HazardAxis;
  x: number;
  y: number;
  radius: number;
  speed: number;
}>;
export type GeneratedMapHazards = Readonly<{
  pitZones: GeneratedPitZone[];
  spinners: GeneratedSpinner[];
}>;

export const HAZARD_LANE_COUNT: number;
export function generateMapHazards(mapId: MapId, random?: () => number): GeneratedMapHazards;
export function getHazardLaneCenters(side: HazardSide): readonly number[];
