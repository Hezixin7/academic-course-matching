import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { matchCourses, cosine } from "../src/core.js";
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
const data = JSON.parse(
  await readFile(opt("--dataset", "eval/data/seed.json"), "utf8"),
);
const courses = data.courses.filter((c) => c.split === split);
const modules = data.modules;
const labels = data.labels.filter((l) =>
  courses.some((c) => c.id === l.courseId),
);
const useLLM = args.includes("--llm");
loadEnv();
const config = readConfig();
if (useLLM && !config.apiKey)
  throw new Error(
    "LLM_API_KEY is missing. Configure .env before a live evaluation; no fake LLM scores will be generated.",
  );
env.allowRemoteModels = false;
env.localModelPath = resolve("models") + "/";
const model = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
  dtype: "q8",
  device: "cpu",
});
try {
  const embed = async (text) =>
    (await model(text, { pooling: "mean", normalize: true })).tolist();
  const retrieval = await matchCourses(courses, modules, embed);
  const descriptions = Object.fromEntries(
    courses.map((c) => [
      c.id,
      retrieval.candidates.filter((x) => x.courseId === c.id),
    ]),
  );
  const vectors = await embed([
    ...courses.map((c) => c.name),
    ...modules.map((m) => m.name),
  ]);
  const names = Object.fromEntries(
    courses.map((c, i) => [
      c.id,
      modules
        .map((m, j) => ({
          moduleId: m.id,
          score: cosine(vectors[i], vectors[courses.length + j]),
        }))
        .sort((a, b) => b.score - a.score),
    ]),
  );
  const tokens = (s) => new Set(s.toLowerCase().match(/[a-z]{3,}/g) || []);
  const keywords = Object.fromEntries(
    courses.map((c) => {
      const a = tokens(c.description);
      return [
        c.id,
        modules
          .map((m) => {
            const b = tokens(m.description);
            return {
              moduleId: m.id,
              score:
                [...a].filter((x) => b.has(x)).length /
                (new Set([...a, ...b]).size || 1),
            };
          })
          .sort((a, b) => b.score - a.score),
      ];
    }),
  );
  const result = {
    generatedAt: new Date().toISOString(),
    dataset: opt("--dataset", "eval/data/seed.json"),
    provenance: data.provenance,
    split,
    courses: courses.length,
    pairs: labels.length,
    embeddingModel: "Xenova/all-MiniLM-L6-v2 q8",
    retrieval: {
      nameEmbedding: retrievalMetrics(names, labels, 3),
      descriptionEmbedding: retrievalMetrics(descriptions, labels, 3),
      keywordJaccard: retrievalMetrics(keywords, labels, 3),
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
  const output = opt(
    "--out",
    `eval/results/${split}-${useLLM ? "live" : "retrieval"}.json`,
  );
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        split,
        retrieval: result.retrieval,
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
