export type MatchCountdownView = {
  value: string;
  starting: boolean;
};

export class MatchCountdown {
  #countdownUntil = 0;
  #startBannerUntil = 0;

  sync(remainingMs: number, now = performance.now()) {
    if (remainingMs > 0) {
      this.#countdownUntil = now + remainingMs;
      this.#startBannerUntil = 0;
      return;
    }
    this.#countdownUntil = 0;
  }

  showStart(now = performance.now(), durationMs = 700) {
    this.#countdownUntil = 0;
    this.#startBannerUntil = now + durationMs;
  }

  clear() {
    this.#countdownUntil = 0;
    this.#startBannerUntil = 0;
  }

  view(now: number, countdownActive: boolean): MatchCountdownView {
    if (this.#startBannerUntil > now) return { value: "START!", starting: true };
    if (this.#countdownUntil > 0 && countdownActive) {
      return {
        value: String(Math.max(1, Math.ceil((this.#countdownUntil - now) / 1000))),
        starting: false,
      };
    }
    return { value: "", starting: false };
  }
}
