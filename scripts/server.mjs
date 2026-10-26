import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep, extname, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnv, readConfig } from "../server/config.mjs";
import { createClassifier } from "../server/classifier.mjs";
import { createApi } from "../server/api.mjs";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".onnx": "application/octet-stream",
  ".bcmap": "application/octet-stream",
  ".ttf": "font/ttf",
  ".pfb": "application/octet-stream",
};
export function createStaticServer(
  directory = resolve(projectRoot, "dist"),
  options = {},
) {
  const root = resolve(directory);
  const classifier =
    options.classifier ||
    createClassifier({
      config: options.config || readConfig(),
      dataDir: options.dataDir ?? resolve(projectRoot, ".data"),
    });
  const api = createApi(classifier);
  return http.createServer(async (request, response) => {
    if (await api(request, response)) return;
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
    } catch {
      response.writeHead(400).end("Invalid path");
      return;
    }
    const path = resolve(
      root,
      "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
    );
    if (!path.startsWith(root + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const info = await stat(path);
      if (!info.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mime[extname(path)] || "application/octet-stream",
        "Content-Length": info.size,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(path)
        .on("error", () => response.destroy())
        .pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
}
export function startServer() {
  loadEnv(projectRoot);
  const port = Number(process.env.PORT || 5173);
  const host = process.env.HOST || "127.0.0.1";
  const server = createStaticServer();
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${port} is in use. Set PORT to a different number.`
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(port, host, () =>
    console.log(
      `Coursewise: http://${host}:${server.address().port}\nPress Ctrl+C to stop.`,
    ),
  );
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  startServer();
