import type { MapId } from "../../shared/map-catalog.mjs";
import type { WorldProp } from "./types";

type MapPresentation = Readonly<{
  props: readonly WorldProp[];
}>;

const MAP_CONTENT: Record<MapId, MapPresentation> = {
  schoolyard: {
    props: [
      { kind: "bench", x: -10, y: 103, width: 39, height: 16, solid: true },
      { kind: "vending", x: 2, y: 157, width: 28, height: 36, solid: true },
      { kind: "plant", x: 4, y: 280, width: 20, height: 24, solid: true },
      { kind: "arcade", x: 1, y: 386, width: 27, height: 37, solid: true },
      { kind: "table", x: 294, y: 274, width: 42, height: 28, solid: true },
      { kind: "sofa", x: 426, y: 273, width: 47, height: 25, solid: true },
      { kind: "plant", x: 360, y: 220, width: 20, height: 24, solid: true },
      { kind: "mailbox", x: 1286, y: 111, width: 23, height: 30, solid: true },
      { kind: "vending", x: 1282, y: 318, width: 28, height: 36, solid: true },
      { kind: "bench", x: 1286, y: 544, width: 39, height: 16, solid: true },
      { kind: "plant", x: 1288, y: 846, width: 20, height: 24, solid: true },
      { kind: "lamp", x: 144, y: 2, width: 16, height: 30 },
      { kind: "lamp", x: 660, y: 2, width: 16, height: 30 },
      { kind: "lamp", x: 144, y: 944, width: 16, height: 30 },
      { kind: "lamp", x: 1068, y: 944, width: 16, height: 30 },
    ],
  },
  "space-station": {
    props: [
      { kind: "arcade", x: 255, y: 40, width: 27, height: 37 },
      { kind: "arcade", x: 1062, y: 40, width: 27, height: 37 },
      { kind: "vending", x: 41, y: 320, width: 28, height: 36 },
      { kind: "vending", x: 1270, y: 622, width: 28, height: 36 },
      { kind: "crate", x: 305, y: 253, width: 27, height: 25 },
      { kind: "crate", x: 1012, y: 687, width: 27, height: 25 },
      { kind: "table", x: 606, y: 459, width: 42, height: 28 },
      { kind: "table", x: 695, y: 514, width: 42, height: 28 },
      { kind: "lamp", x: 380, y: 39, width: 16, height: 30 },
      { kind: "lamp", x: 948, y: 39, width: 16, height: 30 },
      { kind: "lamp", x: 380, y: 938, width: 16, height: 30 },
      { kind: "lamp", x: 948, y: 938, width: 16, height: 30 },
    ],
  },
  "mountain-pass": {
    props: [
      { kind: "plant", x: 285, y: 1028, width: 20, height: 24 },
      { kind: "plant", x: 450, y: 1223, width: 20, height: 24 },
      { kind: "crate", x: 870, y: 750, width: 27, height: 25 },
      { kind: "plant", x: 930, y: 975, width: 20, height: 24 },
      { kind: "plant", x: 1320, y: 450, width: 20, height: 24 },
      { kind: "crate", x: 1695, y: 473, width: 27, height: 25 },
    ],
  },
};

export function getMapPresentation(mapId: MapId) {
  return MAP_CONTENT[mapId];
}
