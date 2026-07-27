import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKPOINTS,
  CLONE_LIMIT,
  FLY_VISUAL_LIFT,
  GIANT_BODY_SCALE,
  GIANT_SPEED_MULTIPLIER,
  MATCH_TIME_LIMIT,
  PIT_WARNING_DURATION,
  PIT_ZONES,
  ROCK_SQUASH_DURATION,
  SKILL_IDS,
  SLOW30_SPEED_MULTIPLIER,
  SPINNER_RULES,
  START_POINT,
  getMovementSpeedMultiplier,
  getSkillBodyScale,
  getSkillHitRadius,
  getSkillRenderLayer,
  getSkillSpeedMultiplier,
  isDamageImmune,
  isGroundHazardImmune,
  isGiantBodyMovementBlocked,
  isObstacleImmune,
  isPassiveSkill,
  isVoidFallImmune,
  isTargetOnAimLine,
  isTargetWithinScaledRange,
  pickNextSkill,
  runnersOverlap,
  runnerTouchesRaceZone,
  runnerTouchesObstacle,
} from "../shared/game-rules.mjs";
import { canStandOnMap, canStandOnTrack, getTrackFallTarget, isMapTrackPoint, isTrackPoint, pointSegmentDistance } from "../shared/geometry.mjs";
import { getMapDefinition } from "../shared/map-catalog.mjs";
import { getMovementLimit, isMovementAllowed } from "../shared/movement-validation.mjs";

test("shared race rules expose the expected playable layout", () => {
  assert.equal(SKILL_IDS.length, 10);
  assert.equal(CLONE_LIMIT, 20);
  assert.equal(MATCH_TIME_LIMIT, 60 * 60 * 1000);
  assert.equal(PIT_WARNING_DURATION, 4_000);
  assert.equal(ROCK_SQUASH_DURATION, 720);
  assert.equal(CHECKPOINTS.length, 3);
  assert.equal(PIT_ZONES.length, 4);
  assert.equal(SPINNER_RULES.length, 3);
  assert.equal(canStandOnTrack(START_POINT.x, START_POINT.y), true);
});

test("passive skills apply immediately without an activation action", () => {
  assert.equal(isPassiveSkill("fly"), true);
  assert.equal(isPassiveSkill("slow30"), true);
  assert.equal(isPassiveSkill("giant"), true);
  assert.equal(isPassiveSkill("dash"), false);
  assert.equal(isGroundHazardImmune("fly"), true);
  assert.equal(isGroundHazardImmune("giant"), true);
  assert.equal(isGroundHazardImmune("slow30"), false);
  assert.equal(isVoidFallImmune("fly"), true);
  assert.equal(isVoidFallImmune("giant"), false);
  assert.equal(isObstacleImmune("giant"), true);
  assert.equal(isObstacleImmune("fly"), false);
  assert.equal(isDamageImmune("giant"), true);
  assert.equal(isDamageImmune("fly"), false);
  assert.equal(isDamageImmune("push"), false);
  assert.equal(getSkillSpeedMultiplier("slow30"), SLOW30_SPEED_MULTIPLIER);
  assert.equal(getSkillSpeedMultiplier("giant"), GIANT_SPEED_MULTIPLIER);
  assert.equal(getSkillSpeedMultiplier("fly"), 1);
  assert.equal(getSkillBodyScale("giant"), GIANT_BODY_SCALE);
  assert.equal(getSkillBodyScale("push"), 1);
  assert.equal(getSkillRenderLayer("push"), 0);
  assert.equal(getSkillRenderLayer("fly"), 1);
  assert.equal(getSkillRenderLayer("giant"), 2);
});

test("flying runners register race gates at their visible elevated position", () => {
  const zone = { x: 394, y: 600, width: 42, height: 124 };
  const x = zone.x + zone.width / 2;
  const logicalY = zone.y + zone.height - 8 + 11;
  assert.equal(runnerTouchesRaceZone("push", x, logicalY, zone, 8), false);
  assert.equal(runnerTouchesRaceZone("fly", x, logicalY, zone, 8), true);
  assert.equal(
    runnerTouchesRaceZone("push", x, logicalY - FLY_VISUAL_LIFT, zone, 8),
    true,
  );
});

test("giant bodies block entry but allow overlapping players to separate", () => {
  assert.equal(isGiantBodyMovementBlocked("push", 0, 0, 10, 0, "push", 50, 0), false);
  assert.equal(isGiantBodyMovementBlocked("push", 0, 0, 10, 0, "giant", 50, 0), true);
  assert.equal(isGiantBodyMovementBlocked("push", 0, 0, -10, 0, "giant", 50, 0), false);
  assert.equal(isGiantBodyMovementBlocked("push", 0, 0, 2, 0, "giant", 50, 0), true);
  assert.equal(isGiantBodyMovementBlocked("push", 0, 0, -2, 0, "giant", 50, 0), false);

  // The giant sprite reaches 40px above and 60px below its center. A normal
  // runner can therefore use the visible space above it up to the actual hat.
  assert.equal(isGiantBodyMovementBlocked("push", 0, -60, 0, -52, "giant", 0, 0), false);
  assert.equal(isGiantBodyMovementBlocked("push", 0, -60, 0, -51, "giant", 0, 0), true);
  assert.equal(isGiantBodyMovementBlocked("push", 0, 70, 0, 68, "giant", 0, 0), false);
  assert.equal(isGiantBodyMovementBlocked("push", 0, 70, 0, 67, "giant", 0, 0), true);
});

test("giant hitboxes cover every offensive interaction across the enlarged body", () => {
  assert.equal(getSkillHitRadius("push"), 12);
  assert.equal(getSkillHitRadius("giant"), 60);

  // Basic bullets and sleep projectiles use the scaled contact radius.
  assert.equal(50 <= getSkillHitRadius("push"), false);
  assert.equal(50 <= getSkillHitRadius("giant"), true);

  // Push and slow explosions include the extra giant body radius.
  assert.equal(isTargetWithinScaledRange("push", 100, 72), false);
  assert.equal(isTargetWithinScaledRange("giant", 100, 72), true);

  // Basic-shot range also reaches the visible edge instead of requiring the center.
  assert.equal(isTargetWithinScaledRange("push", 260, 230), false);
  assert.equal(isTargetWithinScaledRange("giant", 260, 230), true);

  // Grapples can connect to the enlarged body even when the center is off the normal line.
  assert.equal(isTargetOnAimLine("push", 100, 50, 250), false);
  assert.equal(isTargetOnAimLine("giant", 100, 50, 250), true);
});

test("checkpoint skill rolls always exclude the previous skill", () => {
  const skills = ["push", "dash", "run"];
  for (const previousSkill of skills) {
    for (const randomValue of [0, 0.25, 0.5, 0.75, 0.999]) {
      assert.notEqual(pickNextSkill(skills, previousSkill, () => randomValue), previousSkill);
    }
  }
  assert.equal(pickNextSkill(["sleep"], "sleep", () => 0), "sleep");
  assert.equal(pickNextSkill([], undefined, () => 0), "push");
});

test("track geometry rejects the infield and world exterior", () => {
  assert.equal(isTrackPoint(128, 856), true);
  assert.equal(isTrackPoint(650, 500), false);
  assert.equal(isTrackPoint(-1, 856), false);
  assert.equal(canStandOnTrack(128, 856), true);
  assert.equal(canStandOnTrack(208, 500), false);
});

test("mountain geometry follows its straight course instead of the loop track", () => {
  const mountain = getMapDefinition("mountain-pass");
  const [start, end] = mountain.trackPath;
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  assert.equal(isMapTrackPoint(mountain, mountain.startPoint.x, mountain.startPoint.y), true);
  assert.equal(isMapTrackPoint(mountain, midpoint.x, midpoint.y), true);
  assert.equal(isMapTrackPoint(mountain, midpoint.x, midpoint.y + 240), false);
  assert.equal(canStandOnMap(mountain, mountain.startPoint.x, mountain.startPoint.y), true);
  assert.equal(isMovementAllowed(start.x, start.y, start.x + 10, start.y - 6, 55, false, false, 1, mountain), true);
  assert.equal(isMovementAllowed(start.x, start.y, start.x, start.y - 160, 100, false, false, 1, mountain), false);
  assert.equal(isMovementAllowed(end.x, end.y, mountain.worldWidth + 1, end.y, 1000, false, false, 1, mountain), false);
});

test("clients and servers can share exact obstacle and clone body collisions", () => {
  const obstacle = { x: 100, y: 100, width: 40, height: 60 };
  assert.equal(runnerTouchesObstacle(95, 120, obstacle), false);
  assert.equal(runnerTouchesObstacle(98, 120, obstacle), true);
  assert.equal(runnerTouchesObstacle(145, 120, obstacle), false);
  assert.equal(runnersOverlap(100, 100, 110, 111), true);
  assert.equal(runnersOverlap(100, 100, 111, 111), false);
  assert.equal(runnersOverlap(100, 100, 110, 112), false);
});

test("point-to-segment distance handles projected and endpoint distances", () => {
  assert.equal(pointSegmentDistance(5, 4, 0, 0, 10, 0), 4);
  assert.equal(pointSegmentDistance(14, 3, 0, 0, 10, 0), 5);
});

test("space track falls continue away from the edge that was crossed", () => {
  const top = getTrackFallTarget(650, 30);
  const topTrackEdge = getTrackFallTarget(650, 33);
  const bottom = getTrackFallTarget(650, 946);
  const left = getTrackFallTarget(30, 500);
  const right = getTrackFallTarget(1282, 500);
  const innerTop = getTrackFallTarget(650, 200);
  const innerLeft = getTrackFallTarget(216, 500);

  assert.ok(top.y < 30);
  assert.ok(topTrackEdge.y < 33);
  assert.ok(bottom.y > 946);
  assert.ok(left.x < 30);
  assert.ok(right.x > 1282);
  assert.ok(innerTop.y > 200);
  assert.ok(innerLeft.x > 216);
});

test("movement validation enforces speed and track boundaries", () => {
  const normalLimit = getMovementLimit(55);
  const runningLimit = getMovementLimit(55, false, true);
  const slowedLimit = getMovementLimit(55, true, false);
  const slow30Limit = getMovementLimit(55, false, false, getMovementSpeedMultiplier("slow30"));
  const slowedSlow30Limit = getMovementLimit(55, false, false, getMovementSpeedMultiplier("slow30", true));
  const runningSlow30Limit = getMovementLimit(55, false, false, getMovementSpeedMultiplier("slow30", false, true));
  const giantLimit = getMovementLimit(55, false, false, getMovementSpeedMultiplier("giant"));
  const slowedGiantLimit = getMovementLimit(55, false, false, getMovementSpeedMultiplier("giant", true));
  assert.ok(runningLimit > normalLimit);
  assert.ok(slowedLimit < normalLimit);
  assert.ok(slow30Limit < slowedLimit);
  assert.equal(slowedSlow30Limit, slow30Limit);
  assert.equal(runningSlow30Limit, slow30Limit);
  assert.ok(giantLimit < normalLimit);
  assert.ok(giantLimit > slow30Limit);
  assert.equal(slowedGiantLimit, giantLimit);

  assert.equal(isMovementAllowed(128, 856, 140, 856, 55), true);
  assert.equal(isMovementAllowed(128, 856, 200, 856, 55), false);
  assert.equal(isMovementAllowed(210, 800, 210, 780, 100), false);
  assert.equal(isMovementAllowed(208, 760, 212, 760, 55, false, false, 1, true), true);
  assert.equal(isMovementAllowed(208, 760, 212, 760, 55), false);
  assert.equal(isMovementAllowed(128, 856, Number.NaN, 856, 55), false);
});
