import type { MapId } from "../../shared/map-catalog.mjs";
import type { WorldProp } from "./types";

type MapNpc = Readonly<{ x: number; y: number; color: string }>;
type MapPresentation = Readonly<{
  props: readonly WorldProp[];
  npcs: readonly MapNpc[];
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
    npcs: [
      { x: 271, y: 205, color: "#f4c562" },
      { x: 400, y: 347, color: "#78d8e9" },
      { x: 531, y: 367, color: "#a985e6" },
      { x: 159, y: 312, color: "#e58fba" },
    ],
  },
};

export function getMapPresentation(mapId: MapId) {
  return MAP_CONTENT[mapId];
}
