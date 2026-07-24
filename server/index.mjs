import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  CHECKPOINTS,
  CLONE_COOLDOWN,
  CLONE_DURATION,
  CLONE_LIMIT,
  DASH_RECHARGE_DURATION,
  FIRST_PIT_WARNING_DELAY,
  GRAB_HIT_RADIUS,
  GRAB_RANGE,
  JUMP_DURATION,
  JUMP_PADS,
  PIT_CYCLE_MIN_DELAY,
  PIT_CYCLE_RANDOM_DELAY,
  PIT_FALL_DURATION,
  PIT_WARNING_DURATION,
  PIT_ZONES as PITS,
  PLAYER_COLORS as COLORS,
  PUSH_DISTANCE,
  PUSH_DURATION,
  RESPAWN_POINTS,
  RUN_DURATION,
  SKILL_IDS,
  SPAWN_POINTS as SPAWNS,
  SPINNER_RULES,
  START_GATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../shared/game-rules.mjs";
import { canStandOnTrack, pointSegmentDistance } from "../shared/geometry.mjs";
import { isMovementAllowed } from "../shared/movement-validation.mjs";

const PORT = Number(process.env.PORT ?? 5175);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5174";
const TEST_ROOM_CODE = "TEST";
const SKILLS = new Set(SKILL_IDS);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

const rooms = new Map();

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
}

function makeCode() {
  let code = "";
  do code = `PM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  while (rooms.has(code));
  return code;
}

function sanitizeName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 10);
  return name || "말썽꾸러기";
}

function sanitizeConfig(value) {
  const lapLimit = Math.max(1, Math.min(999, Math.floor(Number(value?.lapLimit) || 5)));
  const playerCount = Math.max(2, Math.min(6, Math.floor(Number(value?.playerCount) || 4)));
  const enabledSkills = [...new Set(Array.isArray(value?.enabledSkills) ? value.enabledSkills.filter((skill) => SKILLS.has(skill)) : [])];
  return { lapLimit, playerCount, enabledSkills: enabledSkills.length >= 3 ? enabledSkills : ["push", "dash", "run"] };
}

function rollSkill(room) {
  const skills = room.config.enabledSkills;
  return skills[Math.floor(Math.random() * skills.length)] ?? "push";
}

function createHazardState(now = Date.now()) {
  return { activePitIndex: -1, warningPitIndex: -1, nextPitAt: now + FIRST_PIT_WARNING_DELAY, openAt: 0 };
}

function publicHazards(room, now = Date.now()) {
  const warningMs = room.hazards.warningPitIndex >= 0 ? Math.max(0, room.hazards.openAt - now) : 0;
  return {
    activePitIndex: room.hazards.activePitIndex,
    warningPitIndex: room.hazards.warningPitIndex,
    warningMs,
    nextPitMs: warningMs || Math.max(0, room.hazards.nextPitAt - now),
    spinnerElapsedMs: room.matchStartedAt > 0 ? Math.max(0, now - room.matchStartedAt) : 0,
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
    fallingMs: Math.max(0, player.fallingUntil - now),
    fallingElapsedMs: player.fallingUntil > now ? PIT_FALL_DURATION - (player.fallingUntil - now) : 0,
    fallTargetX: player.fallTargetX,
    fallTargetY: player.fallTargetY,
    airMs: Math.max(0, player.airUntil - now),
    airElapsedMs: player.airUntil > now ? JUMP_DURATION - (player.airUntil - now) : 0,
  };
}

function pruneClones(room) {
  const now = Date.now();
  room.clones = room.clones.filter((clone) => clone.until > now);
}

function snapshot(room) {
  pruneClones(room);
  return {
    code: room.code,
    hostId: room.hostId,
    config: room.config,
    started: room.started,
    finished: room.finished,
    winner: room.winnerId ? { id: room.winnerId, name: room.winnerName } : null,
    hazards: publicHazards(room),
    players: [...room.players.values()].map((player) => publicPlayer(player, room)),
    clones: room.clones.map((clone) => ({ ...clone })),
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit("room:state", snapshot(room));
}

function leaveCurrentRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = undefined;
  if (!room) return;
  room.players.delete(socket.id);
  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  broadcastRoom(room);
}

function addPlayer(room, socket, name) {
  const index = room.players.size;
  const spawn = SPAWNS[index] ?? SPAWNS[0];
  room.players.set(socket.id, {
    id: socket.id,
    name: sanitizeName(name),
    color: COLORS[index % COLORS.length],
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
    fallingUntil: 0,
    fallTargetX: spawn.x,
    fallTargetY: spawn.y,
    airUntil: 0,
    jumpPadCooldownUntil: 0,
    spinnerImmuneUntil: 0,
  });
  socket.join(room.code);
  socket.data.roomCode = room.code;
}

function resetPlayers(room) {
  [...room.players.values()].forEach((player, index) => {
    const spawn = SPAWNS[index] ?? SPAWNS[0];
    player.x = spawn.x;
    player.y = spawn.y;
    player.direction = "right";
    player.walking = index;
    player.health = 5;
    player.ammo = 3;
    player.skill = rollSkill(room);
    player.lap = 0;
    player.checkpoint = 0;
    player.lastUpdateAt = Date.now();
    player.nextShotAt = 0;
    player.nextSkillAt = 0;
    player.grappleUntil = 0;
    player.sleepUntil = 0;
    player.slowUntil = 0;
    player.runUntil = 0;
    player.dashCharges = 3;
    player.dashRechargeAt = 0;
    player.pushUntil = 0;
    player.fallingUntil = 0;
    player.fallTargetX = spawn.x;
    player.fallTargetY = spawn.y;
    player.airUntil = 0;
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
      if (target.id === projectile.sourceId || target.fallingUntil > now) continue;
      if (pointSegmentDistance(target.x, target.y, startX, startY, projectile.x, projectile.y) > 12) continue;
      hitTarget = target;
      break;
    }
    const expired = now >= projectile.until
      || projectile.x < 0 || projectile.x > WORLD_WIDTH
      || projectile.y < 0 || projectile.y > WORLD_HEIGHT;
    if (!hitTarget && !expired) continue;

    const targetIds = [];
    if (projectile.kind === "sleep" && hitTarget) {
      hitTarget.sleepUntil = now + 2000;
      targetIds.push(hitTarget.id);
      stateChanged = true;
    }
    if (projectile.kind === "slow") {
      for (const target of room.players.values()) {
        if (target.id === projectile.sourceId || target.fallingUntil > now) continue;
        if (Math.hypot(target.x - projectile.x, target.y - projectile.y) > 72) continue;
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

function findTarget(room, attacker, aim, maxDistance, minimumDot = 0.5) {
  let selected;
  let closest = Number.POSITIVE_INFINITY;
  for (const target of room.players.values()) {
    if (target.id === attacker.id) continue;
    if (target.fallingUntil > Date.now()) continue;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0 || distance > maxDistance) continue;
    if ((dx / distance) * aim.x + (dy / distance) * aim.y < minimumDot) continue;
    if (distance < closest) {
      selected = target;
      closest = distance;
    }
  }
  return selected;
}

function findTargetOnAimLine(room, attacker, aim, maxDistance = GRAB_RANGE, hitRadius = GRAB_HIT_RADIUS) {
  let selected;
  let closestForwardDistance = Number.POSITIVE_INFINITY;
  for (const target of room.players.values()) {
    if (target.id === attacker.id) continue;
    if (target.fallingUntil > Date.now()) continue;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const forwardDistance = dx * aim.x + dy * aim.y;
    const lateralDistance = Math.abs(dx * aim.y - dy * aim.x);
    if (forwardDistance <= 0 || forwardDistance > maxDistance || lateralDistance > hitRadius) continue;
    if (forwardDistance < closestForwardDistance) {
      selected = target;
      closestForwardDistance = forwardDistance;
    }
  }
  return selected;
}

function clampPosition(player) {
  player.x = Math.max(0, Math.min(WORLD_WIDTH, player.x));
  player.y = Math.max(0, Math.min(WORLD_HEIGHT, player.y));
}

function blockedByClone(room, x, y) {
  pruneClones(room);
  return room.clones.some((clone) => Math.hypot(clone.x - x, clone.y - y) < 13);
}

function findSafePushEnd(room, target, directionX, directionY, maximumDistance = PUSH_DISTANCE) {
  for (let distance = maximumDistance; distance >= 0; distance -= 2) {
    const x = target.x + directionX * distance;
    const y = target.y + directionY * distance;
    if (!canStandOnTrack(x, y) || blockedByClone(room, x, y)) continue;
    return { x, y };
  }
  return { x: target.x, y: target.y };
}

function findSafeAimPlacement(room, origin, aim, maximumDistance, minimumDistance = 0) {
  for (let distance = maximumDistance; distance >= minimumDistance; distance -= 2) {
    const x = origin.x + aim.x * distance;
    const y = origin.y + aim.y * distance;
    if (!canStandOnTrack(x, y) || blockedByClone(room, x, y)) continue;
    return { x, y };
  }
  return undefined;
}

function nudgePlayerFromNewClone(room, player, clone, fallbackX, fallbackY) {
  const deltaX = player.x - clone.x;
  const deltaY = player.y - clone.y;
  if (Math.abs(deltaX) >= 13 || Math.abs(deltaY) >= 14) return;
  const length = Math.hypot(deltaX, deltaY);
  const baseX = length > .01 ? deltaX / length : fallbackX;
  const baseY = length > .01 ? deltaY / length : fallbackY;
  const directions = [
    { x: baseX, y: baseY },
    { x: -baseY, y: baseX },
    { x: baseY, y: -baseX },
    { x: -baseX, y: -baseY },
  ];
  for (const direction of directions) {
    for (let distance = 20; distance <= 48; distance += 4) {
      const x = Math.max(0, Math.min(WORLD_WIDTH, clone.x + direction.x * distance));
      const y = Math.max(0, Math.min(WORLD_HEIGHT, clone.y + direction.y * distance));
      if (!canStandOnTrack(x, y) || blockedByClone(room, x, y)) continue;
      player.x = x;
      player.y = y;
      player.lastUpdateAt = Date.now();
      return;
    }
  }
}

function respawnPlayer(player) {
  const spawn = RESPAWN_POINTS[Math.min(player.checkpoint, RESPAWN_POINTS.length - 1)] ?? RESPAWN_POINTS[0];
  player.x = spawn.x;
  player.y = spawn.y;
  player.health = 5;
  player.ammo = 3;
  player.sleepUntil = 0;
  player.slowUntil = 0;
  player.fallingUntil = 0;
  player.fallTargetX = spawn.x;
  player.fallTargetY = spawn.y;
  player.airUntil = 0;
  player.jumpPadCooldownUntil = 0;
  player.spinnerImmuneUntil = 0;
  player.pushUntil = 0;
  player.lastUpdateAt = Date.now();
}

function respawnPlayerFromPit(player, now = Date.now()) {
  const spawn = RESPAWN_POINTS[Math.min(player.checkpoint, RESPAWN_POINTS.length - 1)] ?? RESPAWN_POINTS[0];
  player.x = spawn.x;
  player.y = spawn.y;
  player.ammo = 3;
  player.fallingUntil = 0;
  player.fallTargetX = spawn.x;
  player.fallTargetY = spawn.y;
  player.airUntil = 0;
  player.jumpPadCooldownUntil = now + 500;
  player.spinnerImmuneUntil = now + 500;
  player.pushUntil = 0;
  player.lastUpdateAt = now;
}

function damagePlayer(room, target) {
  target.health -= 1;
  const defeated = target.health <= 0;
  if (defeated) respawnPlayer(target);
  return defeated;
}

function playerTouchesZone(player, zone, padding = 0) {
  const playerLeft = player.x - 5;
  const playerTop = player.y - 5;
  return playerLeft < zone.x + zone.width - padding
    && playerLeft + 10 > zone.x + padding
    && playerTop < zone.y + zone.height - padding
    && playerTop + 12 > zone.y + padding;
}

function triggerPitFall(room, player, pit, now) {
  player.fallingUntil = now + PIT_FALL_DURATION;
  player.fallTargetX = pit.x + pit.width / 2;
  player.fallTargetY = pit.y + pit.height / 2;
  player.airUntil = 0;
  player.lastUpdateAt = now;
  io.to(room.code).emit("hazard:effect", {
    kind: "pit",
    playerId: player.id,
    duration: PIT_FALL_DURATION,
    targetX: player.fallTargetX,
    targetY: player.fallTargetY,
  });
}

function triggerJumpPad(room, player, pad, now) {
  player.airUntil = now + JUMP_DURATION;
  player.jumpPadCooldownUntil = now + 980;
  player.lastUpdateAt = now;
  io.to(room.code).emit("hazard:effect", {
    kind: "jump",
    playerId: player.id,
    duration: JUMP_DURATION,
    pushX: pad.pushX,
    pushY: pad.pushY,
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
  player.pushUntil = now + PUSH_DURATION;
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
  if (player.fallingUntil > now || player.airUntil > now) return false;
  const activePit = PITS[room.hazards.activePitIndex];
  if (activePit && playerTouchesZone(player, activePit, 4)) {
    triggerPitFall(room, player, activePit, now);
    return true;
  }
  if (player.jumpPadCooldownUntil <= now) {
    const jumpPad = JUMP_PADS.find((pad) => playerTouchesZone(player, pad, 2));
    if (jumpPad) {
      triggerJumpPad(room, player, jumpPad, now);
      return true;
    }
  }
  if (player.pushUntil <= now && player.spinnerImmuneUntil <= now) {
    const spinnerIndex = SPINNER_RULES.findIndex((spinner, index) => triggerSpinnerKnockback(room, player, spinner, index, now));
    if (spinnerIndex >= 0) return true;
  }
  return false;
}

function resetRoomHazards(room, now = Date.now()) {
  room.hazards = createHazardState(now);
}

function findNearestPitIndex(room) {
  let selectedIndex = 0;
  let selectedDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < PITS.length; index += 1) {
    const pit = PITS[index];
    const centerX = pit.x + pit.width / 2;
    const centerY = pit.y + pit.height / 2;
    for (const player of room.players.values()) {
      if (player.fallingUntil > 0) continue;
      const distance = Math.hypot(player.x - centerX, player.y - centerY);
      if (distance >= selectedDistance) continue;
      selectedIndex = index;
      selectedDistance = distance;
    }
  }
  return selectedIndex;
}

function updateRoomHazards(room, now) {
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
  if (room.finished) return false;
  const checkpoint = CHECKPOINTS[player.checkpoint];
  if (checkpoint && playerTouchesZone(player, checkpoint, 8)) {
    player.checkpoint += 1;
    player.ammo = 3;
    player.skill = rollSkill(room);
    player.nextSkillAt = 0;
    player.dashCharges = 3;
    player.dashRechargeAt = 0;
    player.lastUpdateAt = now;
    return true;
  }

  if (player.checkpoint !== CHECKPOINTS.length || !playerTouchesZone(player, START_GATE)) return false;
  player.lap += 1;
  player.checkpoint = 0;
  player.lastUpdateAt = now;
  if (player.lap >= room.config.lapLimit) {
    room.finished = true;
    room.winnerId = player.id;
    room.winnerName = player.name;
  }
  return true;
}

function ack(callback, value) {
  if (typeof callback === "function") callback(value);
}

io.on("connection", (socket) => {
  socket.on("room:create", (payload, callback) => {
    leaveCurrentRoom(socket);
    const requestedCode = normalizeCode(payload?.code);
    const code = requestedCode.length >= 4 ? requestedCode : makeCode();
    if (code === TEST_ROOM_CODE) {
      ack(callback, { ok: false, error: "TEST는 참여하기에서만 사용할 수 있는 테스트 방입니다." });
      return;
    }
    if (rooms.has(code)) {
      ack(callback, { ok: false, error: "이미 사용 중인 초대 코드입니다." });
      return;
    }
    const room = {
      code,
      hostId: socket.id,
      config: sanitizeConfig(payload?.config),
      players: new Map(),
      clones: [],
      projectiles: [],
      started: false,
      finished: false,
      winnerId: null,
      winnerName: null,
      matchStartedAt: 0,
      hazards: createHazardState(),
    };
    rooms.set(code, room);
    addPlayer(room, socket, payload?.name);
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot });
    broadcastRoom(room);
  });

  socket.on("room:join", (payload, callback) => {
    leaveCurrentRoom(socket);
    const code = normalizeCode(payload?.code);
    let room = rooms.get(code);
    if (code === TEST_ROOM_CODE && !room) {
      room = {
        code: TEST_ROOM_CODE,
        hostId: socket.id,
        config: { lapLimit: 5, playerCount: 6, enabledSkills: [...SKILLS] },
        players: new Map(),
        clones: [],
        projectiles: [],
        started: true,
        finished: false,
        winnerId: null,
        winnerName: null,
        matchStartedAt: Date.now(),
        hazards: createHazardState(),
      };
      rooms.set(TEST_ROOM_CODE, room);
    }
    if (!room) {
      ack(callback, { ok: false, error: "방을 찾지 못했습니다. 초대 코드를 확인하세요." });
      return;
    }
    if (room.started && code !== TEST_ROOM_CODE) {
      ack(callback, { ok: false, error: "이미 진행 중인 경기입니다." });
      return;
    }
    if (room.players.size >= room.config.playerCount) {
      ack(callback, { ok: false, error: "방 인원이 가득 찼습니다." });
      return;
    }
    addPlayer(room, socket, payload?.name);
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot });
    broadcastRoom(room);
  });

  socket.on("room:start", (callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) {
      ack(callback, { ok: false, error: "방장만 경기를 시작할 수 있습니다." });
      return;
    }
    if (room.players.size < 2) {
      ack(callback, { ok: false, error: "최소 2명이 참가해야 시작할 수 있습니다." });
      return;
    }
    room.started = true;
    room.finished = false;
    room.winnerId = null;
    room.winnerName = null;
    room.matchStartedAt = Date.now();
    room.clones.length = 0;
    room.projectiles.length = 0;
    resetRoomHazards(room);
    resetPlayers(room);
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot });
    io.to(room.code).emit("match:started", roomSnapshot);
    broadcastRoom(room);
  });

  socket.on("player:state", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    if (!room || !room.started || room.finished || !player) return;
    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = Date.now();
    if (player.sleepUntil > now || player.grappleUntil > now || player.pushUntil > now || player.fallingUntil > 0) return;
    const elapsed = Math.max(16, now - player.lastUpdateAt);
    if (!isMovementAllowed(player.x, player.y, x, y, elapsed, player.slowUntil > now, player.runUntil > now)) return;
    if (blockedByClone(room, x, y)) return;
    player.x = x;
    player.y = y;
    clampPosition(player);
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
    const attacker = room?.players.get(socket.id);
    const now = Date.now();
    if (!room || !room.started || room.finished || !attacker || attacker.fallingUntil > 0 || attacker.pushUntil > now || attacker.sleepUntil > now || attacker.nextShotAt > now || attacker.ammo <= 0) return;
    const aim = normalisedAim(payload);
    attacker.ammo -= 1;
    attacker.nextShotAt = now + 210;
    const target = findTarget(room, attacker, aim, 230, .82);
    const defeated = target ? damagePlayer(room, target) : false;
    io.to(room.code).emit("combat:shot", { sourceId: attacker.id, x: attacker.x + aim.x * 8, y: attacker.y + aim.y * 2, dx: aim.x, dy: aim.y });
    io.to(room.code).emit("combat:effect", { kind: "bullet", sourceId: attacker.id, targetIds: target ? [target.id] : [], defeated });
    broadcastRoom(room);
  });

  socket.on("combat:skill", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const attacker = room?.players.get(socket.id);
    const now = Date.now();
    if (!room || !room.started || room.finished || !attacker || attacker.fallingUntil > 0 || attacker.pushUntil > now || attacker.sleepUntil > now || attacker.nextSkillAt > now) return;
    const skill = attacker.skill;
    refreshDashCharges(attacker, now);
    if (skill === "dash" && attacker.dashCharges <= 0) return;
    attacker.skill = skill;
    const aim = normalisedAim(payload);
    const targetIds = [];
    if (skill === "push") {
      for (const target of room.players.values()) {
        if (target.id === attacker.id) continue;
        if (target.fallingUntil > now) continue;
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const distance = Math.hypot(dx, dy);
        if (!distance || distance > 72) continue;
        const startX = target.x;
        const startY = target.y;
        const pushEnd = findSafePushEnd(room, target, dx / distance, dy / distance);
        target.x = pushEnd.x;
        target.y = pushEnd.y;
        target.pushUntil = now + PUSH_DURATION;
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
      const target = findTargetOnAimLine(room, attacker, aim);
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
        const targetEnd = findSafeAimPlacement(room, attacker, aim, 34) ?? { x: attacker.x, y: attacker.y };
        target.x = targetEnd.x;
        target.y = targetEnd.y;
        target.grappleUntil = now + 520;
        targetIds.push(target.id);
        Object.assign(grapple, {
          targetId: target.id,
          targetStartX,
          targetStartY,
          targetEndX: target.x,
          targetEndY: target.y,
        });
      }
      attacker.grappleUntil = now + 520;
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
        const spawn = findSafeAimPlacement(room, attacker, aim, 32, 8);
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
          if (target.id === attacker.id) continue;
          if (target.fallingUntil > now) continue;
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
  socket.on("disconnect", () => leaveCurrentRoom(socket));
});

const hazardTimer = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.started || room.finished) continue;
    updateRoomHazards(room, now);
    let roomStateChanged = updateSkillProjectiles(room, now);
    for (const player of room.players.values()) {
      if (player.fallingUntil <= 0 || player.fallingUntil > now) continue;
      respawnPlayerFromPit(player, now);
      io.to(room.code).emit("hazard:effect", {
        kind: "respawn",
        playerId: player.id,
        x: player.x,
        y: player.y,
        ammo: player.ammo,
      });
      roomStateChanged = true;
    }
    if (roomStateChanged) broadcastRoom(room);
  }
}, 25);
hazardTimer.unref();

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Panic Marathon multiplayer server listening on :${PORT}`);
});
