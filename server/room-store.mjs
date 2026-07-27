export class RoomCapacityError extends Error {
  constructor(limit) {
    super(`room capacity reached (${limit})`);
    this.name = "RoomCapacityError";
    this.limit = limit;
  }
}

export class InMemoryRoomStore {
  #rooms = new Map();
  #maxRooms;

  constructor({ maxRooms = 100 } = {}) {
    this.#maxRooms = maxRooms;
  }

  get size() {
    return this.#rooms.size;
  }

  get maxRooms() {
    return this.#maxRooms;
  }

  get(code) {
    return this.#rooms.get(code);
  }

  has(code) {
    return this.#rooms.has(code);
  }

  add(code, room) {
    if (this.#rooms.has(code)) return false;
    if (this.#rooms.size >= this.#maxRooms) throw new RoomCapacityError(this.#maxRooms);
    this.#rooms.set(code, room);
    return true;
  }

  delete(code) {
    return this.#rooms.delete(code);
  }

  values() {
    return this.#rooms.values();
  }

  entries() {
    return this.#rooms.entries();
  }

  [Symbol.iterator]() {
    return this.#rooms[Symbol.iterator]();
  }
}
