import assert from "node:assert/strict";
import test from "node:test";

import {
  canPlayerAct,
  canPlayerBeDisplaced,
  canPlayerMove,
  canPlayerReceiveHit,
  enterAirborneState,
  enterDisplacementState,
  enterFallingState,
  getPlayerActionState,
  getPlayerActionStateRemaining,
  resetPlayerTimedStates,
} from "../shared/player-state.mjs";

function makeState(overrides = {}) {
  return {
    fallingUntil: 0,
    airUntil: 0,
    grappleUntil: 0,
    pushUntil: 0,
    sleepUntil: 0,
    slowUntil: 0,
    runUntil: 0,
    ...overrides,
  };
}

test("player action states follow the shared control priority", () => {
  const now = 1_000;
  const player = makeState({
    fallingUntil: 2_000,
    airUntil: 2_100,
    grappleUntil: 2_200,
    pushUntil: 2_300,
    sleepUntil: 2_400,
  });

  assert.equal(getPlayerActionState(player, now), "falling");
  assert.equal(getPlayerActionStateRemaining(player, now), 1_000);
  player.fallingUntil = 0;
  assert.equal(getPlayerActionState(player, now), "airborne");
  player.airUntil = 0;
  assert.equal(getPlayerActionState(player, now), "grappled");
  player.grappleUntil = 0;
  assert.equal(getPlayerActionState(player, now), "pushed");
  player.pushUntil = 0;
  assert.equal(getPlayerActionState(player, now), "sleeping");
  player.sleepUntil = 0;
  assert.equal(getPlayerActionState(player, now), "normal");
});

test("movement, actions, hits, and displacement use one state policy", () => {
  const now = 5_000;
  const normal = makeState();
  assert.equal(canPlayerMove(normal, now), true);
  assert.equal(canPlayerAct(normal, now), true);
  assert.equal(canPlayerReceiveHit(normal, now), true);
  assert.equal(canPlayerBeDisplaced(normal, now), true);

  const sleeping = makeState({ sleepUntil: now + 500 });
  assert.equal(canPlayerMove(sleeping, now), false);
  assert.equal(canPlayerAct(sleeping, now), false);
  assert.equal(canPlayerReceiveHit(sleeping, now), true);
  assert.equal(canPlayerBeDisplaced(sleeping, now), true);

  const pushed = makeState({ pushUntil: now + 500 });
  assert.equal(canPlayerMove(pushed, now), false);
  assert.equal(canPlayerAct(pushed, now), false);
  assert.equal(canPlayerReceiveHit(pushed, now), true);
  assert.equal(canPlayerBeDisplaced(pushed, now), false);

  const airborne = makeState({ airUntil: now + 500 });
  assert.equal(canPlayerMove(airborne, now), false);
  assert.equal(canPlayerAct(airborne, now), false);
  assert.equal(canPlayerReceiveHit(airborne, now), false);
  assert.equal(canPlayerBeDisplaced(airborne, now), false);
});

test("higher-priority transitions clear conflicting lower states", () => {
  const now = 10_000;
  const player = makeState({
    sleepUntil: now + 2_000,
    slowUntil: now + 3_000,
    runUntil: now + 4_000,
  });

  enterDisplacementState(player, "pushed", now + 500);
  assert.equal(getPlayerActionState(player, now), "pushed");
  assert.equal(player.sleepUntil, now + 2_000);
  assert.equal(getPlayerActionState(player, now + 600), "sleeping");

  enterAirborneState(player, now + 1_000);
  assert.equal(getPlayerActionState(player, now), "airborne");
  assert.equal(player.pushUntil, 0);
  assert.equal(player.sleepUntil, 0);
  assert.equal(player.slowUntil, now + 3_000);
  assert.equal(player.runUntil, now + 4_000);

  enterFallingState(player, now + 700);
  assert.equal(getPlayerActionState(player, now), "falling");
  assert.equal(player.airUntil, 0);
  assert.equal(player.slowUntil, 0);
  assert.equal(player.runUntil, 0);

  resetPlayerTimedStates(player);
  assert.equal(getPlayerActionState(player, now), "normal");
});
