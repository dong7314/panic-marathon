export type SkillId = "push" | "dash" | "run" | "grab" | "clone" | "slow" | "sleep" | "fly" | "slow30" | "giant";

export type Point = Readonly<{ x: number; y: number }>;
export type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type TrackBounds = Readonly<{
  outerLeft: number;
  outerTop: number;
  outerRight: number;
  outerBottom: number;
  innerLeft: number;
  innerTop: number;
  innerRight: number;
  innerBottom: number;
}>;

export const WORLD_WIDTH: number;
export const WORLD_HEIGHT: number;
export const GRAB_RANGE: number;
export const GRAB_HIT_RADIUS: number;
export const CLONE_LIMIT: number;
export const CLONE_COOLDOWN: number;
export const CLONE_DURATION: number;
export const PUSH_DISTANCE: number;
export const PUSH_DURATION: number;
export const PLAYER_BASE_SPEED: number;
export const RUN_SPEED_MULTIPLIER: number;
export const SLOW_SPEED_MULTIPLIER: number;
export const SLOW30_SPEED_MULTIPLIER: number;
export const GIANT_SPEED_MULTIPLIER: number;
export const GIANT_BODY_SCALE: number;
export const RUN_DURATION: number;
export const DASH_RECHARGE_DURATION: number;
export const MATCH_TIME_LIMIT: number;
export const PIT_FALL_DURATION: number;
export const JUMP_DURATION: number;
export const ROCK_SQUASH_DURATION: number;
export const FLY_VISUAL_LIFT: number;
export const PIT_WARNING_DURATION: number;
export const FIRST_PIT_WARNING_DELAY: number;
export const PIT_CYCLE_MIN_DELAY: number;
export const PIT_CYCLE_RANDOM_DELAY: number;
export const SKILL_IDS: readonly SkillId[];
export const PASSIVE_SKILL_IDS: readonly SkillId[];
export const PLAYER_COLORS: readonly string[];
export function isPassiveSkill(skill: SkillId): boolean;
export function isGroundHazardImmune(skill: SkillId): boolean;
export function isVoidFallImmune(skill: SkillId): boolean;
export function isObstacleImmune(skill: SkillId): boolean;
export function isDamageImmune(skill: SkillId): boolean;
export function getSkillSpeedMultiplier(skill: SkillId): number;
export function getSkillBodyScale(skill: SkillId): number;
export function getSkillRenderLayer(skill: SkillId): 0 | 1 | 2;
export function runnerTouchesRaceZone(
  skill: SkillId,
  x: number,
  y: number,
  zone: Rect,
  padding?: number,
): boolean;
export function runnerTouchesObstacle(
  x: number,
  y: number,
  obstacle: Rect,
  inset?: number,
): boolean;
export function runnersOverlap(x: number, y: number, otherX: number, otherY: number): boolean;
export function getSkillHitRadius(skill: SkillId, baseRadius?: number): number;
export function isTargetWithinScaledRange(
  targetSkill: SkillId,
  distance: number,
  centerRange: number,
  baseHitRadius?: number,
): boolean;
export function isTargetOnAimLine(
  targetSkill: SkillId,
  forwardDistance: number,
  lateralDistance: number,
  maxDistance: number,
  baseHitRadius?: number,
): boolean;
export function isGiantBodyMovementBlocked(
  movingSkill: SkillId,
  currentX: number,
  currentY: number,
  nextX: number,
  nextY: number,
  otherSkill: SkillId,
  otherX: number,
  otherY: number,
): boolean;
export function pickNextSkill(
  skills: readonly SkillId[],
  previousSkill?: SkillId,
  random?: () => number,
): SkillId;
export const TRACK: TrackBounds;
export const START_POINT: Point;
export const SPAWN_POINTS: readonly Point[];
export const RESPAWN_POINTS: readonly Point[];
export const CHECKPOINTS: readonly Readonly<Rect & { spawnX: number; spawnY: number }>[];
export const START_GATE: Rect;
export const PIT_ZONES: readonly Rect[];
export const JUMP_PADS: readonly Readonly<Rect & { pushX: number; pushY: number }>[];
export const SPINNER_RULES: readonly Readonly<{ x: number; y: number; radius: number; speed: number }>[];
