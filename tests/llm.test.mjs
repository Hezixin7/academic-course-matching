import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateRequest, validateOutput } from "../server/validation.mjs";
import { createClassifier } from "../server/classifier.mjs";
import { buildAllocations } from "../src/proposals.js";
const course = {
  id: "A",
  name: "Linear Algebra",
  description: "Vector spaces, matrices and eigenvalues are covered in depth.",
};
const module = {
  id: "M",
  name: "Mathematics",
  description:
    "Linear algebra includes vector spaces, matrices and eigenvalues.",
};
const input = { course, modules: [module] };
const answer = (change = {}) => ({
  course_id: "A",
  assessments: [
    {
      module_id: "M",
      decision: "match",
      reason: "课程内容覆盖目标模块中的线性代数主题。",
      course_quote: "Vector spaces, matrices and eigenvalues",
      requirement_quote: "vector spaces, matrices and eigenvalues",
      missing_topics: [],
      ...change,
    },
  ],
});
const payload = (content) =>
  new Response(
    JSON.stringify({
      model: "fixture-model",
      choices: [{ finish_reason: "stop", message: { content } }],
      usage: { prompt_tokens: 30, completion_tokens: 15, total_tokens: 45 },
    }),
    { status: 200 },
  );
const config = {
  baseURL: "https://provider.example/v1",
  apiKey: "only-a-test-secret",
  model: "fixture-model",
  maxTokens: 4096,
  maxAttempts: 2,
  timeoutMs: 1000,
  thinking: "disabled",
};
test("LLM schema accepts supported quotes and quarantines fabricated, translated or missing citations", () => {
  assert.equal(
    validateOutput(JSON.stringify(answer()), input)[0].decision,
    "match",
  );
  for (const change of [
    { course_quote: "This sentence never existed in the course." },
    { requirement_quote: "向量空间、矩阵与特征值" },
    { course_quote: "" },
    { ects: 6 },
    { decision: "probably" },
    { missing_topics: "none" },
  ]) {
    const a = validateOutput(JSON.stringify(answer(change)), input)[0];
    assert.equal(a.decision, "needs_review");
    assert.equal(a.validation.valid, false);
  }
  const partial = validateOutput(
    JSON.stringify(
      answer({ decision: "partial", missing_topics: ["矩阵分解深度未说明"] }),
    ),
    input,
  )[0];
  assert.equal(partial.decision, "partial");
  assert.equal(
    validateOutput('{"wrong":true}', input)[0].decision,
    "needs_review",
  );
  assert.equal(validateOutput("not json", input)[0].decision, "needs_review");
  assert.equal(
    validateOutput(
      JSON.stringify({ ...answer(), course_id: "other" }),
      input,
    )[0].validation.valid,
    false,
  );
  assert.equal(
    validateOutput(
      JSON.stringify({
        course_id: "A",
        assessments: [answer().assessments[0], answer().assessments[0]],
      }),
      input,
    )[0].validation.valid,
    false,
  );
  assert.throws(
    () => validateRequest({ ...input, apiKey: "forbidden" }),
    /只应包含/,
  );
});
test("provider adapter sends JSON messages, caches validated output and logs metadata without keys or documents", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coursewise-"));
  let calls = 0;
  try {
    const client = createClassifier({
      config,
      dataDir: dir,
      fetchImpl: async (url, options) => {
        calls++;
        assert.equal(url, "https://provider.example/v1/chat/completions");
        const b = JSON.parse(options.body);
        assert.equal(b.response_format.type, "json_object");
        assert.match(b.messages[0].content, /UNTRUSTED DATA/);
        assert(!b.messages[1].content.includes("credits"));
        return payload(JSON.stringify(answer()));
      },
    });
    const one = await client.classify(input);
    assert.equal(one.trace.status, "validated");
    assert.equal(one.trace.usage.totalTokens, 45);
    const two = await client.classify(input);
    assert.equal(two.trace.cacheHit, true);
    assert.equal(two.trace.usage.totalTokens, 0);
    assert.equal(calls, 1);
    const logs = await readFile(join(dir, "traces.jsonl"), "utf8");
    assert(!logs.includes(config.apiKey));
    assert(!logs.includes(course.description));
    assert(logs.includes("inputHash"));
    const changed = {
      ...input,
      course: {
        ...course,
        description: course.description + " Additional mathematical proofs.",
      },
    };
    await client.classify(changed);
    assert.equal(calls, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("transient HTTP error retries; authentication, invalid JSON and timeouts never become accepted matches", async () => {
  let calls = 0;
  const retry = createClassifier({
    config,
    delay: async () => {},
    fetchImpl: async () =>
      ++calls === 1
        ? new Response("busy", { status: 429 })
        : payload(JSON.stringify(answer())),
  });
  const a = await retry.classify(input);
  assert.equal(calls, 2);
  assert.equal(a.trace.attempts.length, 2);
  assert(a.assessments[0].validation.valid);
  calls = 0;
  const auth = createClassifier({
    config,
    fetchImpl: async () => {
      calls++;
      return new Response("do not expose " + config.apiKey, { status: 401 });
    },
  });
  const bad = await auth.classify(input);
  assert.equal(calls, 1);
  assert.equal(bad.assessments[0].decision, "needs_review");
  assert(!JSON.stringify(bad).includes(config.apiKey));
  const malformed = createClassifier({
    config,
    fetchImpl: async () => payload("not JSON"),
  });
  assert.equal(
    (await malformed.classify(input)).trace.status,
    "validation_failed",
  );
  const timeout = createClassifier({
    config,
    delay: async () => {},
    fetchImpl: async () => {
      throw new DOMException("timeout", "TimeoutError");
    },
  });
  const t = await timeout.classify(input);
  assert.equal(t.trace.attempts.length, 2);
  assert.equal(t.assessments[0].validation.codes[0], "PROVIDER_TIMEOUT");
  const noKey = createClassifier({ config: { ...config, apiKey: "" } });
  await assert.rejects(() => noKey.classify(input), /LLM_API_KEY/);
});
test("only validated positive decisions generate allocations; partial or competing matches require manual amounts", () => {
  const cs = [{ ...course, credits: 4 }],
    mods = [module, { ...module, id: "M2" }];
  const candidates = mods.map((m) => ({
    courseId: "A",
    moduleId: m.id,
    score: 0.6,
  }));
  const good = validateOutput(JSON.stringify(answer()), input)[0];
  assert.equal(buildAllocations(cs, mods, candidates, [good], 1.5)[0].ects, 6);
  assert.equal(
    buildAllocations(
      cs,
      mods,
      candidates,
      [{ ...good, decision: "partial" }],
      1.5,
    )[0].ects,
    0,
  );
  const competing = buildAllocations(cs, mods, candidates, [
    good,
    { ...good, moduleId: "M2" },
  ]);
  assert.equal(competing.length, 2);
  assert(competing.every((e) => e.ects === 0));
  assert.deepEqual(
    buildAllocations(cs, mods, candidates, [
      { ...good, validation: { valid: false } },
    ]),
    [],
  );
  assert.deepEqual(
    buildAllocations(cs, mods, candidates, [{ ...good, decision: "no_match" }]),
    [],
  );
});
