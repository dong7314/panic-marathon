import { resolve } from "node:path";
import { MATCH_TIME_LIMIT } from "../shared/game-rules.mjs";

function positiveNumber(value, fallback, minimum = 100) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function parseOrigins(value) {
  const origins = String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}

export function loadServerConfig(environment = process.env, cwd = process.cwd()) {
  return {
    host: environment.HOST?.trim() || "0.0.0.0",
    port: positiveNumber(environment.PORT, 5175, 1),
    clientOrigins: parseOrigins(environment.CLIENT_ORIGINS ?? environment.CLIENT_ORIGIN),
    matchTimeLimitMs: positiveNumber(environment.MATCH_TIME_LIMIT_MS, MATCH_TIME_LIMIT),
    matchCountdownMs: positiveNumber(environment.MATCH_COUNTDOWN_MS, 3_000),
    reconnectGraceMs: positiveNumber(environment.RECONNECT_GRACE_MS, 30_000),
    staticDir: resolve(cwd, environment.STATIC_DIR?.trim() || "dist"),
  };
}
