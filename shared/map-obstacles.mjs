export const OBSTACLE_LANE_COUNT = 3;
export const MAX_OBSTACLES_PER_BAND = 2;

const LOOP_OBSTACLE_BANDS = Object.freeze([
  Object.freeze({ id: "bottom-west", axis: "horizontal", minimum: 520, maximum: 560, lanes: Object.freeze([812, 856, 912]) }),
  Object.freeze({ id: "bottom-east", axis: "horizontal", minimum: 740, maximum: 850, lanes: Object.freeze([812, 856, 912]) }),
  Object.freeze({ id: "right-lower", axis: "vertical", minimum: 710, maximum: 755, lanes: Object.freeze([1128, 1192, 1256]) }),
  Object.freeze({ id: "right-upper", axis: "vertical", minimum: 230, maximum: 300, lanes: Object.freeze([1128, 1192, 1256]) }),
  Object.freeze({ id: "top-east", axis: "horizontal", minimum: 900, maximum: 1030, lanes: Object.freeze([64, 112, 168]) }),
  Object.freeze({ id: "top-west", axis: "horizontal", minimum: 280, maximum: 460, lanes: Object.freeze([64, 112, 168]) }),
  Object.freeze({ id: "left-upper", axis: "vertical", minimum: 250, maximum: 390, lanes: Object.freeze([56, 120, 184]) }),
  Object.freeze({ id: "left-lower", axis: "vertical", minimum: 640, maximum: 740, lanes: Object.freeze([56, 120, 184]) }),
]);

const MAP_OBSTACLE_KINDS = Object.freeze({
  schoolyard: Object.freeze(["traffic-cone", "school-hurdle"]),
  "space-station": Object.freeze(["space-crate", "space-pylon"]),
});

const OBSTACLE_DIMENSIONS = Object.freeze({
  "traffic-cone": Object.freeze({ width: 12, height: 14 }),
  "school-hurdle": Object.freeze({ width: 18, height: 18 }),
  "space-crate": Object.freeze({ width: 18, height: 18 }),
  "space-pylon": Object.freeze({ width: 14, height: 22 }),
});

function nextRandom(random) {
  const value = Number(random());
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(.999999, value));
}

export function generateMapObstacles(mapId, random = Math.random) {
  const kinds = MAP_OBSTACLE_KINDS[mapId];
  if (!kinds) return [];

  const obstacles = [];
  for (const band of LOOP_OBSTACLE_BANDS) {
    const obstacleCount = 1 + Math.floor(nextRandom(random) * MAX_OBSTACLES_PER_BAND);
    const progress = band.minimum + nextRandom(random) * (band.maximum - band.minimum);
    const availableLanes = Array.from({ length: OBSTACLE_LANE_COUNT }, (_, index) => index);
    for (let index = 0; index < obstacleCount; index += 1) {
      const laneChoice = Math.floor(nextRandom(random) * availableLanes.length);
      const laneIndex = availableLanes.splice(laneChoice, 1)[0];
      const kind = kinds[Math.floor(nextRandom(random) * kinds.length)];
      const dimensions = OBSTACLE_DIMENSIONS[kind];
      const centerX = band.axis === "horizontal" ? progress : band.lanes[laneIndex];
      const centerY = band.axis === "horizontal" ? band.lanes[laneIndex] : progress;
      obstacles.push({
        id: `${band.id}:${laneIndex}`,
        bandId: band.id,
        laneIndex,
        axis: band.axis,
        kind,
        x: Math.round(centerX - dimensions.width / 2),
        y: Math.round(centerY - dimensions.height / 2),
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  }
  return obstacles;
}
