import type { SkillId } from "../../shared/game-rules.mjs";
import type { PlayerActionState } from "../../shared/player-state.mjs";

export type Direction = "down" | "up" | "left" | "right";
export type PropKind = "vending" | "bench" | "crate" | "plant" | "table" | "lamp" | "sofa" | "mailbox" | "arcade";

export type WorldProp = {
  kind: PropKind;
  x: number;
  y: number;
  width: number;
  height: number;
  solid?: boolean;
};

export type Player = {
  x: number;
  y: number;
  direction: Direction;
  walking: number;
  name: string;
  color: string;
  knockbackX: number;
  knockbackY: number;
  hitUntil: number;
  fallingUntil: number;
  fallingStartedAt: number;
  fallTargetX: number;
  fallTargetY: number;
  airUntil: number;
  airStartedAt: number;
  dashUntil: number;
  dashVelocityX: number;
  dashVelocityY: number;
  health: number;
  ammo: number;
  shotReadyAt: number;
};

export type Spinner = { x: number; y: number; radius: number; angle: number; speed: number };
export type Pit = { x: number; y: number; width: number; height: number; active: boolean; warning?: boolean };
export type AimState = { screenX: number; screenY: number; worldX: number; worldY: number; visible: boolean; pulseUntil: number; pulseX: number; pulseY: number };
export type GameMode = "track" | "practice";
export type TestBot = { id: number; x: number; y: number; direction: Direction; walking: number; color: string; name: string; skill: SkillId; moveX: number; moveY: number; nextTurnAt: number; knockbackX: number; knockbackY: number; slowUntil: number; sleepUntil: number; health: number; lap: number; checkpoint: number; routeIndex: number; shotReadyAt: number };
export type Clone = { x: number; y: number; direction: Direction; until: number; ownerId?: string };
export type Projectile = { kind: "slow" | "sleep" | "bullet"; owner: "player" | "bot" | "remote"; sourceId?: string | number; x: number; y: number; velocityX: number; velocityY: number; until: number; radius: number; visualOnly?: boolean };
export type RoomConfig = { lapLimit: number; playerCount: number; enabledSkills: SkillId[] };

export type NetworkPlayer = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  direction: Direction;
  walking: number;
  health: number;
  ammo: number;
  skill: SkillId;
  lap: number;
  checkpoint: number;
  skillCooldownMs?: number;
  cloneCount?: number;
  dashCharges?: number;
  dashRechargeMs?: number;
  actionState?: PlayerActionState;
  actionStateMs?: number;
  grappleMs?: number;
  pushMs?: number;
  sleepMs?: number;
  slowMs?: number;
  runMs?: number;
  fallingMs?: number;
  fallingElapsedMs?: number;
  fallTargetX?: number;
  fallTargetY?: number;
  airMs?: number;
  airElapsedMs?: number;
  airStartX?: number;
  airStartY?: number;
  airEndX?: number;
  airEndY?: number;
  connected: boolean;
  reconnectMs: number;
};

export type NetworkClone = { id: string; ownerId: string; x: number; y: number; direction: Direction; until: number };
export type NetworkHazards = { activePitIndex: number; warningPitIndex: number; warningMs: number; nextPitMs: number; spinnerElapsedMs: number };
export type NetworkRoomPhase = "waiting" | "running" | "finished";
export type NetworkStanding = {
  place: number;
  id: string;
  name: string;
  color: string;
  lap: number;
  checkpoint: number;
  completed: boolean;
  finishTimeMs: number | null;
};
export type NetworkMatchResult = {
  reason: "completed" | "time-limit";
  durationMs: number;
  standings: NetworkStanding[];
};
export type RemotePlayer = NetworkPlayer & {
  targetX: number;
  targetY: number;
  targetWalking: number;
  skillCooldownUntil: number;
  dashRechargeUntil: number;
  fallingStartedAt: number;
  fallingUntil: number;
  fallTargetX: number;
  fallTargetY: number;
  airStartedAt: number;
  airUntil: number;
  slowEffectUntil: number;
  sleepEffectUntil: number;
};

export type NetworkRoom = {
  code: string;
  hostId: string;
  config: RoomConfig;
  phase: NetworkRoomPhase;
  round: number;
  started: boolean;
  finished: boolean;
  countdownMs: number;
  winner: { id: string; name: string } | null;
  result: NetworkMatchResult | null;
  hazards: NetworkHazards;
  players: NetworkPlayer[];
  clones: NetworkClone[];
};
export type NetworkSession = { roomCode: string; playerId: string; reconnectToken: string };
export type NetworkResponse = { ok: true; room: NetworkRoom; session?: NetworkSession } | { ok: false; error: string };
export type LabelledRunner = Pick<TestBot, "id" | "name" | "skill"> | Pick<RemotePlayer, "id" | "name" | "skill" | "skillCooldownUntil" | "cloneCount" | "dashCharges" | "dashRechargeUntil" | "connected">;
export type GrappleEffect = { sourceId: string | number; targetId?: string | number; sourceX: number; sourceY: number; hookX: number; hookY: number; targetStartX?: number; targetStartY?: number; targetEndX?: number; targetEndY?: number; startedAt: number; until: number };
export type PushEffect = { sourceId: string; targetId: string; startX: number; startY: number; endX: number; endY: number; duration: number; startedAt: number; until: number };
export type SlowImpact = { x: number; y: number; startedAt: number; until: number };
export type HazardEffect =
  | { kind: "pit"; playerId: string; duration: number; targetX: number; targetY: number }
  | { kind: "jump"; playerId: string; duration: number; startX: number; startY: number; endX: number; endY: number }
  | { kind: "respawn"; playerId: string; x: number; y: number; ammo: number };
