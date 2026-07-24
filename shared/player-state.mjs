const CONTROL_FIELDS = Object.freeze(["fallingUntil", "airUntil", "grappleUntil", "pushUntil", "sleepUntil"]);
const MODIFIER_FIELDS = Object.freeze(["slowUntil", "runUntil"]);

function activeUntil(player, field, now) {
  const value = Number(player?.[field]) || 0;
  return value > now ? value : 0;
}

export function getPlayerActionState(player, now = Date.now()) {
  if ((Number(player?.fallingUntil) || 0) > 0) return "falling";
  if (activeUntil(player, "airUntil", now)) return "airborne";
  if (activeUntil(player, "grappleUntil", now)) return "grappled";
  if (activeUntil(player, "pushUntil", now)) return "pushed";
  if (activeUntil(player, "sleepUntil", now)) return "sleeping";
  return "normal";
}

export function getPlayerActionStateRemaining(player, now = Date.now()) {
  const state = getPlayerActionState(player, now);
  const field = {
    falling: "fallingUntil",
    airborne: "airUntil",
    grappled: "grappleUntil",
    pushed: "pushUntil",
    sleeping: "sleepUntil",
  }[state];
  return field ? Math.max(0, (Number(player?.[field]) || 0) - now) : 0;
}

export function canPlayerMove(player, now = Date.now()) {
  return getPlayerActionState(player, now) === "normal";
}

export function canPlayerAct(player, now = Date.now()) {
  return getPlayerActionState(player, now) === "normal";
}

export function canPlayerReceiveHit(player, now = Date.now()) {
  const state = getPlayerActionState(player, now);
  return state !== "falling" && state !== "airborne";
}

export function canPlayerBeDisplaced(player, now = Date.now()) {
  const state = getPlayerActionState(player, now);
  return state === "normal" || state === "sleeping";
}

export function resetPlayerTimedStates(player) {
  for (const field of CONTROL_FIELDS) player[field] = 0;
  for (const field of MODIFIER_FIELDS) player[field] = 0;
}

export function enterFallingState(player, until) {
  resetPlayerTimedStates(player);
  player.fallingUntil = until;
}

export function enterAirborneState(player, until) {
  player.fallingUntil = 0;
  player.airUntil = until;
  player.grappleUntil = 0;
  player.pushUntil = 0;
  player.sleepUntil = 0;
}

export function enterDisplacementState(player, kind, until) {
  if (kind !== "grappled" && kind !== "pushed") throw new TypeError(`Unsupported displacement state: ${kind}`);
  player.fallingUntil = 0;
  player.airUntil = 0;
  player.grappleUntil = kind === "grappled" ? until : 0;
  player.pushUntil = kind === "pushed" ? until : 0;
}
