import type { Direction } from "./types";

export function fillRect(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function darken(hex: string, amount = 38) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "f16c7a";
  const channels = [0, 2, 4].map((offset) => Math.max(0, Number.parseInt(value.slice(offset, offset + 2), 16) - amount));
  return `rgb(${channels.join(",")})`;
}

export function drawPerson(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Direction,
  walking: number,
  color = "#f16c7a",
  npc = false,
  sleeping = false,
) {
  const outline = "#25233a";
  const uniformShadow = darken(color);
  if (sleeping) {
    fillRect(context, "rgba(22,19,38,.4)", x - 13, y + 7, 27, 4);
    fillRect(context, outline, x + 5, y + 1, 9, 8);
    fillRect(context, uniformShadow, x + 6, y + 2, 7, 6);
    fillRect(context, "#f0e4d5", x + 11, y + 3, 3, 2);
    fillRect(context, outline, x - 5, y - 3, 13, 11);
    fillRect(context, uniformShadow, x - 4, y - 2, 11, 9);
    fillRect(context, color, x - 4, y - 2, 9, 7);
    fillRect(context, "#fff4cf", x - 2, y - 1, 5, 3);
    fillRect(context, outline, x - 13, y - 5, 10, 11);
    fillRect(context, "#f4d9c7", x - 12, y - 4, 8, 9);
    fillRect(context, npc ? "#54415e" : "#34304c", x - 13, y - 5, 9, 4);
    fillRect(context, npc ? "#6e5a79" : uniformShadow, x - 12, y - 5, 7, 2);
    fillRect(context, "#273047", x - 11, y, 3, 1);
    fillRect(context, "#d5968f", x - 11, y + 3, 2, 1);
    fillRect(context, outline, x - 1, y + 5, 8, 4);
    fillRect(context, "#f4d9c7", x, y + 5, 6, 2);
    return;
  }

  const bounce = npc
    ? Math.sin(walking) > .65 ? 1 : 0
    : Math.abs(Math.sin(walking)) > .65 ? 1 : 0;
  const leftStep = Math.sin(walking) > 0 ? 1 : 0;
  const rightStep = Math.sin(walking) <= 0 ? 1 : 0;

  fillRect(context, "rgba(22,19,38,.4)", x - 7, y + 9, 15, 3);
  fillRect(context, outline, x - 5, y + 6 + leftStep, 4, 6);
  fillRect(context, outline, x + 2, y + 6 + rightStep, 4, 6);
  fillRect(context, "#f0e4d5", x - 4, y + 7 + leftStep, 3, 2);
  fillRect(context, "#f0e4d5", x + 3, y + 7 + rightStep, 3, 2);

  fillRect(context, outline, x - 6, y + bounce, 13, 9);
  fillRect(context, uniformShadow, x - 5, y + 1 + bounce, 11, 8);
  fillRect(context, color, x - 4, y + 1 + bounce, 8, 7);
  fillRect(context, "#fff4cf", x - 2, y + 2 + bounce, 5, 3);
  fillRect(context, uniformShadow, x - 1, y + 2 + bounce, 2, 4);

  fillRect(context, outline, x - 5, y - 7 + bounce, 11, 9);
  fillRect(context, "#f4d9c7", x - 4, y - 6 + bounce, 9, 8);
  fillRect(context, npc ? "#54415e" : "#34304c", x - 5, y - 8 + bounce, 11, 4);
  fillRect(context, npc ? "#6e5a79" : uniformShadow, x - 4, y - 8 + bounce, 9, 2);

  if (direction === "down") {
    fillRect(context, "#273047", x - 2, y - 3 + bounce, 2, 2);
    fillRect(context, "#273047", x + 2, y - 3 + bounce, 2, 2);
    fillRect(context, "#d5968f", x, y + bounce, 2, 1);
  }
  if (direction === "up") fillRect(context, "#34304c", x - 4, y - 4 + bounce, 9, 5);
  if (direction === "left") {
    fillRect(context, "#273047", x - 4, y - 3 + bounce, 2, 2);
    fillRect(context, "#d5968f", x - 4, y + bounce, 2, 1);
  }
  if (direction === "right") {
    fillRect(context, "#273047", x + 4, y - 3 + bounce, 2, 2);
    fillRect(context, "#d5968f", x + 4, y + bounce, 2, 1);
  }

  fillRect(context, outline, x - 8, y + 2 + bounce, 3, 6);
  fillRect(context, outline, x + 6, y + 2 + bounce, 3, 6);
  fillRect(context, "#f4d9c7", x - 7, y + 3 + bounce, 2, 4);
  fillRect(context, "#f4d9c7", x + 7, y + 3 + bounce, 2, 4);
}
