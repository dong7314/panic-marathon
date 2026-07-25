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
const MUSIC_STEP_SECONDS = .15;
const MUSIC_LOOKAHEAD_SECONDS = .75;
const MELODY = [
  293.66, 369.99, 440, 493.88, 440, 369.99, 329.63, 369.99,
  440, 493.88, 587.33, 659.25, 587.33, 493.88, 440, 369.99,
  329.63, 369.99, 440, 587.33, 493.88, 440, 369.99, 329.63,
  293.66, 329.63, 369.99, 440, 369.99, 329.63, 293.66, 246.94,
  293.66, 369.99, 440, 493.88, 587.33, 493.88, 440, 369.99,
  329.63, 440, 493.88, 587.33, 659.25, 587.33, 493.88, 440,
  369.99, 440, 493.88, 369.99, 329.63, 369.99, 440, 493.88,
  587.33, 493.88, 440, 369.99, 329.63, 293.66, 246.94, 293.66,
] as const;
const BASS_ROOTS = [146.83, 123.47, 164.81, 110] as const;

export class GameAudio {
  #context: AudioContext | undefined;
  #master: GainNode | undefined;
  #music: GainNode | undefined;
  #musicTimer: number | undefined;
  #musicStep = 0;
  #nextMusicNoteAt = 0;
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

  async unlock() {
    if (!this.#context) {
      this.#context = new AudioContext();
      this.#master = this.#context.createGain();
      this.#music = this.#context.createGain();
      this.#music.gain.value = .46;
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
        const step = this.#musicStep % MELODY.length;
        const beat = step % 4;
        const bar = Math.floor(step / 16) % BASS_ROOTS.length;
        const melodyFrequency = MELODY[step];
        this.#tone(melodyFrequency, this.#nextMusicNoteAt, MUSIC_STEP_SECONDS * 1.22, .055, "square", music);
        if (step % 2 === 0) {
          const harmony = step % 8 < 4 ? melodyFrequency / 2 : melodyFrequency * .75;
          this.#tone(harmony, this.#nextMusicNoteAt, MUSIC_STEP_SECONDS * 1.7, .026, "triangle", music);
        }
        if (beat === 0) {
          const bass = BASS_ROOTS[bar];
          this.#tone(bass, this.#nextMusicNoteAt, MUSIC_STEP_SECONDS * 3.4, .052, "triangle", music);
          this.#tone(82, this.#nextMusicNoteAt, .08, .035, "sine", music, 46);
        }
        this.#musicStep = (this.#musicStep + 1) % MELODY.length;
        this.#nextMusicNoteAt += MUSIC_STEP_SECONDS;
      }
    };
    this.#nextMusicNoteAt = this.#context?.currentTime ?? 0;
    scheduleAhead();
    this.#musicTimer = window.setInterval(scheduleAhead, 100);
  }
}
