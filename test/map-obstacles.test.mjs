import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_OBSTACLES_PER_BAND,
  OBSTACLE_LANE_COUNT,
  generateMapObstacles,
} from "../shared/map-obstacles.mjs";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("loop maps randomize themed obstacles while leaving at least one lane open per band", () => {
  const allowedKinds = {
    schoolyard: new Set(["traffic-cone", "school-hurdle"]),
    "space-station": new Set(["space-crate", "space-pylon"]),
  };
  const layouts = new Set();

  for (const [mapId, kinds] of Object.entries(allowedKinds)) {
    for (let seed = 1; seed <= 40; seed += 1) {
      const obstacles = generateMapObstacles(mapId, seededRandom(seed));
      const byBand = Map.groupBy(obstacles, (obstacle) => obstacle.bandId);

      assert.equal(byBand.size, 8);
      assert.equal(obstacles.every((obstacle) => kinds.has(obstacle.kind)), true);
      for (const bandObstacles of byBand.values()) {
        assert.equal(bandObstacles.length >= 1, true);
        assert.equal(bandObstacles.length <= MAX_OBSTACLES_PER_BAND, true);
        assert.equal(new Set(bandObstacles.map((obstacle) => obstacle.laneIndex)).size, bandObstacles.length);
        assert.equal(
          OBSTACLE_LANE_COUNT - bandObstacles.length >= 1,
          true,
          "every obstacle band must preserve an open route",
        );
      }
      layouts.add(JSON.stringify(obstacles));
    }
  }

  assert.equal(layouts.size > 2, true);
});

test("the linear mountain map does not receive loop-track obstacles", () => {
  assert.deepEqual(generateMapObstacles("mountain-pass", seededRandom(1)), []);
});
