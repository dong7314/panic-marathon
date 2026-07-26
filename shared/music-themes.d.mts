import type { MapId } from "./map-catalog.mjs";

export type MusicThemeId = "lobby" | MapId;
export type MusicOscillatorType = "sine" | "square" | "triangle" | "sawtooth";

export type MusicVoice = Readonly<{
  type: MusicOscillatorType;
  durationSteps: number;
  volume: number;
}>;

export type MusicHarmony = MusicVoice & Readonly<{
  everySteps: number;
  ratios: readonly number[];
}>;

export type MusicPulse = Readonly<{
  type: MusicOscillatorType;
  everySteps: number;
  frequency: number;
  endFrequency: number;
  durationSeconds: number;
  volume: number;
}>;

export type MusicTheme = Readonly<{
  stepSeconds: number;
  gain: number;
  melody: readonly (number | null)[];
  lead: MusicVoice;
  harmony: MusicHarmony;
  bassRoots: readonly number[];
  bassChangeSteps: number;
  bass: MusicVoice;
  pulse: MusicPulse;
}>;

export const MUSIC_THEME_IDS: readonly MusicThemeId[];
export const MUSIC_THEMES: Readonly<Record<MusicThemeId, MusicTheme>>;
export function isMusicThemeId(value: unknown): value is MusicThemeId;
