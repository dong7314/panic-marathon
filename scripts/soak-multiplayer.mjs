import assert from "node:assert/strict";
import {
  connectClient,
  delay,
  onceMatching,
  request,
  reservePort,
  spawnMultiplayerServer,
  waitForExit,
  waitForServer,
} from "../test-support/multiplayer.mjs";

const durationMs = Math.max(10_000, Number(process.env.SOAK_DURATION_MS) || 30 * 60 * 1000);
const tickMs = 50;
const sampleMs = 5_000;
const roomSpecs = [
  { playerCount: 2, mapId: "schoolyard" },
  { playerCount: 4, mapId: "schoolyard" },
  { playerCount: 6, mapId: "schoolyard" },
];

const port = await reservePort();
const server = spawnMultiplayerServer(port, {
  MATCH_COUNTDOWN_MS: "100",
  MATCH_TIME_LIMIT_MS: String(durationMs + 60_000),
  RECONNECT_GRACE_MS: "30000",
}, true);
const url = `http://127.0.0.1:${port}`;
const groups = [];
const clients = [];
let sentPackets = 0;
let relayedPackets = 0;
let reconnects = 0;
let maxHealthLatencyMs = 0;
let maxRssMb = 0;
let maxHeapUsedMb = 0;
let initialHeapUsedMb = 0;

async function sampleHealth() {
  const startedAt = performance.now();
  const response = await fetch(`${url}/healthz`);
  const health = await response.json();
  const latency = performance.now() - startedAt;
  maxHealthLatencyMs = Math.max(maxHealthLatencyMs, latency);
  maxRssMb = Math.max(maxRssMb, health.memory.rssMb);
  maxHeapUsedMb = Math.max(maxHeapUsedMb, health.memory.heapUsedMb);
  if (initialHeapUsedMb === 0) initialHeapUsedMb = health.memory.heapUsedMb;
  assert.equal(response.status, 200);
  assert.equal(health.rooms, 3);
  assert.equal(health.players, 12);
  assert.equal(health.connectedPlayers, 12);
  assert.equal(health.phases.running, 3);
  assert.ok(health.memory.rssMb < 512, `server RSS exceeded 512 MB: ${health.memory.rssMb} MB`);
  assert.ok(latency < 2_000, `health response exceeded 2 seconds: ${latency.toFixed(1)} ms`);
}

try {
  await waitForServer(server);
  for (const { playerCount, mapId } of roomSpecs) {
    const roomClients = await Promise.all(
      Array.from({ length: playerCount }, () => connectClient(url)),
    );
    clients.push(...roomClients);
    roomClients.forEach((client) => client.on("player:state", () => { relayedPackets += 1; }));
    const code = `PM-S${playerCount}-${String(port).slice(-2)}`;
    const created = await request(roomClients[0], "room:create", {
      code,
      name: `Soak-${playerCount}-1`,
      config: {
        lapLimit: 999,
        playerCount,
        mapId,
        enabledSkills: ["push", "dash", "run"],
      },
    });
    assert.equal(created.config.mapId, mapId);
    for (let index = 1; index < roomClients.length; index += 1) {
      await request(roomClients[index], "room:join", {
        code,
        name: `Soak-${playerCount}-${index + 1}`,
      });
    }
    groups.push({ code, roomClients, playerCount, mapId });
  }

  await Promise.all(groups.map(async ({ code, roomClients }) => {
    const started = onceMatching(roomClients[0], "match:started", (room) => room.code === code);
    await request(roomClients[0], "room:start");
    await started;
  }));

  const basePositions = [128, 178, 226, 274, 322, 370];
  const startedAt = performance.now();
  let nextSampleAt = startedAt;
  let reconnectCompleted = false;
  let tick = 0;
  while (performance.now() - startedAt < durationMs) {
    const elapsed = performance.now() - startedAt;
    const offset = Math.sin(tick / 18) * 2;
    for (const group of groups) {
      group.roomClients.forEach((client, index) => {
        client.emit("player:state", {
          x: basePositions[index] + offset,
          y: 856,
          direction: offset >= 0 ? "right" : "left",
          walking: tick,
        });
        sentPackets += 1;
      });
    }

    if (!reconnectCompleted && elapsed >= durationMs / 2) {
      const group = groups[2];
      const disconnected = group.roomClients[1];
      const session = disconnected.session;
      disconnected.disconnect();
      await delay(750);
      const replacement = await connectClient(url);
      replacement.on("player:state", () => { relayedPackets += 1; });
      const restored = await request(replacement, "room:resume", session);
      assert.equal(restored.config.mapId, group.mapId);
      assert.equal(restored.players.length, group.playerCount);
      group.roomClients[1] = replacement;
      const clientIndex = clients.indexOf(disconnected);
      clients[clientIndex] = replacement;
      reconnects += 1;
      reconnectCompleted = true;
    }

    if (performance.now() >= nextSampleAt) {
      await sampleHealth();
      nextSampleAt += sampleMs;
    }
    tick += 1;
    await delay(tickMs);
  }

  await sampleHealth();
  assert.ok(relayedPackets > sentPackets, `expected relayed packets to exceed sends: ${relayedPackets}/${sentPackets}`);
  assert.equal(reconnects, 1);

  const summary = {
    durationMs: Math.round(performance.now() - startedAt),
    rooms: roomSpecs,
    clients: clients.length,
    sentPackets,
    relayedPackets,
    reconnects,
    maxHealthLatencyMs: Math.round(maxHealthLatencyMs * 10) / 10,
    initialHeapUsedMb,
    maxHeapUsedMb,
    heapGrowthMb: Math.round((maxHeapUsedMb - initialHeapUsedMb) * 10) / 10,
    maxRssMb,
  };
  console.log(JSON.stringify(summary, null, 2));
} finally {
  for (const client of clients) client?.disconnect();
  if (server.exitCode === null && server.signalCode === null) {
    server.send({ type: "shutdown" });
    await waitForExit(server).catch(() => server.kill());
  }
}
