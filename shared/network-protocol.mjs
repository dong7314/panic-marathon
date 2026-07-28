export const CLIENT_EVENTS = Object.freeze({
  createRoom: "room:create",
  joinRoom: "room:join",
  resumeRoom: "room:resume",
  startRoom: "room:start",
  rematchRoom: "room:rematch",
  leaveRoom: "room:leave",
  playerState: "player:state",
  chatSend: "chat:send",
  combatShoot: "combat:shoot",
  combatSkill: "combat:skill",
});

export const SERVER_EVENTS = Object.freeze({
  roomState: "room:state",
  matchCountdown: "match:countdown",
  matchStarted: "match:started",
  matchFinished: "match:finished",
  hazardWarning: "hazard:warning",
  hazardState: "hazard:state",
  hazardEffect: "hazard:effect",
  rockSpawn: "hazard:rock:spawn",
  rockRemove: "hazard:rock:remove",
  raceTeleport: "race:teleport",
  playerState: "player:state",
  chatMessage: "chat:message",
  combatShot: "combat:shot",
  combatProjectile: "combat:projectile",
  combatGrapple: "combat:grapple",
  combatKnockback: "combat:knockback",
  combatEffect: "combat:effect",
});

const DIRECTIONS = new Set(["up", "down", "left", "right"]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePlayerStatePayload(value) {
  if (!isRecord(value)) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const direction = DIRECTIONS.has(value.direction) ? value.direction : undefined;
  const walkingValue = Number(value.walking);
  return {
    x,
    y,
    direction,
    walking: Number.isFinite(walkingValue) ? walkingValue : undefined,
  };
}

export function parseAimPayload(value) {
  if (!isRecord(value)) return { x: 1, y: 0 };
  const rawX = Number(value.dx);
  const rawY = Number(value.dy);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return { x: 1, y: 0 };
  const length = Math.hypot(rawX, rawY);
  if (length < .001) return { x: 1, y: 0 };
  return { x: rawX / length, y: rawY / length };
}

export function parseChatPayload(value) {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  const text = value.text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return text ? { text } : null;
}

export function parseReconnectPayload(value) {
  if (!isRecord(value)) return null;
  const roomCode = typeof value.roomCode === "string" ? value.roomCode : "";
  const playerId = typeof value.playerId === "string" ? value.playerId : "";
  const reconnectToken = typeof value.reconnectToken === "string" ? value.reconnectToken : "";
  if (!roomCode || !playerId || !reconnectToken) return null;
  return { roomCode, playerId, reconnectToken };
}
