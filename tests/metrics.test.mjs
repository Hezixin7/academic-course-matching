import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { retrievalMetrics, classificationMetrics } from "../eval/metrics.mjs";
test("retrieval and classification metrics count missed positives, abstentions and false positives", () => {
  const gold = [
    { courseId: "A", moduleId: "M", decision: "match" },
    { courseId: "A", moduleId: "N", decision: "partial" },
    { courseId: "B", moduleId: "M", decision: "no_match" },
  ];
  const r = retrievalMetrics({ A: [{ moduleId: "M" }] }, gold, 1);
  assert.equal(r.macroRecallAtK, 0.5);
  assert.equal(r.mrr, 1);
  const m = classificationMetrics(gold, [
    { courseId: "A", moduleId: "M", decision: "match" },
    { courseId: "A", moduleId: "N", decision: "needs_review" },
    { courseId: "B", moduleId: "M", decision: "match" },
  ]);
  assert.equal(m.accuracy, 1 / 3);
  assert.equal(m.abstained, 1);
  assert.equal(m.positivePrecision, 0.5);
  assert.equal(m.positiveRecall, 0.5);
});
test("seed dataset has disjoint course IDs and complete pair labels, and is marked synthetic", async () => {
  const d = JSON.parse(await readFile("eval/data/seed.json", "utf8"));
  assert.match(d.provenance, /synthetic/);
  assert.equal(new Set(d.courses.map((c) => c.id)).size, d.courses.length);
  assert.equal(d.labels.length, d.courses.length * d.modules.length);
  assert(d.courses.some((c) => c.split === "dev"));
  assert(d.courses.some((c) => c.split === "test"));
});
