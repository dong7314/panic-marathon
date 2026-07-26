import {
  MUSIC_THEMES,
  type MusicThemeId,
} from "../../shared/music-themes.mjs";

export type GameSound =
  | "ui"
  | "countdown"
  | "start"
  | "shoot"
  | "empty"
  | "skill"
  | "hit"
  | "checkpoint"
  | "pit"
  | "jump"
  | "finish";

const STORAGE_KEY = "panic-marathon:audio-muted:v1";
const MUSIC_LOOKAHEAD_SECONDS = .75;
const MUSIC_TRANSITION_SECONDS = .18;

export class GameAudio {
  #context: AudioContext | undefined;
  #master: GainNode | undefined;
  #music: GainNode | undefined;
  #musicTimer: number | undefined;
  #musicStep = 0;
  #nextMusicNoteAt = 0;
  #musicTheme: MusicThemeId = "lobby";
  #musicSources = new Set<OscillatorNode>();
  #muted: boolean;

  constructor() {
    try {
      this.#muted = window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      this.#muted = false;
    }
  }

  get muted() {
    return this.#muted;
  }

  get musicTheme() {
    return this.#musicTheme;
  }

  setMusicTheme(theme: MusicThemeId) {
    if (this.#musicTheme === theme) return;
    this.#musicTheme = theme;
    this.#musicStep = 0;

    const context = this.#context;
    const music = this.#music;
    if (!context || !music) return;
    const now = context.currentTime;
    const fadeOutEndsAt = now + MUSIC_TRANSITION_SECONDS * .45;
    const nextThemeStartsAt = now + MUSIC_TRANSITION_SECONDS * .65;
    this.#nextMusicNoteAt = nextThemeStartsAt;

    music.gain.cancelScheduledValues(now);
    music.gain.setValueAtTime(Math.max(.0001, music.gain.value), now);
    music.gain.exponentialRampToValueAtTime(.0001, fadeOutEndsAt);
    for (const source of [...this.#musicSources]) {
      try {
        source.stop(fadeOutEndsAt + .01);
      } catch {
        this.#musicSources.delete(source);
      }
    }
    music.gain.setValueAtTime(.0001, nextThemeStartsAt);
    music.gain.exponentialRampToValueAtTime(
      MUSIC_THEMES[theme].gain,
      now + MUSIC_TRANSITION_SECONDS,
    );
  }

  async unlock() {
    if (!this.#context) {
      this.#context = new AudioContext();
      this.#master = this.#context.createGain();
      this.#music = this.#context.createGain();
      this.#music.gain.value = MUSIC_THEMES[this.#musicTheme].gain;
      this.#music.connect(this.#master);
      this.#master.connect(this.#context.destination);
      this.#applyMute();
      this.#startMusicLoop();
    }
    if (this.#context.state === "suspended") await this.#context.resume();
  }

  async toggle() {
    this.#muted = !this.#muted;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(this.#muted));
    } catch {
      // Audio still toggles for the current page when storage is unavailable.
    }
    await this.unlock();
    this.#applyMute();
    if (!this.#muted) this.play("ui");
    return this.#muted;
  }

  play(sound: GameSound) {
    const context = this.#context;
    const master = this.#master;
    if (!context || !master || this.#muted) return;
    const now = context.currentTime;

    if (sound === "shoot") {
      this.#tone(210, now, .055, .11, "square", master, 90);
      this.#noise(now, .045, .06, master);
    } else if (sound === "empty") {
      this.#tone(110, now, .05, .08, "square", master, 72);
    } else if (sound === "skill") {
      this.#tone(330, now, .08, .08, "square", master, 660);
      this.#tone(660, now + .06, .09, .07, "triangle", master, 880);
    } else if (sound === "hit") {
      this.#noise(now, .11, .12, master);
      this.#tone(92, now, .12, .1, "sawtooth", master, 54);
    } else if (sound === "checkpoint") {
      [392, 523.25, 659.25].forEach((frequency, index) => {
        this.#tone(frequency, now + index * .075, .12, .07, "square", master);
      });
    } else if (sound === "countdown") {
      this.#tone(294, now, .09, .07, "square", master);
    } else if (sound === "start") {
      this.#tone(392, now, .11, .09, "square", master);
      this.#tone(784, now + .08, .2, .08, "square", master);
    } else if (sound === "pit") {
      this.#tone(180, now, .32, .12, "sawtooth", master, 42);
    } else if (sound === "jump") {
      this.#tone(220, now, .24, .09, "square", master, 740);
    } else if (sound === "finish") {
      [392, 493.88, 587.33, 783.99].forEach((frequency, index) => {
        this.#tone(frequency, now + index * .1, .24, .08, "square", master);
      });
    } else {
      this.#tone(440, now, .045, .045, "square", master, 520);
    }
  }

  #applyMute() {
    if (!this.#context || !this.#master) return;
    this.#master.gain.setTargetAtTime(this.#muted ? 0 : .62, this.#context.currentTime, .015);
  }

  #tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    destination: AudioNode,
    endFrequency = frequency,
    musicSource = false,
  ) {
    const context = this.#context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    if (musicSource) {
      this.#musicSources.add(oscillator);
      oscillator.addEventListener("ended", () => this.#musicSources.delete(oscillator), { once: true });
    }
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  #noise(start: number, duration: number, volume: number, destination: AudioNode) {
    const context = this.#context;
    if (!context) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(gain);
    gain.connect(destination);
    source.start(start);
  }

  #startMusicLoop() {
    if (this.#musicTimer !== undefined) return;
    const scheduleAhead = () => {
      const context = this.#context;
      const music = this.#music;
      if (!context || !music) return;
      if (this.#muted) {
        this.#nextMusicNoteAt = context.currentTime + .05;
        return;
      }
      if (this.#nextMusicNoteAt < context.currentTime) {
        this.#nextMusicNoteAt = context.currentTime + .05;
      }
      while (this.#nextMusicNoteAt < context.currentTime + MUSIC_LOOKAHEAD_SECONDS) {
        const theme = MUSIC_THEMES[this.#musicTheme];
        const step = this.#musicStep % theme.melody.length;
        const melodyFrequency = theme.melody[step];
        if (melodyFrequency !== null) {
          this.#tone(
            melodyFrequency,
            this.#nextMusicNoteAt,
            theme.stepSeconds * theme.lead.durationSteps,
            theme.lead.volume,
            theme.lead.type,
            music,
            melodyFrequency,
            true,
          );
        }
        if (melodyFrequency !== null && step % theme.harmony.everySteps === 0) {
          const harmonyIndex = Math.floor(step / theme.harmony.everySteps) % theme.harmony.ratios.length;
          const harmonyFrequency = melodyFrequency * theme.harmony.ratios[harmonyIndex];
          this.#tone(
            harmonyFrequency,
            this.#nextMusicNoteAt,
            theme.stepSeconds * theme.harmony.durationSteps,
            theme.harmony.volume,
            theme.harmony.type,
            music,
            harmonyFrequency,
            true,
          );
        }
        if (step % 4 === 0) {
          const bassIndex = Math.floor(step / theme.bassChangeSteps) % theme.bassRoots.length;
          const bassFrequency = theme.bassRoots[bassIndex];
          this.#tone(
            bassFrequency,
            this.#nextMusicNoteAt,
            theme.stepSeconds * theme.bass.durationSteps,
            theme.bass.volume,
            theme.bass.type,
            music,
            bassFrequency,
            true,
          );
        }
        if (step % theme.pulse.everySteps === 0) {
          this.#tone(
            theme.pulse.frequency,
            this.#nextMusicNoteAt,
            theme.pulse.durationSeconds,
            theme.pulse.volume,
            theme.pulse.type,
            music,
            theme.pulse.endFrequency,
            true,
          );
        }
        this.#musicStep = (this.#musicStep + 1) % theme.melody.length;
        this.#nextMusicNoteAt += theme.stepSeconds;
      }
    };
    this.#nextMusicNoteAt = this.#context?.currentTime ?? 0;
    scheduleAhead();
    this.#musicTimer = window.setInterval(scheduleAhead, 100);
  }
}
