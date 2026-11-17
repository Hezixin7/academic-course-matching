import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateBenchmark } from "../eval/validate-benchmark.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("Benchmark V2 has complete labels and the required scenario distribution", async () => {
  const data = await readJson("eval/data/benchmark-v2.json");
  const result = validateBenchmark(data);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.stats.splitCounts, { dev: 40, test: 60 });
  assert.equal(result.stats.courses, 100);
  assert.equal(result.stats.modules, 20);
  assert.equal(result.stats.labels, 2000);
  assert.deepEqual(result.stats.scenarioOverall, {
    straightforward: 25,
    paraphrase: 25,
    partial: 20,
    hard_negative: 20,
    no_valid_match: 10,
  });
  assert.deepEqual(result.stats.scenarioBySplit, {
    dev: {
      straightforward: 10,
      paraphrase: 10,
      partial: 8,
      hard_negative: 8,
      no_valid_match: 4,
    },
    test: {
      straightforward: 15,
      paraphrase: 15,
      partial: 12,
      hard_negative: 12,
      no_valid_match: 6,
    },
  });
  assert.deepEqual(result.stats.labelCounts, {
    match: 70,
    partial: 20,
    no_match: 1910,
  });
  assert.deepEqual(result.stats.eligibleCourses, {
    overall: 90,
    dev: 36,
    test: 54,
  });
  // Every hard-negative decoy must be a no_match, not a hidden positive.
  assert.equal(result.stats.decoyPairsChecked, 20);
  assert.equal(result.stats.decoyPairsLabeledNoMatch, 20);
});

test("Benchmark V2 splits are isolated and descriptions are not near-duplicates", async () => {
  const data = await readJson("eval/data/benchmark-v2.json");
  const result = validateBenchmark(data, { nearDuplicateThreshold: 0.8 });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.stats.nearDuplicatePairs.length, 0);
  assert(result.stats.maxDescriptionSimilarity < 0.8);
  const devIds = new Set(
    data.courses.filter((c) => c.split === "dev").map((c) => c.id),
  );
  const testIds = new Set(
    data.courses.filter((c) => c.split === "test").map((c) => c.id),
  );
  assert.equal(devIds.size, 40);
  assert.equal(testIds.size, 60);
  for (const id of devIds) assert(!testIds.has(id), `${id} leaked into test`);
  assert.equal(data.synthetic, true);
  assert.equal(data.humanValidated, false);
  assert.match(data.provenance, /synthetic/i);
});

test("Benchmark V1 and its existing retrieval results remain preserved", async () => {
  const v1 = await readJson("eval/data/seed.json");
  assert.equal(v1.version, 1);
  assert.equal(v1.courses.length, 16);
  assert.equal(v1.modules.length, 6);
  assert.equal(v1.labels.length, 96);
  assert.equal(v1.courses.filter((c) => c.split === "dev").length, 8);
  assert.equal(v1.courses.filter((c) => c.split === "test").length, 8);
  const moduleIds = new Set(v1.modules.map((m) => m.id));
  for (const course of v1.courses) {
    const own = v1.labels.filter((l) => l.courseId === course.id);
    assert.equal(own.length, moduleIds.size);
    assert.deepEqual(
      new Set(own.map((l) => l.moduleId)),
      moduleIds,
    );
  }
  for (const split of ["dev", "test"]) {
    const report = await readJson(`eval/results/${split}-retrieval.json`);
    assert.equal(report.dataset, "eval/data/seed.json");
    assert.equal(report.split, split);
    assert.equal(report.courses, 8);
    assert.equal(report.pairs, 48);
    assert.equal(report.retrieval.descriptionEmbedding.k, 3);
  }
});
