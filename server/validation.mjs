export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
function keys(x, allowed) {
  return (
    object(x) &&
    Object.keys(x).every((k) => allowed.includes(k)) &&
    allowed.every((k) => Object.hasOwn(x, k))
  );
}
function text(x, min, max) {
  return typeof x === "string" && x.trim().length >= min && x.length <= max;
}
export function validateRequest(input) {
  if (!keys(input, ["course", "modules"]))
    throw new AppError("INVALID_INPUT", "请求只应包含 course 和 modules。");
  function record(row) {
    if (
      !keys(row, ["id", "name", "description"]) ||
      !text(row.id, 1, 100) ||
      !text(row.name, 1, 200) ||
      !text(row.description, 8, 8000)
    )
      throw new AppError(
        "INVALID_INPUT",
        "编号、名称或描述无效；描述限制为 8–8000 字符。",
      );
    return { id: row.id, name: row.name, description: row.description };
  }
  const course = record(input.course);
  if (
    !Array.isArray(input.modules) ||
    input.modules.length < 1 ||
    input.modules.length > 8
  )
    throw new AppError("INVALID_INPUT", "每次仅接受 1–8 个候选模块。");
  const modules = input.modules.map(record);
  if (new Set(modules.map((m) => m.id)).size !== modules.length)
    throw new AppError("INVALID_INPUT", "候选模块编号不能重复。");
  return { course, modules };
}
// 只有四种匹配结果
export const DECISIONS = [
  "match",
  "partial",
  "no_match",
  "insufficient_evidence",
];
const normalize = (value) => value.replace(/\s+/g, " ").trim();
function citationValid(quote, source, required) {
  if (!text(quote, 0, 800)) return false;
  if (!quote.trim()) return !required;
  return (
    quote.trim().length >= 8 && normalize(source).includes(normalize(quote))
  );
}
export function reviewOnly(input, code, reason) {
  return input.modules.map((m) => ({
    courseId: input.course.id,
    moduleId: m.id,
    decision: "needs_review",
    reason,
    courseQuote: "",
    requirementQuote: "",
    missingTopics: [],
    validation: { valid: false, codes: [code] },
  }));
}
export function validateOutput(content, input) {
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return reviewOnly(
      input,
      "INVALID_JSON",
      "模型未返回可解析的 JSON，需人工复核。",
    );
  }
  if (
    !keys(data, ["course_id", "assessments"]) ||
    data.course_id !== input.course.id ||
    !Array.isArray(data.assessments) ||
    data.assessments.length !== input.modules.length
  )
    return reviewOnly(
      input,
      "INVALID_SCHEMA",
      "模型响应结构或课程编号不符合契约。",
    );
  const ids = data.assessments.map((a) => a?.module_id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !input.modules.some((m) => m.id === id))
  )
    return reviewOnly(input, "INVALID_SCHEMA", "模型返回了重复或未知模块。");
  return input.modules.map((module) => {
    const a = data.assessments.find((x) => x.module_id === module.id);
    const codes = [];
    if (
      !keys(a, [
        "module_id",
        "decision",
        "reason",
        "course_quote",
        "requirement_quote",
        "missing_topics",
      ]) ||
      !DECISIONS.includes(a.decision) ||
      !text(a.reason, 4, 1600) ||
      !Array.isArray(a.missing_topics) ||
      a.missing_topics.length > 12 ||
      a.missing_topics.some((x) => !text(x, 1, 200))
    )
      return reviewOnly(
        { course: input.course, modules: [module] },
        "INVALID_SCHEMA",
        "该候选的字段、判断值或理由格式无效。",
      )[0];
    // 如果匹配要能在原文中定位, 不然就人工核验
    const positive = ["match", "partial"].includes(a.decision);
    if (!citationValid(a.course_quote, input.course.description, positive))
      codes.push("INVALID_COURSE_QUOTE");
    if (!citationValid(a.requirement_quote, module.description, positive))
      codes.push("INVALID_REQUIREMENT_QUOTE");
    return {
      courseId: input.course.id,
      moduleId: module.id,
      decision: codes.length ? "needs_review" : a.decision,
      reason: codes.length
        ? "模型引用未能通过原文校验，请人工复核。"
        : a.reason,
      courseQuote: codes.length ? "" : a.course_quote,
      requirementQuote: codes.length ? "" : a.requirement_quote,
      missingTopics: a.missing_topics,
      validation: { valid: codes.length === 0, codes },
    };
  });
}
