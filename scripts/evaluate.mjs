import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { env, pipeline } from "@huggingface/transformers";
import { matchCourses, cosine, chunks, semanticText } from "../src/core.js";
import { retrievalMetrics, classificationMetrics } from "../eval/metrics.mjs";
import { loadEnv, readConfig } from "../server/config.mjs";
import { createClassifier } from "../server/classifier.mjs";
import { PROMPT_VERSION } from "../server/prompt.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const a = args.find((x) => x.startsWith(name + "="));
  return a ? a.slice(name.length + 1) : fallback;
};
const split = opt("--split", "test");
if (!["dev", "test"].includes(split))
  throw new Error("--split must be dev or test");
const datasetPath = opt("--dataset", "eval/data/seed.json");
const repeats = Number(opt("--repeats", "5"));
if (!Number.isInteger(repeats) || repeats < 2)
  throw new Error("--repeats must be an integer >= 2");
const data = JSON.parse(await readFile(datasetPath, "utf8"));
const courses = data.courses.filter((c) => c.split === split);
const modules = data.modules;
const courseIds = new Set(courses.map((c) => c.id));
const labels = data.labels.filter((l) => courseIds.has(l.courseId));
const useLLM = args.includes("--llm");
loadEnv();
const config = readConfig();
if (useLLM && !config.apiKey)
  throw new Error(
    "LLM_API_KEY is missing. Configure .env before a live evaluation; no fake LLM scores will be generated.",
  );

const ks = [1, 3, 5];
const ms = (n) => Math.round(n * 1000) / 1000;
const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    runsMs: values.map(ms),
    minMs: ms(sorted[0]),
    medianMs: ms(median),
    meanMs: ms(values.reduce((a, b) => a + b, 0) / values.length),
    maxMs: ms(sorted[sorted.length - 1]),
  };
};
const positive = (d) => ["match", "partial"].includes(d);

env.allowRemoteModels = false;
env.localModelPath = resolve("models") + "/";
const modelLoadStart = performance.now();
const model = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
  dtype: "q8",
  device: "cpu",
});
const modelLoadMs = performance.now() - modelLoadStart;

try {
  const embed = async (text) =>
    (await model(text, { pooling: "mean", normalize: true })).tolist();

  // The production retrieval path uses document-level description vectors.
  // This evaluation copy reproduces the same chunking, semantic expansion and
  // document-to-document cosine so that K=5 can be measured; a parity assertion
  // below verifies that its top-3 ranking is identical to matchCourses().
  const mean = (vectors) => {
    const a = new Array(vectors[0].length).fill(0);
    for (const v of vectors)
      for (let i = 0; i < a.length; i++) a[i] += v[i] / vectors.length;
    return a;
  };
  const descriptionRows = [...courses, ...modules];
  const descriptionTexts = [];
  const descriptionRanges = [];
  for (const row of descriptionRows) {
    const parts = chunks(row.description);
    descriptionRanges.push({ start: descriptionTexts.length, count: parts.length });
    descriptionTexts.push(...parts.map(semanticText));
  }
  const rankDescriptions = (vectors) => {
    const means = descriptionRanges.map((r) =>
      mean(vectors.slice(r.start, r.start + r.count)),
    );
    return Object.fromEntries(
      courses.map((course, i) => [
        course.id,
        modules
          .map((module, j) => ({
            moduleId: module.id,
            score: Math.max(
              0,
              cosine(means[i], means[courses.length + j]),
            ),
          }))
          .sort((a, b) => b.score - a.score),
      ]),
    );
  };
  const runDescriptions = async () => {
    const start = performance.now();
    const embeddingStart = performance.now();
    const vectors = await embed(descriptionTexts);
    const embeddingMs = performance.now() - embeddingStart;
    const rankings = rankDescriptions(vectors);
    return { rankings, runMs: performance.now() - start, embeddingMs };
  };

  const nameTexts = [
    ...courses.map((c) => c.name),
    ...modules.map((m) => m.name),
  ];
  const runNames = async () => {
    const start = performance.now();
    const embeddingStart = performance.now();
    const vectors = await embed(nameTexts);
    const embeddingMs = performance.now() - embeddingStart;
    const rankings = Object.fromEntries(
      courses.map((course, i) => [
        course.id,
        modules
          .map((module, j) => ({
            moduleId: module.id,
            score: cosine(vectors[i], vectors[courses.length + j]),
          }))
          .sort((a, b) => b.score - a.score),
      ]),
    );
    return { rankings, runMs: performance.now() - start, embeddingMs };
  };

  const tokenize = (s) =>
    new Set(s.toLowerCase().match(/[a-z]{3,}/g) || []);
  const runKeywords = () => {
    const start = performance.now();
    const rankings = Object.fromEntries(
      courses.map((course) => {
        const a = tokenize(course.description);
        return [
          course.id,
          modules
            .map((module) => {
              const b = tokenize(module.description);
              return {
                moduleId: module.id,
                score:
                  [...a].filter((x) => b.has(x)).length /
                  (new Set([...a, ...b]).size || 1),
              };
            })
            .sort((a, b) => b.score - a.score),
        ];
      }),
    );
    return { rankings, runMs: performance.now() - start };
  };

  // Repeat every strategy. The first description run is the cold run
  // (immediately after model load); later runs are warm steady-state runs.
  const descriptionRuns = [];
  for (let i = 0; i < repeats; i++) descriptionRuns.push(await runDescriptions());
  const nameRuns = [];
  for (let i = 0; i < repeats; i++) nameRuns.push(await runNames());
  const keywordRuns = [];
  for (let i = 0; i < repeats; i++) keywordRuns.push(runKeywords());

  const descriptionRankings = descriptionRuns.at(-1).rankings;
  const nameRankings = nameRuns.at(-1).rankings;
  const keywordRankings = keywordRuns.at(-1).rankings;

  // Verify that the K=5 evaluation ranker agrees with the production top-3.
  const production = await matchCourses(courses, modules, embed);
  const parityFailures = [];
  for (const course of courses) {
    const expected = production.candidates
      .filter((x) => x.courseId === course.id)
      .map((x) => x.moduleId);
    const actual = descriptionRankings[course.id]
      .slice(0, 3)
      .map((x) => x.moduleId);
    if (expected.join("\0") !== actual.join("\0"))
      parityFailures.push({
        courseId: course.id,
        production: expected,
        evaluation: actual,
      });
  }
  if (parityFailures.length)
    throw new Error(
      "Description ranking parity check failed: " +
        JSON.stringify(parityFailures.slice(0, 5)),
    );

  const metricsAtK = Object.fromEntries(
    ks.map((k) => [
      String(k),
      {
        nameEmbedding: retrievalMetrics(nameRankings, labels, k),
        descriptionEmbedding: retrievalMetrics(
          descriptionRankings,
          labels,
          k,
        ),
        keywordJaccard: retrievalMetrics(keywordRankings, labels, k),
      },
    ]),
  );

  const reduction = (courseCount) =>
    Object.fromEntries(
      ks.map((k) => {
        const exhaustivePairs = courseCount * modules.length;
        const retrievedPairs = courseCount * Math.min(k, modules.length);
        const ratio = 1 - retrievedPairs / (exhaustivePairs || 1);
        return [
          String(k),
          {
            exhaustivePairs,
            retrievedPairs,
            reduction: Math.round(ratio * 10000) / 10000,
            reductionPercent: Math.round(ratio * 10000) / 100,
          },
        ];
      }),
    );
  const eligibleCourses = new Set(
    labels.filter((l) => positive(l.decision)).map((l) => l.courseId),
  );

  const scenarioDistribution = {};
  for (const course of courses) {
    const key = course.scenario || "unspecified";
    scenarioDistribution[key] = (scenarioDistribution[key] || 0) + 1;
  }
  const labelDistribution = { match: 0, partial: 0, no_match: 0, other: 0 };
  for (const label of labels) {
    if (Object.hasOwn(labelDistribution, label.decision))
      labelDistribution[label.decision]++;
    else labelDistribution.other++;
  }

  const descriptionCold = descriptionRuns[0];
  const descriptionWarm = descriptionRuns.slice(1);
  const nameFirst = nameRuns[0];
  const nameWarm = nameRuns.slice(1);
  const keywordFirst = keywordRuns[0];
  const keywordWarm = keywordRuns.slice(1);

  const timing = {
    hardware: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpu: os.cpus()[0]?.model || "unknown",
      logicalCores: os.cpus().length,
      totalMemoryGB: Math.round((os.totalmem() / 1073741824) * 10) / 10,
      node: process.version,
      embeddingModel: "Xenova/all-MiniLM-L6-v2",
      dtype: "q8",
      device: "cpu",
    },
    protocol:
      "Single process; model loaded once. The first description run starts immediately after load and is reported as cold. Remaining runs are warm steady-state measurements in the same process. Name and keyword runs follow the description runs, so their first run is already model-warm. Every strategy is repeated " +
      repeats +
      " times.",
    repeats,
    modelLoadMs: ms(modelLoadMs),
    coldStartTotalMs: ms(modelLoadMs + descriptionCold.runMs),
    descriptionEmbedding: {
      cold: {
        runMs: ms(descriptionCold.runMs),
        embeddingMs: ms(descriptionCold.embeddingMs),
      },
      warm: {
        runMs: summarize(descriptionWarm.map((r) => r.runMs)),
        embeddingMs: summarize(descriptionWarm.map((r) => r.embeddingMs)),
      },
    },
    nameEmbedding: {
      firstRun: {
        runMs: ms(nameFirst.runMs),
        embeddingMs: ms(nameFirst.embeddingMs),
      },
      warm: {
        runMs: summarize(nameWarm.map((r) => r.runMs)),
        embeddingMs: summarize(nameWarm.map((r) => r.embeddingMs)),
      },
    },
    keywordJaccard: {
      firstRunMs: ms(keywordFirst.runMs),
      warm: { runMs: summarize(keywordWarm.map((r) => r.runMs)) },
    },
    retrievalLatencyMs: {
      descriptionEmbedding: {
        coldStartTotalMs: ms(modelLoadMs + descriptionCold.runMs),
        warmMedianMs: summarize(descriptionWarm.map((r) => r.runMs)).medianMs,
      },
      nameEmbedding: {
        firstRunMs: ms(nameFirst.runMs),
        warmMedianMs: summarize(nameWarm.map((r) => r.runMs)).medianMs,
      },
      keywordJaccard: {
        firstRunMs: ms(keywordFirst.runMs),
        warmMedianMs: summarize(keywordWarm.map((r) => r.runMs)).medianMs,
      },
    },
  };

  const datasetStats = {
    version: data.version,
    benchmark: data.benchmark || `Benchmark V${data.version}`,
    split,
    courses: courses.length,
    modules: modules.length,
    labels: labels.length,
    exhaustivePairs: courses.length * modules.length,
    scenarioDistribution,
    labelDistribution,
    positiveLabels:
      labelDistribution.match + labelDistribution.partial,
    negativeLabels: labelDistribution.no_match,
    eligibleCourses: eligibleCourses.size,
    synthetic:
      data.synthetic ??
      /synthetic/i.test(String(data.provenance || "")),
    humanValidated: data.humanValidated ?? false,
    provenance: data.provenance,
  };

  const descriptions = Object.fromEntries(
    courses.map((c) => [
      c.id,
      production.candidates.filter((x) => x.courseId === c.id),
    ]),
  );

  const result = {
    generatedAt: new Date().toISOString(),
    dataset: datasetPath,
    provenance: data.provenance,
    split,
    courses: courses.length,
    pairs: labels.length,
    embeddingModel: "Xenova/all-MiniLM-L6-v2 q8",
    datasetStats,
    metricDefinitions: {
      relevance:
        data.relevanceDefinition ||
        "Relevant = ground-truth decision match or partial. Courses without a relevant module are excluded from retrieval denominators.",
      recallAtK:
        "Per-course recall over positive labels, macro-averaged across eligible courses.",
      hitRateAtK:
        "Fraction of eligible courses with at least one relevant module in the top K.",
      mrr:
        "MRR@K: reciprocal rank of the first relevant module within the top K; 0 when no relevant module is retrieved in the top K.",
      eligibleCourses:
        "Courses with at least one match/partial label. Courses without a valid match contribute no Recall/HitRate/MRR denominator.",
      candidateReduction:
        "Exhaustive matching compares every course with every module; retrieval returns the top K modules per course. Reduction is a candidate-count ratio, not a measured API-cost saving.",
      latency:
        "Cold total = model load + first description run. Warm values are repeated steady-state runs in the same process. No GPU is used.",
    },
    retrieval: metricsAtK["3"],
    retrievalAtK: metricsAtK,
    candidateReduction: {
      allCourses: reduction(courses.length),
      eligibleCoursesOnly: reduction(eligibleCourses.size),
    },
    timing,
    parity: {
      productionRanker: "matchCourses() top-3",
      evaluationRanker: "evaluation description ranker top-3",
      checkedCourses: courses.length,
      failures: parityFailures.length,
    },
    llm: { status: "not_run", metrics: null },
    rankings: descriptions,
  };

  if (useLLM) {
    const classifier = createClassifier({
      config,
      dataDir: resolve(".data/eval"),
    });
    const predictions = [],
      traces = [];
    for (const [i, c] of courses.entries()) {
      console.log(`Live LLM evaluation ${i + 1}/${courses.length}: ${c.id}`);
      const selected = descriptions[c.id].map((r) =>
        modules.find((m) => m.id === r.moduleId),
      );
      const clean = (r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
      });
      const r = await classifier.classify({
        course: clean(c),
        modules: selected.map(clean),
      });
      predictions.push(...r.assessments);
      traces.push(r.trace);
    }
    const allPairs = labels.map(
      (l) =>
        predictions.find(
          (p) => p.courseId === l.courseId && p.moduleId === l.moduleId,
        ) || { ...l, decision: "no_match", notRetrieved: true },
    );
    result.llm = {
      status: "live_provider",
      model: config.model,
      promptVersion: PROMPT_VERSION,
      retrievedPairs: classificationMetrics(
        labels.filter((l) =>
          predictions.some(
            (p) => p.courseId === l.courseId && p.moduleId === l.moduleId,
          ),
        ),
        predictions,
      ),
      endToEnd: classificationMetrics(labels, allPairs),
      outputValidationPassRate: predictions.length
        ? predictions.filter((p) => p.validation.valid).length /
          predictions.length
        : 0,
      citationValidation: (() => {
        const cited = predictions.filter(
          (p) =>
            p.courseQuote ||
            p.requirementQuote ||
            p.validation.codes.some((c) => c.includes("QUOTE")),
        );
        return {
          attempted: cited.length,
          passed: cited.filter((p) => p.validation.valid).length,
          rate: cited.length
            ? cited.filter((p) => p.validation.valid).length / cited.length
            : null,
        };
      })(),
      predictions,
      traces,
    };
  }

  await mkdir("eval/results", { recursive: true });
  const isV2 = data.version === 2;
  const output = opt(
    "--out",
    `eval/results/${isV2 ? "v2-" : ""}${split}-${useLLM ? "live" : "retrieval"}.json`,
  );
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        split,
        dataset: datasetPath,
        datasetStats,
        retrieval: result.retrieval,
        retrievalAtK: result.retrievalAtK,
        candidateReduction: result.candidateReduction,
        timing: result.timing,
        parity: result.parity,
        llmStatus: result.llm.status,
        output,
      },
      null,
      2,
    ),
  );
} finally {
  await model.dispose();
}
