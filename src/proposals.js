import { round, calculate } from "./core.js";
export const verdictLabel = {
  match: "内容匹配",
  partial: "部分匹配",
  no_match: "不匹配",
  insufficient_evidence: "证据不足",
  needs_review: "校验未通过",
  not_run: "未进行 LLM 判定",
  manual: "人工指定",
};
export function buildAllocations(
  courses,
  modules,
  candidates,
  assessments,
  factor = 1.5,
) {
  const edges = [];
  for (const course of courses) {
    const accepted = assessments.filter(
      (a) =>
        a.courseId === course.id &&
        a.validation?.valid &&
        ["match", "partial"].includes(a.decision),
    );
    const full = accepted.filter((a) => a.decision === "match");
    for (const [index, a] of accepted.entries()) {
      const module = modules.find((m) => m.id === a.moduleId);
      if (!module) continue;
      const candidate = candidates.find(
        (c) => c.courseId === course.id && c.moduleId === a.moduleId,
      );
      edges.push({
        id: `llm-${course.id}-${index}`,
        courseId: course.id,
        moduleId: a.moduleId,
        score: candidate?.score ?? null,
        ects:
          a.decision === "match" && full.length === 1
            ? round(course.credits * factor)
            : 0,
        status: "pending",
        manual: false,
        note: "",
        evidence: a.courseQuote,
        requirementEvidence: a.requirementQuote,
        source: course.descriptionSource,
        requirementSource: module.source,
        llmDecision: a.decision,
        llmReason: a.reason,
        missingTopics: a.missingTopics,
        validation: a.validation,
        modelTraceId: a.requestId,
      });
    }
  }
  calculate(courses, modules, edges, factor);
  return edges;
}
