import assert from "node:assert/strict";
import test from "node:test";

import {
  HAZARD_LANE_COUNT,
  generateMapHazards,
  getHazardLaneCenters,
} from "../shared/map-hazards.mjs";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function assertHazardLayout(mapId, expectedPitCount) {
  const layouts = new Set();
  const usedPitSides = new Set();
  const usedSpinnerSides = new Set();

  for (let seed = 1; seed <= 80; seed += 1) {
    const layout = generateMapHazards(mapId, seededRandom(seed));
    assert.equal(layout.pitZones.length, expectedPitCount);
    assert.equal(layout.spinners.length, 3);
    assert.equal(new Set(layout.pitZones.map((pit) => pit.side)).size, layout.pitZones.length);
    assert.equal(new Set(layout.spinners.map((spinner) => spinner.side)).size, layout.spinners.length);

    for (const pit of layout.pitZones) {
      assert.equal(pit.laneIndex >= 0 && pit.laneIndex < HAZARD_LANE_COUNT, true);
      assert.equal(pit.width, 34);
      assert.equal(pit.height, 34);
      usedPitSides.add(pit.side);
    }

    for (const spinner of layout.spinners) {
      const laneCenters = getHazardLaneCenters(spinner.side);
      const spinnerLane = laneCenters[spinner.laneIndex];
      const guaranteedSafeLanes = laneCenters.filter((lane) => (
        Math.abs(lane - spinnerLane) > spinner.radius + 8
      ));
      assert.ok(guaranteedSafeLanes.length >= 1, `${spinner.side} spinner must preserve a safe lane`);
      assert.equal(Math.abs(spinner.speed) >= 2.3 && Math.abs(spinner.speed) < 3.2, true);
      usedSpinnerSides.add(spinner.side);
    }
    layouts.add(JSON.stringify(layout));
  }

  assert.ok(layouts.size > 20);
  assert.deepEqual([...usedSpinnerSides].sort(), ["bottom", "left", "right", "top"]);
  if (expectedPitCount < 4) assert.deepEqual([...usedPitSides].sort(), ["bottom", "left", "right", "top"]);
}

test("schoolyard hazards randomize lanes while preserving a route", () => {
  assertHazardLayout("schoolyard", 4);
});

test("space-station hazards randomize both selected sides and lanes", () => {
  assertHazardLayout("space-station", 2);
});

test("mountain-pass keeps its dedicated rock hazard layout", () => {
  assert.deepEqual(generateMapHazards("mountain-pass", seededRandom(1)), {
    pitZones: [],
    spinners: [],
  });
});
