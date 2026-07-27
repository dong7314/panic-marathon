import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { io } from "socket.io-client";
import { runnerTouchesObstacle } from "../shared/game-rules.mjs";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reservePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("multiplayer server did not start")), 5000);
    const onData = (chunk) => {
      if (!String(chunk).includes("multiplayer server listening")) return;
      clearTimeout(timeout);
      child.stderr.off("data", onError);
      resolve();
    };
    const onError = (chunk) => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      reject(new Error(String(chunk)));
    };
    child.stdout.on("data", onData);
    child.stderr.once("data", onError);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`multiplayer server exited with ${code}`));
    });
  });
}

function connectClient(url) {
  const socket = io(url, { transports: ["websocket"], reconnection: false, forceNew: true });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("socket connection timed out")), 4000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function request(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const callback = (response) => {
      if (!response?.ok) reject(new Error(response?.error ?? `${event} failed`));
      else {
        if (response.session) {
          socket.session = response.session;
          socket.playerId = response.session.playerId;
        }
        resolve(response.room);
      }
    };
    if (payload === undefined) socket.emit(event, callback);
    else socket.emit(event, payload, callback);
  });
}

function onceMatching(socket, event, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`${event} timed out`));
    }, timeoutMs);
    const listener = (value) => {
      if (!predicate(value)) return;
      clearTimeout(timeout);
      socket.off(event, listener);
      resolve(value);
    };
    socket.on(event, listener);
  });
}

async function driveSocket(socket, start, waypoints, stepSize = 12, intervalMs = 30) {
  let x = start.x;
  let y = start.y;
  for (const [targetX, targetY] of waypoints) {
    while (Math.hypot(targetX - x, targetY - y) > 0.01) {
      const dx = targetX - x;
      const dy = targetY - y;
      const distance = Math.hypot(dx, dy);
      const step = Math.min(stepSize, distance);
      x += dx / distance * step;
      y += dy / distance * step;
      await delay(intervalMs);
      socket.emit("player:state", { x, y, direction: Math.abs(dx) > Math.abs(dy) ? "right" : "down", walking: 1 });
    }
  }
  return { x, y };
}

function safeLoopBoundary(room, side) {
  const spinner = room.spinners.find((candidate) => candidate.side === side);
  if (side === "bottom") return !spinner || spinner.y <= 856 ? 934 : 792;
  if (side === "right") return !spinner || spinner.x <= 1192 ? 1276 : 1109;
  if (side === "top") return !spinner || spinner.y <= 112 ? 180 : 40;
  return !spinner || spinner.x <= 120 ? 203 : 36;
}

const MOUNTAIN_CLIMB_ROUTE = Object.freeze([
  [481, 1149],
  [721, 939],
  [874, 847],
  [1016, 777],
  [1225, 661],
  [1349, 500],
  [1510, 425],
  [1610, 366],
  [1685, 325],
  [1778, 321],
  [1865, 354],
  [1924, 338],
  [1982, 294],
  [2054, 226],
]);

test("mountain rooms teleport completed laps and stop the first rolling rock at a barrier", { timeout: 24_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(
    process.execPath,
    ["--import", "data:text/javascript,Math.random=()=>0", "server/index.mjs"],
    {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174", MATCH_COUNTDOWN_MS: "120" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await waitForServer(server);

  const url = `http://127.0.0.1:${port}`;
  const host = await connectClient(url);
  const guest = await connectClient(url);
  t.after(() => {
    host.disconnect();
    guest.disconnect();
    server.kill();
  });

  const code = `PM-M${String(port).slice(-3)}`;
  await request(host, "room:create", {
    code,
    name: "Climber",
    config: {
      lapLimit: 2,
      playerCount: 2,
      mapId: "mountain-pass",
      enabledSkills: ["giant", "fly", "push"],
    },
  });
  await request(guest, "room:join", { code, name: "Sherpa" });
  const startedEvent = onceMatching(host, "match:started", (room) => room.code === code);
  await request(host, "room:start");
  const started = await startedEvent;
  assert.equal(started.config.mapId, "mountain-pass");
  assert.equal(started.rocks.length, 0);
  assert.equal(started.pitZones.length, 0);
  assert.equal(started.spinners.length, 0);

  const self = started.players.find((player) => player.id === host.playerId);
  assert.equal(self.skill, "fly");
  const rockSpawnEvent = onceMatching(host, "hazard:rock:spawn", (rock) => rock.id === "1:0", 12_000);
  const rockRemoveEvent = onceMatching(host, "hazard:rock:remove", (event) => event.id === "1:0", 12_000);
  const lapStateEvent = onceMatching(
    host,
    "room:state",
    (room) => room.players.some((player) => player.id === host.playerId && player.lap === 1),
    18_000,
  );
  await driveSocket(host, self, [...MOUNTAIN_CLIMB_ROUTE, [2203, 112]]);
  const lapState = await lapStateEvent;
  const teleported = lapState.players.find((player) => player.id === host.playerId);
  assert.equal(teleported.lap, 1);
  assert.equal(teleported.checkpoint, 0);
  assert.deepEqual({ x: teleported.x, y: teleported.y }, { x: 132, y: 1263 });

  const spawned = await rockSpawnEvent;
  assert.equal(spawned.radius, 14);
  const removed = await rockRemoveEvent;
  assert.equal(removed.reason, "barrier");
});

test("mountain flying runners activate checkpoints at the elevated sprite position", { timeout: 12_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(
    process.execPath,
    ["--import", "data:text/javascript,Math.random=()=>0", "server/index.mjs"],
    {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174", MATCH_COUNTDOWN_MS: "120" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await waitForServer(server);

  const url = `http://127.0.0.1:${port}`;
  const host = await connectClient(url);
  const guest = await connectClient(url);
  t.after(() => {
    host.disconnect();
    guest.disconnect();
    server.kill();
  });

  const code = `PM-F${String(port).slice(-3)}`;
  await request(host, "room:create", {
    code,
    name: "Flyer",
    config: {
      lapLimit: 2,
      playerCount: 2,
      mapId: "mountain-pass",
      enabledSkills: ["push", "fly", "dash"],
    },
  });
  await request(guest, "room:join", { code, name: "Observer" });
  const startedEvent = onceMatching(host, "match:started", (room) => room.code === code);
  await request(host, "room:start");
  const started = await startedEvent;
  const self = started.players.find((player) => player.id === host.playerId);
  assert.equal(self.skill, "fly");

  const checkpointEvent = onceMatching(
    host,
    "room:state",
    (room) => room.players.some((runner) => runner.id === host.playerId && runner.checkpoint === 1),
    6000,
  );
  await driveSocket(host, self, [
    [481, 1149],
    [716, 1007],
  ]);
  const checkpointRoom = await checkpointEvent;
  const flyer = checkpointRoom.players.find((runner) => runner.id === host.playerId);
  assert.equal(flyer.checkpoint, 1);
});

test("rolling rocks squash runners before checkpoint recovery", { timeout: 24_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174", MATCH_COUNTDOWN_MS: "120" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(server);

  const url = `http://127.0.0.1:${port}`;
  const host = await connectClient(url);
  const guest = await connectClient(url);
  t.after(() => {
    host.disconnect();
    guest.disconnect();
    server.kill();
  });

  const code = `PM-R${String(port).slice(-3)}`;
  await request(host, "room:create", {
    code,
    name: "Target",
    config: {
      lapLimit: 2,
      playerCount: 2,
      mapId: "mountain-pass",
      enabledSkills: ["push", "dash", "run"],
    },
  });
  await request(guest, "room:join", { code, name: "Witness" });
  const startedEvent = onceMatching(host, "match:started", (room) => room.code === code);
  await request(host, "room:start");
  const started = await startedEvent;
  const self = started.players.find((player) => player.id === host.playerId);

  let hitDetectedAt = 0;
  const hitEvent = onceMatching(
    host,
    "hazard:rock:remove",
    (event) => {
      const matched = event.reason === "player" && event.playerId === host.playerId;
      if (matched) hitDetectedAt = Date.now();
      return matched;
    },
    18_000,
  );
  const flattenedStateEvent = onceMatching(
    host,
    "room:state",
    (room) => room.players.some((runner) => (
      runner.id === host.playerId
      && runner.actionState === "flattened"
      && runner.flattenedMs > 0
    )),
    18_000,
  );
  const respawnEvent = onceMatching(
    host,
    "hazard:effect",
    (event) => event.kind === "respawn" && event.reason === "rock" && event.playerId === host.playerId,
    18_000,
  );
  const drivePromise = driveSocket(host, self, [...MOUNTAIN_CLIMB_ROUTE, [2111, 117]]);
  await hitEvent;
  const flattenedRoom = await flattenedStateEvent;
  const flattened = flattenedRoom.players.find((runner) => runner.id === host.playerId);
  assert.equal(flattened.health, 4);
  assert.equal(flattened.checkpoint, 3);
  assert.equal(flattened.actionState, "flattened");

  host.emit("player:state", { x: flattened.x + 8, y: flattened.y, direction: "right", walking: 2 });
  await delay(60);
  const lockedRoomEvent = onceMatching(host, "room:state", (room) => room.code === code);
  guest.emit("combat:shoot", { dx: 1, dy: 0 });
  const lockedRoom = await lockedRoomEvent;
  const locked = lockedRoom.players.find((runner) => runner.id === host.playerId);
  assert.deepEqual({ x: locked.x, y: locked.y }, { x: flattened.x, y: flattened.y });
  assert.equal(locked.actionState, "flattened");

  const respawn = await respawnEvent;
  await drivePromise;
  assert.ok(Date.now() - hitDetectedAt >= 600);
  assert.deepEqual(
    { x: respawn.x, y: respawn.y, health: respawn.health, ammo: respawn.ammo },
    { x: 1730, y: 383, health: 4, ammo: 3 },
  );
});

test("multiplayer rooms preserve names and reject movement into the infield and generated obstacles", { timeout: 20_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174", MATCH_COUNTDOWN_MS: "120" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(server);

  const url = `http://127.0.0.1:${port}`;
  const host = await connectClient(url);
  const guest = await connectClient(url);
  t.after(() => {
    host.disconnect();
    guest.disconnect();
    server.kill();
  });

  const code = `PM-T${String(port).slice(-3)}`;
  await request(host, "room:create", {
    code,
    name: "Alpha",
    config: { lapLimit: 2, playerCount: 2, enabledSkills: ["push", "dash", "run"] },
  });
  await request(guest, "room:join", { code, name: "Beta" });
  const startEvent = onceMatching(host, "match:started", (room) => room.code === code);
  const countdown = await request(host, "room:start");
  assert.equal(countdown.phase, "waiting");
  assert.equal(countdown.countdownMs > 0 && countdown.countdownMs <= 120, true);

  let movementReceivedDuringCountdown = false;
  const countdownMovementListener = (player) => {
    if (player.id === host.playerId) movementReceivedDuringCountdown = true;
  };
  guest.on("player:state", countdownMovementListener);
  host.emit("player:state", { x: 144, y: 856, direction: "right", walking: 1 });
  await delay(40);
  guest.off("player:state", countdownMovementListener);
  assert.equal(movementReceivedDuringCountdown, false);

  const started = await startEvent;

  assert.deepEqual(started.players.map((player) => player.name), ["Alpha", "Beta"]);
  assert.equal(started.phase, "running");
  assert.equal(started.countdownMs, 0);
  assert.equal(started.hazards.spinnerElapsedMs >= 0, true);
  assert.equal(started.obstacles.length >= 8, true);
  assert.equal(started.obstacles.every((obstacle) => ["traffic-cone", "school-hurdle"].includes(obstacle.kind)), true);
  assert.equal(started.pitZones.length, 4);
  assert.equal(started.spinners.length, 3);
  assert.equal(new Set(started.pitZones.map((pit) => pit.side)).size, 4);
  assert.equal(new Set(started.spinners.map((spinner) => spinner.side)).size, 3);

  for (const x of [144, 160, 176, 192, 208, 224, 240]) {
    await delay(70);
    const received = onceMatching(guest, "player:state", (player) => player.id === host.playerId && player.x === x);
    host.emit("player:state", { x, y: 856, direction: "right", walking: 1 });
    await received;
  }

  for (const y of [840, 824, 808, 792]) {
    await delay(70);
    const received = onceMatching(guest, "player:state", (player) => player.id === host.playerId && player.y === y);
    host.emit("player:state", { x: 240, y, direction: "up", walking: 1 });
    await received;
  }

  await delay(70);
  host.emit("player:state", { x: 240, y: 776, direction: "up", walking: 2 });
  await delay(80);
  const roomState = onceMatching(host, "room:state", (room) => room.code === code);
  host.emit("combat:shoot", { dx: 1, dy: 0 });
  const snapshot = await roomState;
  const hostState = snapshot.players.find((player) => player.id === host.playerId);
  assert.deepEqual({ x: hostState?.x, y: hostState?.y }, { x: 240, y: 792 });

  const obstacle = started.obstacles
    .filter((candidate) => candidate.bandId === "bottom-west")
    .sort((left, right) => right.y - left.y)[0];
  assert.ok(obstacle);
  const obstacleCenterX = obstacle.x + obstacle.width / 2;
  const obstacleCenterY = obstacle.y + obstacle.height / 2;
  await driveSocket(host, hostState, [[240, 934], [obstacleCenterX, 934], [obstacleCenterX, obstacleCenterY]], 8, 40);
  const obstacleInspection = onceMatching(host, "room:state", (room) => room.code === code);
  guest.emit("combat:shoot", { dx: 1, dy: 0 });
  const obstacleSnapshot = await obstacleInspection;
  const blockedHost = obstacleSnapshot.players.find((player) => player.id === host.playerId);
  assert.equal(runnerTouchesObstacle(blockedHost.x, blockedHost.y, obstacle), false);
  assert.notDeepEqual({ x: blockedHost.x, y: blockedHost.y }, { x: obstacleCenterX, y: obstacleCenterY });
});

test("space-station rooms fall outward from the upper edge, then respawn", { timeout: 15_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174", MATCH_COUNTDOWN_MS: "120" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(server);

  const url = `http://127.0.0.1:${port}`;
  const host = await connectClient(url);
  const guest = await connectClient(url);
  t.after(() => {
    host.disconnect();
    guest.disconnect();
    server.kill();
  });

  const code = `PM-S${String(port).slice(-3)}`;
  await request(host, "room:create", {
    code,
    name: "Orbit",
    config: {
      lapLimit: 2,
      playerCount: 2,
      mapId: "space-station",
      enabledSkills: ["push", "dash", "run"],
    },
  });
  await request(guest, "room:join", { code, name: "Dock" });
  const startedEvent = onceMatching(host, "match:started", (room) => room.code === code);
  await request(host, "room:start");
  const started = await startedEvent;
  assert.equal(started.config.mapId, "space-station");
  assert.equal(started.pitZones.length, 2);
  assert.equal(started.spinners.length, 3);
  assert.equal(new Set(started.pitZones.map((pit) => pit.side)).size, 2);
  assert.equal(new Set(started.spinners.map((spinner) => spinner.side)).size, 3);

  const hostStart = started.players.find((player) => player.id === host.playerId);
  assert.ok(hostStart);
  const fallEffectPromise = onceMatching(
    guest,
    "hazard:effect",
    (effect) => effect.kind === "void" && effect.playerId === host.playerId,
    5_000,
  );
  const respawnEffectPromise = onceMatching(
    guest,
    "hazard:effect",
    (effect) => effect.kind === "respawn" && effect.playerId === host.playerId,
    5_000,
  );

  const safeLeftX = safeLoopBoundary(started, "left");
  await driveSocket(host, hostStart, [
    [safeLeftX, hostStart.y],
    [safeLeftX, 200],
    [150, 200],
    [150, 24],
  ], 12, 30);
  const fallEffect = await fallEffectPromise;
  assert.equal(fallEffect.kind, "void");
  assert.equal(fallEffect.targetX, 150);
  assert.ok(fallEffect.targetY < 32);
  const respawnEffect = await respawnEffectPromise;
  assert.deepEqual(
    { x: respawnEffect.x, y: respawnEffect.y, health: respawnEffect.health, ammo: respawnEffect.ammo },
    { x: 128, y: 856, health: 5, ammo: 3 },
  );
});

test("TEST mode grants a different skill at every checkpoint and completed lap", { timeout: 15_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(server);

  const url = `http://127.0.0.1:${port}`;
  const host = await connectClient(url);
  t.after(() => {
    host.disconnect();
    server.kill();
  });

  const code = "TEST";
  const started = await request(host, "room:join", { code, name: "TestRunner" });
  assert.equal(started.phase, "running");
  const hostStart = started.players.find((player) => player.id === host.playerId);
  assert.ok(hostStart);
  const safeBottomY = safeLoopBoundary(started, "bottom");
  const safeRightX = safeLoopBoundary(started, "right");
  const safeTopY = safeLoopBoundary(started, "top");
  const safeLeftX = safeLoopBoundary(started, "left");

  async function reachProgress(from, expectedLap, expectedCheckpoint, waypoints) {
    const roomPromise = onceMatching(host, "room:state", (room) => (
      room.code === code
      && room.players.some((player) => (
        player.id === host.playerId
        && player.lap === expectedLap
        && player.checkpoint === expectedCheckpoint
      ))
    ), 8_000);
    const drivenPosition = await driveSocket(host, from, waypoints, 12, 5);
    const room = await roomPromise.catch((error) => {
      throw new Error(`lap ${expectedLap}, checkpoint ${expectedCheckpoint}: ${error.message}`);
    });
    const player = room.players.find((candidate) => candidate.id === host.playerId);
    assert.ok(player);
    assert.notEqual(player.skill, from.skill);
    return { ...player, ...drivenPosition };
  }

  const checkpoint1 = await reachProgress(hostStart, 0, 1, [
    [hostStart.x, safeBottomY],
    [1134, safeBottomY],
    [1134, 856],
  ]);
  const checkpoint2 = await reachProgress(checkpoint1, 0, 2, [
    [safeRightX, 856],
    [safeRightX, 140],
    [1152, 140],
  ]);
  const checkpoint3 = await reachProgress(checkpoint2, 0, 3, [
    [1152, 40],
    [880, 40],
    [850, safeTopY],
    [550, safeTopY],
    [520, 40],
    [200, 40],
    [128, 120],
  ]);
  const nextLap = await reachProgress(checkpoint3, 1, 0, [
    [safeLeftX, 120],
    [safeLeftX, 856],
    [150, 856],
  ]);
  assert.equal(nextLap.lap, 1);
  assert.equal(nextLap.checkpoint, 0);
});

test("a finished room publishes full standings and lets only the host start a rematch", { timeout: 10_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      CLIENT_ORIGIN: "http://127.0.0.1:5174",
      MATCH_TIME_LIMIT_MS: "300",
      MATCH_COUNTDOWN_MS: "120",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(server);

  const url = `http://127.0.0.1:${port}`;
  const host = await connectClient(url);
  const guest = await connectClient(url);
  t.after(() => {
    host.disconnect();
    guest.disconnect();
    server.kill();
  });

  const code = `PM-R${String(port).slice(-3)}`;
  await request(host, "room:create", {
    code,
    name: "Alpha",
    config: { lapLimit: 3, playerCount: 2, enabledSkills: ["push", "dash", "run"] },
  });
  await request(guest, "room:join", { code, name: "Beta" });
  const hostFinished = onceMatching(host, "match:finished", (room) => room.code === code);
  const guestFinished = onceMatching(guest, "match:finished", (room) => room.code === code);
  const hostStarted = onceMatching(host, "match:started", (room) => room.code === code);
  const countdown = await request(host, "room:start");
  const started = await hostStarted;

  assert.equal(countdown.phase, "waiting");
  assert.equal(countdown.countdownMs > 0, true);
  assert.equal(started.phase, "running");
  assert.equal(started.round, 1);
  const [hostResult, guestResult] = await Promise.all([hostFinished, guestFinished]);
  assert.equal(hostResult.phase, "finished");
  assert.equal(hostResult.result.reason, "time-limit");
  assert.equal(hostResult.result.standings.length, 2);
  assert.deepEqual(hostResult.result.standings.map(({ place, name }) => ({ place, name })), [
    { place: 1, name: "Beta" },
    { place: 2, name: "Alpha" },
  ]);
  assert.deepEqual(guestResult.result, hostResult.result);

  await assert.rejects(request(guest, "room:rematch"), /방장만 재대결/);
  const guestRestarted = onceMatching(guest, "match:started", (room) => room.code === code && room.round === 2);
  const rematchCountdown = await request(host, "room:rematch");
  const restarted = await guestRestarted;
  assert.equal(rematchCountdown.phase, "finished");
  assert.equal(rematchCountdown.countdownMs > 0, true);
  assert.equal(restarted.phase, "running");
  assert.equal(restarted.round, 2);
  assert.equal(restarted.result, null);
  assert.equal(restarted.players.every((player) => player.lap === 0 && player.checkpoint === 0), true);
  assert.equal(restarted.players.every((player) => player.actionState === "normal"), true);
  assert.equal(restarted.players.every((player) => player.sleepMs === 0 && player.slowMs === 0 && player.runMs === 0), true);
});

test("2, 4, and 6 player rooms start with consistent state and propagate movement", { timeout: 20_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174", MATCH_COUNTDOWN_MS: "120" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(server);
  const sockets = [];
  t.after(() => {
    for (const socket of sockets) socket.disconnect();
    server.kill();
  });

  const url = `http://127.0.0.1:${port}`;
  for (const playerCount of [2, 4, 6]) {
    const clients = await Promise.all(Array.from({ length: playerCount }, () => connectClient(url)));
    sockets.push(...clients);
    const [host, ...guests] = clients;
    const code = `PM-${playerCount}P${String(port).slice(-2)}`;
    await request(host, "room:create", {
      code,
      name: `P${playerCount}-1`,
      config: { lapLimit: 2, playerCount, enabledSkills: ["push", "dash", "run"] },
    });
    for (let index = 0; index < guests.length; index += 1) {
      await request(guests[index], "room:join", { code, name: `P${playerCount}-${index + 2}` });
    }

    const startEvents = clients.map((client) => onceMatching(client, "match:started", (room) => room.code === code));
    const countdown = await request(host, "room:start");
    const receivedStarts = await Promise.all(startEvents);
    const started = receivedStarts[0];
    assert.equal(countdown.countdownMs > 0, true);
    assert.equal(started.players.length, playerCount);
    assert.equal(receivedStarts.every((room) => room.round === 1 && room.phase === "running"), true);
    assert.equal(started.players.every((player) => player.actionState === "normal"), true);
    assert.equal(started.obstacles.length >= 8, true);
    assert.equal(receivedStarts.every((room) => JSON.stringify(room.obstacles) === JSON.stringify(started.obstacles)), true);
    assert.equal(started.pitZones.length, 4);
    assert.equal(started.spinners.length, 3);
    assert.equal(receivedStarts.every((room) => JSON.stringify(room.pitZones) === JSON.stringify(started.pitZones)), true);
    assert.equal(receivedStarts.every((room) => JSON.stringify(room.spinners) === JSON.stringify(started.spinners)), true);

    const movements = clients.map((client, index) => {
      const initial = started.players.find((player) => player.id === client.playerId);
      assert.ok(initial);
      const x = initial.x + 8;
      const observer = clients[(index + 1) % clients.length];
      const received = onceMatching(observer, "player:state", (player) => player.id === client.playerId && player.x === x);
      client.emit("player:state", { x, y: initial.y, direction: "right", walking: 1 });
      return received;
    });
    await Promise.all(movements);

    for (let tick = 2; tick <= 12; tick += 1) {
      await delay(65);
      for (const client of clients) {
        const initial = started.players.find((player) => player.id === client.playerId);
        client.emit("player:state", { x: initial.x + tick * 8, y: initial.y, direction: "right", walking: tick });
      }
    }
    await delay(70);
    const synchronizedState = onceMatching(clients[1], "room:state", (room) => room.code === code);
    host.emit("combat:shoot", { dx: 1, dy: 0 });
    const synchronized = await synchronizedState;
    assert.equal(synchronized.players.every((player) => {
      const initial = started.players.find((candidate) => candidate.id === player.id);
      return player.x === initial.x + 96;
    }), true);

    for (const client of clients) client.disconnect();
    await delay(40);
  }
});

test("jump pads use a server-owned endpoint and lock airborne movement", { timeout: 18_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174", MATCH_COUNTDOWN_MS: "120" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(server);
  const url = `http://127.0.0.1:${port}`;
  const host = await connectClient(url);
  const guest = await connectClient(url);
  t.after(() => {
    host.disconnect();
    guest.disconnect();
    server.kill();
  });

  const code = `PM-J${String(port).slice(-3)}`;
  await request(host, "room:create", {
    code,
    name: "Jumper",
    config: { lapLimit: 2, playerCount: 2, enabledSkills: ["push", "dash", "run"] },
  });
  await request(guest, "room:join", { code, name: "Observer" });
  const startEvent = onceMatching(host, "match:started", (room) => room.code === code);
  const countdown = await request(host, "room:start");
  assert.equal(countdown.countdownMs > 0, true);
  const started = await startEvent;
  const hostStart = started.players.find((player) => player.id === host.playerId);
  assert.ok(hostStart);

  const jumpEffectPromise = onceMatching(guest, "hazard:effect", (effect) => effect.kind === "jump" && effect.playerId === host.playerId, 10_000);
  const airborneRoomPromise = onceMatching(guest, "room:state", (room) => room.players.some((player) => player.id === host.playerId && player.actionState === "airborne"), 10_000);
  const safeBottomY = safeLoopBoundary(started, "bottom");
  const [, jumpEffect, airborneRoom] = await Promise.all([
    driveSocket(host, hostStart, [[hostStart.x, safeBottomY], [940, safeBottomY], [940, 842]]),
    jumpEffectPromise,
    airborneRoomPromise,
  ]);
  assert.ok(jumpEffect.endX < jumpEffect.startX);
  const airborne = airborneRoom.players.find((player) => player.id === host.playerId);
  assert.equal(airborne?.x, jumpEffect.endX);
  assert.equal(airborne?.y, jumpEffect.endY);

  host.emit("player:state", { x: jumpEffect.endX + 8, y: jumpEffect.endY, direction: "right", walking: 2 });
  await delay(60);
  const inspection = onceMatching(guest, "room:state", (room) => room.code === code);
  guest.emit("combat:shoot", { dx: 1, dy: 0 });
  const lockedRoom = await inspection;
  const locked = lockedRoom.players.find((player) => player.id === host.playerId);
  assert.equal(locked?.x, jumpEffect.endX);
  assert.equal(locked?.actionState, "airborne");
});

test("stable player sessions restore race state and preserve host authority during the reconnect grace period", { timeout: 15_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      CLIENT_ORIGIN: "http://127.0.0.1:5174",
      MATCH_COUNTDOWN_MS: "120",
      RECONNECT_GRACE_MS: "350",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(server);
  const url = `http://127.0.0.1:${port}`;
  const sockets = [];
  t.after(() => {
    for (const socket of sockets) socket.disconnect();
    server.kill();
  });

  const host = await connectClient(url);
  const guest = await connectClient(url);
  sockets.push(host, guest);
  const code = `PM-S${String(port).slice(-3)}`;
  await request(host, "room:create", {
    code,
    name: "SessionHost",
    config: { lapLimit: 2, playerCount: 2, enabledSkills: ["sleep", "slow", "run"] },
  });
  await request(guest, "room:join", { code, name: "SessionGuest" });
  assert.notEqual(host.playerId, host.id);
  assert.notEqual(guest.playerId, guest.id);
  assert.equal(typeof host.session.reconnectToken, "string");

  const startEvent = onceMatching(host, "match:started", (room) => room.code === code);
  await request(host, "room:start");
  const started = await startEvent;
  assert.equal(started.players.every((player) => player.connected), true);
  assert.equal(started.players.some((player) => Object.hasOwn(player, "reconnectToken")), false);

  const hostState = started.players.find((player) => player.id === host.playerId);
  assert.ok(hostState);
  const subject = hostState.skill === "run" ? host : guest;
  const observer = subject === host ? guest : host;
  const statusField = hostState.skill === "run" ? "runMs" : `${hostState.skill}Ms`;
  const subjectStart = started.players.find((player) => player.id === subject.playerId);
  assert.ok(subjectStart);

  await delay(70);
  const moved = onceMatching(observer, "player:state", (player) => player.id === subject.playerId && player.x === subjectStart.x + 8);
  subject.emit("player:state", { x: subjectStart.x + 8, y: subjectStart.y, direction: "right", walking: 1 });
  await moved;

  const ammoSpent = onceMatching(observer, "room:state", (room) => room.players.some((player) => player.id === subject.playerId && player.ammo === 2));
  subject.emit("combat:shoot", { dx: subject === host ? -1 : 1, dy: 0 });
  await ammoSpent;

  const statusApplied = onceMatching(observer, "room:state", (room) => {
    const player = room.players.find((candidate) => candidate.id === subject.playerId);
    return Number(player?.[statusField] ?? 0) > 0;
  }, 3_000);
  host.emit("combat:skill", { dx: 1, dy: 0 });
  const beforeDisconnectRoom = await statusApplied;
  const beforeDisconnect = beforeDisconnectRoom.players.find((player) => player.id === subject.playerId);
  assert.ok(beforeDisconnect);

  const markedDisconnected = onceMatching(observer, "room:state", (room) => room.players.some((player) => player.id === subject.playerId && !player.connected));
  subject.disconnect();
  const disconnectedRoom = await markedDisconnected;
  const reservedPlayer = disconnectedRoom.players.find((player) => player.id === subject.playerId);
  assert.equal(reservedPlayer?.connected, false);
  assert.equal(Number(reservedPlayer?.reconnectMs ?? 0) > 0, true);

  const resumedSubject = await connectClient(url);
  sockets.push(resumedSubject);
  const restoredRoom = await request(resumedSubject, "room:resume", subject.session);
  const restored = restoredRoom.players.find((player) => player.id === subject.playerId);
  assert.ok(restored);
  assert.notEqual(restored.id, resumedSubject.id);
  assert.equal(restored.connected, true);
  assert.deepEqual(
    {
      x: restored.x,
      y: restored.y,
      lap: restored.lap,
      checkpoint: restored.checkpoint,
      health: restored.health,
      ammo: restored.ammo,
      skill: restored.skill,
      actionState: restored.actionState,
    },
    {
      x: beforeDisconnect.x,
      y: beforeDisconnect.y,
      lap: beforeDisconnect.lap,
      checkpoint: beforeDisconnect.checkpoint,
      health: beforeDisconnect.health,
      ammo: beforeDisconnect.ammo,
      skill: beforeDisconnect.skill,
      actionState: beforeDisconnect.actionState,
    },
  );
  assert.equal(Number(restored[statusField] ?? 0) > 0, true);
  assert.equal(Number(restored[statusField] ?? 0) <= Number(beforeDisconnect[statusField] ?? 0), true);

  const currentHostSocket = subject === host ? resumedSubject : host;
  const remainingGuestSocket = subject === host ? guest : resumedSubject;
  const hostMarkedDisconnected = onceMatching(remainingGuestSocket, "room:state", (room) => room.hostId === host.playerId && room.players.some((player) => player.id === host.playerId && !player.connected));
  currentHostSocket.disconnect();
  const hostReservedRoom = await hostMarkedDisconnected;
  assert.equal(hostReservedRoom.hostId, host.playerId);

  const resumedHost = await connectClient(url);
  sockets.push(resumedHost);
  const hostRestoredRoom = await request(resumedHost, "room:resume", host.session);
  assert.equal(hostRestoredRoom.hostId, host.playerId);
  assert.equal(hostRestoredRoom.players.find((player) => player.id === host.playerId)?.connected, true);

  const hostHandedOff = onceMatching(remainingGuestSocket, "room:state", (room) => room.hostId === guest.playerId && !room.players.some((player) => player.id === host.playerId), 3_000);
  resumedHost.disconnect();
  const handedOffRoom = await hostHandedOff;
  assert.equal(handedOffRoom.players.length, 1);
  assert.equal(handedOffRoom.hostId, guest.playerId);

  const expiredHost = await connectClient(url);
  sockets.push(expiredHost);
  await assert.rejects(request(expiredHost, "room:resume", host.session), /만료|올바르지/);
});
