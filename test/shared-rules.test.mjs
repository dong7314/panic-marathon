import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKPOINTS,
  CLONE_LIMIT,
  PIT_ZONES,
  SKILL_IDS,
  SPINNER_RULES,
  START_POINT,
} from "../shared/game-rules.mjs";
import { canStandOnTrack, isTrackPoint, pointSegmentDistance } from "../shared/geometry.mjs";
import { getMovementLimit, isMovementAllowed } from "../shared/movement-validation.mjs";

test("shared race rules expose the expected playable layout", () => {
  assert.equal(SKILL_IDS.length, 7);
  assert.equal(CLONE_LIMIT, 20);
  assert.equal(CHECKPOINTS.length, 3);
  assert.equal(PIT_ZONES.length, 4);
  assert.equal(SPINNER_RULES.length, 3);
  assert.equal(canStandOnTrack(START_POINT.x, START_POINT.y), true);
});

test("track geometry rejects the infield and world exterior", () => {
  assert.equal(isTrackPoint(128, 856), true);
  assert.equal(isTrackPoint(650, 500), false);
  assert.equal(isTrackPoint(-1, 856), false);
  assert.equal(canStandOnTrack(128, 856), true);
  assert.equal(canStandOnTrack(208, 500), false);
});

test("point-to-segment distance handles projected and endpoint distances", () => {
  assert.equal(pointSegmentDistance(5, 4, 0, 0, 10, 0), 4);
  assert.equal(pointSegmentDistance(14, 3, 0, 0, 10, 0), 5);
});

test("movement validation enforces speed and track boundaries", () => {
  const normalLimit = getMovementLimit(55);
  const runningLimit = getMovementLimit(55, false, true);
  const slowedLimit = getMovementLimit(55, true, false);
  assert.ok(runningLimit > normalLimit);
  assert.ok(slowedLimit < normalLimit);

  assert.equal(isMovementAllowed(128, 856, 140, 856, 55), true);
  assert.equal(isMovementAllowed(128, 856, 200, 856, 55), false);
  assert.equal(isMovementAllowed(210, 800, 210, 780, 100), false);
  assert.equal(isMovementAllowed(128, 856, Number.NaN, 856, 55), false);
});
