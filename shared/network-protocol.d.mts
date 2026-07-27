import type { SkillId } from "./game-rules.mjs";
import type { GeneratedPitZone, GeneratedSpinner } from "./map-hazards.mjs";
import type { MapId } from "./map-catalog.mjs";
import type { PlayerActionState } from "./player-state.mjs";

export type NetworkDirection = "down" | "up" | "left" | "right";
export type NetworkObstacleKind = "traffic-cone" | "school-hurdle" | "space-crate" | "space-pylon";
export type RoomConfig = {
  lapLimit: number;
  playerCount: number;
  mapId: MapId;
  enabledSkills: SkillId[];
};

export type NetworkPlayer = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  direction: NetworkDirection;
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
  flattenedMs?: number;
  flattenedElapsedMs?: number;
  fallingMs?: number;
  fallingElapsedMs?: number;
  fallTargetX?: number;
  fallTargetY?: number;
  fallKind?: "pit" | "void";
  airMs?: number;
  airElapsedMs?: number;
  airStartX?: number;
  airStartY?: number;
  airEndX?: number;
  airEndY?: number;
  connected: boolean;
  reconnectMs: number;
};

export type NetworkClone = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  direction: NetworkDirection;
  until: number;
};

export type NetworkRock = {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  remainingMs: number;
};

export type NetworkObstacle = {
  id: string;
  bandId: string;
  laneIndex: number;
  axis: "horizontal" | "vertical";
  kind: NetworkObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NetworkHazards = {
  activePitIndex: number;
  warningPitIndex: number;
  warningMs: number;
  nextPitMs: number;
  spinnerElapsedMs: number;
};

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
  obstacles: NetworkObstacle[];
  pitZones: GeneratedPitZone[];
  spinners: GeneratedSpinner[];
  rocks: NetworkRock[];
};

export type NetworkSession = {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
};

export type NetworkResponse =
  | { ok: true; room: NetworkRoom; session?: NetworkSession }
  | { ok: false; error: string };

export type RoomCreatePayload = { code?: string; name?: string; config?: Partial<RoomConfig> };
export type RoomJoinPayload = { code?: string; name?: string };
export type PlayerStatePayload = {
  x: number;
  y: number;
  direction?: NetworkDirection;
  walking?: number;
};
export type AimPayload = { dx: number; dy: number; skill?: SkillId };
export type NetworkAck = (response: NetworkResponse) => void;

export type HazardEffect =
  | { kind: "pit"; playerId: string; duration: number; targetX: number; targetY: number }
  | { kind: "void"; playerId: string; duration: number; targetX: number; targetY: number }
  | { kind: "jump"; playerId: string; duration: number; startX: number; startY: number; endX: number; endY: number }
  | { kind: "respawn"; reason?: "rock" | "pit" | "void"; playerId: string; x: number; y: number; health: number; ammo: number };

export type NetworkShot = { sourceId: string; x: number; y: number; dx: number; dy: number };
export type NetworkProjectile = {
  id: string;
  kind: "slow" | "sleep";
  sourceId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifetime: number;
};
export type NetworkGrapple = {
  sourceId: string;
  targetId?: string;
  sourceX: number;
  sourceY: number;
  hookX: number;
  hookY: number;
  targetStartX?: number;
  targetStartY?: number;
  targetEndX?: number;
  targetEndY?: number;
};
export type NetworkKnockback = {
  sourceId: string;
  targetId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
};
export type NetworkCombatEffect = {
  kind: "bullet" | SkillId;
  sourceId: string;
  targetIds: string[];
  duration?: number;
  defeated?: boolean;
  x?: number;
  y?: number;
};
export type NetworkRockRemoval = {
  id: string;
  reason: "barrier" | "player" | "expired";
  playerId?: string;
  defeated?: boolean;
};
export type NetworkTeleport = { playerId: string; x: number; y: number; lap: number };

export interface ClientToServerEvents {
  "room:create": (payload: RoomCreatePayload, callback: NetworkAck) => void;
  "room:join": (payload: RoomJoinPayload, callback: NetworkAck) => void;
  "room:resume": (payload: NetworkSession, callback: NetworkAck) => void;
  "room:start": (callback: NetworkAck) => void;
  "room:rematch": (callback: NetworkAck) => void;
  "room:leave": () => void;
  "player:state": (payload: PlayerStatePayload) => void;
  "combat:shoot": (payload: AimPayload) => void;
  "combat:skill": (payload: AimPayload) => void;
}

export interface ServerToClientEvents {
  "room:state": (room: NetworkRoom) => void;
  "match:countdown": (room: NetworkRoom) => void;
  "match:started": (room: NetworkRoom) => void;
  "match:finished": (room: NetworkRoom) => void;
  "hazard:warning": (hazards: NetworkHazards) => void;
  "hazard:state": (hazards: NetworkHazards) => void;
  "hazard:effect": (effect: HazardEffect) => void;
  "hazard:rock:spawn": (rock: NetworkRock) => void;
  "hazard:rock:remove": (event: NetworkRockRemoval) => void;
  "race:teleport": (event: NetworkTeleport) => void;
  "player:state": (runner: NetworkPlayer) => void;
  "combat:shot": (shot: NetworkShot) => void;
  "combat:projectile": (projectile: NetworkProjectile) => void;
  "combat:grapple": (grapple: NetworkGrapple) => void;
  "combat:knockback": (knockback: NetworkKnockback) => void;
  "combat:effect": (effect: NetworkCombatEffect) => void;
}

export const CLIENT_EVENTS: Readonly<{
  createRoom: "room:create";
  joinRoom: "room:join";
  resumeRoom: "room:resume";
  startRoom: "room:start";
  rematchRoom: "room:rematch";
  leaveRoom: "room:leave";
  playerState: "player:state";
  combatShoot: "combat:shoot";
  combatSkill: "combat:skill";
}>;

export const SERVER_EVENTS: Readonly<{
  roomState: "room:state";
  matchCountdown: "match:countdown";
  matchStarted: "match:started";
  matchFinished: "match:finished";
  hazardWarning: "hazard:warning";
  hazardState: "hazard:state";
  hazardEffect: "hazard:effect";
  rockSpawn: "hazard:rock:spawn";
  rockRemove: "hazard:rock:remove";
  raceTeleport: "race:teleport";
  playerState: "player:state";
  combatShot: "combat:shot";
  combatProjectile: "combat:projectile";
  combatGrapple: "combat:grapple";
  combatKnockback: "combat:knockback";
  combatEffect: "combat:effect";
}>;

export function parsePlayerStatePayload(value: unknown): PlayerStatePayload | null;
export function parseAimPayload(value: unknown): { x: number; y: number };
export function parseReconnectPayload(value: unknown): NetworkSession | null;
