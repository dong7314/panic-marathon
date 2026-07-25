import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function applySecurityHeaders(response) {
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function sendJson(response, statusCode, value, headOnly = false) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(headOnly ? undefined : body);
}

function sendText(response, statusCode, body, headOnly = false) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(headOnly ? undefined : body);
}

async function isRegularFile(pathname) {
  try {
    return (await stat(pathname)).isFile();
  } catch {
    return false;
  }
}

async function serveFile(request, response, pathname) {
  const fileStats = await stat(pathname);
  const extension = extname(pathname).toLowerCase();
  const immutableAsset = pathname.includes(`${sep}assets${sep}`);
  response.writeHead(200, {
    "Cache-Control": immutableAsset ? "public, max-age=31536000, immutable" : "no-cache",
    "Content-Length": fileStats.size,
    "Content-Type": MIME_TYPES.get(extension) ?? "application/octet-stream",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(pathname).on("error", () => response.destroy()).pipe(response);
}

export function createAppRequestHandler({ staticDir, getRuntimeStatus }) {
  const staticRoot = resolve(staticDir);
  const rootPrefix = `${staticRoot}${sep}`;
  const indexPath = resolve(staticRoot, "index.html");

  return (request, response) => {
    void (async () => {
      applySecurityHeaders(response);
      const headOnly = request.method === "HEAD";
      if (request.method !== "GET" && !headOnly) {
        sendText(response, 405, "Method Not Allowed");
        return;
      }

      const rawPath = String(request.url ?? "/").split("?", 1)[0];
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(rawPath);
      } catch {
        sendText(response, 400, "Bad Request", headOnly);
        return;
      }

      if (decodedPath === "/healthz") {
        sendJson(response, 200, { status: "ok", ...getRuntimeStatus() }, headOnly);
        return;
      }
      if (decodedPath === "/readyz") {
        const staticReady = await isRegularFile(indexPath);
        sendJson(response, staticReady ? 200 : 503, {
          status: staticReady ? "ready" : "not-ready",
          staticReady,
          ...getRuntimeStatus(),
        }, headOnly);
        return;
      }

      const segments = decodedPath.replaceAll("\\", "/").split("/");
      if (decodedPath.includes("\0") || segments.includes("..")) {
        sendText(response, 403, "Forbidden", headOnly);
        return;
      }

      const relativePath = decodedPath.replace(/^\/+/, "");
      const requestedPath = resolve(staticRoot, relativePath || "index.html");
      if (requestedPath !== staticRoot && !requestedPath.startsWith(rootPrefix)) {
        sendText(response, 403, "Forbidden", headOnly);
        return;
      }

      if (await isRegularFile(requestedPath)) {
        await serveFile(request, response, requestedPath);
        return;
      }
      if (!extname(relativePath) && await isRegularFile(indexPath)) {
        await serveFile(request, response, indexPath);
        return;
      }
      sendText(response, 404, "Not Found", headOnly);
    })().catch((error) => {
      console.error("HTTP request failed", error);
      if (!response.headersSent) sendText(response, 500, "Internal Server Error");
      else response.destroy();
    });
  };
}
