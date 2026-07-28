import assert from "node:assert/strict";
import test from "node:test";
import {
  addMatchAwards,
  createMatchStats,
  getChaosScore,
  getInterferenceCount,
  incrementMatchStat,
} from "../shared/match-stats.mjs";

test("match stats start at zero and only accept known counters", () => {
  const player = { matchStats: createMatchStats() };
  incrementMatchStat(player, "shotsFired");
  incrementMatchStat(player, "shotsHit", 2);
  incrementMatchStat(player, "sleepHits", 1.9);
  incrementMatchStat(player, "unknown", 99);

  assert.equal(player.matchStats.shotsFired, 1);
  assert.equal(player.matchStats.shotsHit, 2);
  assert.equal(player.matchStats.sleepHits, 1);
  assert.equal(player.matchStats.unknown, undefined);
  assert.equal(getInterferenceCount(player.matchStats), 1);
  assert.equal(getChaosScore(player.matchStats), 4);
});

test("match awards select one chaos leader and stat-based comedy titles", () => {
  const pusher = createMatchStats();
  pusher.pushHits = 3;
  const sleeper = createMatchStats();
  sleeper.sleepHits = 1;
  const faller = createMatchStats();
  faller.pitFalls = 2;
  const winner = createMatchStats();

  const awarded = addMatchAwards([
    { id: "winner", place: 1, stats: winner },
    { id: "pusher", place: 2, stats: pusher },
    { id: "sleeper", place: 3, stats: sleeper },
    { id: "faller", place: 4, stats: faller },
  ]);

  assert.equal(awarded.find(({ id }) => id === "pusher")?.title, "최고의 방해꾼");
  assert.equal(awarded.find(({ id }) => id === "sleeper")?.title, "마취과 과장");
  assert.equal(awarded.find(({ id }) => id === "faller")?.title, "구덩이 단골");
  assert.equal(awarded.find(({ id }) => id === "winner")?.title, "오늘의 우승자");
});
