import assert from "node:assert/strict";
import test from "node:test";
import {
  MUSIC_THEME_IDS,
  MUSIC_THEMES,
  isMusicThemeId,
} from "../shared/music-themes.mjs";

test("lobby and every playable map expose a distinct, long-form music theme", () => {
  assert.deepEqual(MUSIC_THEME_IDS, [
    "lobby",
    "schoolyard",
    "space-station",
    "mountain-pass",
  ]);

  const melodies = new Set();
  for (const id of MUSIC_THEME_IDS) {
    const theme = MUSIC_THEMES[id];
    assert.ok(theme);
    assert.equal(theme.stepSeconds * theme.melody.length >= 8, true);
    assert.equal(theme.melody.some((frequency) => frequency === null), id === "space-station");
    assert.equal(
      theme.melody.every((frequency) => frequency === null || (Number.isFinite(frequency) && frequency > 20)),
      true,
    );
    assert.equal(theme.bassRoots.every((frequency) => Number.isFinite(frequency) && frequency > 20), true);
    melodies.add(JSON.stringify(theme.melody));
  }
  assert.equal(melodies.size, MUSIC_THEME_IDS.length);
});

test("music theme ids reject unknown map names", () => {
  assert.equal(isMusicThemeId("lobby"), true);
  assert.equal(isMusicThemeId("space-station"), true);
  assert.equal(isMusicThemeId("construction-site"), false);
});
