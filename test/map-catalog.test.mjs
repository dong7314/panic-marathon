import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MAP_ID,
  getMapDefinition,
  isMapId,
  MAP_DEFINITIONS,
  MAP_IDS,
} from "../shared/map-catalog.mjs";
import { canStandOnMap } from "../shared/geometry.mjs";
import { sanitizeRoomConfig } from "../server/room-state.mjs";

test("map catalog exposes loop, falling-boundary, and linear mountain courses", () => {
  assert.deepEqual(MAP_IDS, ["schoolyard", "space-station", "mountain-pass"]);
  assert.equal(DEFAULT_MAP_ID, "schoolyard");
  for (const mapId of MAP_IDS) {
    const map = getMapDefinition(mapId);
    assert.equal(map.id, mapId);
    assert.equal(map.checkpoints.length, 3);
    assert.ok(map.spawnPoints.length >= 6);
    assert.equal(isMapId(mapId), true);
  }
  const schoolyard = getMapDefinition("schoolyard");
  const station = getMapDefinition("space-station");
  const mountain = getMapDefinition("mountain-pass");
  assert.ok(schoolyard.pitZones.length >= 2);
  assert.ok(station.jumpPads.length >= 1);
  assert.equal(mountain.courseType, "linear");
  assert.equal(mountain.pitZones.length, 0);
  assert.equal(mountain.jumpPads.length, 0);
  assert.equal(mountain.spinners.length, 0);
  assert.equal(mountain.rockBarriers.length, 6);
  const [pathStart, pathEnd] = mountain.trackPath;
  const pathLength = Math.hypot(pathEnd.x - pathStart.x, pathEnd.y - pathStart.y);
  assert.ok(Math.abs(pathLength - 2400.8) < 1);
  assert.equal(mountain.movementSpeedMultiplier, .85);
  assert.equal(schoolyard.movementSpeedMultiplier, 1);
  assert.equal(station.movementSpeedMultiplier, 1);
  assert.equal(mountain.worldWidth, 2420);
  assert.equal(mountain.worldHeight, 1512);
  assert.equal(mountain.spawnPoints.every((point) => canStandOnMap(mountain, point.x, point.y)), true);
  assert.equal(mountain.respawnPoints.every((point) => canStandOnMap(mountain, point.x, point.y)), true);
  assert.equal(
    [...mountain.spawnPoints, ...mountain.respawnPoints, pathStart, pathEnd].every((point) => (
      point.x >= 0
      && point.x <= mountain.worldWidth
      && point.y >= 0
      && point.y <= mountain.worldHeight
    )),
    true,
  );
  const tangentX = (pathEnd.x - pathStart.x) / pathLength;
  const tangentY = (pathEnd.y - pathStart.y) / pathLength;
  const normalX = -(pathEnd.y - pathStart.y) / pathLength;
  const normalY = (pathEnd.x - pathStart.x) / pathLength;
  const barrierMetrics = mountain.rockBarriers.map((barrier) => {
    const centerX = barrier.x + barrier.width / 2;
    const centerY = barrier.y + barrier.height / 2;
    return {
      along: (centerX - pathStart.x) * tangentX + (centerY - pathStart.y) * tangentY,
      side: (centerX - pathStart.x) * normalX + (centerY - pathStart.y) * normalY,
      normalHalfExtent: Math.abs(normalX) * barrier.width / 2 + Math.abs(normalY) * barrier.height / 2,
    };
  });
  const sideOffsets = barrierMetrics.map((barrier) => barrier.side);
  assert.ok(sideOffsets.filter((offset) => offset < -40).length >= 2);
  assert.ok(sideOffsets.filter((offset) => offset > 40).length >= 2);
  assert.ok(sideOffsets.some((offset) => Math.abs(offset) < 10));
  const bottleneck = barrierMetrics.flatMap((barrier, index) => (
    barrierMetrics.slice(index + 1).map((other) => [barrier, other])
  )).find(([barrier, other]) => (
    barrier.side * other.side < 0
    && Math.abs(barrier.along - other.along) < 4
  ));
  assert.ok(bottleneck);
  const [firstWall, secondWall] = bottleneck;
  const negativeWall = firstWall.side < 0 ? firstWall : secondWall;
  const positiveWall = firstWall.side > 0 ? firstWall : secondWall;
  const bottleneckWidth = (
    positiveWall.side - positiveWall.normalHalfExtent
    - (negativeWall.side + negativeWall.normalHalfExtent)
  );
  assert.ok(bottleneckWidth >= 18 && bottleneckWidth <= 36);
  assert.ok(mountain.rollingRocks);
  assert.equal(getMapDefinition("schoolyard").trackBoundary, "blocked");
  assert.equal(getMapDefinition("space-station").trackBoundary, "fall");
  assert.equal(getMapDefinition("unknown").id, DEFAULT_MAP_ID);
});

test("room configuration accepts playable maps and rejects removed maps safely", () => {
  const schoolyard = sanitizeRoomConfig({
    lapLimit: 3,
    playerCount: 6,
    mapId: "schoolyard",
    enabledSkills: ["push", "dash", "run"],
  });
  assert.equal(schoolyard.mapId, "schoolyard");
  assert.equal(sanitizeRoomConfig({ mapId: "space-station" }).mapId, "space-station");
  assert.equal(sanitizeRoomConfig({ mapId: "mountain-pass" }).mapId, "mountain-pass");
  assert.deepEqual(
    sanitizeRoomConfig({ enabledSkills: ["fly", "slow30", "giant"] }).enabledSkills,
    ["fly", "slow30", "giant"],
  );
  assert.equal(sanitizeRoomConfig({ mapId: "construction" }).mapId, DEFAULT_MAP_ID);
  assert.equal(sanitizeRoomConfig({ mapId: "rooftop" }).mapId, DEFAULT_MAP_ID);
  assert.equal(sanitizeRoomConfig({ mapId: "unknown" }).mapId, DEFAULT_MAP_ID);
});
