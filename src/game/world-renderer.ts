import { TRACK } from "../../shared/game-rules.mjs";
import { isMapTrackPoint } from "../../shared/geometry.mjs";
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

function drawSpaceStationDetail(context: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
  const line = (color: string, x: number, y: number, width: number, height: number) => {
    fillRect(context, color, x - cameraX, y - cameraY, width, height);
  };

  // 트랙 아래 멀리 떠 있는 픽셀 행성
  const planetRows = [
    [628, 442, 88, "#162c59"],
    [608, 450, 128, "#1b3d75"],
    [596, 462, 152, "#24558e"],
    [590, 478, 164, "#2e6fa7"],
    [590, 494, 164, "#347ab0"],
    [598, 510, 148, "#24558e"],
    [612, 526, 120, "#1b3d75"],
    [632, 538, 80, "#162c59"],
  ] as const;
  for (const [x, y, width, color] of planetRows) line(color, x, y, width, 14);
  line("#63cbe8", 618, 468, 42, 6);
  line("#8be3ee", 638, 474, 56, 5);
  line("#18345f", 678, 510, 48, 7);

  // 정거장 패널의 경고 스트라이프와 도킹 라이트
  for (let x = TRACK.innerLeft + 10; x < TRACK.innerRight - 10; x += 32) {
    line((x / 32) % 2 ? "#ffcf5c" : "#27334b", x, TRACK.innerTop + 5, 16, 4);
    line((x / 32) % 2 ? "#27334b" : "#ffcf5c", x, TRACK.innerBottom - 9, 16, 4);
  }
  for (let y = TRACK.innerTop + 12; y < TRACK.innerBottom - 12; y += 38) {
    line("#70e7ff", TRACK.outerLeft + 6, y, 4, 9);
    line("#ff6b9f", TRACK.outerRight - 10, y + 12, 4, 9);
  }
}

function drawMountainDetail(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, map: MapDefinition) {
  const line = (color: string, x: number, y: number, width: number, height: number) => {
    fillRect(context, color, x - cameraX, y - cameraY, width, height);
  };
  const [start, end] = map.trackPath;
  if (!start || !end) return;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const halfWidth = map.trackWidth / 2;

  for (let step = 0; step <= 1; step += .025) {
    const centerX = start.x + dx * step;
    const centerY = start.y + dy * step;
    const edgeColor = Math.floor(step * 40) % 2 ? "#e2c77c" : "#725640";
    for (const side of [-1, 1]) {
      line(edgeColor, centerX + normalX * halfWidth * side - 3, centerY + normalY * halfWidth * side - 2, 7, 5);
    }
    if (Math.floor(step * 80) % 7 === 0) {
      line("#d4b476", centerX - 2, centerY - 2, 4, 3);
    }
  }

  // 산 아래쪽의 침엽수와 정상 표지
  const treeSpacing = 78;
  const treeCount = Math.ceil(map.worldWidth / treeSpacing);
  const treeBaseY = map.worldHeight - 96;
  for (let index = 0; index < treeCount; index += 1) {
    const x = 24 + index * treeSpacing;
    const y = treeBaseY - (index % 3) * 22;
    line("#1d332c", x, y, 25, 42);
    line("#426049", x + 4, y - 12, 17, 32);
    line("#708057", x + 8, y - 22, 9, 25);
  }
  line("#4b3a35", end.x - 4, end.y - 64, 5, 66);
  line("#f1cf68", end.x + 1, end.y - 62, 38, 18);
  line("#e16f68", end.x + 6, end.y - 58, 24, 4);
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
      if (isMapTrackPoint(map, worldX, worldY)) {
        fillRect(context, (tileX + tileY) % 2 ? palette.trackA : palette.trackB, screenX, screenY, TILE, TILE);
        fillRect(context, palette.trackEdge, screenX, screenY + TILE - 2, TILE, 2);
        if (noise(tileX, tileY) > .68) fillRect(context, palette.trackSpeck, screenX + 3, screenY + 4, 3, 2);
      } else if (map.courseType === "linear") {
        fillRect(context, palette.exteriorBase, screenX, screenY, TILE, TILE);
        fillRect(context, (tileX + tileY) % 2 ? palette.exteriorA : palette.exteriorB, screenX + 1, screenY + 1, TILE - 2, TILE - 2);
        if (noise(tileX, tileY) > .58) {
          fillRect(context, palette.exteriorSpeck, screenX + 3, screenY + 3, 4, 3);
          fillRect(context, "#1f352d", screenX + 9, screenY + 8, 3, 6);
        }
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
  if (map.courseType === "linear") {
    drawMountainDetail(context, cameraX, cameraY, map);
    return;
  }
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

  if (map.theme === "space-station") {
    drawSpaceStationDetail(context, cameraX, cameraY);
  } else {
    drawSchoolyardDetail(context, cameraX, cameraY);
  }
}
