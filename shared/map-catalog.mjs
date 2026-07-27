export const MAP_IDS = Object.freeze(["schoolyard", "space-station", "mountain-pass"]);
export const DEFAULT_MAP_ID = "schoolyard";

const LOOP_START_POINT = Object.freeze({ x: 128, y: 856 });
const LOOP_SPAWN_POINTS = Object.freeze([
  Object.freeze({ x: 128, y: 856 }),
  Object.freeze({ x: 178, y: 856 }),
  Object.freeze({ x: 226, y: 856 }),
  Object.freeze({ x: 274, y: 856 }),
  Object.freeze({ x: 322, y: 856 }),
  Object.freeze({ x: 370, y: 856 }),
]);
const LOOP_RESPAWN_POINTS = Object.freeze([
  LOOP_START_POINT,
  Object.freeze({ x: 1152, y: 856 }),
  Object.freeze({ x: 1152, y: 120 }),
  Object.freeze({ x: 128, y: 120 }),
]);
const LOOP_CHECKPOINTS = Object.freeze([
  Object.freeze({ x: 1120, y: 816, width: 72, height: 74, spawnX: 1152, spawnY: 856 }),
  Object.freeze({ x: 1120, y: 80, width: 72, height: 74, spawnX: 1152, spawnY: 120 }),
  Object.freeze({ x: 105, y: 80, width: 72, height: 74, spawnX: 128, spawnY: 120 }),
]);
const LOOP_FINISH_GATE = Object.freeze({ x: 128, y: 810, width: 62, height: 82 });

export const MAP_DEFINITIONS = Object.freeze({
  schoolyard: Object.freeze({
    id: "schoolyard",
    name: "말썽 운동장",
    tagline: "구덩이와 회전판이 기다리는 클래식 트랙",
    theme: "schoolyard",
    courseType: "loop",
    trackBoundary: "blocked",
    movementSpeedMultiplier: 1,
    worldWidth: 1344,
    worldHeight: 1008,
    trackPath: Object.freeze([]),
    trackWidth: 0,
    startPoint: LOOP_START_POINT,
    spawnPoints: LOOP_SPAWN_POINTS,
    respawnPoints: LOOP_RESPAWN_POINTS,
    checkpoints: LOOP_CHECKPOINTS,
    finishGate: LOOP_FINISH_GATE,
    palette: Object.freeze({
      trackA: "#d96b68",
      trackB: "#e67b70",
      trackEdge: "#bd555e",
      trackSpeck: "#f39a83",
      infieldA: "#5da267",
      infieldB: "#64ad6d",
      infieldSpeck: "#8cca78",
      exteriorA: "#45476d",
      exteriorB: "#3d4166",
      exteriorBase: "#2f3153",
      exteriorSpeck: "#777695",
      outerLine: "#f4d7ab",
      innerLine: "#b94958",
      laneLine: "#f8dab1",
      accent: "#f6d477",
    }),
    pitZones: Object.freeze([
      Object.freeze({ x: 260, y: 836, width: 34, height: 36 }),
      Object.freeze({ x: 1168, y: 350, width: 34, height: 31 }),
      Object.freeze({ x: 115, y: 510, width: 34, height: 31 }),
      Object.freeze({ x: 840, y: 88, width: 34, height: 34 }),
    ]),
    jumpPads: Object.freeze([
      Object.freeze({ x: 920, y: 836, width: 40, height: 30, pushX: -320, pushY: 0 }),
    ]),
    spinners: Object.freeze([
      Object.freeze({ x: 650, y: 856, radius: 52, speed: 2.15 }),
      Object.freeze({ x: 1190, y: 492, radius: 48, speed: -2.8 }),
      Object.freeze({ x: 660, y: 112, radius: 48, speed: 3.1 }),
    ]),
    rockBarriers: Object.freeze([]),
    rollingRocks: null,
  }),
  "space-station": Object.freeze({
    id: "space-station",
    name: "우주 정거장",
    tagline: "난간 없는 정거장 트랙에서 우주 공간으로 떨어지지 마세요",
    theme: "space-station",
    courseType: "loop",
    trackBoundary: "fall",
    movementSpeedMultiplier: 1,
    worldWidth: 1344,
    worldHeight: 1008,
    trackPath: Object.freeze([]),
    trackWidth: 0,
    startPoint: LOOP_START_POINT,
    spawnPoints: LOOP_SPAWN_POINTS,
    respawnPoints: LOOP_RESPAWN_POINTS,
    checkpoints: LOOP_CHECKPOINTS,
    finishGate: LOOP_FINISH_GATE,
    palette: Object.freeze({
      trackA: "#53657d",
      trackB: "#46576f",
      trackEdge: "#202a40",
      trackSpeck: "#91acc4",
      infieldA: "#050817",
      infieldB: "#080d22",
      infieldSpeck: "#89d9ff",
      exteriorA: "#030511",
      exteriorB: "#070b1d",
      exteriorBase: "#02030c",
      exteriorSpeck: "#e5f7ff",
      outerLine: "#70e7ff",
      innerLine: "#ffcf5c",
      laneLine: "#9aa9c7",
      accent: "#ff6b9f",
    }),
    pitZones: Object.freeze([
      Object.freeze({ x: 470, y: 836, width: 34, height: 36 }),
      Object.freeze({ x: 1170, y: 350, width: 34, height: 31 }),
    ]),
    jumpPads: Object.freeze([
      Object.freeze({ x: 920, y: 836, width: 40, height: 30, pushX: -320, pushY: 0 }),
      Object.freeze({ x: 1168, y: 650, width: 30, height: 40, pushX: 0, pushY: -320 }),
    ]),
    spinners: Object.freeze([
      Object.freeze({ x: 650, y: 856, radius: 52, speed: 2.45 }),
      Object.freeze({ x: 1190, y: 492, radius: 48, speed: -3.1 }),
      Object.freeze({ x: 660, y: 112, radius: 48, speed: 3.35 }),
    ]),
    rockBarriers: Object.freeze([]),
    rollingRocks: null,
  }),
  "mountain-pass": Object.freeze({
    id: "mountain-pass",
    name: "우당탕 산맥",
    tagline: "완만한 오르막을 끝까지 올라 낙석과 암벽 사이를 돌파하세요",
    theme: "mountain-pass",
    courseType: "linear",
    trackBoundary: "blocked",
    movementSpeedMultiplier: .85,
    worldWidth: 2420,
    worldHeight: 1512,
    trackPath: Object.freeze([
      Object.freeze({ x: 132, y: 1263 }),
      Object.freeze({ x: 2234, y: 104 }),
    ]),
    trackWidth: 180,
    startPoint: Object.freeze({ x: 132, y: 1263 }),
    spawnPoints: Object.freeze([
      Object.freeze({ x: 103, y: 1210 }),
      Object.freeze({ x: 115, y: 1231 }),
      Object.freeze({ x: 126, y: 1252 }),
      Object.freeze({ x: 138, y: 1274 }),
      Object.freeze({ x: 149, y: 1295 }),
      Object.freeze({ x: 161, y: 1316 }),
    ]),
    respawnPoints: Object.freeze([
      Object.freeze({ x: 132, y: 1263 }),
      Object.freeze({ x: 721, y: 939 }),
      Object.freeze({ x: 1225, y: 661 }),
      Object.freeze({ x: 1730, y: 383 }),
    ]),
    checkpoints: Object.freeze([
      Object.freeze({ x: 700, y: 877, width: 42, height: 124, spawnX: 721, spawnY: 939 }),
      Object.freeze({ x: 1204, y: 599, width: 42, height: 124, spawnX: 1225, spawnY: 661 }),
      Object.freeze({ x: 1709, y: 321, width: 42, height: 124, spawnX: 1730, spawnY: 383 }),
    ]),
    finishGate: Object.freeze({ x: 2179, y: 54, width: 48, height: 116 }),
    palette: Object.freeze({
      trackA: "#9b7653",
      trackB: "#aa8158",
      trackEdge: "#694f3f",
      trackSpeck: "#c6a16d",
      infieldA: "#547344",
      infieldB: "#4a673d",
      infieldSpeck: "#78945c",
      exteriorA: "#334b3f",
      exteriorB: "#2c4239",
      exteriorBase: "#23352f",
      exteriorSpeck: "#6f8c6a",
      outerLine: "#e4cf91",
      innerLine: "#8f694d",
      laneLine: "#d9bd7a",
      accent: "#f1cf68",
    }),
    pitZones: Object.freeze([]),
    jumpPads: Object.freeze([]),
    spinners: Object.freeze([]),
    rockBarriers: Object.freeze([
      Object.freeze({ x: 392, y: 995, width: 56, height: 86 }),
      Object.freeze({ x: 961, y: 684, width: 52, height: 82 }),
      Object.freeze({ x: 1017, y: 786, width: 52, height: 82 }),
      Object.freeze({ x: 1393, y: 575, width: 56, height: 86 }),
      Object.freeze({ x: 1622, y: 391, width: 46, height: 74 }),
      Object.freeze({ x: 1841, y: 194, width: 58, height: 90 }),
    ]),
    rollingRocks: Object.freeze({
      firstDelay: 4000,
      minDelay: 2600,
      randomDelay: 1400,
      speed: 154,
      radius: 14,
      spawnOffsets: Object.freeze([0, -48, 48, -16, 16]),
    }),
  }),
});

export function getMapDefinition(value = DEFAULT_MAP_ID) {
  return isMapId(value)
    ? MAP_DEFINITIONS[value]
    : MAP_DEFINITIONS[DEFAULT_MAP_ID];
}

export function isMapId(value) {
  return typeof value === "string" && MAP_IDS.includes(value);
}
