import { createServer } from "node:http";
import { Server } from "socket.io";
import { loadServerConfig } from "./config.mjs";
import { createAppRequestHandler } from "./http-handler.mjs";
import {
  countConnectedPlayers,
  createPlayerIdentity,
  createReconnectSession,
  selectNextHost,
} from "./player-session.mjs";
import {
  createRoomState,
  normalizeRoomCode,
  sanitizePlayerName,
} from "./room-state.mjs";
import {
  CLONE_COOLDOWN,
  CLONE_DURATION,
  CLONE_LIMIT,
  DASH_RECHARGE_DURATION,
  FIRST_PIT_WARNING_DELAY,
  GRAB_HIT_RADIUS,
  GRAB_RANGE,
  JUMP_DURATION,
  PIT_CYCLE_MIN_DELAY,
  PIT_CYCLE_RANDOM_DELAY,
  PIT_FALL_DURATION,
  PIT_WARNING_DURATION,
  PLAYER_COLORS as COLORS,
  PUSH_DISTANCE,
  PUSH_DURATION,
  ROCK_SQUASH_DURATION,
  RUN_DURATION,
  getSkillHitRadius,
  getMovementSpeedMultiplier,
  isDamageImmune,
  isGroundHazardImmune,
  isGiantBodyMovementBlocked,
  isObstacleImmune,
  isPassiveSkill,
  isVoidFallImmune,
  isTargetOnAimLine,
  isTargetWithinScaledRange,
  pickNextSkill,
  runnersOverlap,
  runnerTouchesRaceZone,
  runnerTouchesObstacle,
} from "../shared/game-rules.mjs";
import { getMapDefinition } from "../shared/map-catalog.mjs";
import { generateMapHazards } from "../shared/map-hazards.mjs";
import { generateMapObstacles } from "../shared/map-obstacles.mjs";
import { canStandOnMap, getTrackFallTarget, pointSegmentDistance } from "../shared/geometry.mjs";
import { isMovementAllowed } from "../shared/movement-validation.mjs";
import {
  canPlayerAct,
  canPlayerBeDisplaced,
  canPlayerMove,
  canPlayerReceiveHit,
  enterAirborneState,
  enterDisplacementState,
  enterFallingState,
  enterFlattenedState,
  getPlayerActionState,
  getPlayerActionStateRemaining,
  resetPlayerTimedStates,
} from "../shared/player-state.mjs";

const config = loadServerConfig();
const rooms = new Map();
const serverStartedAt = Date.now();

function runtimeStatus() {
  const phases = { waiting: 0, running: 0, finished: 0 };
  let playerCount = 0;
  let connectedPlayerCount = 0;
  for (const room of rooms.values()) {
    phases[room.phase] += 1;
    playerCount += room.players.size;
    connectedPlayerCount += countConnectedPlayers(room.players);
  }
  const memory = process.memoryUsage();
  return {
    uptimeMs: Date.now() - serverStartedAt,
    rooms: rooms.size,
    players: playerCount,
    connectedPlayers: connectedPlayerCount,
    socketConnections: io?.engine?.clientsCount ?? 0,
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024 * 10) / 10,
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024 * 10) / 10,
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024 * 10) / 10,
    },
    phases,
  };
}

const httpServer = createServer(createAppRequestHandler({
  staticDir: config.staticDir,
  getRuntimeStatus: runtimeStatus,
}));
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigins, methods: ["GET", "POST"] },
});

function makeCode() {
  let code = "";
  do code = `PM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  while (rooms.has(code));
  return code;
}

function mapForRoom(room) {
  return getMapDefinition(room.config.mapId);
}

function rollSkill(room, previousSkill) {
  return pickNextSkill(room.config.enabledSkills, previousSkill);
}

function grantNextRaceSkill(room, player) {
  player.skill = rollSkill(room, player.skill);
  player.nextSkillAt = 0;
  player.dashCharges = 3;
  player.dashRechargeAt = 0;
}

function createHazardState(now = Date.now()) {
  return { activePitIndex: -1, warningPitIndex: -1, nextPitAt: now + FIRST_PIT_WARNING_DELAY, openAt: 0 };
}

function publicHazards(room, now = Date.now()) {
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

function refreshDashCharges(player, now = Date.now()) {
  if (player.dashCharges === 0 && player.dashRechargeAt > 0 && now >= player.dashRechargeAt) {
    player.dashCharges = 3;
    player.dashRechargeAt = 0;
  }
}

function publicPlayer(player, room) {
  const now = Date.now();
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

function pruneClones(room) {
  const now = Date.now();
  room.clones = room.clones.filter((clone) => clone.until > now);
}

function snapshot(room) {
  pruneClones(room);
  const now = Date.now();
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
    hazards: publicHazards(room),
    players: [...room.players.values()].map((player) => publicPlayer(player, room)),
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
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit("room:state", snapshot(room));
}

function bindPlayerSocket(room, player, socket) {
  const previousSocketId = player.socketId;
  player.socketId = socket.id;
  player.connected = true;
  player.reconnectDeadline = 0;
  player.lastUpdateAt = Date.now();
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.playerId = player.id;
  if (previousSocketId && previousSocketId !== socket.id) {
    io.sockets.sockets.get(previousSocketId)?.disconnect(true);
  }
}

function removePlayer(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) return false;
  room.players.delete(playerId);
  room.clones = room.clones.filter((clone) => clone.ownerId !== playerId);
  room.projectiles = room.projectiles.filter((projectile) => projectile.sourceId !== playerId);
  if (room.countdownEndsAt > 0 && countConnectedPlayers(room.players) < 2) room.countdownEndsAt = 0;
  if (room.hostId === playerId) room.hostId = selectNextHost(room.players);
  if (room.players.size === 0) rooms.delete(room.code);
  return true;
}

function leaveCurrentRoom(socket) {
  const code = socket.data.roomCode;
  const playerId = socket.data.playerId;
  if (!code || !playerId) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = undefined;
  socket.data.playerId = undefined;
  if (!room) return;
  const player = room.players.get(playerId);
  if (!player || player.socketId !== socket.id) return;
  removePlayer(room, playerId);
  if (rooms.has(code)) broadcastRoom(room);
}

function disconnectCurrentRoom(socket, now = Date.now()) {
  const code = socket.data.roomCode;
  const playerId = socket.data.playerId;
  socket.data.roomCode = undefined;
  socket.data.playerId = undefined;
  if (!code || !playerId) return;
  const room = rooms.get(code);
  const player = room?.players.get(playerId);
  if (!room || !player || player.socketId !== socket.id) return;
  player.socketId = undefined;
  player.connected = false;
  player.reconnectDeadline = now + config.reconnectGraceMs;
  broadcastRoom(room);
}

function addPlayer(room, socket, name) {
  const index = room.players.size;
  const spawns = mapForRoom(room).spawnPoints;
  const spawn = spawns[index] ?? spawns[0];
  const identity = createPlayerIdentity();
  const player = {
    ...identity,
    socketId: undefined,
    connected: false,
    reconnectDeadline: 0,
    name: sanitizePlayerName(name),
    color: COLORS[index % COLORS.length],
    joinOrder: room.nextJoinOrder++,
    x: spawn.x,
    y: spawn.y,
    direction: "right",
    walking: index,
    health: 5,
    ammo: 3,
    skill: rollSkill(room),
    lap: 0,
    checkpoint: 0,
    lastUpdateAt: Date.now(),
    nextShotAt: 0,
    nextSkillAt: 0,
    grappleUntil: 0,
    sleepUntil: 0,
    slowUntil: 0,
    runUntil: 0,
    dashCharges: 3,
    dashRechargeAt: 0,
    pushUntil: 0,
    flattenedUntil: 0,
    fallingUntil: 0,
    fallTargetX: spawn.x,
    fallTargetY: spawn.y,
    fallKind: undefined,
    airUntil: 0,
    airStartX: spawn.x,
    airStartY: spawn.y,
    airEndX: spawn.x,
    airEndY: spawn.y,
    jumpPadCooldownUntil: 0,
    spinnerImmuneUntil: 0,
  };
  room.players.set(player.id, player);
  bindPlayerSocket(room, player, socket);
  return player;
}

function resetPlayers(room, now = Date.now()) {
  const spawns = mapForRoom(room).spawnPoints;
  [...room.players.values()].forEach((player, index) => {
    const spawn = spawns[index] ?? spawns[0];
    player.x = spawn.x;
    player.y = spawn.y;
    player.direction = "right";
    player.walking = index;
    player.health = 5;
    player.ammo = 3;
    grantNextRaceSkill(room, player);
    player.lap = 0;
    player.checkpoint = 0;
    player.lastUpdateAt = now;
    player.nextShotAt = 0;
    resetPlayerTimedStates(player);
    player.fallTargetX = spawn.x;
    player.fallTargetY = spawn.y;
    player.fallKind = undefined;
    player.airStartX = spawn.x;
    player.airStartY = spawn.y;
    player.airEndX = spawn.x;
    player.airEndY = spawn.y;
    player.jumpPadCooldownUntil = 0;
    player.spinnerImmuneUntil = 0;
  });
}

function normalisedAim(payload) {
  const x = Number(payload?.dx);
  const y = Number(payload?.dy);
  const length = Math.hypot(x, y);
  return length > 0.01 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

function spawnSkillProjectile(room, attacker, skill, aim, now) {
  const speed = skill === "sleep" ? 345 : 265;
  const lifetime = skill === "sleep" ? 680 : 760;
  const projectile = {
    id: `${attacker.id}:${skill}:${now}`,
    kind: skill,
    sourceId: attacker.id,
    x: attacker.x,
    y: attacker.y - 2,
    velocityX: aim.x * speed,
    velocityY: aim.y * speed,
    lastUpdateAt: now,
    until: now + lifetime,
  };
  room.projectiles.push(projectile);
  io.to(room.code).emit("combat:projectile", {
    id: projectile.id,
    kind: projectile.kind,
    sourceId: projectile.sourceId,
    x: projectile.x,
    y: projectile.y,
    velocityX: projectile.velocityX,
    velocityY: projectile.velocityY,
    lifetime,
  });
}

function updateSkillProjectiles(room, now) {
  const map = mapForRoom(room);
  let stateChanged = false;
  for (let index = room.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = room.projectiles[index];
    const elapsed = Math.max(0, Math.min(100, now - projectile.lastUpdateAt)) / 1000;
    const startX = projectile.x;
    const startY = projectile.y;
    projectile.x += projectile.velocityX * elapsed;
    projectile.y += projectile.velocityY * elapsed;
    projectile.lastUpdateAt = now;
    let hitTarget;
    for (const target of room.players.values()) {
      if (!target.connected || target.id === projectile.sourceId || !canPlayerReceiveHit(target, now)) continue;
      if (pointSegmentDistance(target.x, target.y, startX, startY, projectile.x, projectile.y) > getSkillHitRadius(target.skill)) continue;
      hitTarget = target;
      break;
    }
    const expired = now >= projectile.until
      || projectile.x < 0 || projectile.x > map.worldWidth
      || projectile.y < 0 || projectile.y > map.worldHeight;
    if (!hitTarget && !expired) continue;

    const targetIds = [];
    if (projectile.kind === "sleep" && hitTarget) {
      hitTarget.sleepUntil = now + 2000;
      targetIds.push(hitTarget.id);
      stateChanged = true;
    }
    if (projectile.kind === "slow") {
      for (const target of room.players.values()) {
        if (!target.connected || target.id === projectile.sourceId || !canPlayerReceiveHit(target, now)) continue;
        if (!isTargetWithinScaledRange(target.skill, Math.hypot(target.x - projectile.x, target.y - projectile.y), 72)) continue;
        target.slowUntil = now + 3600;
        targetIds.push(target.id);
        stateChanged = true;
      }
    }
    io.to(room.code).emit("combat:effect", {
      kind: projectile.kind,
      sourceId: projectile.sourceId,
      targetIds,
      duration: projectile.kind === "sleep" ? 2000 : 3600,
      x: projectile.x,
      y: projectile.y,
    });
    room.projectiles.splice(index, 1);
  }
  return stateChanged;
}

function findTarget(room, attacker, aim, maxDistance, minimumDot = 0.5, now = Date.now()) {
  let selected;
  let closest = Number.POSITIVE_INFINITY;
  for (const target of room.players.values()) {
    if (!target.connected || target.id === attacker.id) continue;
    if (!canPlayerReceiveHit(target, now)) continue;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0 || !isTargetWithinScaledRange(target.skill, distance, maxDistance)) continue;
    const forwardDistance = dx * aim.x + dy * aim.y;
    const hitRadius = getSkillHitRadius(target.skill);
    if (forwardDistance <= -hitRadius) continue;
    const aimDot = (dx / distance) * aim.x + (dy / distance) * aim.y;
    const lateralDistance = Math.abs(dx * aim.y - dy * aim.x);
    if (aimDot < minimumDot && lateralDistance > hitRadius) continue;
    const rangeExtension = hitRadius - 12;
    const edgeDistance = Math.max(0, distance - rangeExtension);
    if (edgeDistance < closest) {
      selected = target;
      closest = edgeDistance;
    }
  }
  return selected;
}

function findTargetOnAimLine(room, attacker, aim, maxDistance = GRAB_RANGE, hitRadius = GRAB_HIT_RADIUS, now = Date.now()) {
  let selected;
  let closestForwardDistance = Number.POSITIVE_INFINITY;
  for (const target of room.players.values()) {
    if (!target.connected || target.id === attacker.id) continue;
    if (!canPlayerBeDisplaced(target, now)) continue;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const forwardDistance = dx * aim.x + dy * aim.y;
    const lateralDistance = Math.abs(dx * aim.y - dy * aim.x);
    if (!isTargetOnAimLine(target.skill, forwardDistance, lateralDistance, maxDistance, hitRadius)) continue;
    if (forwardDistance < closestForwardDistance) {
      selected = target;
      closestForwardDistance = forwardDistance;
    }
  }
  return selected;
}

function clampPosition(room, player) {
  const map = mapForRoom(room);
  player.x = Math.max(0, Math.min(map.worldWidth, player.x));
  player.y = Math.max(0, Math.min(map.worldHeight, player.y));
}

function progressScore(room, player) {
  return player.lap * (mapForRoom(room).checkpoints.length + 1) + player.checkpoint;
}

function distanceToNextGate(room, player) {
  const map = mapForRoom(room);
  const gate = map.checkpoints[player.checkpoint] ?? map.finishGate;
  return Math.hypot(player.x - (gate.x + gate.width / 2), player.y - (gate.y + gate.height / 2));
}

function buildMatchResult(room, reason, now, winnerId) {
  const players = [...room.players.values()];
  players.sort((left, right) => {
    if (left.id === winnerId) return -1;
    if (right.id === winnerId) return 1;
    const progressDifference = progressScore(room, right) - progressScore(room, left);
    if (progressDifference !== 0) return progressDifference;
    const distanceDifference = distanceToNextGate(room, left) - distanceToNextGate(room, right);
    if (Math.abs(distanceDifference) > 0.001) return distanceDifference;
    return left.joinOrder - right.joinOrder;
  });
  const durationMs = Math.max(0, now - room.matchStartedAt);
  return {
    reason,
    durationMs,
    standings: players.map((player, index) => ({
      place: index + 1,
      id: player.id,
      name: player.name,
      color: player.color,
      lap: Math.min(player.lap, room.config.lapLimit),
      checkpoint: player.checkpoint,
      completed: player.lap >= room.config.lapLimit,
      finishTimeMs: player.lap >= room.config.lapLimit ? durationMs : null,
    })),
  };
}

function finishRoom(room, reason, now = Date.now(), winnerId) {
  if (room.phase !== "running") return false;
  room.phase = "finished";
  room.countdownEndsAt = 0;
  room.result = buildMatchResult(room, reason, now, winnerId);
  room.clones.length = 0;
  room.projectiles.length = 0;
  room.rocks.length = 0;
  room.nextRockAt = 0;
  io.to(room.code).emit("match:finished", snapshot(room));
  return true;
}

function startRoomMatch(room, now = Date.now()) {
  room.countdownEndsAt = 0;
  room.phase = "running";
  room.round += 1;
  room.result = null;
  room.matchStartedAt = now;
  room.clones.length = 0;
  room.projectiles.length = 0;
  resetRoomHazardLayout(room);
  resetRoomHazards(room, now);
  resetRoomRocks(room, now);
  resetRoomObstacles(room);
  resetPlayers(room, now);
}

function startRoomCountdown(room, now = Date.now()) {
  room.countdownEndsAt = now + config.matchCountdownMs;
}

function blockedByClone(room, x, y) {
  pruneClones(room);
  return room.clones.some((clone) => runnersOverlap(x, y, clone.x, clone.y));
}

function blockedByGiantPlayer(room, player, x, y) {
  for (const other of room.players.values()) {
    if (!other.connected || other.id === player.id) continue;
    if (isGiantBodyMovementBlocked(
      player.skill,
      player.x,
      player.y,
      x,
      y,
      other.skill,
      other.x,
      other.y,
    )) return true;
  }
  return false;
}

function canOccupyMap(room, x, y, skill) {
  const map = mapForRoom(room);
  if (x - 5 < 0 || x + 5 > map.worldWidth || y - 5 < 0 || y + 7 > map.worldHeight) return false;
  if (map.trackBoundary !== "fall" && !canStandOnMap(map, x, y)) return false;
  const obstacles = [...map.rockBarriers, ...room.obstacles];
  return isObstacleImmune(skill)
    || !obstacles.some((obstacle) => runnerTouchesObstacle(x, y, obstacle));
}

function findSafePushEnd(room, target, directionX, directionY, maximumDistance = PUSH_DISTANCE) {
  for (let distance = maximumDistance; distance >= 0; distance -= 2) {
    const x = target.x + directionX * distance;
    const y = target.y + directionY * distance;
    if (!canOccupyMap(room, x, y, target.skill)) continue;
    if (!isObstacleImmune(target.skill) && blockedByClone(room, x, y)) continue;
    if (blockedByGiantPlayer(room, target, x, y)) continue;
    return { x, y };
  }
  return { x: target.x, y: target.y };
}

function findSafeAimPlacement(room, origin, aim, maximumDistance, minimumDistance = 0, skill) {
  for (let distance = maximumDistance; distance >= minimumDistance; distance -= 2) {
    const x = origin.x + aim.x * distance;
    const y = origin.y + aim.y * distance;
    if (!canOccupyMap(room, x, y, skill) || blockedByClone(room, x, y)) continue;
    return { x, y };
  }
  return undefined;
}

function nudgePlayerFromNewClone(room, player, clone, fallbackX, fallbackY) {
  if (isObstacleImmune(player.skill)) return;
  const deltaX = player.x - clone.x;
  const deltaY = player.y - clone.y;
  if (!runnersOverlap(player.x, player.y, clone.x, clone.y)) return;
  const length = Math.hypot(deltaX, deltaY);
  const baseX = length > .01 ? deltaX / length : fallbackX;
  const baseY = length > .01 ? deltaY / length : fallbackY;
  const directions = [
    { x: baseX, y: baseY },
    { x: -baseY, y: baseX },
    { x: baseY, y: -baseX },
    { x: -baseX, y: -baseY },
  ];
  const map = mapForRoom(room);
  for (const direction of directions) {
    for (let distance = 20; distance <= 48; distance += 4) {
      const x = Math.max(0, Math.min(map.worldWidth, clone.x + direction.x * distance));
      const y = Math.max(0, Math.min(map.worldHeight, clone.y + direction.y * distance));
      if (!canOccupyMap(room, x, y, player.skill) || blockedByClone(room, x, y)) continue;
      player.x = x;
      player.y = y;
      player.lastUpdateAt = Date.now();
      return;
    }
  }
}

function respawnPlayer(room, player, now = Date.now()) {
  const respawnPoints = mapForRoom(room).respawnPoints;
  const spawn = respawnPoints[Math.min(player.checkpoint, respawnPoints.length - 1)] ?? respawnPoints[0];
  player.x = spawn.x;
  player.y = spawn.y;
  player.health = 5;
  player.ammo = 3;
  resetPlayerTimedStates(player);
  player.fallTargetX = spawn.x;
  player.fallTargetY = spawn.y;
  player.fallKind = undefined;
  player.airStartX = spawn.x;
  player.airStartY = spawn.y;
  player.airEndX = spawn.x;
  player.airEndY = spawn.y;
  player.jumpPadCooldownUntil = now + 500;
  player.spinnerImmuneUntil = now + 500;
  player.lastUpdateAt = now;
}

function respawnPlayerFromPit(room, player, now = Date.now()) {
  const respawnPoints = mapForRoom(room).respawnPoints;
  const spawn = respawnPoints[Math.min(player.checkpoint, respawnPoints.length - 1)] ?? respawnPoints[0];
  player.x = spawn.x;
  player.y = spawn.y;
  player.ammo = 3;
  resetPlayerTimedStates(player);
  player.fallTargetX = spawn.x;
  player.fallTargetY = spawn.y;
  player.fallKind = undefined;
  player.airStartX = spawn.x;
  player.airStartY = spawn.y;
  player.airEndX = spawn.x;
  player.airEndY = spawn.y;
  player.jumpPadCooldownUntil = now + 500;
  player.spinnerImmuneUntil = now + 500;
  player.lastUpdateAt = now;
}

function damagePlayer(room, target, now = Date.now()) {
  if (isDamageImmune(target.skill)) return false;
  target.health -= 1;
  const defeated = target.health <= 0;
  if (defeated) respawnPlayer(room, target, now);
  return defeated;
}

function flattenPlayerFromRock(target, now = Date.now()) {
  if (isDamageImmune(target.skill)) return false;
  target.health -= 1;
  enterFlattenedState(target, now + ROCK_SQUASH_DURATION);
  target.lastUpdateAt = now;
  return target.health <= 0;
}

function bodyTouchesZone(x, y, zone, padding = 0) {
  const playerLeft = x - 5;
  const playerTop = y - 5;
  return playerLeft < zone.x + zone.width - padding
    && playerLeft + 10 > zone.x + padding
    && playerTop < zone.y + zone.height - padding
    && playerTop + 12 > zone.y + padding;
}

function playerTouchesZone(player, zone, padding = 0) {
  return bodyTouchesZone(player.x, player.y, zone, padding);
}

function triggerPitFall(room, player, pit, now) {
  enterFallingState(player, now + PIT_FALL_DURATION);
  player.fallKind = "pit";
  player.fallTargetX = pit.x + pit.width / 2;
  player.fallTargetY = pit.y + pit.height / 2;
  player.lastUpdateAt = now;
  io.to(room.code).emit("hazard:effect", {
    kind: "pit",
    playerId: player.id,
    duration: PIT_FALL_DURATION,
    targetX: player.fallTargetX,
    targetY: player.fallTargetY,
  });
}

function triggerVoidFall(room, player, now) {
  enterFallingState(player, now + PIT_FALL_DURATION);
  player.fallKind = "void";
  const target = getTrackFallTarget(player.x, player.y);
  player.fallTargetX = target.x;
  player.fallTargetY = target.y;
  player.lastUpdateAt = now;
  io.to(room.code).emit("hazard:effect", {
    kind: "void",
    playerId: player.id,
    duration: PIT_FALL_DURATION,
    targetX: player.fallTargetX,
    targetY: player.fallTargetY,
  });
}

function triggerJumpPad(room, player, pad, now) {
  const startX = player.x;
  const startY = player.y;
  const speed = Math.hypot(pad.pushX, pad.pushY);
  const distance = speed * JUMP_DURATION / 1000;
  const end = speed > 0
    ? findSafePushEnd(room, player, pad.pushX / speed, pad.pushY / speed, distance)
    : { x: player.x, y: player.y };
  player.x = end.x;
  player.y = end.y;
  player.airStartX = startX;
  player.airStartY = startY;
  player.airEndX = end.x;
  player.airEndY = end.y;
  enterAirborneState(player, now + JUMP_DURATION);
  player.jumpPadCooldownUntil = now + 980;
  player.lastUpdateAt = now;
  io.to(room.code).emit("hazard:effect", {
    kind: "jump",
    playerId: player.id,
    duration: JUMP_DURATION,
    startX,
    startY,
    endX: end.x,
    endY: end.y,
  });
}

function triggerSpinnerKnockback(room, player, spinner, spinnerIndex, now) {
  const elapsedSeconds = Math.max(0, now - room.matchStartedAt) / 1000;
  const angle = spinner.speed * elapsedSeconds;
  const armX = Math.cos(angle) * spinner.radius;
  const armY = Math.sin(angle) * spinner.radius;
  if (pointSegmentDistance(player.x, player.y + 2, spinner.x - armX, spinner.y - armY, spinner.x + armX, spinner.y + armY) > 8) return false;

  const awayX = player.x - spinner.x;
  const awayY = player.y - spinner.y;
  const distance = Math.max(1, Math.hypot(awayX, awayY));
  const startX = player.x;
  const startY = player.y;
  const end = findSafePushEnd(room, player, awayX / distance, awayY / distance);
  player.x = end.x;
  player.y = end.y;
  enterDisplacementState(player, "pushed", now + PUSH_DURATION);
  player.spinnerImmuneUntil = now + 430;
  player.lastUpdateAt = now;
  io.to(room.code).emit("combat:knockback", {
    sourceId: `hazard:spinner:${spinnerIndex}`,
    targetId: player.id,
    startX,
    startY,
    endX: end.x,
    endY: end.y,
    duration: PUSH_DURATION,
  });
  return true;
}

function updatePlayerHazards(room, player, now) {
  const map = mapForRoom(room);
  const actionState = getPlayerActionState(player, now);
  if (actionState === "falling" || actionState === "airborne") return false;
  if (map.trackBoundary === "fall" && !isVoidFallImmune(player.skill) && !canStandOnMap(map, player.x, player.y)) {
    triggerVoidFall(room, player, now);
    return true;
  }
  if (isGroundHazardImmune(player.skill)) return false;
  const activePit = room.pitZones[room.hazards.activePitIndex];
  if (activePit && playerTouchesZone(player, activePit, 4)) {
    triggerPitFall(room, player, activePit, now);
    return true;
  }
  if (player.jumpPadCooldownUntil <= now) {
    const jumpPad = map.jumpPads.find((pad) => playerTouchesZone(player, pad, 2));
    if (jumpPad) {
      triggerJumpPad(room, player, jumpPad, now);
      return true;
    }
  }
  if (canPlayerBeDisplaced(player, now) && player.spinnerImmuneUntil <= now) {
    const spinnerIndex = room.spinners.findIndex((spinner, index) => triggerSpinnerKnockback(room, player, spinner, index, now));
    if (spinnerIndex >= 0) return true;
  }
  return false;
}

function resetRoomHazards(room, now = Date.now()) {
  room.hazards = createHazardState(now);
}

function resetRoomHazardLayout(room) {
  const layout = generateMapHazards(room.config.mapId);
  room.pitZones = layout.pitZones;
  room.spinners = layout.spinners;
}

function resetRoomRocks(room, now = Date.now()) {
  const config = mapForRoom(room).rollingRocks;
  room.rocks.length = 0;
  room.nextRockId = 0;
  room.nextRockAt = config ? now + config.firstDelay : 0;
}

function resetRoomObstacles(room) {
  room.obstacles = generateMapObstacles(room.config.mapId);
}

function circleTouchesRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function spawnRollingRock(room, now) {
  const map = mapForRoom(room);
  const config = map.rollingRocks;
  if (!config || map.trackPath.length < 2) return false;
  const summit = map.trackPath[map.trackPath.length - 1];
  const downhillTarget = map.trackPath[map.trackPath.length - 2];
  const downhillX = downhillTarget.x - summit.x;
  const downhillY = downhillTarget.y - summit.y;
  const length = Math.max(1, Math.hypot(downhillX, downhillY));
  const directionX = downhillX / length;
  const directionY = downhillY / length;
  const normalX = -directionY;
  const normalY = directionX;
  const sequence = room.nextRockId;
  const offsets = config.spawnOffsets.length > 0 ? config.spawnOffsets : [0];
  const offset = offsets[sequence % offsets.length];
  const travelDuration = Math.ceil(length / Math.max(1, config.speed) * 1000) + 3000;
  const rock = {
    id: `${room.round}:${sequence}`,
    x: summit.x + normalX * offset,
    y: summit.y + normalY * offset,
    velocityX: directionX * config.speed,
    velocityY: directionY * config.speed,
    radius: config.radius,
    lastUpdateAt: now,
    until: now + travelDuration,
  };
  room.nextRockId += 1;
  room.rocks.push(rock);
  room.nextRockAt = now + config.minDelay + Math.random() * config.randomDelay;
  io.to(room.code).emit("hazard:rock:spawn", {
    id: rock.id,
    x: rock.x,
    y: rock.y,
    velocityX: rock.velocityX,
    velocityY: rock.velocityY,
    radius: rock.radius,
    remainingMs: rock.until - now,
  });
  return true;
}

function updateRollingRocks(room, now) {
  const map = mapForRoom(room);
  const config = map.rollingRocks;
  if (!config) {
    if (room.rocks.length === 0) return false;
    room.rocks.length = 0;
    return true;
  }

  let stateChanged = false;
  if (room.nextRockAt > 0 && now >= room.nextRockAt) spawnRollingRock(room, now);
  for (let index = room.rocks.length - 1; index >= 0; index -= 1) {
    const rock = room.rocks[index];
    const elapsed = Math.max(0, Math.min(100, now - rock.lastUpdateAt)) / 1000;
    rock.x += rock.velocityX * elapsed;
    rock.y += rock.velocityY * elapsed;
    rock.lastUpdateAt = now;

    const barrierHit = map.rockBarriers.some((barrier) => circleTouchesRect(rock.x, rock.y, rock.radius, barrier));
    let hitPlayer;
    if (!barrierHit) {
      hitPlayer = [...room.players.values()].find((candidate) => (
        candidate.connected
        && canPlayerReceiveHit(candidate, now)
        && !isGroundHazardImmune(candidate.skill)
        && Math.hypot(candidate.x - rock.x, candidate.y - rock.y) <= rock.radius + getSkillHitRadius(candidate.skill, 9)
      ));
    }
    const expired = now >= rock.until
      || rock.x < -rock.radius || rock.x > map.worldWidth + rock.radius
      || rock.y < -rock.radius || rock.y > map.worldHeight + rock.radius;
    if (!barrierHit && !hitPlayer && !expired) continue;

    let defeated = false;
    if (hitPlayer) {
      defeated = flattenPlayerFromRock(hitPlayer, now);
      stateChanged = true;
    }
    room.rocks.splice(index, 1);
    io.to(room.code).emit("hazard:rock:remove", {
      id: rock.id,
      reason: barrierHit ? "barrier" : hitPlayer ? "player" : "expired",
      playerId: hitPlayer?.id,
      defeated,
    });
  }
  return stateChanged;
}

function findNearestPitIndex(room) {
  const pitZones = room.pitZones;
  let selectedIndex = 0;
  let selectedDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < pitZones.length; index += 1) {
    const pit = pitZones[index];
    const centerX = pit.x + pit.width / 2;
    const centerY = pit.y + pit.height / 2;
    for (const player of room.players.values()) {
      if (!player.connected || player.fallingUntil > 0) continue;
      const distance = Math.hypot(player.x - centerX, player.y - centerY);
      if (distance >= selectedDistance) continue;
      selectedIndex = index;
      selectedDistance = distance;
    }
  }
  return selectedIndex;
}

function updateRoomHazards(room, now) {
  if (room.pitZones.length === 0) return false;
  if (room.hazards.warningPitIndex >= 0) {
    if (now < room.hazards.openAt) return false;
    room.hazards.activePitIndex = room.hazards.warningPitIndex;
    room.hazards.warningPitIndex = -1;
    room.hazards.openAt = 0;
    room.hazards.nextPitAt = now + PIT_CYCLE_MIN_DELAY + Math.random() * PIT_CYCLE_RANDOM_DELAY;
    io.to(room.code).emit("hazard:state", publicHazards(room, now));
    return true;
  }
  if (now < room.hazards.nextPitAt) return false;
  room.hazards.warningPitIndex = findNearestPitIndex(room);
  room.hazards.activePitIndex = -1;
  room.hazards.openAt = now + PIT_WARNING_DURATION;
  const state = publicHazards(room, now);
  io.to(room.code).emit("hazard:warning", state);
  io.to(room.code).emit("hazard:state", state);
  return true;
}

function updateRaceProgress(room, player, now = Date.now()) {
  if (room.phase !== "running") return false;
  const map = mapForRoom(room);
  const checkpoint = map.checkpoints[player.checkpoint];
  if (checkpoint && runnerTouchesRaceZone(player.skill, player.x, player.y, checkpoint, 8)) {
    player.checkpoint += 1;
    player.ammo = 3;
    grantNextRaceSkill(room, player);
    player.lastUpdateAt = now;
    return true;
  }

  if (
    player.checkpoint !== map.checkpoints.length
    || !runnerTouchesRaceZone(player.skill, player.x, player.y, map.finishGate)
  ) return false;
  player.lap += 1;
  player.checkpoint = 0;
  player.lastUpdateAt = now;
  if (player.lap >= room.config.lapLimit) {
    finishRoom(room, "completed", now, player.id);
  } else {
    grantNextRaceSkill(room, player);
    if (map.courseType === "linear") {
      player.x = map.startPoint.x;
      player.y = map.startPoint.y;
      player.direction = "right";
      resetPlayerTimedStates(player);
      player.fallTargetX = player.x;
      player.fallTargetY = player.y;
      player.airStartX = player.x;
      player.airStartY = player.y;
      player.airEndX = player.x;
      player.airEndY = player.y;
      player.lastUpdateAt = now;
      io.to(room.code).emit("race:teleport", {
        playerId: player.id,
        x: player.x,
        y: player.y,
        lap: player.lap,
      });
    }
  }
  return true;
}

function ack(callback, value) {
  if (typeof callback === "function") callback(value);
}

io.on("connection", (socket) => {
  socket.on("room:create", (payload, callback) => {
    leaveCurrentRoom(socket);
    const requestedCode = normalizeRoomCode(payload?.code);
    const code = requestedCode.length >= 4 ? requestedCode : makeCode();
    if (rooms.has(code)) {
      ack(callback, { ok: false, error: "이미 사용 중인 초대 코드입니다." });
      return;
    }
    const room = createRoomState({
      code,
      config: payload?.config,
      createHazardState,
    });
    rooms.set(code, room);
    const player = addPlayer(room, socket, payload?.name);
    room.hostId = player.id;
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot, session: createReconnectSession(room.code, player) });
    broadcastRoom(room);
  });

  socket.on("room:join", (payload, callback) => {
    leaveCurrentRoom(socket);
    const code = normalizeRoomCode(payload?.code);
    const room = rooms.get(code);
    if (!room) {
      ack(callback, { ok: false, error: "방을 찾지 못했습니다. 초대 코드를 확인하세요." });
      return;
    }
    if (room.phase !== "waiting") {
      ack(callback, { ok: false, error: "이미 진행 중인 경기입니다." });
      return;
    }
    if (room.countdownEndsAt > 0) {
      ack(callback, { ok: false, error: "출발 카운트다운이 진행 중입니다." });
      return;
    }
    if (room.players.size >= room.config.playerCount) {
      ack(callback, { ok: false, error: "방 인원이 가득 찼습니다." });
      return;
    }
    const player = addPlayer(room, socket, payload?.name);
    if (!room.hostId) room.hostId = player.id;
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot, session: createReconnectSession(room.code, player) });
    broadcastRoom(room);
  });

  socket.on("room:resume", (payload, callback) => {
    const code = normalizeRoomCode(payload?.roomCode);
    const playerId = String(payload?.playerId ?? "");
    const reconnectToken = String(payload?.reconnectToken ?? "");
    const room = rooms.get(code);
    const player = room?.players.get(playerId);
    if (!room || !player || !reconnectToken || player.reconnectToken !== reconnectToken) {
      ack(callback, { ok: false, error: "재접속 세션이 만료되었거나 올바르지 않습니다." });
      return;
    }
    if (!player.connected && player.reconnectDeadline > 0 && player.reconnectDeadline <= Date.now()) {
      removePlayer(room, player.id);
      if (rooms.has(code)) broadcastRoom(room);
      ack(callback, { ok: false, error: "재접속 유예 시간이 지나 세션이 만료되었습니다." });
      return;
    }
    if (socket.data.roomCode !== code || socket.data.playerId !== playerId) leaveCurrentRoom(socket);
    bindPlayerSocket(room, player, socket);
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot, session: createReconnectSession(room.code, player) });
    broadcastRoom(room);
  });

  socket.on("room:start", (callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerId) {
      ack(callback, { ok: false, error: "방장만 경기를 시작할 수 있습니다." });
      return;
    }
    if (countConnectedPlayers(room.players) < 2) {
      ack(callback, { ok: false, error: "최소 2명이 참가해야 시작할 수 있습니다." });
      return;
    }
    if (room.phase !== "waiting") {
      ack(callback, { ok: false, error: "대기 중인 방에서만 경기를 시작할 수 있습니다." });
      return;
    }
    if (room.countdownEndsAt > 0) {
      ack(callback, { ok: false, error: "이미 출발 카운트다운이 진행 중입니다." });
      return;
    }
    startRoomCountdown(room);
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot });
    io.to(room.code).emit("match:countdown", roomSnapshot);
    broadcastRoom(room);
  });

  socket.on("room:rematch", (callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.data.playerId) {
      ack(callback, { ok: false, error: "방장만 재대결을 시작할 수 있습니다." });
      return;
    }
    if (room.phase !== "finished") {
      ack(callback, { ok: false, error: "경기가 끝난 뒤에만 재대결할 수 있습니다." });
      return;
    }
    if (countConnectedPlayers(room.players) < 2) {
      ack(callback, { ok: false, error: "최소 2명이 참가해야 재대결할 수 있습니다." });
      return;
    }
    if (room.countdownEndsAt > 0) {
      ack(callback, { ok: false, error: "이미 출발 카운트다운이 진행 중입니다." });
      return;
    }
    startRoomCountdown(room);
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot });
    io.to(room.code).emit("match:countdown", roomSnapshot);
    broadcastRoom(room);
  });

  socket.on("player:state", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.data.playerId);
    if (!room || room.phase !== "running" || !player) return;
    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = Date.now();
    if (!canPlayerMove(player, now)) return;
    const elapsed = Math.max(16, now - player.lastUpdateAt);
    const movementSpeedMultiplier = getMovementSpeedMultiplier(
      player.skill,
      player.slowUntil > now,
      player.runUntil > now,
    ) * mapForRoom(room).movementSpeedMultiplier;
    if (!isMovementAllowed(
      player.x,
      player.y,
      x,
      y,
      elapsed,
      false,
      false,
      movementSpeedMultiplier,
      mapForRoom(room),
    )) return;
    if (!canOccupyMap(room, x, y, player.skill)) return;
    if (!isObstacleImmune(player.skill) && blockedByClone(room, x, y)) return;
    if (blockedByGiantPlayer(room, player, x, y)) return;
    player.x = x;
    player.y = y;
    clampPosition(room, player);
    player.direction = ["up", "down", "left", "right"].includes(payload?.direction) ? payload.direction : player.direction;
    player.walking = Number.isFinite(Number(payload?.walking)) ? Number(payload.walking) : player.walking;
    player.lastUpdateAt = now;
    const hazardChanged = updatePlayerHazards(room, player, now);
    const raceChanged = !hazardChanged && updateRaceProgress(room, player, now);
    if (hazardChanged || raceChanged) {
      broadcastRoom(room);
      return;
    }
    socket.to(room.code).emit("player:state", publicPlayer(player, room));
  });

  socket.on("combat:shoot", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const attacker = room?.players.get(socket.data.playerId);
    const now = Date.now();
    if (!room || room.phase !== "running" || !attacker || !canPlayerAct(attacker, now) || attacker.nextShotAt > now || attacker.ammo <= 0) return;
    const aim = normalisedAim(payload);
    attacker.ammo -= 1;
    attacker.nextShotAt = now + 210;
    const target = findTarget(room, attacker, aim, 230, .82, now);
    const defeated = target ? damagePlayer(room, target, now) : false;
    io.to(room.code).emit("combat:shot", { sourceId: attacker.id, x: attacker.x + aim.x * 8, y: attacker.y + aim.y * 2, dx: aim.x, dy: aim.y });
    io.to(room.code).emit("combat:effect", { kind: "bullet", sourceId: attacker.id, targetIds: target ? [target.id] : [], defeated });
    broadcastRoom(room);
  });

  socket.on("combat:skill", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const attacker = room?.players.get(socket.data.playerId);
    const now = Date.now();
    if (!room || room.phase !== "running" || !attacker || !canPlayerAct(attacker, now) || attacker.nextSkillAt > now) return;
    const skill = attacker.skill;
    if (isPassiveSkill(skill)) return;
    refreshDashCharges(attacker, now);
    if (skill === "dash" && attacker.dashCharges <= 0) return;
    attacker.skill = skill;
    const aim = normalisedAim(payload);
    const targetIds = [];
    if (skill === "push") {
      for (const target of room.players.values()) {
        if (!target.connected || target.id === attacker.id) continue;
        if (!canPlayerBeDisplaced(target, now)) continue;
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const distance = Math.hypot(dx, dy);
        if (!distance || !isTargetWithinScaledRange(target.skill, distance, 72)) continue;
        const startX = target.x;
        const startY = target.y;
        const pushEnd = findSafePushEnd(room, target, dx / distance, dy / distance);
        target.x = pushEnd.x;
        target.y = pushEnd.y;
        enterDisplacementState(target, "pushed", now + PUSH_DURATION);
        target.lastUpdateAt = now;
        targetIds.push(target.id);
        io.to(room.code).emit("combat:knockback", {
          sourceId: attacker.id,
          targetId: target.id,
          startX,
          startY,
          endX: target.x,
          endY: target.y,
          duration: PUSH_DURATION,
        });
      }
      attacker.nextSkillAt = now + 2600;
    } else if (skill === "grab") {
      const target = findTargetOnAimLine(room, attacker, aim, GRAB_RANGE, GRAB_HIT_RADIUS, now);
      const grapple = {
        sourceId: attacker.id,
        sourceX: attacker.x,
        sourceY: attacker.y,
        hookX: target ? target.x : attacker.x + aim.x * GRAB_RANGE,
        hookY: target ? target.y : attacker.y + aim.y * GRAB_RANGE,
      };
      if (target) {
        const targetStartX = target.x;
        const targetStartY = target.y;
        const targetEndDistance = 34 + getSkillHitRadius(target.skill) - 12;
        const targetEnd = findSafeAimPlacement(room, attacker, aim, targetEndDistance, 0, target.skill) ?? { x: attacker.x, y: attacker.y };
        target.x = targetEnd.x;
        target.y = targetEnd.y;
        enterDisplacementState(target, "grappled", now + 520);
        targetIds.push(target.id);
        Object.assign(grapple, {
          targetId: target.id,
          targetStartX,
          targetStartY,
          targetEndX: target.x,
          targetEndY: target.y,
        });
      }
      enterDisplacementState(attacker, "grappled", now + 520);
      io.to(room.code).emit("combat:grapple", grapple);
      attacker.nextSkillAt = now + 3800;
    } else if (skill === "slow" || skill === "sleep") {
      spawnSkillProjectile(room, attacker, skill, aim, now);
      attacker.nextSkillAt = now + (skill === "slow" ? 4600 : 2000);
    } else if (skill === "dash") {
      attacker.dashCharges -= 1;
      if (attacker.dashCharges === 0) attacker.dashRechargeAt = now + DASH_RECHARGE_DURATION;
      const dashEnd = findSafePushEnd(room, attacker, aim.x, aim.y, 46);
      attacker.x = dashEnd.x;
      attacker.y = dashEnd.y;
      attacker.nextSkillAt = now + 170;
    } else if (skill === "run") {
      attacker.runUntil = now + RUN_DURATION;
      attacker.nextSkillAt = now + 9000;
    } else if (skill === "clone") {
      pruneClones(room);
      const ownedClones = room.clones.filter((clone) => clone.ownerId === attacker.id);
      if (ownedClones.length < CLONE_LIMIT) {
        const spawn = findSafeAimPlacement(room, attacker, aim, 32, 18);
        if (!spawn) {
          attacker.nextSkillAt = now + CLONE_COOLDOWN;
          broadcastRoom(room);
          return;
        }
        const clone = {
          id: `${attacker.id}:${now}:${ownedClones.length}`,
          ownerId: attacker.id,
          x: spawn.x,
          y: spawn.y,
          direction: Math.abs(aim.x) > Math.abs(aim.y) ? (aim.x < 0 ? "left" : "right") : (aim.y < 0 ? "up" : "down"),
          until: now + CLONE_DURATION,
        };
        room.clones.push(clone);
        for (const target of room.players.values()) {
          if (!target.connected || target.id === attacker.id) continue;
          if (!canPlayerBeDisplaced(target, now)) continue;
          nudgePlayerFromNewClone(room, target, clone, aim.x, aim.y);
        }
      }
      attacker.nextSkillAt = now + CLONE_COOLDOWN;
    } else {
      attacker.nextSkillAt = now + 1100;
    }
    const attackerHitHazard = updatePlayerHazards(room, attacker, now);
    if (!attackerHitHazard) updateRaceProgress(room, attacker, now);
    for (const targetId of targetIds) {
      const target = room.players.get(targetId);
      if (!target) continue;
      const targetHitHazard = updatePlayerHazards(room, target, now);
      if (!targetHitHazard) updateRaceProgress(room, target, now);
    }
    if (skill !== "sleep" && skill !== "slow") {
      io.to(room.code).emit("combat:effect", { kind: skill, sourceId: attacker.id, targetIds, duration: 0 });
    }
    broadcastRoom(room);
  });

  socket.on("room:leave", () => leaveCurrentRoom(socket));
  socket.on("disconnect", () => disconnectCurrentRoom(socket));
});

const hazardTimer = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.countdownEndsAt > 0) {
      if (countConnectedPlayers(room.players) < 2) {
        room.countdownEndsAt = 0;
        broadcastRoom(room);
        continue;
      }
      if (now < room.countdownEndsAt) continue;
      startRoomMatch(room, now);
      const roomSnapshot = snapshot(room);
      io.to(room.code).emit("match:started", roomSnapshot);
      broadcastRoom(room);
      continue;
    }
    if (room.phase !== "running") continue;
    if (now - room.matchStartedAt >= config.matchTimeLimitMs) {
      finishRoom(room, "time-limit", now);
      broadcastRoom(room);
      continue;
    }
    updateRoomHazards(room, now);
    let roomStateChanged = updateSkillProjectiles(room, now);
    roomStateChanged = updateRollingRocks(room, now) || roomStateChanged;
    for (const player of room.players.values()) {
      if (player.flattenedUntil > 0 && player.flattenedUntil <= now) {
        if (player.health <= 0) respawnPlayer(room, player, now);
        else respawnPlayerFromPit(room, player, now);
        io.to(room.code).emit("hazard:effect", {
          kind: "respawn",
          reason: "rock",
          playerId: player.id,
          x: player.x,
          y: player.y,
          health: player.health,
          ammo: player.ammo,
        });
        roomStateChanged = true;
        continue;
      }
      if (player.fallingUntil <= 0 || player.fallingUntil > now) continue;
      const fellIntoVoid = player.fallKind === "void";
      if (fellIntoVoid) respawnPlayer(room, player, now);
      else respawnPlayerFromPit(room, player, now);
      io.to(room.code).emit("hazard:effect", {
        kind: "respawn",
        playerId: player.id,
        x: player.x,
        y: player.y,
        health: player.health,
        ammo: player.ammo,
      });
      roomStateChanged = true;
    }
    if (roomStateChanged) broadcastRoom(room);
  }
}, 25);
hazardTimer.unref();

const reconnectTimer = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    let changed = false;
    for (const player of [...room.players.values()]) {
      if (player.connected || player.reconnectDeadline <= 0 || player.reconnectDeadline > now) continue;
      changed = removePlayer(room, player.id) || changed;
    }
    if (changed && rooms.has(code)) broadcastRoom(room);
  }
}, 250);
reconnectTimer.unref();

httpServer.listen(config.port, config.host, () => {
  console.log(`Panic Marathon multiplayer server listening on http://${config.host}:${config.port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing multiplayer server`);
  clearInterval(hazardTimer);
  clearInterval(reconnectTimer);
  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, 5_000);
  forceExitTimer.unref();

  const finish = () => {
    clearTimeout(forceExitTimer);
    process.exitCode = 0;
    if (process.connected) process.disconnect();
  };
  io.close(() => {
    if (!httpServer.listening) {
      finish();
      return;
    }
    httpServer.close(finish);
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
if (typeof process.send === "function") {
  process.once("message", (message) => {
    if (message === "shutdown" || message?.type === "shutdown") shutdown("IPC shutdown request");
  });
}
