import type { RollingRock, WorldProp } from "./types";
import { fillRect } from "./pixel-renderer";

const VIEW_WIDTH = 384;
const VIEW_HEIGHT = 216;

function drawVending(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#563b65", x + 2, y + 6, 24, 30);
  fillRect(context, "#e65b71", x, y + 3, 24, 31);
  fillRect(context, "#ff8a84", x + 3, y + 6, 18, 14);
  fillRect(context, "#242542", x + 5, y + 8, 14, 9);
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 3; column += 1) fillRect(context, (row + column) % 2 ? "#79d7f0" : "#ffd766", x + 6 + column * 4, y + 9 + row * 4, 2, 2);
  fillRect(context, "#fff1d1", x + 4, y + 23, 14, 6);
  fillRect(context, "#7e334c", x + 20, y + 10, 2, 15);
  fillRect(context, "#3c2d4f", x + 3, y + 34, 20, 3);
}

function drawBench(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#6e4860", x + 2, y + 9, 35, 6);
  fillRect(context, "#d08a5b", x, y + 4, 38, 7);
  fillRect(context, "#efae73", x + 2, y + 5, 34, 2);
  fillRect(context, "#4b3a52", x + 5, y + 15, 4, 5);
  fillRect(context, "#4b3a52", x + 29, y + 15, 4, 5);
}

function drawCrate(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#664755", x + 2, y + 3, 20, 19);
  fillRect(context, "#b7765b", x, y, 20, 20);
  fillRect(context, "#e3aa6e", x + 3, y + 3, 14, 3);
  fillRect(context, "#8a554e", x + 8, y + 3, 4, 14);
  fillRect(context, "#8a554e", x + 3, y + 8, 14, 4);
}

function drawPlant(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#5a4355", x + 4, y + 15, 12, 9);
  fillRect(context, "#e07b58", x + 3, y + 13, 14, 8);
  fillRect(context, "#ffc07b", x + 5, y + 14, 10, 2);
  fillRect(context, "#3b805d", x + 8, y + 2, 5, 13);
  fillRect(context, "#5fae6e", x + 2, y + 6, 7, 6);
  fillRect(context, "#5fae6e", x + 11, y + 4, 7, 7);
  fillRect(context, "#8bd57b", x + 5, y, 5, 7);
}

function drawTable(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#52394c", x + 3, y + 11, 36, 15);
  fillRect(context, "#c58a63", x, y + 5, 40, 13);
  fillRect(context, "#f2bb7b", x + 3, y + 7, 34, 3);
  fillRect(context, "#f5f1db", x + 10, y + 8, 8, 5);
  fillRect(context, "#f5f1db", x + 23, y + 9, 10, 4);
  fillRect(context, "#5e4254", x + 4, y + 18, 4, 9);
  fillRect(context, "#5e4254", x + 32, y + 18, 4, 9);
}

function drawSofa(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#4e415a", x + 3, y + 8, 42, 17);
  fillRect(context, "#6c8bc2", x, y + 6, 44, 16);
  fillRect(context, "#91b5e7", x + 3, y + 8, 16, 7);
  fillRect(context, "#91b5e7", x + 24, y + 8, 16, 7);
  fillRect(context, "#4d5d92", x + 4, y + 19, 36, 4);
  fillRect(context, "#3f354e", x + 4, y + 23, 4, 4);
  fillRect(context, "#3f354e", x + 36, y + 23, 4, 4);
}

function drawLamp(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#52516c", x + 7, y + 10, 3, 20);
  fillRect(context, "#414159", x + 3, y + 28, 11, 3);
  fillRect(context, "#f3ca69", x + 3, y + 3, 11, 9);
  fillRect(context, "#fff3ae", x + 5, y + 5, 7, 4);
}

function drawMailbox(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#4d4b66", x + 7, y + 15, 6, 15);
  fillRect(context, "#5c94b2", x + 2, y + 3, 18, 16);
  fillRect(context, "#94d5df", x + 4, y + 5, 14, 4);
  fillRect(context, "#293851", x + 5, y + 12, 11, 2);
  fillRect(context, "#ef6b6f", x + 19, y + 7, 4, 4);
}

function drawArcade(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#40344f", x + 2, y + 6, 23, 31);
  fillRect(context, "#86528f", x, y + 2, 23, 31);
  fillRect(context, "#f174ae", x + 3, y + 5, 17, 12);
  fillRect(context, "#1e2945", x + 5, y + 7, 13, 8);
  fillRect(context, "#74f0dc", x + 8, y + 9, 7, 3);
  fillRect(context, "#f7d366", x + 8, y + 21, 3, 3);
  fillRect(context, "#67c5df", x + 14, y + 21, 3, 3);
  fillRect(context, "#3c2e49", x + 5, y + 33, 14, 4);
}

function drawRockWall(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const rows = Math.max(4, Math.floor(height / 15));
  const rowHeight = Math.ceil((height - 5) / rows);
  fillRect(context, "rgba(25,22,24,.38)", x + 5, y + height - 3, width, 9);

  for (let row = 0; row < rows; row += 1) {
    const topRow = row === 0;
    const columns = row % 2 === 0 ? 3 : 4;
    const sideInset = topRow ? Math.max(3, Math.floor(width * .14)) : row === 1 ? 2 : 0;
    const availableWidth = width - sideInset * 2;
    const rockWidth = Math.ceil(availableWidth / columns);
    const rockY = y + 5 + row * rowHeight;
    const rockHeight = Math.min(rowHeight + 3, y + height - rockY);
    for (let column = 0; column < columns; column += 1) {
      const variant = (row * 7 + column * 5 + width + height) % 4;
      const rockX = x + sideInset + column * rockWidth - (column > 0 ? 1 : 0);
      const actualWidth = Math.min(rockWidth + 2, x + width - rockX);
      const crown = topRow ? variant % 3 : 0;
      fillRect(context, "#343238", rockX + 1, rockY - crown, actualWidth - 1, rockHeight + crown);
      fillRect(context, "#555052", rockX, rockY + 2 - crown, actualWidth, Math.max(2, rockHeight - 3 + crown));
      fillRect(context, variant % 2 ? "#70665e" : "#665f59", rockX + 2, rockY + 1 - crown, Math.max(2, actualWidth - 4), Math.max(3, rockHeight - 6));
      fillRect(context, "#9d8c72", rockX + 3, rockY + 2 - crown, Math.max(2, Math.floor(actualWidth * .38)), 2);
      if (rockHeight > 9) {
        const crackX = rockX + Math.max(4, Math.floor(actualWidth * (variant % 2 ? .62 : .45)));
        fillRect(context, "#403d40", crackX, rockY + 6, 2, Math.max(3, rockHeight - 9));
        fillRect(context, "#403d40", crackX - (variant % 2), rockY + rockHeight - 5, 4, 2);
      }
    }
  }

  fillRect(context, "#2d3031", x + 2, y + height - 5, width - 4, 5);
  fillRect(context, "#6f7756", x + 4, y + height - 7, Math.max(5, Math.floor(width * .24)), 3);
  fillRect(context, "#8d9365", x + 7, y + height - 8, Math.max(3, Math.floor(width * .12)), 2);
}

function drawTrafficCone(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  fillRect(context, "rgba(42,31,45,.28)", x + 1, y + height - 1, width, 4);
  fillRect(context, "#49354c", x, y + height - 4, width, 4);
  fillRect(context, "#f5d06b", x + 1, y + height - 5, width - 2, 3);
  fillRect(context, "#ed6b55", x + Math.floor(width / 2) - 2, y + 2, 5, height - 7);
  fillRect(context, "#ff9a62", x + Math.floor(width / 2) - 1, y, 3, 4);
  fillRect(context, "#fff0c7", x + Math.floor(width / 2) - 2, y + 6, 5, 2);
}

function drawSchoolHurdle(context: CanvasRenderingContext2D, prop: WorldProp, x: number, y: number) {
  const vertical = prop.axis === "horizontal";
  fillRect(context, "rgba(42,31,45,.25)", x + 2, y + prop.height - 2, prop.width, 4);
  if (vertical) {
    fillRect(context, "#564660", x + 3, y, 3, prop.height);
    fillRect(context, "#564660", x + prop.width - 6, y, 3, prop.height);
    fillRect(context, "#f5f0d8", x + 2, y + 3, prop.width - 4, 5);
    fillRect(context, "#e65f65", x + 5, y + 4, 4, 3);
    fillRect(context, "#e65f65", x + prop.width - 9, y + 4, 4, 3);
  } else {
    fillRect(context, "#564660", x, y + 3, prop.width, 3);
    fillRect(context, "#564660", x, y + prop.height - 6, prop.width, 3);
    fillRect(context, "#f5f0d8", x + 3, y + 2, 5, prop.height - 4);
    fillRect(context, "#e65f65", x + 4, y + 5, 3, 4);
    fillRect(context, "#e65f65", x + 4, y + prop.height - 9, 3, 4);
  }
}

function drawSpaceCrate(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  fillRect(context, "rgba(10,17,38,.35)", x + 2, y + height - 1, width, 4);
  fillRect(context, "#202b4b", x, y, width, height);
  fillRect(context, "#536989", x + 2, y + 2, width - 4, height - 4);
  fillRect(context, "#263957", x + 5, y + 5, width - 10, height - 10);
  fillRect(context, "#78e5ed", x + 3, y + 3, 3, 3);
  fillRect(context, "#ffcf62", x + width - 6, y + height - 6, 3, 3);
  fillRect(context, "#8fa6c6", x + Math.floor(width / 2) - 1, y + 2, 2, height - 4);
}

function drawSpacePylon(context: CanvasRenderingContext2D, prop: WorldProp, x: number, y: number) {
  const vertical = prop.axis === "horizontal";
  fillRect(context, "rgba(10,17,38,.35)", x + 1, y + prop.height - 1, prop.width, 4);
  fillRect(context, "#202b4b", x, y, prop.width, prop.height);
  fillRect(context, "#506582", x + 2, y + 2, prop.width - 4, prop.height - 4);
  if (vertical) {
    fillRect(context, "#ff5f9d", x + 4, y + 3, prop.width - 8, prop.height - 6);
    fillRect(context, "#8cf5f1", x + 5, y + 5, prop.width - 10, prop.height - 10);
  } else {
    fillRect(context, "#ff5f9d", x + 3, y + 4, prop.width - 6, prop.height - 8);
    fillRect(context, "#8cf5f1", x + 5, y + 5, prop.width - 10, prop.height - 10);
  }
  fillRect(context, "#f4f6ff", x + Math.floor(prop.width / 2) - 1, y + 4, 2, prop.height - 8);
}

export function drawRollingRock(context: CanvasRenderingContext2D, rock: RollingRock, cameraX: number, cameraY: number) {
  const x = Math.round(rock.x - cameraX);
  const y = Math.round(rock.y - cameraY);
  const radius = Math.round(rock.radius);
  if (x < -radius * 2 || x > VIEW_WIDTH + radius * 2 || y < -radius * 2 || y > VIEW_HEIGHT + radius * 2) return;
  fillRect(context, "rgba(27,22,27,.28)", x - radius, y + radius - 2, radius * 2, 5);
  context.save();
  context.translate(x, y);
  context.rotate(rock.angle);
  fillRect(context, "#343039", -radius + 2, -radius, radius * 2 - 4, radius * 2);
  fillRect(context, "#343039", -radius, -radius + 3, radius * 2, radius * 2 - 6);
  fillRect(context, "#655b57", -radius + 2, -radius + 2, radius * 2 - 5, radius * 2 - 5);
  fillRect(context, "#8a7968", -radius + 5, -radius + 3, radius - 1, 5);
  fillRect(context, "#4a4447", 1, -1, radius - 3, 4);
  fillRect(context, "#b29a77", -radius + 4, 4, 5, 3);
  fillRect(context, "#302e36", -2, -radius + 3, 3, 8);
  context.restore();
}

export function drawWorldProp(context: CanvasRenderingContext2D, prop: WorldProp, cameraX: number, cameraY: number) {
  const x = Math.floor(prop.x - cameraX);
  const y = Math.floor(prop.y - cameraY);
  if (x > VIEW_WIDTH + 50 || y > VIEW_HEIGHT + 50 || x + prop.width < -50 || y + prop.height < -50) return;
  if (prop.kind === "vending") drawVending(context, x, y);
  if (prop.kind === "bench") drawBench(context, x, y);
  if (prop.kind === "crate") drawCrate(context, x, y);
  if (prop.kind === "plant") drawPlant(context, x, y);
  if (prop.kind === "table") drawTable(context, x, y);
  if (prop.kind === "sofa") drawSofa(context, x, y);
  if (prop.kind === "lamp") drawLamp(context, x, y);
  if (prop.kind === "mailbox") drawMailbox(context, x, y);
  if (prop.kind === "arcade") drawArcade(context, x, y);
  if (prop.kind === "rockwall") drawRockWall(context, x, y, prop.width, prop.height);
  if (prop.kind === "traffic-cone") drawTrafficCone(context, x, y, prop.width, prop.height);
  if (prop.kind === "school-hurdle") drawSchoolHurdle(context, prop, x, y);
  if (prop.kind === "space-crate") drawSpaceCrate(context, x, y, prop.width, prop.height);
  if (prop.kind === "space-pylon") drawSpacePylon(context, prop, x, y);
}

