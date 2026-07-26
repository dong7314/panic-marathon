export const MUSIC_THEME_IDS = Object.freeze([
  "lobby",
  "schoolyard",
  "space-station",
  "mountain-pass",
]);

const LOBBY_MELODY = Object.freeze([
  293.66, 369.99, 440, 493.88, 440, 369.99, 329.63, 369.99,
  440, 493.88, 587.33, 659.25, 587.33, 493.88, 440, 369.99,
  329.63, 369.99, 440, 587.33, 493.88, 440, 369.99, 329.63,
  293.66, 329.63, 369.99, 440, 369.99, 329.63, 293.66, 246.94,
  293.66, 369.99, 440, 493.88, 587.33, 493.88, 440, 369.99,
  329.63, 440, 493.88, 587.33, 659.25, 587.33, 493.88, 440,
  369.99, 440, 493.88, 369.99, 329.63, 369.99, 440, 493.88,
  587.33, 493.88, 440, 369.99, 329.63, 293.66, 246.94, 293.66,
]);

const SCHOOLYARD_MELODY = Object.freeze([
  392, 440, 493.88, 523.25, 493.88, 440, 392, 329.63,
  392, 493.88, 587.33, 659.25, 587.33, 523.25, 493.88, 440,
  329.63, 392, 440, 493.88, 440, 392, 329.63, 293.66,
  329.63, 392, 493.88, 587.33, 523.25, 493.88, 392, 329.63,
  392, 440, 523.25, 587.33, 523.25, 493.88, 440, 392,
  440, 493.88, 587.33, 659.25, 698.46, 659.25, 587.33, 493.88,
  349.23, 392, 440, 523.25, 493.88, 440, 392, 349.23,
  329.63, 392, 440, 493.88, 440, 392, 329.63, 392,
]);

const SPACE_STATION_MELODY = Object.freeze([
  293.66, null, 440, null, 523.25, null, 440, null,
  329.63, null, 493.88, null, 587.33, null, 493.88, null,
  261.63, null, 392, null, 523.25, null, 392, null,
  293.66, null, 440, null, 493.88, 440, 392, null,
  293.66, null, 349.23, null, 440, null, 523.25, null,
  392, null, 493.88, null, 587.33, null, 659.25, null,
  523.25, null, 440, null, 392, null, 329.63, null,
  293.66, 329.63, 392, null, 349.23, null, 293.66, null,
]);

const MOUNTAIN_PASS_MELODY = Object.freeze([
  329.63, 392, 440, 493.88, 440, 392, 329.63, 293.66,
  329.63, 392, 493.88, 587.33, 493.88, 440, 392, 329.63,
  293.66, 369.99, 440, 493.88, 440, 369.99, 329.63, 293.66,
  246.94, 293.66, 369.99, 440, 392, 369.99, 329.63, 293.66,
  329.63, 392, 440, 493.88, 587.33, 493.88, 440, 392,
  369.99, 440, 493.88, 587.33, 659.25, 587.33, 493.88, 440,
  392, 369.99, 329.63, 293.66, 246.94, 293.66, 329.63, 369.99,
  392, 440, 392, 369.99, 329.63, 293.66, 246.94, 329.63,
]);

function voice(type, durationSteps, volume) {
  return Object.freeze({ type, durationSteps, volume });
}

function harmony(type, everySteps, durationSteps, volume, ratios) {
  return Object.freeze({
    type,
    everySteps,
    durationSteps,
    volume,
    ratios: Object.freeze(ratios),
  });
}

function pulse(type, everySteps, frequency, endFrequency, durationSeconds, volume) {
  return Object.freeze({
    type,
    everySteps,
    frequency,
    endFrequency,
    durationSeconds,
    volume,
  });
}

function theme(definition) {
  return Object.freeze({
    ...definition,
    bassRoots: Object.freeze(definition.bassRoots),
  });
}

export const MUSIC_THEMES = Object.freeze({
  lobby: theme({
    stepSeconds: .15,
    gain: .46,
    melody: LOBBY_MELODY,
    lead: voice("square", 1.22, .055),
    harmony: harmony("triangle", 2, 1.7, .026, [.5, .5, .75, .75]),
    bassRoots: [146.83, 123.47, 164.81, 110],
    bassChangeSteps: 16,
    bass: voice("triangle", 3.4, .052),
    pulse: pulse("sine", 4, 82, 46, .08, .035),
  }),
  schoolyard: theme({
    stepSeconds: .135,
    gain: .44,
    melody: SCHOOLYARD_MELODY,
    lead: voice("square", 1.08, .05),
    harmony: harmony("triangle", 2, 1.35, .022, [.5, .75]),
    bassRoots: [130.81, 110, 87.31, 98],
    bassChangeSteps: 16,
    bass: voice("triangle", 2.8, .047),
    pulse: pulse("sine", 4, 104, 62, .065, .026),
  }),
  "space-station": theme({
    stepSeconds: .185,
    gain: .42,
    melody: SPACE_STATION_MELODY,
    lead: voice("triangle", 2.65, .044),
    harmony: harmony("sine", 4, 3.2, .019, [.5, .75]),
    bassRoots: [73.42, 65.41, 87.31, 55],
    bassChangeSteps: 16,
    bass: voice("sine", 6.2, .043),
    pulse: pulse("sine", 8, 55, 82, .34, .014),
  }),
  "mountain-pass": theme({
    stepSeconds: .15,
    gain: .45,
    melody: MOUNTAIN_PASS_MELODY,
    lead: voice("triangle", 1.42, .052),
    harmony: harmony("square", 2, 1.25, .017, [.5, .75]),
    bassRoots: [82.41, 98, 73.42, 110],
    bassChangeSteps: 16,
    bass: voice("triangle", 3.25, .052),
    pulse: pulse("triangle", 4, 73.42, 55, .1, .027),
  }),
});

export function isMusicThemeId(value) {
  return MUSIC_THEME_IDS.includes(value);
}
