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

function onceMatching(socket, event, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`${event} timed out`));
    }, 2000);
    const listener = (value) => {
      if (!predicate(value)) return;
      clearTimeout(timeout);
      socket.off(event, listener);
      resolve(value);
    };
    socket.on(event, listener);
  });
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
});
