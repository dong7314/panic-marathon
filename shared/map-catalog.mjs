export const MAP_IDS = Object.freeze(["schoolyard"]);
export const DEFAULT_MAP_ID = "schoolyard";

export const MAP_DEFINITIONS = Object.freeze({
  schoolyard: Object.freeze({
    id: "schoolyard",
    name: "말썽 운동장",
    tagline: "구덩이와 회전봉이 기다리는 클래식 트랙",
    theme: "schoolyard",
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
  }),
});

export function getMapDefinition() {
  return MAP_DEFINITIONS[DEFAULT_MAP_ID];
}

export function isMapId(value) {
  return value === DEFAULT_MAP_ID;
}
