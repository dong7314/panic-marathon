import {
  JUMP_DURATION,
  PIT_FALL_DURATION,
  ROCK_SQUASH_DURATION,
} from "../shared/game-rules.mjs";
import {
  getPlayerActionState,
  getPlayerActionStateRemaining,
} from "../shared/player-state.mjs";

export function publicHazards(room, now = Date.now()) {
  const hasPits = room.pitZones.length > 0;
  const warningMs = room.hazards.warningPitIndex >= 0 ? Math.max(0, room.hazards.openAt - now) : 0;
  const spinnerElapsedMs = room.matchStartedAt > 0
    ? room.result?.durationMs ?? Math.max(0, now - room.matchStartedAt)
    : 0;
  return {
    activePitIndex: room.hazards.activePitIndex,
    warningPitIndex: room.hazards.warningPitIndex,
    warningMs,
    nextPitMs: hasPits ? warningMs || Math.max(0, room.hazards.nextPitAt - now) : 0,
    spinnerElapsedMs,
  };
}

export function refreshDashCharges(player, now = Date.now()) {
  if (player.dashCharges === 0 && player.dashRechargeAt > 0 && now >= player.dashRechargeAt) {
    player.dashCharges = 3;
    player.dashRechargeAt = 0;
  }
}

export function publicPlayer(player, room, now = Date.now()) {
  refreshDashCharges(player, now);
  const actionState = getPlayerActionState(player, now);
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    x: player.x,
    y: player.y,
    direction: player.direction,
    walking: player.walking,
    health: player.health,
    ammo: player.ammo,
    skill: player.skill,
    lap: player.lap,
    checkpoint: player.checkpoint,
    skillCooldownMs: Math.max(0, player.nextSkillAt - now),
    cloneCount: room.clones.filter((clone) => clone.ownerId === player.id && clone.until > now).length,
    dashCharges: player.dashCharges,
    dashRechargeMs: Math.max(0, player.dashRechargeAt - now),
    actionState,
    actionStateMs: getPlayerActionStateRemaining(player, now),
    grappleMs: Math.max(0, player.grappleUntil - now),
    pushMs: Math.max(0, player.pushUntil - now),
    sleepMs: Math.max(0, player.sleepUntil - now),
    slowMs: Math.max(0, player.slowUntil - now),
    runMs: Math.max(0, player.runUntil - now),
    flattenedMs: Math.max(0, player.flattenedUntil - now),
    flattenedElapsedMs: player.flattenedUntil > now
      ? ROCK_SQUASH_DURATION - (player.flattenedUntil - now)
      : 0,
    fallingMs: Math.max(0, player.fallingUntil - now),
    fallingElapsedMs: player.fallingUntil > now ? PIT_FALL_DURATION - (player.fallingUntil - now) : 0,
    fallTargetX: player.fallTargetX,
    fallTargetY: player.fallTargetY,
    fallKind: player.fallKind,
    airMs: Math.max(0, player.airUntil - now),
    airElapsedMs: player.airUntil > now ? JUMP_DURATION - (player.airUntil - now) : 0,
    airStartX: player.airStartX,
    airStartY: player.airStartY,
    airEndX: player.airEndX,
    airEndY: player.airEndY,
    connected: player.connected,
    reconnectMs: player.connected ? 0 : Math.max(0, player.reconnectDeadline - now),
  };
}

export function pruneClones(room, now = Date.now()) {
  room.clones = room.clones.filter((clone) => clone.until > now);
}

export function snapshot(room, now = Date.now()) {
  pruneClones(room, now);
  const started = room.phase !== "waiting";
  const finished = room.phase === "finished";
  const winner = room.result?.standings[0] ?? null;
  return {
    code: room.code,
    hostId: room.hostId,
    config: room.config,
    phase: room.phase,
    round: room.round,
    started,
    finished,
    countdownMs: room.countdownEndsAt > 0 ? Math.max(0, room.countdownEndsAt - now) : 0,
    winner: winner ? { id: winner.id, name: winner.name } : null,
    result: room.result,
    hazards: publicHazards(room, now),
    players: [...room.players.values()].map((player) => publicPlayer(player, room, now)),
    clones: room.clones.map((clone) => ({ ...clone })),
    obstacles: room.obstacles.map((obstacle) => ({ ...obstacle })),
    pitZones: room.pitZones.map((pit) => ({ ...pit })),
    spinners: room.spinners.map((spinner) => ({ ...spinner })),
    rocks: room.rocks.map((rock) => ({
      id: rock.id,
      x: rock.x,
      y: rock.y,
      velocityX: rock.velocityX,
      velocityY: rock.velocityY,
      radius: rock.radius,
      remainingMs: Math.max(0, rock.until - now),
    })),
    chatMessages: room.chatMessages.map((message) => ({ ...message })),
  };
}
