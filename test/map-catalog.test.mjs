import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MAP_ID,
  getMapDefinition,
  isMapId,
  MAP_DEFINITIONS,
  MAP_IDS,
} from "../shared/map-catalog.mjs";
import { sanitizeRoomConfig } from "../server/room-state.mjs";

test("map catalog exposes only the schoolyard course", () => {
  assert.deepEqual(MAP_IDS, ["schoolyard"]);
  assert.equal(DEFAULT_MAP_ID, "schoolyard");
  for (const mapId of MAP_IDS) {
    const map = getMapDefinition(mapId);
    assert.equal(map.id, mapId);
    assert.ok(map.pitZones.length >= 4);
    assert.ok(map.jumpPads.length >= 1);
    assert.ok(map.spinners.length >= 3);
    assert.equal(isMapId(mapId), true);
  }
});

test("room configuration accepts schoolyard and rejects removed maps safely", () => {
  const schoolyard = sanitizeRoomConfig({
    lapLimit: 3,
    playerCount: 6,
    mapId: "schoolyard",
    enabledSkills: ["push", "dash", "run"],
  });
  assert.equal(schoolyard.mapId, "schoolyard");
  assert.equal(sanitizeRoomConfig({ mapId: "construction" }).mapId, DEFAULT_MAP_ID);
  assert.equal(sanitizeRoomConfig({ mapId: "rooftop" }).mapId, DEFAULT_MAP_ID);
  assert.equal(sanitizeRoomConfig({ mapId: "unknown" }).mapId, DEFAULT_MAP_ID);
});
