export const HAZARD_LANE_COUNT = 3;

const LOOP_HAZARD_SECTIONS = Object.freeze({
  bottom: Object.freeze({
    axis: "horizontal",
    lanes: Object.freeze([812, 856, 912]),
    pitRange: Object.freeze([260, 390]),
    spinnerRange: Object.freeze([610, 700]),
  }),
  right: Object.freeze({
    axis: "vertical",
    lanes: Object.freeze([1128, 1192, 1256]),
    pitRange: Object.freeze([340, 420]),
    spinnerRange: Object.freeze([510, 600]),
  }),
  top: Object.freeze({
    axis: "horizontal",
    lanes: Object.freeze([64, 112, 168]),
    pitRange: Object.freeze([760, 850]),
    spinnerRange: Object.freeze([600, 710]),
  }),
  left: Object.freeze({
    axis: "vertical",
    lanes: Object.freeze([56, 120, 184]),
    pitRange: Object.freeze([425, 460]),
    spinnerRange: Object.freeze([555, 595]),
  }),
});

const LOOP_HAZARD_SIDES = Object.freeze(Object.keys(LOOP_HAZARD_SECTIONS));

const MAP_HAZARD_COUNTS = Object.freeze({
  schoolyard: Object.freeze({ pits: 4, spinners: 3 }),
  "space-station": Object.freeze({ pits: 2, spinners: 3 }),
});

const PIT_SIZE = 34;
const SPINNER_RADIUS = 46;

function nextRandom(random) {
  const value = Number(random());
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(.999999, value));
}

function shuffledSides(random) {
  const sides = [...LOOP_HAZARD_SIDES];
  for (let index = sides.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom(random) * (index + 1));
    [sides[index], sides[swapIndex]] = [sides[swapIndex], sides[index]];
  }
  return sides;
}

function pointForSection(section, range, laneIndex, random) {
  const progress = range[0] + nextRandom(random) * (range[1] - range[0]);
  return section.axis === "horizontal"
    ? { x: progress, y: section.lanes[laneIndex] }
    : { x: section.lanes[laneIndex], y: progress };
}

function createPit(side, random) {
  const section = LOOP_HAZARD_SECTIONS[side];
  const laneIndex = Math.floor(nextRandom(random) * HAZARD_LANE_COUNT);
  const center = pointForSection(section, section.pitRange, laneIndex, random);
  return {
    id: `pit:${side}`,
    side,
    laneIndex,
    axis: section.axis,
    x: Math.round(center.x - PIT_SIZE / 2),
    y: Math.round(center.y - PIT_SIZE / 2),
    width: PIT_SIZE,
    height: PIT_SIZE,
  };
}

function createSpinner(side, random) {
  const section = LOOP_HAZARD_SECTIONS[side];
  const laneIndex = Math.floor(nextRandom(random) * HAZARD_LANE_COUNT);
  const center = pointForSection(section, section.spinnerRange, laneIndex, random);
  const direction = nextRandom(random) < .5 ? -1 : 1;
  return {
    id: `spinner:${side}`,
    side,
    laneIndex,
    axis: section.axis,
    x: Math.round(center.x),
    y: Math.round(center.y),
    radius: SPINNER_RADIUS,
    speed: direction * (2.3 + nextRandom(random) * .9),
  };
}

export function generateMapHazards(mapId, random = Math.random) {
  const counts = MAP_HAZARD_COUNTS[mapId];
  if (!counts) return { pitZones: [], spinners: [] };

  const pitSides = shuffledSides(random).slice(0, counts.pits);
  const spinnerSides = shuffledSides(random).slice(0, counts.spinners);
  return {
    pitZones: pitSides.map((side) => createPit(side, random)),
    spinners: spinnerSides.map((side) => createSpinner(side, random)),
  };
}

export function getHazardLaneCenters(side) {
  return LOOP_HAZARD_SECTIONS[side]?.lanes ?? [];
}
