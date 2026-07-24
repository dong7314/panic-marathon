import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { io } from "socket.io-client";

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
      else resolve(response.room);
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
}

test("multiplayer rooms preserve names and reject movement into the infield", { timeout: 15_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174" },
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
  const started = await request(host, "room:start");

  assert.deepEqual(started.players.map((player) => player.name), ["Alpha", "Beta"]);
  assert.equal(started.hazards.spinnerElapsedMs >= 0, true);

  for (const x of [144, 160, 176, 192, 208, 224, 240]) {
    await delay(70);
    const received = onceMatching(guest, "player:state", (player) => player.id === host.id && player.x === x);
    host.emit("player:state", { x, y: 856, direction: "right", walking: 1 });
    await received;
  }

  for (const y of [840, 824, 808, 792]) {
    await delay(70);
    const received = onceMatching(guest, "player:state", (player) => player.id === host.id && player.y === y);
    host.emit("player:state", { x: 240, y, direction: "up", walking: 1 });
    await received;
  }

  await delay(70);
  host.emit("player:state", { x: 240, y: 776, direction: "up", walking: 2 });
  await delay(80);
  const roomState = onceMatching(host, "room:state", (room) => room.code === code);
  host.emit("combat:shoot", { dx: 1, dy: 0 });
  const snapshot = await roomState;
  const hostState = snapshot.players.find((player) => player.id === host.id);
  assert.deepEqual({ x: hostState?.x, y: hostState?.y }, { x: 240, y: 792 });
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
  const started = await request(host, "room:start");

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
  const restarted = await request(host, "room:rematch");
  const guestRestart = await guestRestarted;
  assert.equal(restarted.phase, "running");
  assert.equal(restarted.round, 2);
  assert.equal(restarted.result, null);
  assert.equal(guestRestart.players.every((player) => player.lap === 0 && player.checkpoint === 0), true);
  assert.equal(guestRestart.players.every((player) => player.actionState === "normal"), true);
  assert.equal(guestRestart.players.every((player) => player.sleepMs === 0 && player.slowMs === 0 && player.runMs === 0), true);
});

test("2, 4, and 6 player rooms start with consistent state and propagate movement", { timeout: 20_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174" },
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
    const started = await request(host, "room:start");
    const receivedStarts = await Promise.all(startEvents);
    assert.equal(started.players.length, playerCount);
    assert.equal(receivedStarts.every((room) => room.round === 1 && room.phase === "running"), true);
    assert.equal(started.players.every((player) => player.actionState === "normal"), true);

    const movements = clients.map((client, index) => {
      const initial = started.players.find((player) => player.id === client.id);
      assert.ok(initial);
      const x = initial.x + 8;
      const observer = clients[(index + 1) % clients.length];
      const received = onceMatching(observer, "player:state", (player) => player.id === client.id && player.x === x);
      client.emit("player:state", { x, y: initial.y, direction: "right", walking: 1 });
      return received;
    });
    await Promise.all(movements);

    for (let tick = 2; tick <= 12; tick += 1) {
      await delay(65);
      for (const client of clients) {
        const initial = started.players.find((player) => player.id === client.id);
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

test("jump pads use a server-owned endpoint and lock airborne movement", { timeout: 12_000 }, async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CLIENT_ORIGIN: "http://127.0.0.1:5174" },
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
  const started = await request(host, "room:start");
  const hostStart = started.players.find((player) => player.id === host.id);
  assert.ok(hostStart);

  const jumpEffectPromise = onceMatching(guest, "hazard:effect", (effect) => effect.kind === "jump" && effect.playerId === host.id, 6_000);
  const airborneRoomPromise = onceMatching(guest, "room:state", (room) => room.players.some((player) => player.id === host.id && player.actionState === "airborne"), 6_000);
  const [, jumpEffect, airborneRoom] = await Promise.all([
    driveSocket(host, hostStart, [[hostStart.x, 790], [940, 790], [940, 842]]),
    jumpEffectPromise,
    airborneRoomPromise,
  ]);
  assert.ok(jumpEffect.endX < jumpEffect.startX);
  const airborne = airborneRoom.players.find((player) => player.id === host.id);
  assert.equal(airborne?.x, jumpEffect.endX);
  assert.equal(airborne?.y, jumpEffect.endY);

  host.emit("player:state", { x: jumpEffect.endX + 8, y: jumpEffect.endY, direction: "right", walking: 2 });
  await delay(60);
  const inspection = onceMatching(guest, "room:state", (room) => room.code === code);
  guest.emit("combat:shoot", { dx: 1, dy: 0 });
  const lockedRoom = await inspection;
  const locked = lockedRoom.players.find((player) => player.id === host.id);
  assert.equal(locked?.x, jumpEffect.endX);
  assert.equal(locked?.actionState, "airborne");
});
