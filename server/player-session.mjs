import { randomBytes, randomUUID } from "node:crypto";

export function createPlayerIdentity() {
  return {
    id: randomUUID(),
    reconnectToken: randomBytes(32).toString("base64url"),
  };
}

export function createReconnectSession(roomCode, player) {
  return {
    roomCode,
    playerId: player.id,
    reconnectToken: player.reconnectToken,
  };
}

export function countConnectedPlayers(players) {
  let count = 0;
  for (const player of players.values()) {
    if (player.connected) count += 1;
  }
  return count;
}

export function selectNextHost(players) {
  return [...players.values()]
    .sort((left, right) => Number(right.connected) - Number(left.connected) || left.joinOrder - right.joinOrder)[0]?.id;
}
