import type { MapId } from "./map-catalog.mjs";

export type MapObstacleKind = "traffic-cone" | "school-hurdle" | "space-crate" | "space-pylon";
export type MapObstacle = Readonly<{
  id: string;
  bandId: string;
  laneIndex: number;
  axis: "horizontal" | "vertical";
  kind: MapObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export const OBSTACLE_LANE_COUNT: number;
export const MAX_OBSTACLES_PER_BAND: number;
export function generateMapObstacles(mapId: MapId, random?: () => number): MapObstacle[];
