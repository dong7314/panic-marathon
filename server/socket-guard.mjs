export class EventRateLimiter {
  #buckets = new Map();
  #now;

  constructor(now = Date.now) {
    this.#now = now;
  }

  allow(key, limit, windowMs = 1_000) {
    const now = this.#now();
    const bucket = this.#buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      this.#buckets.set(key, { startedAt: now, count: 1 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
  }

  clear() {
    this.#buckets.clear();
  }
}

export class ConnectionRegistry {
  #counts = new Map();
  #limit;

  constructor(limit) {
    this.#limit = limit;
  }

  acquire(address) {
    const key = address || "unknown";
    const count = this.#counts.get(key) ?? 0;
    if (count >= this.#limit) return false;
    this.#counts.set(key, count + 1);
    return true;
  }

  release(address) {
    const key = address || "unknown";
    const count = this.#counts.get(key) ?? 0;
    if (count <= 1) this.#counts.delete(key);
    else this.#counts.set(key, count - 1);
  }

  count(address) {
    return this.#counts.get(address || "unknown") ?? 0;
  }
}
