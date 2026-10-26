import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createStaticServer } from "../scripts/server.mjs";
import { createClassifier } from "../server/classifier.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("actual backend HTTP integration -> provider HTTP -> evidence validation; rejects foreign origins and secret-bearing request shapes", async () => {
  let providerCalls = 0;
  const provider = http.createServer(async (req, res) => {
    providerCalls++;
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text);
    const user = JSON.parse(body.messages[1].content);
    const answer = {
      course_id: user.course.id,
      assessments: user.modules.map((m) => ({
        module_id: m.id,
        decision: "match",
        reason: "课程描述直接覆盖指定主题，仍需人工核实深度。",
        course_quote: user.course.description,
        requirement_quote: m.description,
        missing_topics: [],
      })),
    };
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(answer) },
            },
          ],
          usage: { total_tokens: 50, prompt_tokens: 30, completion_tokens: 20 },
        }),
      );
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const dir = await mkdtemp(join(tmpdir(), "coursewise-api-"));
  const classifier = createClassifier({
    config: {
      baseURL: `http://127.0.0.1:${provider.address().port}`,
      apiKey: "test-key",
      model: "http-fixture",
      maxAttempts: 2,
      maxTokens: 4096,
      timeoutMs: 1000,
    },
    dataDir: dir,
  });
  const server = createStaticServer(undefined, { classifier });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const data = {
    course: {
      id: "A",
      name: "Course",
      description: "Linear algebra and matrix factorizations.",
    },
    modules: [
      {
        id: "M",
        name: "Module",
        description: "Linear algebra and matrix factorizations.",
      },
    ],
  };
  try {
    const status = await (await fetch(base + "/api/status")).json();
    assert(status.configured);
    assert(!JSON.stringify(status).includes("test-key"));
    const post = (extra) =>
      fetch(base + "/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extra },
        body: JSON.stringify(data),
      });
    const result = await (await post()).json();
    assert.equal(result.assessments[0].decision, "match");
    assert.equal(result.trace.status, "validated");
    assert.equal(providerCalls, 1);
    assert.equal((await (await post()).json()).trace.cacheHit, true);
    assert.equal(providerCalls, 1);
    assert.equal(
      (await post({ Origin: "https://foreign.example" })).status,
      403,
    );
    const invalid = await fetch(base + "/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, credits: 12 }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(providerCalls, 1);
  } finally {
    server.closeAllConnections();
    provider.closeAllConnections();
    await Promise.all([
      new Promise((r) => server.close(r)),
      new Promise((r) => provider.close(r)),
    ]);
    await rm(dir, { recursive: true, force: true });
  }
});
