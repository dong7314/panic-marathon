import type { NetworkRoom, NetworkSession } from "./types";

const NETWORK_SESSION_KEY = "panic-marathon:network-session:v1";

function parseSession(value: string | null): NetworkSession | undefined {
  if (!value) return undefined;
  try {
    const session = JSON.parse(value) as Partial<NetworkSession>;
    if (typeof session.roomCode !== "string" || typeof session.playerId !== "string" || typeof session.reconnectToken !== "string") {
      return undefined;
    }
    if (!session.roomCode || !session.playerId || !session.reconnectToken) return undefined;
    return session as NetworkSession;
  } catch {
    return undefined;
  }
}

export class NetworkSessionStore {
  #storage: Storage | undefined;
  #current: NetworkSession | undefined;

  constructor(storage?: Storage) {
    this.#storage = storage;
    try {
      this.#current = parseSession(storage?.getItem(NETWORK_SESSION_KEY) ?? null);
    } catch {
      this.#current = undefined;
    }
  }

  get current() {
    return this.#current;
  }

  save(session: NetworkSession) {
    this.#current = session;
    try {
      this.#storage?.setItem(NETWORK_SESSION_KEY, JSON.stringify(session));
    } catch {
      // The in-memory session still supports transport reconnects.
    }
    return session;
  }

  clear() {
    this.#current = undefined;
    try {
      this.#storage?.removeItem(NETWORK_SESSION_KEY);
    } catch {
      // Ignore unavailable browser storage while clearing memory.
    }
  }
}

export function countConnectedPlayers(room: NetworkRoom) {
  return room.players.filter((runner) => runner.connected).length;
}

export function resolveMultiplayerEndpoint(location: Location, configuredEndpoint: string | undefined, development: boolean) {
  if (configuredEndpoint) return configuredEndpoint;
  return development
    ? `${location.protocol}//${location.hostname}:5175`
    : location.origin;
}
