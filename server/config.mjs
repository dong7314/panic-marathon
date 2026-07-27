import { resolve } from "node:path";
import { MATCH_TIME_LIMIT } from "../shared/game-rules.mjs";

function positiveNumber(value, fallback, minimum = 100) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function parseOrigins(value, allowAnyOrigin) {
  const origins = String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : allowAnyOrigin;
}

export function loadServerConfig(environment = process.env, cwd = process.cwd()) {
  const production = environment.NODE_ENV === "production";
  return {
    host: environment.HOST?.trim() || "0.0.0.0",
    port: positiveNumber(environment.PORT, 5175, 1),
    clientOrigins: parseOrigins(environment.CLIENT_ORIGINS ?? environment.CLIENT_ORIGIN, !production),
    matchTimeLimitMs: positiveNumber(environment.MATCH_TIME_LIMIT_MS, MATCH_TIME_LIMIT),
    matchCountdownMs: positiveNumber(environment.MATCH_COUNTDOWN_MS, 3_000),
    reconnectGraceMs: positiveNumber(environment.RECONNECT_GRACE_MS, 30_000),
    maxRooms: positiveNumber(environment.MAX_ROOMS, 100, 1),
    maxConnectionsPerAddress: positiveNumber(environment.MAX_CONNECTIONS_PER_ADDRESS, 32, 2),
    maxStateEventsPerSecond: positiveNumber(environment.MAX_STATE_EVENTS_PER_SECOND, 120, 20),
    maxCombatEventsPerSecond: positiveNumber(environment.MAX_COMBAT_EVENTS_PER_SECOND, 30, 5),
    maxRoomEventsPerMinute: positiveNumber(environment.MAX_ROOM_EVENTS_PER_MINUTE, 30, 5),
    staticDir: resolve(cwd, environment.STATIC_DIR?.trim() || "dist"),
  };
}
