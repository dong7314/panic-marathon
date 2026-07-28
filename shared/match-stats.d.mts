export type MatchStats = {
  shotsFired: number;
  shotsHit: number;
  eliminations: number;
  timesDefeated: number;
  pushHits: number;
  grabHits: number;
  sleepHits: number;
  slowHits: number;
  clonesCreated: number;
  pitFalls: number;
  voidFalls: number;
  rockHits: number;
  jumpPadsTriggered: number;
};

export type MatchStandingForAwards = {
  id: string;
  place: number;
  stats: MatchStats;
};

export const MATCH_STAT_KEYS: readonly (keyof MatchStats)[];
export function createMatchStats(): MatchStats;
export function incrementMatchStat(
  player: { matchStats?: MatchStats },
  key: keyof MatchStats,
  amount?: number,
): void;
export function normalizeMatchStats(value?: Partial<MatchStats>): MatchStats;
export function getInterferenceCount(stats: MatchStats): number;
export function getChaosScore(stats: MatchStats): number;
export function addMatchAwards<T extends MatchStandingForAwards>(
  standings: T[],
): Array<T & { chaosScore: number; title: string }>;
