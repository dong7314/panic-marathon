import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { io } from "socket.io-client";

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reservePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

export function spawnMultiplayerServer(port, environment = {}, ipc = false) {
  return spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      CLIENT_ORIGIN: "http://127.0.0.1:5174",
      ...environment,
    },
    stdio: ipc ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"],
  });
}

export function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("multiplayer server did not start")), 5_000);
    const onData = (chunk) => {
      if (String(chunk).includes("multiplayer server listening")) finish();
    };
    const onError = (chunk) => finish(new Error(String(chunk)));
    const onExit = (code) => finish(new Error(`multiplayer server exited with ${code}`));
    const finish = (error) => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.stderr.off("data", onError);
      child.off("exit", onExit);
      if (error) reject(error);
      else resolve();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onError);
    child.once("exit", onExit);
  });
}

export function connectClient(url) {
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("socket connection timed out")), 4_000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export function request(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} timed out`)), 5_000);
    const callback = (response) => {
      clearTimeout(timeout);
      if (!response?.ok) {
        reject(new Error(response?.error ?? `${event} failed`));
        return;
      }
      if (response.session) {
        socket.session = response.session;
        socket.playerId = response.session.playerId;
      }
      resolve(response.room);
    };
    if (payload === undefined) socket.emit(event, callback);
    else socket.emit(event, payload, callback);
  });
}

export function onceMatching(socket, event, predicate, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`${event} timed out`));
    }, timeoutMs);
    const listener = (value) => {
      if (!predicate(value)) return;
      clearTimeout(timeout);
      socket.off(event, listener);
      resolve(value);
    };
    socket.on(event, listener);
  });
}

export function waitForExit(child, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    const timeout = setTimeout(() => reject(new Error("server did not exit")), timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}
