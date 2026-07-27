import type { SkillId } from "../../shared/game-rules.mjs";
import type {
  HazardEffect,
  NetworkClone,
  NetworkDirection,
  NetworkHazards,
  NetworkMatchResult,
  NetworkObstacle,
  NetworkPlayer,
  NetworkResponse,
  NetworkRock,
  NetworkRoom,
  NetworkRoomPhase,
  NetworkSession,
  NetworkStanding,
  RoomConfig,
} from "../../shared/network-protocol.mjs";

export type {
  HazardEffect,
  NetworkClone,
  NetworkHazards,
  NetworkMatchResult,
  NetworkObstacle,
  NetworkPlayer,
  NetworkResponse,
  NetworkRock,
  NetworkRoom,
  NetworkRoomPhase,
  NetworkSession,
  NetworkStanding,
  RoomConfig,
} from "../../shared/network-protocol.mjs";

export type Direction = NetworkDirection;
export type PropKind =
  | "vending"
  | "bench"
  | "crate"
  | "plant"
  | "table"
  | "lamp"
  | "sofa"
  | "mailbox"
  | "arcade"
  | "rockwall"
  | "traffic-cone"
  | "school-hurdle"
  | "space-crate"
  | "space-pylon";

export type WorldProp = {
  kind: PropKind;
  x: number;
  y: number;
  width: number;
  height: number;
  solid?: boolean;
  axis?: "horizontal" | "vertical";
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
  flattenedUntil: number;
  flattenedStartedAt: number;
  fallingUntil: number;
  fallingStartedAt: number;
  fallTargetX: number;
  fallTargetY: number;
  fallKind?: "pit" | "void";
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
export type Pit = { x: number; y: number; width: number; height: number; active: boolean };
export type AimState = { screenX: number; screenY: number; worldX: number; worldY: number; visible: boolean; pulseUntil: number; pulseX: number; pulseY: number };
export type Clone = { x: number; y: number; direction: Direction; until: number; ownerId?: string };
export type Projectile = { kind: "slow" | "sleep" | "bullet"; owner: "player" | "remote"; sourceId?: string; x: number; y: number; velocityX: number; velocityY: number; until: number; radius: number; visualOnly?: boolean };
export type RollingRock = { id: string; x: number; y: number; velocityX: number; velocityY: number; radius: number; until: number; angle: number };
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
  flattenedStartedAt: number;
  flattenedUntil: number;
  slowEffectUntil: number;
  sleepEffectUntil: number;
};
export type LabelledRunner = Pick<RemotePlayer, "id" | "name" | "skill" | "skillCooldownUntil" | "cloneCount" | "dashCharges" | "dashRechargeUntil" | "connected">;
export type GrappleEffect = { sourceId: string; targetId?: string; sourceX: number; sourceY: number; hookX: number; hookY: number; targetStartX?: number; targetStartY?: number; targetEndX?: number; targetEndY?: number; startedAt: number; until: number };
export type PushEffect = { sourceId: string; targetId: string; startX: number; startY: number; endX: number; endY: number; duration: number; startedAt: number; until: number };
export type SlowImpact = { x: number; y: number; startedAt: number; until: number };
