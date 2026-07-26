/**
 * Rules that must stay identical on the browser and multiplayer server.
 * Keep this module runtime-only so Node and Vite can import the same source.
 */
import { MAP_DEFINITIONS } from "./map-catalog.mjs";

export const WORLD_WIDTH = 1344;
export const WORLD_HEIGHT = 1008;

export const GRAB_RANGE = 250;
export const GRAB_HIT_RADIUS = 12;
export const CLONE_LIMIT = 20;
export const CLONE_COOLDOWN = 150;
export const CLONE_DURATION = 10_000;
export const PUSH_DISTANCE = 56;
export const PUSH_DURATION = 320;

export const PLAYER_BASE_SPEED = 110;
export const RUN_SPEED_MULTIPLIER = 1.68;
export const SLOW_SPEED_MULTIPLIER = 0.55;
export const SLOW30_SPEED_MULTIPLIER = 0.3;
export const GIANT_SPEED_MULTIPLIER = 0.5;
export const GIANT_BODY_SCALE = 5;
export const RUN_DURATION = 4600;
export const DASH_RECHARGE_DURATION = 4300;
export const MATCH_TIME_LIMIT = 60 * 60 * 1000;

export const PIT_FALL_DURATION = 520;
export const JUMP_DURATION = 560;
export const ROCK_SQUASH_DURATION = 720;
export const FLY_VISUAL_LIFT = 15;
export const PIT_WARNING_DURATION = 4000;
export const FIRST_PIT_WARNING_DELAY = 2500;
export const PIT_CYCLE_MIN_DELAY = 4000;
export const PIT_CYCLE_RANDOM_DELAY = 2000;

export const SKILL_IDS = Object.freeze(["push", "dash", "run", "grab", "clone", "slow", "sleep", "fly", "slow30", "giant"]);
export const PASSIVE_SKILL_IDS = Object.freeze(["fly", "slow30", "giant"]);
export const PLAYER_COLORS = Object.freeze(["#f16c7a", "#f4c562", "#78d8e9", "#a985e6", "#e58fba", "#8edb8a"]);

export function isPassiveSkill(skill) {
  return PASSIVE_SKILL_IDS.includes(skill);
}

export function isGroundHazardImmune(skill) {
  return skill === "fly" || skill === "giant";
}

export function isVoidFallImmune(skill) {
  return skill === "fly";
}

export function isObstacleImmune(skill) {
  return skill === "giant";
}

export function isDamageImmune(skill) {
  return skill === "giant";
}

export function getSkillSpeedMultiplier(skill) {
  if (skill === "slow30") return SLOW30_SPEED_MULTIPLIER;
  return skill === "giant" ? GIANT_SPEED_MULTIPLIER : 1;
}

export function getSkillBodyScale(skill) {
  return skill === "giant" ? GIANT_BODY_SCALE : 1;
}

export function getSkillRenderLayer(skill) {
  if (skill === "giant") return 2;
  return skill === "fly" ? 1 : 0;
}

function bodyTouchesRaceZone(x, y, zone, padding = 0) {
  const playerLeft = x - 5;
  const playerTop = y - 5;
  return playerLeft < zone.x + zone.width - padding
    && playerLeft + 10 > zone.x + padding
    && playerTop < zone.y + zone.height - padding
    && playerTop + 12 > zone.y + padding;
}

export function runnerTouchesRaceZone(skill, x, y, zone, padding = 0) {
  return bodyTouchesRaceZone(x, y, zone, padding)
    || (skill === "fly" && bodyTouchesRaceZone(x, y - FLY_VISUAL_LIFT, zone, padding));
}

export function runnerTouchesObstacle(x, y, obstacle, inset = 2) {
  return bodyTouchesRaceZone(x, y, obstacle, Math.max(0, inset));
}

export function runnersOverlap(x, y, otherX, otherY) {
  return Math.abs(x - otherX) < 11 && Math.abs(y - otherY) < 12;
}

export function getSkillHitRadius(skill, baseRadius = 12) {
  return Math.max(0, baseRadius) * getSkillBodyScale(skill);
}

export function isTargetWithinScaledRange(targetSkill, distance, centerRange, baseHitRadius = 12) {
  const rangeExtension = getSkillHitRadius(targetSkill, baseHitRadius) - baseHitRadius;
  return Number.isFinite(distance) && distance <= centerRange + rangeExtension;
}

export function isTargetOnAimLine(targetSkill, forwardDistance, lateralDistance, maxDistance, baseHitRadius = 12) {
  const hitRadius = getSkillHitRadius(targetSkill, baseHitRadius);
  const rangeExtension = hitRadius - baseHitRadius;
  return forwardDistance > -rangeExtension
    && forwardDistance <= maxDistance + rangeExtension
    && lateralDistance <= hitRadius;
}

export function isGiantBodyMovementBlocked(
  movingSkill,
  currentX,
  currentY,
  nextX,
  nextY,
  otherSkill,
  otherX,
  otherY,
) {
  if (movingSkill !== "giant" && otherSkill !== "giant") return false;
  const movingScale = getSkillBodyScale(movingSkill);
  const otherScale = getSkillBodyScale(otherSkill);
  const horizontalReach = (delta) => delta < 0
    ? 9 * movingScale + 8 * otherScale
    : 8 * movingScale + 9 * otherScale;
  const verticalReach = (delta) => delta < 0
    ? 12 * movingScale + 8 * otherScale
    : 8 * movingScale + 12 * otherScale;
  const nextDeltaX = nextX - otherX;
  const nextDeltaY = nextY - otherY;
  const nextReachX = horizontalReach(nextDeltaX);
  const nextReachY = verticalReach(nextDeltaY);
  const nextDx = Math.abs(nextDeltaX);
  const nextDy = Math.abs(nextDeltaY);
  if (nextDx >= nextReachX || nextDy >= nextReachY) return false;

  const currentDeltaX = currentX - otherX;
  const currentDeltaY = currentY - otherY;
  const currentReachX = horizontalReach(currentDeltaX);
  const currentReachY = verticalReach(currentDeltaY);
  const currentDx = Math.abs(currentDeltaX);
  const currentDy = Math.abs(currentDeltaY);
  const currentlyOverlapping = currentDx < currentReachX && currentDy < currentReachY;
  if (!currentlyOverlapping) return true;

  const currentSeparation = (currentDx / currentReachX) ** 2 + (currentDy / currentReachY) ** 2;
  const nextSeparation = (nextDx / nextReachX) ** 2 + (nextDy / nextReachY) ** 2;
  return nextSeparation <= currentSeparation;
}

export function pickNextSkill(skills, previousSkill, random = Math.random) {
  const differentSkills = skills.filter((skill) => skill !== previousSkill);
  const candidates = differentSkills.length > 0 ? differentSkills : skills;
  return candidates[Math.floor(random() * candidates.length)] ?? "push";
}

export const TRACK = Object.freeze({
  outerLeft: 32,
  outerTop: 32,
  outerRight: 1280,
  outerBottom: 944,
  innerLeft: 208,
  innerTop: 192,
  innerRight: 1104,
  innerBottom: 784,
});

export const START_POINT = MAP_DEFINITIONS.schoolyard.startPoint;
export const SPAWN_POINTS = MAP_DEFINITIONS.schoolyard.spawnPoints;
export const RESPAWN_POINTS = MAP_DEFINITIONS.schoolyard.respawnPoints;
export const CHECKPOINTS = MAP_DEFINITIONS.schoolyard.checkpoints;
export const START_GATE = MAP_DEFINITIONS.schoolyard.finishGate;

export const PIT_ZONES = MAP_DEFINITIONS.schoolyard.pitZones;
export const JUMP_PADS = MAP_DEFINITIONS.schoolyard.jumpPads;
export const SPINNER_RULES = MAP_DEFINITIONS.schoolyard.spinners;
