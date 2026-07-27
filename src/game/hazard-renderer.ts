import type { MapRect } from "../../shared/map-catalog.mjs";
import { fillRect } from "./pixel-renderer";
import type { Pit, Spinner } from "./types";

type JumpPad = MapRect & { pushX: number; pushY: number };

export function getJumpPadLayout(pad: JumpPad) {
  const magnitude = Math.hypot(pad.pushX, pad.pushY);
  return {
    angle: magnitude > 0 ? Math.atan2(pad.pushY, pad.pushX) : 0,
    length: Math.max(pad.width, pad.height),
    breadth: Math.min(pad.width, pad.height),
  };
}

export function drawPit(
  context: CanvasRenderingContext2D,
  pit: Pit,
  cameraX: number,
  cameraY: number,
  time: number,
) {
  const x = pit.x - cameraX;
  const y = pit.y - cameraY;
  fillRect(context, "#9e4c59", x - 2, y - 2, pit.width + 4, pit.height + 4);
  if (!pit.active) {
    fillRect(context, "#7f5665", x, y, pit.width, pit.height);
    for (let index = 4; index < pit.width; index += 8) {
      fillRect(context, "#b37a77", x + index, y + 2, 2, pit.height - 4);
    }
    fillRect(context, "#f0b26e", x + 2, y + 2, pit.width - 4, 2);
    return;
  }
  fillRect(context, "#392d4a", x, y, pit.width, pit.height);
  fillRect(context, "#17182e", x + 3, y + 4, pit.width - 6, pit.height - 7);
  fillRect(context, "#5b3f5b", x + 5, y + 5, pit.width - 10, 3);
  const spark = Math.floor(time / 120) % 3;
  fillRect(context, "#ec7769", x + 4 + spark * 6, y + pit.height - 7, 3, 2);
  fillRect(context, "#f4c562", x + pit.width - 8, y + 8 + spark * 4, 2, 3);
}

export function drawJumpPad(
  context: CanvasRenderingContext2D,
  pad: JumpPad,
  cameraX: number,
  cameraY: number,
) {
  const { angle, length, breadth } = getJumpPadLayout(pad);
  const left = -length / 2;
  const top = -breadth / 2;
  const arrowLeft = left + 7;
  const arrowTip = length / 2 - 5;

  context.save();
  context.translate(
    Math.round(pad.x + pad.width / 2 - cameraX),
    Math.round(pad.y + pad.height / 2 - cameraY),
  );
  context.rotate(angle);

  fillRect(context, "#403b63", left - 2, top - 2, length + 4, breadth + 4);
  fillRect(context, "#4c77b8", left, top, length, breadth);
  fillRect(context, "#78cdea", left + 3, top + 3, length - 6, 4);
  fillRect(context, "#293a68", left + 3, top + breadth - 5, length - 6, 2);

  fillRect(context, "#e7a85e", arrowLeft, 0, arrowTip - arrowLeft - 2, 5);
  fillRect(context, "#e7a85e", arrowTip - 7, -5, 4, 15);
  fillRect(context, "#e7a85e", arrowTip - 3, -3, 4, 11);
  fillRect(context, "#fff0a7", arrowLeft, -2, arrowTip - arrowLeft - 2, 5);
  fillRect(context, "#fff0a7", arrowTip - 7, -7, 4, 15);
  fillRect(context, "#fff0a7", arrowTip - 3, -5, 4, 11);

  context.restore();
}

export function drawCheckpoint(
  context: CanvasRenderingContext2D,
  checkpoint: MapRect,
  cameraX: number,
  cameraY: number,
  active: boolean,
  label: string,
) {
  const x = checkpoint.x - cameraX;
  const y = checkpoint.y - cameraY;
  const color = active ? "#f7d366" : "#a58ca4";
  fillRect(context, "#4a3d58", x + 31, y + 12, 4, 41);
  fillRect(context, color, x + 35, y + 12, 18, 11);
  fillRect(context, active ? "#fff0af" : "#d6bfd2", x + 38, y + 15, 4, 4);
  fillRect(context, "#4a3d58", x + 27, y + 51, 12, 3);
  context.fillStyle = active ? "#fff5c1" : "#dfc7dc";
  context.font = "bold 7px monospace";
  context.fillText(label, Math.round(x + 42), Math.round(y + 21));
}

export function drawSpinner(
  context: CanvasRenderingContext2D,
  spinner: Spinner,
  cameraX: number,
  cameraY: number,
) {
  const x = spinner.x - cameraX;
  const y = spinner.y - cameraY;
  const dx = Math.cos(spinner.angle) * spinner.radius;
  const dy = Math.sin(spinner.angle) * spinner.radius;
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.rotate(spinner.angle);
  fillRect(context, "#673f5a", -spinner.radius - 2, -4, spinner.radius * 2 + 4, 8);
  fillRect(context, "#f1c55f", -spinner.radius, -2, spinner.radius * 2, 4);
  fillRect(context, "#f37e72", -spinner.radius - 3, -5, 8, 10);
  fillRect(context, "#f37e72", spinner.radius - 5, -5, 8, 10);
  context.restore();
  fillRect(context, "#40364e", x - 7, y - 4, 14, 11);
  fillRect(context, "#9e8db4", x - 4, y - 8, 8, 12);
  fillRect(context, "#f8dd7d", x - 2, y - 5, 4, 5);
  fillRect(context, "#f1c55f", x + dx - 2, y + dy - 2, 4, 4);
}
