export type PlayerActionState = "falling" | "airborne" | "grappled" | "pushed" | "sleeping" | "normal";
export type PlayerTimedState = {
  fallingUntil: number;
  airUntil: number;
  grappleUntil: number;
  pushUntil: number;
  sleepUntil: number;
  slowUntil: number;
  runUntil: number;
};

export function getPlayerActionState(player: Partial<PlayerTimedState>, now?: number): PlayerActionState;
export function getPlayerActionStateRemaining(player: Partial<PlayerTimedState>, now?: number): number;
export function canPlayerMove(player: Partial<PlayerTimedState>, now?: number): boolean;
export function canPlayerAct(player: Partial<PlayerTimedState>, now?: number): boolean;
export function canPlayerReceiveHit(player: Partial<PlayerTimedState>, now?: number): boolean;
export function canPlayerBeDisplaced(player: Partial<PlayerTimedState>, now?: number): boolean;
export function resetPlayerTimedStates(player: Partial<PlayerTimedState>): void;
export function enterFallingState(player: Partial<PlayerTimedState>, until: number): void;
export function enterAirborneState(player: Partial<PlayerTimedState>, until: number): void;
export function enterDisplacementState(player: Partial<PlayerTimedState>, kind: "grappled" | "pushed", until: number): void;
