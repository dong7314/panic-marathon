export const MATCH_STAT_KEYS = Object.freeze([
  "shotsFired",
  "shotsHit",
  "eliminations",
  "timesDefeated",
  "pushHits",
  "grabHits",
  "sleepHits",
  "slowHits",
  "clonesCreated",
  "pitFalls",
  "voidFalls",
  "rockHits",
  "jumpPadsTriggered",
]);

export function createMatchStats() {
  return Object.fromEntries(MATCH_STAT_KEYS.map((key) => [key, 0]));
}

export function incrementMatchStat(player, key, amount = 1) {
  if (!MATCH_STAT_KEYS.includes(key)) return;
  if (!player.matchStats) player.matchStats = createMatchStats();
  player.matchStats[key] += Math.max(0, Math.floor(Number(amount) || 0));
}

export function normalizeMatchStats(value) {
  const stats = createMatchStats();
  for (const key of MATCH_STAT_KEYS) {
    stats[key] = Math.max(0, Math.floor(Number(value?.[key]) || 0));
  }
  return stats;
}

export function getInterferenceCount(stats) {
  return stats.pushHits + stats.grabHits + stats.sleepHits + stats.slowHits;
}

export function getChaosScore(stats) {
  return stats.shotsHit
    + stats.eliminations * 3
    + stats.pushHits * 2
    + stats.grabHits * 2
    + stats.sleepHits * 2
    + stats.slowHits
    + Math.floor(stats.clonesCreated / 4);
}

function specialtyTitle(standing) {
  const stats = standing.stats;
  const candidates = [
    { title: "마취과 과장", score: stats.sleepHits * 6 },
    { title: "로켓팔 낚시왕", score: stats.grabHits * 6 },
    { title: "인간 제설차", score: stats.pushHits * 5 },
    { title: "교통 체증 유발자", score: stats.slowHits * 4 },
    { title: "분신 공장장", score: stats.clonesCreated },
    { title: "픽셀 명사수", score: stats.shotsHit * 3 },
    { title: "구덩이 단골", score: (stats.pitFalls + stats.voidFalls) * 5 },
    { title: "낙석 수집가", score: stats.rockHits * 5 },
    { title: "점프대 애호가", score: stats.jumpPadsTriggered * 3 },
    { title: "부활 전문점", score: stats.timesDefeated * 5 },
  ];
  candidates.sort((left, right) => right.score - left.score);
  if (candidates[0].score > 0) return candidates[0].title;
  if (stats.shotsFired >= 3) return "허공의 명사수";
  if (standing.place === 1) return "오늘의 우승자";
  return "평화주의 러너";
}

export function addMatchAwards(standings) {
  const normalized = standings.map((standing) => {
    const stats = normalizeMatchStats(standing.stats);
    return {
      ...standing,
      stats,
      chaosScore: getChaosScore(stats),
    };
  });
  const chaosLeader = normalized
    .filter((standing) => standing.chaosScore > 0)
    .sort((left, right) => right.chaosScore - left.chaosScore || left.place - right.place)[0];
  return normalized.map((standing) => ({
    ...standing,
    title: standing.id === chaosLeader?.id ? "최고의 방해꾼" : specialtyTitle(standing),
  }));
}
