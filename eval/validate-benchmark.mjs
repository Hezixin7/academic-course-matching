// Structural and semantic QA for Benchmark V2.
// The validator is intentionally dependency-free so it can run in CI and tests.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCENARIOS = [
  "straightforward",
  "paraphrase",
  "partial",
  "hard_negative",
  "no_valid_match",
];
const DECISIONS = ["match", "partial", "no_match"];
const EXPECTED_SCENARIOS = {
  straightforward: 25,
  paraphrase: 25,
  partial: 20,
  hard_negative: 20,
  no_valid_match: 10,
};
const EXPECTED_SCENARIOS_BY_SPLIT = {
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
};

const words = (text) =>
  new Set(String(text).toLowerCase().match(/\p{L}{2,}/gu) || []);
const jaccard = (a, b) => {
  const union = new Set([...a, ...b]).size;
  if (!union) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / union;
};

export function validateBenchmark(
  data,
  { nearDuplicateThreshold = 0.8 } = {},
) {
  const errors = [];
  const warnings = [];
  const fail = (message) => errors.push(message);
  const stats = {
    version: data.version,
    benchmark: data.benchmark,
    courses: 0,
    modules: 0,
    labels: 0,
    splitCounts: {},
    scenarioOverall: {},
    scenarioBySplit: {},
    labelCounts: { match: 0, partial: 0, no_match: 0 },
    positiveLabels: 0,
    negativeLabels: 0,
    eligibleCourses: { overall: 0, dev: 0, test: 0 },
    maxDescriptionSimilarity: 0,
    nearDuplicatePairs: [],
    decoyPairsChecked: 0,
    decoyPairsLabeledNoMatch: 0,
    potentialAmbiguities: 0,
  };

  if (data.version !== 2) fail(`Expected version 2, got ${data.version}`);
  if (data.benchmark !== "Benchmark V2")
    fail(`Expected benchmark "Benchmark V2", got ${data.benchmark}`);
  if (data.synthetic !== true) fail("Benchmark must be marked synthetic");
  if (data.humanValidated !== false)
    fail("Benchmark must not claim independent human validation");
  if (!String(data.provenance || "").toLowerCase().includes("synthetic"))
    fail("Provenance must explicitly state that the data is synthetic");

  const modules = Array.isArray(data.modules) ? data.modules : [];
  const courses = Array.isArray(data.courses) ? data.courses : [];
  const labels = Array.isArray(data.labels) ? data.labels : [];
  stats.modules = modules.length;
  stats.courses = courses.length;
  stats.labels = labels.length;

  if (modules.length !== 20) fail(`Expected 20 modules, got ${modules.length}`);
  if (courses.length !== 100)
    fail(`Expected 100 courses, got ${courses.length}`);
  if (labels.length !== 2000)
    fail(`Expected 2000 labels, got ${labels.length}`);

  // Module IDs.
  const moduleIds = new Set();
  for (const module of modules) {
    if (!String(module.id || "").trim()) fail("Module with empty id");
    if (moduleIds.has(module.id))
      fail(`Duplicate module id ${module.id}`);
    moduleIds.add(module.id);
    if (!String(module.name || "").trim())
      fail(`Module ${module.id} has no name`);
    if (!String(module.description || "").trim())
      fail(`Module ${module.id} has no description`);
    if (
      !Number.isFinite(module.required_ects) ||
      module.required_ects <= 0
    )
      fail(`Module ${module.id} has invalid required_ects`);
  }

  // Course IDs, splits and scenario metadata.
  const courseIds = new Set();
  const splitIds = { dev: new Set(), test: new Set() };
  const scenarioOverall = Object.fromEntries(SCENARIOS.map((k) => [k, 0]));
  const scenarioBySplit = {
    dev: Object.fromEntries(SCENARIOS.map((k) => [k, 0])),
    test: Object.fromEntries(SCENARIOS.map((k) => [k, 0])),
  };
  const nameSet = new Set();
  for (const course of courses) {
    if (!String(course.id || "").trim()) fail("Course with empty id");
    if (courseIds.has(course.id))
      fail(`Duplicate course id ${course.id}`);
    courseIds.add(course.id);
    if (!["dev", "test"].includes(course.split))
      fail(`Course ${course.id} has invalid split ${course.split}`);
    else splitIds[course.split].add(course.id);
    if (!String(course.name || "").trim())
      fail(`Course ${course.id} has no name`);
    if (nameSet.has(course.name))
      fail(`Duplicate course name ${course.name}`);
    nameSet.add(course.name);
    if (!String(course.description || "").trim())
      fail(`Course ${course.id} has no description`);
    if (!Number.isFinite(course.credits) || course.credits <= 0)
      fail(`Course ${course.id} has invalid credits`);
    if (!SCENARIOS.includes(course.scenario))
      fail(`Course ${course.id} has invalid scenario ${course.scenario}`);
    else {
      scenarioOverall[course.scenario]++;
      scenarioBySplit[course.split][course.scenario]++;
    }
    if (
      ["straightforward", "paraphrase", "partial"].includes(course.scenario) &&
      !moduleIds.has(course.targetModuleId)
    )
      fail(`Course ${course.id} has unknown targetModuleId`);
    if (
      course.scenario === "hard_negative" &&
      !moduleIds.has(course.decoyModuleId)
    )
      fail(`Course ${course.id} has unknown decoyModuleId`);
  }

  stats.splitCounts = {
    dev: splitIds.dev.size,
    test: splitIds.test.size,
  };
  if (splitIds.dev.size !== 40)
    fail(`Expected 40 dev courses, got ${splitIds.dev.size}`);
  if (splitIds.test.size !== 60)
    fail(`Expected 60 test courses, got ${splitIds.test.size}`);
  for (const id of splitIds.dev)
    if (splitIds.test.has(id)) fail(`Course ${id} appears in both splits`);
  stats.scenarioOverall = scenarioOverall;
  stats.scenarioBySplit = scenarioBySplit;
  for (const scenario of SCENARIOS) {
    if (scenarioOverall[scenario] !== EXPECTED_SCENARIOS[scenario])
      fail(
        `Scenario ${scenario} expected ${EXPECTED_SCENARIOS[scenario]}, got ${scenarioOverall[scenario]}`,
      );
    for (const split of ["dev", "test"])
      if (
        scenarioBySplit[split][scenario] !==
        EXPECTED_SCENARIOS_BY_SPLIT[split][scenario]
      )
        fail(
          `Scenario ${scenario}/${split} expected ${EXPECTED_SCENARIOS_BY_SPLIT[split][scenario]}, got ${scenarioBySplit[split][scenario]}`,
        );
  }

  // Label completeness and consistency.
  const labelMap = new Map();
  for (const label of labels) {
    if (!courseIds.has(label.courseId))
      fail(`Label references unknown course ${label.courseId}`);
    if (!moduleIds.has(label.moduleId))
      fail(`Label references unknown module ${label.moduleId}`);
    const key = label.courseId + "\0" + label.moduleId;
    if (labelMap.has(key))
      fail(`Duplicate label for ${label.courseId}/${label.moduleId}`);
    labelMap.set(key, label);
    if (!DECISIONS.includes(label.decision))
      fail(`Invalid decision ${label.decision} for ${key}`);
    else stats.labelCounts[label.decision]++;
    if (!String(label.rationale || "").trim())
      fail(`Missing rationale for ${key}`);
  }
  for (const course of courses)
    for (const module of modules) {
      const key = course.id + "\0" + module.id;
      if (!labelMap.has(key))
        fail(`Missing label for ${course.id}/${module.id}`);
    }

  stats.positiveLabels =
    stats.labelCounts.match + stats.labelCounts.partial;
  stats.negativeLabels = stats.labelCounts.no_match;
  if (stats.labelCounts.match !== 70)
    fail(`Expected 70 match labels, got ${stats.labelCounts.match}`);
  if (stats.labelCounts.partial !== 20)
    fail(`Expected 20 partial labels, got ${stats.labelCounts.partial}`);
  if (stats.labelCounts.no_match !== 1910)
    fail(`Expected 1910 no_match labels, got ${stats.labelCounts.no_match}`);

  // Scenario-to-label consistency, computed per course.
  const eligible = { overall: 0, dev: 0, test: 0 };
  for (const course of courses) {
    const own = labels.filter((l) => l.courseId === course.id);
    const positives = own.filter(
      (l) => l.decision === "match" || l.decision === "partial",
    );
    const matches = own.filter((l) => l.decision === "match");
    const partials = own.filter((l) => l.decision === "partial");
    if (
      course.scenario === "straightforward" ||
      course.scenario === "paraphrase"
    ) {
      if (matches.length !== 1)
        fail(
          `Scenario ${course.scenario}/${course.id} must have exactly one match, got ${matches.length}`,
        );
      if (partials.length !== 0)
        fail(`Scenario ${course.scenario}/${course.id} must not have partial labels`);
      if (matches[0]?.moduleId !== course.targetModuleId)
        fail(`Course ${course.id} match is not on targetModuleId`);
    } else if (course.scenario === "partial") {
      if (matches.length !== 0)
        fail(`Partial course ${course.id} must not have match labels`);
      if (partials.length !== 1)
        fail(
          `Partial course ${course.id} must have exactly one partial label, got ${partials.length}`,
        );
      if (partials[0]?.moduleId !== course.targetModuleId)
        fail(`Course ${course.id} partial label is not on targetModuleId`);
    } else if (course.scenario === "hard_negative") {
      if (matches.length !== 1)
        fail(
          `Hard-negative course ${course.id} must have exactly one match, got ${matches.length}`,
        );
      if (partials.length !== 0)
        fail(`Hard-negative course ${course.id} must not have partial labels`);
      if (matches[0]?.moduleId !== course.targetModuleId)
        fail(`Hard-negative course ${course.id} match is not on targetModuleId`);
      const decoy = own.find((l) => l.moduleId === course.decoyModuleId);
      stats.decoyPairsChecked++;
      if (decoy?.decision === "no_match") stats.decoyPairsLabeledNoMatch++;
      else
        fail(
          `Hard-negative decoy ${course.id}/${course.decoyModuleId} is not no_match`,
        );
    } else {
      if (positives.length !== 0)
        fail(
          `Course ${course.id} (${course.scenario}) must have no positive labels`,
        );
    }
    if (positives.length) {
      eligible.overall++;
      eligible[course.split]++;
    }
  }
  stats.eligibleCourses = eligible;
  if (eligible.overall !== 90)
    fail(`Expected 90 eligible courses, got ${eligible.overall}`);
  if (eligible.dev !== 36)
    fail(`Expected 36 eligible dev courses, got ${eligible.dev}`);
  if (eligible.test !== 54)
    fail(`Expected 54 eligible test courses, got ${eligible.test}`);

  // Description near-duplicates and split leakage.
  const descriptions = courses.map((course) => ({
    course,
    tokens: words(course.description),
  }));
  for (let i = 0; i < descriptions.length; i++)
    for (let j = i + 1; j < descriptions.length; j++) {
      const a = descriptions[i];
      const b = descriptions[j];
      const similarity = jaccard(a.tokens, b.tokens);
      if (similarity > stats.maxDescriptionSimilarity)
        stats.maxDescriptionSimilarity = similarity;
      if (
        a.course.description.trim().toLowerCase() ===
        b.course.description.trim().toLowerCase()
      )
        fail(
          `Exact duplicate description: ${a.course.id} and ${b.course.id}`,
        );
      if (similarity >= nearDuplicateThreshold) {
        const pair = {
          a: a.course.id,
          b: b.course.id,
          similarity: Math.round(similarity * 10000) / 10000,
          crossSplit: a.course.split !== b.course.split,
        };
        stats.nearDuplicatePairs.push(pair);
        fail(
          `Near-duplicate descriptions ${pair.a}/${pair.b} (${pair.similarity})` +
            (pair.crossSplit ? " across splits" : ""),
        );
      }
    }
  stats.maxDescriptionSimilarity =
    Math.round(stats.maxDescriptionSimilarity * 10000) / 10000;

  // Informational only: non-target, non-decoy modules with high lexical overlap
  // but a no_match label. These are not failures; they are the cases retrieval
  // metrics (which only score positives) cannot reward or penalize directly.
  for (const course of courses) {
    const courseTokens = words(course.description);
    for (const module of modules) {
      const label = labelMap.get(course.id + "\0" + module.id);
      if (!label || label.decision !== "no_match") continue;
      if (
        module.id === course.targetModuleId ||
        module.id === course.decoyModuleId
      )
        continue;
      if (jaccard(courseTokens, words(module.description)) >= 0.35)
        stats.potentialAmbiguities++;
    }
  }

  if (stats.nearDuplicatePairs.length > 0)
    warnings.push(
      `${stats.nearDuplicatePairs.length} description pair(s) meet the near-duplicate threshold.`,
    );

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const path = process.argv[2] || "eval/data/benchmark-v2.json";
  const data = JSON.parse(await readFile(path, "utf8"));
  const result = validateBenchmark(data);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
