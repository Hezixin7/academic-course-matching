import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createStaticServer } from "../scripts/server.mjs";

test("standalone HTTP service delivers app, model and correct WASM types; rejects traversal", async () => {
  const server = createStaticServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(await page.text(), /Academic Course Matching Copilot/);
    for (const pathname of [
      "/app.js",
      "/semantic-worker.js",
      "/vendor/pdf.min.mjs",
      "/vendor/mammoth-reader.js",
      "/vendor/transformers.web.min.js",
    ]) {
      const response = await fetch(origin + pathname, { method: "HEAD" });
      assert.equal(response.status, 200, pathname);
      assert.match(response.headers.get("content-type"), /javascript/);
      assert(Number(response.headers.get("content-length")) > 100);
    }
    const wasm = await fetch(
      origin + "/vendor/ort-wasm-simd-threaded.jsep.wasm",
      { method: "HEAD" },
    );
    assert.equal(wasm.status, 200);
    assert.equal(wasm.headers.get("content-type"), "application/wasm");
    const model = await fetch(
      origin + "/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx",
      { method: "HEAD" },
    );
    assert.equal(model.status, 200);
    assert.equal(Number(model.headers.get("content-length")), 22972370);
    const forbiddenStatus = await new Promise((resolve, reject) => {
      http
        .get(origin + "/..%2Fpackage.json", (response) => {
          response.resume();
          resolve(response.statusCode);
        })
        .on("error", reject);
    });
    assert.equal(forbiddenStatus, 403);
    assert.equal((await fetch(origin + "/missing.txt")).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
