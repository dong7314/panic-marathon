/**
 * Rules that must stay identical on the browser and multiplayer server.
 * Keep this module runtime-only so Node and Vite can import the same source.
 */

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

export const PIT_FALL_DURATION = 520;
export const JUMP_DURATION = 560;
export const PIT_WARNING_DURATION = 900;
export const FIRST_PIT_WARNING_DELAY = 2500;
export const PIT_CYCLE_MIN_DELAY = 4000;
export const PIT_CYCLE_RANDOM_DELAY = 2000;

export const SKILL_IDS = Object.freeze(["push", "dash", "run", "grab", "clone", "slow", "sleep"]);
export const PLAYER_COLORS = Object.freeze(["#f16c7a", "#f4c562", "#78d8e9", "#a985e6", "#e58fba", "#8edb8a"]);

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

export const PIT_ZONES = Object.freeze([
  Object.freeze({ x: 260, y: 836, width: 34, height: 36 }),
  Object.freeze({ x: 1168, y: 350, width: 34, height: 31 }),
  Object.freeze({ x: 115, y: 510, width: 34, height: 31 }),
  Object.freeze({ x: 840, y: 88, width: 34, height: 34 }),
]);

export const JUMP_PADS = Object.freeze([
  Object.freeze({ x: 920, y: 836, width: 40, height: 30, pushX: -320, pushY: 0 }),
]);

export const SPINNER_RULES = Object.freeze([
  Object.freeze({ x: 650, y: 856, radius: 52, speed: 2.15 }),
  Object.freeze({ x: 1190, y: 492, radius: 48, speed: -2.8 }),
  Object.freeze({ x: 660, y: 112, radius: 48, speed: 3.1 }),
]);
