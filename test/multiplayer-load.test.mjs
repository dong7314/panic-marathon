import assert from "node:assert/strict";
import test from "node:test";
import {
  connectClient,
  delay,
  onceMatching,
  request,
  reservePort,
  spawnMultiplayerServer,
  waitForServer,
} from "../test-support/multiplayer.mjs";

test("2, 4, and 6 player matches remain responsive under sustained state traffic", { timeout: 20_000 }, async (t) => {
  const port = await reservePort();
  const server = spawnMultiplayerServer(port, {
    MATCH_COUNTDOWN_MS: "100",
    MATCH_TIME_LIMIT_MS: "30000",
  });
  await waitForServer(server);

  const url = `http://127.0.0.1:${port}`;
  const roomSpecs = [
    { playerCount: 2, mapId: "schoolyard" },
    { playerCount: 4, mapId: "schoolyard" },
    { playerCount: 6, mapId: "schoolyard" },
  ];
  const roomGroups = [];
  const allClients = [];
  t.after(() => {
    for (const client of allClients) client.disconnect();
    if (!server.killed) server.kill();
  });

  for (const { playerCount, mapId } of roomSpecs) {
    const clients = await Promise.all(
      Array.from({ length: playerCount }, () => connectClient(url)),
    );
    allClients.push(...clients);
    const code = `PM-L${playerCount}-${String(port).slice(-2)}`;
    await request(clients[0], "room:create", {
      code,
      name: `Load-${playerCount}-1`,
      config: {
        lapLimit: 99,
        playerCount,
        mapId,
        enabledSkills: ["push", "dash", "run"],
      },
    });
    for (let index = 1; index < clients.length; index += 1) {
      await request(clients[index], "room:join", {
        code,
        name: `Load-${playerCount}-${index + 1}`,
      });
    }
    roomGroups.push({ code, clients, playerCount, mapId });
  }

  await Promise.all(roomGroups.map(async ({ code, clients }) => {
    const started = onceMatching(
      clients[0],
      "match:started",
      (room) => room.code === code && room.phase === "running",
    );
    await request(clients[0], "room:start");
    await started;
  }));

  let observedStatePackets = 0;
  for (const client of allClients) {
    client.on("player:state", () => {
      observedStatePackets += 1;
    });
  }

  const basePositions = [128, 178, 226, 274, 322, 370];
  const ticks = 90;
  for (let tick = 0; tick < ticks; tick += 1) {
    const offset = tick % 20 < 10 ? (tick % 10) * 0.35 : (10 - tick % 10) * 0.35;
    for (const { clients } of roomGroups) {
      clients.forEach((client, index) => {
        client.emit("player:state", {
          x: basePositions[index] + offset,
          y: 856,
          direction: "right",
          walking: tick,
        });
      });
    }
    await delay(20);
  }
  await delay(150);

  assert.equal(allClients.length, 12);
  assert.ok(observedStatePackets >= 2_000, `expected at least 2000 relayed state packets, received ${observedStatePackets}`);

  for (const { clients, code, playerCount, mapId } of roomGroups) {
    const room = await request(clients[0], "room:resume", clients[0].session);
    assert.equal(room.code, code);
    assert.equal(room.phase, "running");
    assert.equal(room.config.mapId, mapId);
    assert.equal(room.players.length, playerCount);
    assert.equal(room.players.filter((player) => player.connected).length, playerCount);
  }

  const healthResponse = await fetch(`${url}/healthz`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.status, "ok");
  assert.equal(health.rooms, 3);
  assert.equal(health.players, 12);
  assert.equal(health.connectedPlayers, 12);
  assert.equal(health.phases.running, 3);
});
