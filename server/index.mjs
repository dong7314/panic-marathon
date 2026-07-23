import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT ?? 5175);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5174";
const TEST_ROOM_CODE = "TEST";
const GRAB_RANGE = 250;
const GRAB_HIT_RADIUS = 12;
const CLONE_LIMIT = 20;
const CLONE_COOLDOWN = 150;
const CLONE_DURATION = 10_000;
const SKILLS = new Set(["push", "dash", "run", "grab", "clone", "slow", "sleep"]);
const COLORS = ["#f16c7a", "#f4c562", "#78d8e9", "#a985e6", "#e58fba", "#8edb8a"];
const SPAWNS = [
  { x: 128, y: 856 },
  { x: 178, y: 856 },
  { x: 226, y: 856 },
  { x: 274, y: 856 },
  { x: 322, y: 856 },
  { x: 370, y: 856 },
];

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

function pickSkill(room, index) {
  return room.config.enabledSkills[index % room.config.enabledSkills.length] ?? "push";
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
    skill: pickSkill(room, index),
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
    player.skill = pickSkill(room, index);
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
  });
}

function normalisedAim(payload) {
  const x = Number(payload?.dx);
  const y = Number(payload?.dy);
  const length = Math.hypot(x, y);
  return length > 0.01 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

function findTarget(room, attacker, aim, maxDistance, minimumDot = 0.5) {
  let selected;
  let closest = Number.POSITIVE_INFINITY;
  for (const target of room.players.values()) {
    if (target.id === attacker.id) continue;
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
  player.x = Math.max(0, Math.min(1344, player.x));
  player.y = Math.max(0, Math.min(1008, player.y));
}

function blockedByClone(room, x, y) {
  pruneClones(room);
  return room.clones.some((clone) => Math.hypot(clone.x - x, clone.y - y) < 13);
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
      const x = Math.max(0, Math.min(1344, clone.x + direction.x * distance));
      const y = Math.max(0, Math.min(1008, clone.y + direction.y * distance));
      if (blockedByClone(room, x, y)) continue;
      player.x = x;
      player.y = y;
      player.lastUpdateAt = Date.now();
      return;
    }
  }
}

function respawnPlayer(player) {
  const spawn = SPAWNS[Math.min(player.checkpoint, SPAWNS.length - 1)] ?? SPAWNS[0];
  player.x = spawn.x;
  player.y = spawn.y;
  player.health = 5;
  player.ammo = 3;
  player.sleepUntil = 0;
  player.slowUntil = 0;
}

function damagePlayer(room, target) {
  target.health -= 1;
  const defeated = target.health <= 0;
  if (defeated) respawnPlayer(target);
  broadcastRoom(room);
  return defeated;
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
    const room = { code, hostId: socket.id, config: sanitizeConfig(payload?.config), players: new Map(), clones: [], started: false };
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
        started: true,
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
    room.clones.length = 0;
    resetPlayers(room);
    const roomSnapshot = snapshot(room);
    ack(callback, { ok: true, room: roomSnapshot });
    io.to(room.code).emit("match:started", roomSnapshot);
    broadcastRoom(room);
  });

  socket.on("player:state", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    if (!room || !room.started || !player) return;
    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = Date.now();
    if (player.sleepUntil > now || player.grappleUntil > now) return;
    const elapsed = Math.max(16, now - player.lastUpdateAt);
    const movementScale = (player.slowUntil > now ? .55 : 1) * (player.runUntil > now ? 1.75 : 1);
    const maxDistance = Math.min(42, (12 + elapsed * 0.22) * movementScale);
    const distance = Math.hypot(x - player.x, y - player.y);
    if (distance > maxDistance) return;
    if (blockedByClone(room, x, y)) return;
    player.x = x;
    player.y = y;
    clampPosition(player);
    player.direction = ["up", "down", "left", "right"].includes(payload?.direction) ? payload.direction : player.direction;
    player.walking = Number.isFinite(Number(payload?.walking)) ? Number(payload.walking) : player.walking;
    player.lastUpdateAt = now;
    socket.to(room.code).emit("player:state", publicPlayer(player, room));
  });

  socket.on("combat:shoot", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const attacker = room?.players.get(socket.id);
    const now = Date.now();
    if (!room || !room.started || !attacker || attacker.sleepUntil > now || attacker.nextShotAt > now || attacker.ammo <= 0) return;
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
    if (!room || !room.started || !attacker || attacker.sleepUntil > now || attacker.nextSkillAt > now) return;
    const skill = room.config.enabledSkills.includes(payload?.skill) ? payload.skill : attacker.skill;
    refreshDashCharges(attacker, now);
    if (skill === "dash" && attacker.dashCharges <= 0) return;
    attacker.skill = skill;
    const aim = normalisedAim(payload);
    const targetIds = [];
    if (skill === "push") {
      for (const target of room.players.values()) {
        if (target.id === attacker.id) continue;
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const distance = Math.hypot(dx, dy);
        if (!distance || distance > 72) continue;
        target.x += dx / distance * 38;
        target.y += dy / distance * 38;
        clampPosition(target);
        targetIds.push(target.id);
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
        target.x = attacker.x + aim.x * 34;
        target.y = attacker.y + aim.y * 34;
        clampPosition(target);
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
      const target = findTarget(room, attacker, aim, skill === "slow" ? 190 : 210, .62);
      if (target) {
        if (skill === "slow") target.slowUntil = now + 3600;
        else target.sleepUntil = now + 2000;
        targetIds.push(target.id);
      }
      attacker.nextSkillAt = now + (skill === "slow" ? 4600 : 2000);
    } else if (skill === "dash") {
      attacker.dashCharges -= 1;
      if (attacker.dashCharges === 0) attacker.dashRechargeAt = now + 4300;
      attacker.x += aim.x * 46;
      attacker.y += aim.y * 46;
      clampPosition(attacker);
      attacker.nextSkillAt = now + 170;
    } else if (skill === "run") {
      attacker.runUntil = now + 4600;
      attacker.nextSkillAt = now + 9000;
    } else if (skill === "clone") {
      pruneClones(room);
      const ownedClones = room.clones.filter((clone) => clone.ownerId === attacker.id);
      if (ownedClones.length < CLONE_LIMIT) {
        const clone = {
          id: `${attacker.id}:${now}:${ownedClones.length}`,
          ownerId: attacker.id,
          x: Math.max(8, Math.min(1336, attacker.x + aim.x * 32)),
          y: Math.max(8, Math.min(1000, attacker.y + aim.y * 32)),
          direction: Math.abs(aim.x) > Math.abs(aim.y) ? (aim.x < 0 ? "left" : "right") : (aim.y < 0 ? "up" : "down"),
          until: now + CLONE_DURATION,
        };
        room.clones.push(clone);
        for (const target of room.players.values()) {
          if (target.id === attacker.id) continue;
          nudgePlayerFromNewClone(room, target, clone, aim.x, aim.y);
        }
      }
      attacker.nextSkillAt = now + CLONE_COOLDOWN;
    } else {
      attacker.nextSkillAt = now + 1100;
    }
    io.to(room.code).emit("combat:effect", { kind: skill, sourceId: attacker.id, targetIds, duration: skill === "sleep" ? 2000 : skill === "slow" ? 3600 : 0 });
    broadcastRoom(room);
  });

  socket.on("room:leave", () => leaveCurrentRoom(socket));
  socket.on("disconnect", () => leaveCurrentRoom(socket));
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Panic Marathon multiplayer server listening on :${PORT}`);
});
