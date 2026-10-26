import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { DEMO, joinCourses, matchCourses, calculate } from "../src/core.js";
env.allowRemoteModels = false;
env.localModelPath = resolve("dist/models") + "/";
env.backends.onnx.wasm.numThreads = 1;
test("real quantized MiniLM retrieves candidates but cannot bypass the LLM gate", async () => {
  const model = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
    { dtype: "q8", device: "cpu" },
  );
  const courses = joinCourses(DEMO.transcript, DEMO.descriptions);
  let calls = 0;
  const embed = async (texts) => {
    calls++;
    return (await model(texts, { pooling: "mean", normalize: true })).tolist();
  };
  const { edges, candidates } = await matchCourses(
    courses,
    DEMO.requirements,
    embed,
    1.5,
  );
  const top = (id) =>
    candidates
      .filter((x) => x.courseId === id)
      .sort((a, b) => b.score - a.score)[0];
  assert.equal(top("CS203").moduleId, "DATA");
  assert.equal(top("MA301").moduleId, "STAT");
  assert.equal(top("MA202").moduleId, "MATH");
  assert.equal(top("CS202").moduleId, "CS");
  assert.equal(
    edges.length,
    0,
    "retrieval must not bypass LLM validation and assign credits",
  );
  assert.equal(candidates.length, 24);
  assert.equal(calculate(courses, DEMO.requirements, edges, 1.5).allocated, 0);
  await model.dispose();
});
