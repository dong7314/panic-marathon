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
export const RUN_DURATION = 4600;
export const DASH_RECHARGE_DURATION = 4300;
export const MATCH_TIME_LIMIT = 60 * 60 * 1000;

export const PIT_FALL_DURATION = 520;
export const JUMP_DURATION = 560;
export const PIT_WARNING_DURATION = 4000;
export const FIRST_PIT_WARNING_DELAY = 2500;
export const PIT_CYCLE_MIN_DELAY = 4000;
export const PIT_CYCLE_RANDOM_DELAY = 2000;

export const SKILL_IDS = Object.freeze(["push", "dash", "run", "grab", "clone", "slow", "sleep"]);
export const PLAYER_COLORS = Object.freeze(["#f16c7a", "#f4c562", "#78d8e9", "#a985e6", "#e58fba", "#8edb8a"]);

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

export const START_POINT = Object.freeze({ x: 128, y: 856 });

export const SPAWN_POINTS = Object.freeze([
  Object.freeze({ x: 128, y: 856 }),
  Object.freeze({ x: 178, y: 856 }),
  Object.freeze({ x: 226, y: 856 }),
  Object.freeze({ x: 274, y: 856 }),
  Object.freeze({ x: 322, y: 856 }),
  Object.freeze({ x: 370, y: 856 }),
]);

export const RESPAWN_POINTS = Object.freeze([
  Object.freeze({ x: 128, y: 856 }),
  Object.freeze({ x: 1152, y: 856 }),
  Object.freeze({ x: 1152, y: 120 }),
  Object.freeze({ x: 128, y: 120 }),
]);

export const CHECKPOINTS = Object.freeze([
  Object.freeze({ x: 1120, y: 816, width: 72, height: 74, spawnX: 1152, spawnY: 856 }),
  Object.freeze({ x: 1120, y: 80, width: 72, height: 74, spawnX: 1152, spawnY: 120 }),
  Object.freeze({ x: 105, y: 80, width: 72, height: 74, spawnX: 128, spawnY: 120 }),
]);

export const START_GATE = Object.freeze({ x: 128, y: 810, width: 62, height: 82 });

export const PIT_ZONES = MAP_DEFINITIONS.schoolyard.pitZones;
export const JUMP_PADS = MAP_DEFINITIONS.schoolyard.jumpPads;
export const SPINNER_RULES = MAP_DEFINITIONS.schoolyard.spinners;
