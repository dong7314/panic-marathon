import { TRACK } from "../../shared/game-rules.mjs";
import { isTrackPoint } from "../../shared/geometry.mjs";
import type { MapDefinition } from "../../shared/map-catalog.mjs";
import { fillRect } from "./pixel-renderer";

const TILE = 16;

function noise(x: number, y: number) {
  const value = Math.sin(x * 87.3 + y * 41.7) * 1031.77;
  return value - Math.floor(value);
}

function drawSchoolyardDetail(context: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
  const line = (color: string, x: number, y: number, width: number, height: number) => {
    fillRect(context, color, x - cameraX, y - cameraY, width, height);
  };
  line("#dbb75d", 606, 488, 132, 3);
  line("#dbb75d", 670, 424, 3, 132);
  line("#7ccc73", 611, 493, 122, 54);
}

export function drawWorldFloor(
  context: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  map: MapDefinition,
  viewWidth = 384,
  viewHeight = 216,
) {
  const firstX = Math.floor(cameraX / TILE) - 1;
  const firstY = Math.floor(cameraY / TILE) - 1;
  const lastX = Math.ceil((cameraX + viewWidth) / TILE) + 1;
  const lastY = Math.ceil((cameraY + viewHeight) / TILE) + 1;
  const palette = map.palette;

  for (let tileY = firstY; tileY <= lastY; tileY += 1) {
    for (let tileX = firstX; tileX <= lastX; tileX += 1) {
      const screenX = tileX * TILE - cameraX;
      const screenY = tileY * TILE - cameraY;
      const worldX = tileX * TILE + TILE / 2;
      const worldY = tileY * TILE + TILE / 2;
      if (isTrackPoint(worldX, worldY)) {
        fillRect(context, (tileX + tileY) % 2 ? palette.trackA : palette.trackB, screenX, screenY, TILE, TILE);
        fillRect(context, palette.trackEdge, screenX, screenY + TILE - 2, TILE, 2);
        if (noise(tileX, tileY) > .68) fillRect(context, palette.trackSpeck, screenX + 3, screenY + 4, 3, 2);
      } else if (worldX >= TRACK.innerLeft && worldX <= TRACK.innerRight && worldY >= TRACK.innerTop && worldY <= TRACK.innerBottom) {
        fillRect(context, (tileX + tileY) % 2 ? palette.infieldA : palette.infieldB, screenX, screenY, TILE, TILE);
        if (noise(tileX, tileY) > .3) {
          fillRect(context, palette.infieldSpeck, screenX + 3 + Math.floor(noise(tileY, tileX) * 8), screenY + 4 + Math.floor(noise(tileX + 3, tileY + 2) * 7), 2, 3);
        }
      } else {
        fillRect(context, palette.exteriorBase, screenX, screenY, TILE, TILE);
        fillRect(context, (tileX + tileY) % 2 ? palette.exteriorA : palette.exteriorB, screenX + 1, screenY + 1, TILE - 2, TILE - 2);
        if (noise(tileX, tileY) > .66) fillRect(context, palette.exteriorSpeck, screenX + 4, screenY + 4, 2, 2);
      }
    }
  }

  const line = (color: string, x: number, y: number, width: number, height: number) => {
    fillRect(context, color, x - cameraX, y - cameraY, width, height);
  };
  line(palette.outerLine, TRACK.outerLeft, TRACK.outerTop, TRACK.outerRight - TRACK.outerLeft, 3);
  line(palette.outerLine, TRACK.outerLeft, TRACK.outerBottom - 3, TRACK.outerRight - TRACK.outerLeft, 3);
  line(palette.outerLine, TRACK.outerLeft, TRACK.outerTop, 3, TRACK.outerBottom - TRACK.outerTop);
  line(palette.outerLine, TRACK.outerRight - 3, TRACK.outerTop, 3, TRACK.outerBottom - TRACK.outerTop);
  line(palette.innerLine, TRACK.innerLeft, TRACK.innerTop, TRACK.innerRight - TRACK.innerLeft, 3);
  line(palette.innerLine, TRACK.innerLeft, TRACK.innerBottom - 3, TRACK.innerRight - TRACK.innerLeft, 3);
  line(palette.innerLine, TRACK.innerLeft, TRACK.innerTop, 3, TRACK.innerBottom - TRACK.innerTop);
  line(palette.innerLine, TRACK.innerRight - 3, TRACK.innerTop, 3, TRACK.innerBottom - TRACK.innerTop);

  for (let x = TRACK.innerLeft + 8; x < TRACK.innerRight - 8; x += 22) {
    line(palette.laneLine, x, 111, 11, 3);
    line(palette.laneLine, x, 863, 11, 3);
  }
  for (let y = TRACK.innerTop + 10; y < TRACK.innerBottom - 8; y += 22) {
    line(palette.laneLine, 119, y, 3, 11);
    line(palette.laneLine, 1191, y, 3, 11);
  }

  for (let row = 0; row < 7; row += 1) {
    line(row % 2 ? "#fff0d1" : "#40344f", 160, 826 + row * 11, 10, 11);
    line(row % 2 ? "#40344f" : "#fff0d1", 170, 826 + row * 11, 10, 11);
  }
  for (let index = 0; index < 10; index += 1) {
    const marker = index * 92 + 40;
    line(palette.accent, 26, marker, 5, 5);
    line(palette.accent, 1286, marker + 19, 5, 5);
  }

  drawSchoolyardDetail(context, cameraX, cameraY);
}
