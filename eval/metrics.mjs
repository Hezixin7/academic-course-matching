const positive = (d) => ["match", "partial"].includes(d);
export function retrievalMetrics(rankings, labels, k = 3) {
  const byCourse = new Map();
  for (const l of labels)
    if (positive(l.decision)) {
      if (!byCourse.has(l.courseId)) byCourse.set(l.courseId, new Set());
      byCourse.get(l.courseId).add(l.moduleId);
    }
  let recall = 0,
    rr = 0,
    hit = 0;
  for (const [id, gold] of byCourse) {
    const ranked = rankings[id] || [];
    const top = ranked.slice(0, k);
    recall += top.filter((x) => gold.has(x.moduleId)).length / gold.size;
    const position = top.findIndex((x) => gold.has(x.moduleId));
    if (position >= 0) rr += 1 / (position + 1);
    if (top.some((x) => gold.has(x.moduleId))) hit++;
  }
  const n = byCourse.size;
  return {
    k,
    eligibleCourses: n,
    macroRecallAtK: n ? recall / n : 0,
    hitRateAtK: n ? hit / n : 0,
    mrr: n ? rr / n : 0,
  };
}
export function classificationMetrics(gold, predicted) {
  const map = new Map(
    predicted.map((p) => [p.courseId + "\0" + p.moduleId, p.decision]),
  );
  const classes = ["match", "partial", "no_match", "insufficient_evidence"];
  const confusion = Object.fromEntries(classes.map((c) => [c, {}]));
  let correct = 0,
    tp = 0,
    fp = 0,
    fn = 0,
    abstained = 0;
  const counts = Object.fromEntries(
    classes.map((c) => [c, { tp: 0, fp: 0, fn: 0, support: 0 }]),
  );
  for (const row of gold) {
    const decision =
      map.get(row.courseId + "\0" + row.moduleId) || "needs_review";
    confusion[row.decision][decision] =
      (confusion[row.decision][decision] || 0) + 1;
    counts[row.decision].support++;
    if (decision === row.decision) {
      correct++;
      counts[row.decision].tp++;
    } else {
      counts[row.decision].fn++;
      if (counts[decision]) counts[decision].fp++;
    }
    if (!classes.includes(decision)) abstained++;
    if (positive(row.decision) && positive(decision)) tp++;
    else if (!positive(row.decision) && positive(decision)) fp++;
    else if (positive(row.decision) && !positive(decision)) fn++;
  }
  const div = (a, b) => (b ? a / b : 0);
  const perClass = Object.fromEntries(
    Object.entries(counts).map(([c, v]) => [
      c,
      {
        ...v,
        precision: div(v.tp, v.tp + v.fp),
        recall: div(v.tp, v.tp + v.fn),
        f1: div(2 * v.tp, 2 * v.tp + v.fp + v.fn),
      },
    ]),
  );
  const supported = Object.values(perClass).filter((v) => v.support);
  return {
    pairs: gold.length,
    accuracy: div(correct, gold.length),
    macroF1: div(
      supported.reduce((n, v) => n + v.f1, 0),
      supported.length,
    ),
    abstained,
    positivePrecision: div(tp, tp + fp),
    positiveRecall: div(tp, tp + fn),
    positiveF1: div(2 * tp, 2 * tp + fp + fn),
    confusion,
    perClass,
  };
}
