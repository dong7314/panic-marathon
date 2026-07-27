import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAimPayload,
  parsePlayerStatePayload,
  parseReconnectPayload,
} from "../shared/network-protocol.mjs";
import { loadServerConfig } from "../server/config.mjs";
import { InMemoryRoomStore, RoomCapacityError } from "../server/room-store.mjs";
import { ConnectionRegistry, EventRateLimiter } from "../server/socket-guard.mjs";

test("network protocol parsers reject malformed movement and reconnect payloads", () => {
  assert.equal(parsePlayerStatePayload(null), null);
  assert.equal(parsePlayerStatePayload({ x: "nope", y: 10 }), null);
  assert.deepEqual(parsePlayerStatePayload({
    x: "12.5",
    y: 30,
    direction: "left",
    walking: "4",
  }), {
    x: 12.5,
    y: 30,
    direction: "left",
    walking: 4,
  });
  assert.deepEqual(parsePlayerStatePayload({ x: 1, y: 2, direction: "sideways" }), {
    x: 1,
    y: 2,
    direction: undefined,
    walking: undefined,
  });
  assert.equal(parseReconnectPayload({ roomCode: "PM-1", playerId: "p1" }), null);
  assert.deepEqual(parseReconnectPayload({
    roomCode: "PM-1",
    playerId: "p1",
    reconnectToken: "secret",
  }), {
    roomCode: "PM-1",
    playerId: "p1",
    reconnectToken: "secret",
  });
});

test("aim payloads are normalized before combat rules consume them", () => {
  assert.deepEqual(parseAimPayload({ dx: 3, dy: 4 }), { x: .6, y: .8 });
  assert.deepEqual(parseAimPayload({ dx: 0, dy: 0 }), { x: 1, y: 0 });
  assert.deepEqual(parseAimPayload({ dx: "invalid", dy: 1 }), { x: 1, y: 0 });
});

test("in-memory room storage enforces its configured capacity", () => {
  const rooms = new InMemoryRoomStore({ maxRooms: 1 });
  assert.equal(rooms.add("PM-A", { code: "PM-A" }), true);
  assert.equal(rooms.add("PM-A", { code: "PM-A" }), false);
  assert.throws(() => rooms.add("PM-B", { code: "PM-B" }), RoomCapacityError);
  assert.equal(rooms.size, 1);
  assert.equal(rooms.delete("PM-A"), true);
  assert.equal(rooms.add("PM-B", { code: "PM-B" }), true);
});

test("socket guards bound event bursts and connections per address", () => {
  let now = 1_000;
  const limiter = new EventRateLimiter(() => now);
  assert.equal(limiter.allow("state", 2), true);
  assert.equal(limiter.allow("state", 2), true);
  assert.equal(limiter.allow("state", 2), false);
  now += 1_000;
  assert.equal(limiter.allow("state", 2), true);

  const connections = new ConnectionRegistry(2);
  assert.equal(connections.acquire("127.0.0.1"), true);
  assert.equal(connections.acquire("127.0.0.1"), true);
  assert.equal(connections.acquire("127.0.0.1"), false);
  connections.release("127.0.0.1");
  assert.equal(connections.acquire("127.0.0.1"), true);
});

test("production configuration denies unspecified cross-origin clients and parses guard limits", () => {
  const production = loadServerConfig({
    NODE_ENV: "production",
    MAX_ROOMS: "12",
    MAX_CONNECTIONS_PER_ADDRESS: "8",
  });
  assert.equal(production.clientOrigins, false);
  assert.equal(production.maxRooms, 12);
  assert.equal(production.maxConnectionsPerAddress, 8);

  const development = loadServerConfig({});
  assert.equal(development.clientOrigins, true);
  const restricted = loadServerConfig({ CLIENT_ORIGINS: "https://one.example, https://two.example" });
  assert.deepEqual(restricted.clientOrigins, ["https://one.example", "https://two.example"]);
});
