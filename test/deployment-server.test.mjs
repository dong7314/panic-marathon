import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  connectClient,
  request,
  reservePort,
  spawnMultiplayerServer,
  waitForExit,
  waitForServer,
} from "../test-support/multiplayer.mjs";

test("production server serves the SPA, reports health, and shuts down gracefully", { timeout: 15_000 }, async (t) => {
  const staticDir = await mkdtemp(join(tmpdir(), "panic-marathon-static-"));
  const assetsDir = join(staticDir, "assets");
  await mkdir(assetsDir);
  await writeFile(join(staticDir, "index.html"), "<!doctype html><title>Panic Deploy Fixture</title>", "utf8");
  await writeFile(join(assetsDir, "app.js"), "globalThis.panicFixture = true;", "utf8");

  const port = await reservePort();
  const server = spawnMultiplayerServer(port, { STATIC_DIR: staticDir }, true);
  await waitForServer(server);
  const url = `http://127.0.0.1:${port}`;
  let client;
  t.after(async () => {
    client?.disconnect();
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await rm(staticDir, { recursive: true, force: true });
  });

  const rootResponse = await fetch(`${url}/`);
  assert.equal(rootResponse.status, 200);
  assert.match(rootResponse.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await rootResponse.text(), /Panic Deploy Fixture/);
  assert.equal(rootResponse.headers.get("x-content-type-options"), "nosniff");

  const assetResponse = await fetch(`${url}/assets/app.js`);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get("content-type") ?? "", /^text\/javascript/);
  assert.match(assetResponse.headers.get("cache-control") ?? "", /immutable/);

  const spaResponse = await fetch(`${url}/room/example`);
  assert.equal(spaResponse.status, 200);
  assert.match(await spaResponse.text(), /Panic Deploy Fixture/);

  const missingAssetResponse = await fetch(`${url}/assets/missing.js`);
  assert.equal(missingAssetResponse.status, 404);
  const traversalResponse = await fetch(`${url}/%2e%2e/package.json`);
  assert.ok([403, 404].includes(traversalResponse.status));

  const readyResponse = await fetch(`${url}/readyz`);
  assert.equal(readyResponse.status, 200);
  const ready = await readyResponse.json();
  assert.deepEqual({ status: ready.status, staticReady: ready.staticReady }, {
    status: "ready",
    staticReady: true,
  });

  client = await connectClient(url);
  await request(client, "room:create", {
    code: `PM-D${String(port).slice(-3)}`,
    name: "Deploy",
    config: { lapLimit: 1, playerCount: 2, enabledSkills: ["push", "dash", "run"] },
  });
  const healthResponse = await fetch(`${url}/healthz`);
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.status, "ok");
  assert.equal(health.rooms, 1);
  assert.equal(health.players, 1);
  assert.equal(health.connectedPlayers, 1);
  assert.equal(health.socketConnections, 1);
  assert.ok(health.memory.rssMb > 0);
  assert.ok(health.memory.heapUsedMb > 0);

  client.disconnect();
  client = undefined;
  server.send({ type: "shutdown" });
  const exit = await waitForExit(server);
  assert.deepEqual(exit, { code: 0, signal: null });
});
