import assert from "node:assert/strict";
import test from "node:test";
import {
  connectClient,
  request,
  reservePort,
  spawnMultiplayerServer,
  waitForServer,
} from "../test-support/multiplayer.mjs";

test("server rejects rooms and same-address sockets beyond configured limits", { timeout: 15_000 }, async (t) => {
  const port = await reservePort();
  const server = spawnMultiplayerServer(port, {
    MAX_ROOMS: "1",
    MAX_CONNECTIONS_PER_ADDRESS: "2",
  });
  await waitForServer(server);
  const url = `http://127.0.0.1:${port}`;
  const clients = [];
  t.after(() => {
    for (const client of clients) client.disconnect();
    if (!server.killed) server.kill();
  });

  const host = await connectClient(url);
  const second = await connectClient(url);
  clients.push(host, second);
  await request(host, "room:create", {
    code: "PM-GUARD-A",
    name: "Guard A",
    config: { lapLimit: 1, playerCount: 2, enabledSkills: ["push", "dash", "run"] },
  });
  await assert.rejects(
    request(second, "room:create", {
      code: "PM-GUARD-B",
      name: "Guard B",
      config: { lapLimit: 1, playerCount: 2, enabledSkills: ["push", "dash", "run"] },
    }),
    /방 수/,
  );
  await assert.rejects(connectClient(url), /connection limit reached/);
});
