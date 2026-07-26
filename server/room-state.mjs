import { SKILL_IDS } from "../shared/game-rules.mjs";
import { DEFAULT_MAP_ID, isMapId } from "../shared/map-catalog.mjs";

const SKILLS = new Set(SKILL_IDS);

export function normalizeRoomCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);
}

export function sanitizePlayerName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 10);
  return name || "말썽꾸러기";
}

export function sanitizeRoomConfig(value) {
  const lapLimit = Math.max(1, Math.min(999, Math.floor(Number(value?.lapLimit) || 5)));
  const playerCount = Math.max(2, Math.min(6, Math.floor(Number(value?.playerCount) || 4)));
  const mapId = isMapId(value?.mapId) ? value.mapId : DEFAULT_MAP_ID;
  const enabledSkills = [...new Set(
    Array.isArray(value?.enabledSkills)
      ? value.enabledSkills.filter((skill) => SKILLS.has(skill))
      : [],
  )];
  return {
    lapLimit,
    playerCount,
    mapId,
    enabledSkills: enabledSkills.length >= 3 ? enabledSkills : ["push", "dash", "run"],
  };
}

export function createRoomState({
  code,
  config,
  phase = "waiting",
  round = 0,
  now = Date.now(),
  createHazardState,
}) {
  return {
    code,
    hostId: undefined,
    config: sanitizeRoomConfig(config),
    players: new Map(),
    nextJoinOrder: 0,
    clones: [],
    projectiles: [],
    rocks: [],
    obstacles: [],
    pitZones: [],
    spinners: [],
    nextRockAt: 0,
    nextRockId: 0,
    phase,
    round,
    result: null,
    matchStartedAt: phase === "running" ? now : 0,
    countdownEndsAt: 0,
    hazards: createHazardState(now),
  };
}
