import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { resolve } from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { createClassifier } from "../server/classifier.mjs";
import { DEMO, toCSV, matchCourses } from "../src/core.js";
const w = new Window({ url: "https://academic-course-matching-copilot.test" });
w.document.body.innerHTML =
  '<div id="app"></div><dialog id="editor"></dialog><div id="toast"></div>';
for (const k of [
  "window",
  "document",
  "localStorage",
  "Blob",
  "File",
  "URL",
  "Event",
  "HTMLElement",
  "CustomEvent",
])
  globalThis[k] = k === "window" ? w : w[k];
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
let created = 0;
let model;
env.allowRemoteModels = false;
env.localModelPath = resolve("dist/models") + "/";
class LocalTestWorker {
  constructor() {
    created++;
  }
  postMessage(data) {
    Promise.resolve()
      .then(async () => {
        model ||= await pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2",
          { dtype: "q8", device: "cpu" },
        );
        const result = await matchCourses(
          data.courses,
          data.modules,
          async (t) =>
            (await model(t, { pooling: "mean", normalize: true })).tolist(),
          data.factor,
        );
        this.onmessage({ data: { type: "result", result } });
      })
      .catch((error) => this.onerror?.(error));
  }
  terminate() {}
}
globalThis.Worker = LocalTestWorker;
const $ = (s) => w.document.querySelector(s);
const click = (s) => {
  assert($(s), "missing " + s);
  $(s).click();
};
const waitFor = async (p) => {
  for (let i = 0; i < 300; i++) {
    if (p()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Timed out waiting for UI state");
};
const saved = () => JSON.parse(localStorage.getItem("coursewise.v2"));
let llmCalls = 0;
const classifier = createClassifier({
  config: {
    baseURL: "https://fixture.example",
    apiKey: "integration-only-test-key",
    model: "integration-fixture",
    maxAttempts: 2,
    maxTokens: 4096,
    timeoutMs: 1000,
  },
  fetchImpl: async (url, options) => {
    const request = JSON.parse(JSON.parse(options.body).messages[1].content);
    const answer = {
      course_id: request.course.id,
      assessments: request.modules.map((m, i) => ({
        module_id: m.id,
        decision: i === 0 ? "match" : i === 2 ? "partial" : "no_match",
        reason: "集成测试提供的固定模型响应，仅用于验证流程。",
        course_quote: i === 1 ? "" : request.course.description,
        requirement_quote: i === 1 ? "" : m.description,
        missing_topics: i === 2 ? ["部分主题尚需人工核实"] : [],
      })),
    };
    return new Response(
      JSON.stringify({
        model: "integration-fixture",
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(answer) },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
      { status: 200 },
    );
  },
});
globalThis.fetch = async (url, options) => {
  if (url === "/api/status")
    return new Response(JSON.stringify(classifier.status()), { status: 200 });
  if (url === "/api/classify") {
    llmCalls++;
    return new Response(
      JSON.stringify(await classifier.classify(JSON.parse(options.body))),
      { status: 200 },
    );
  }
  throw new Error("Unexpected UI network request: " + url);
};
await import("../dist/app.js");
test("real upload -> parse -> match -> evidence -> edit -> confirm -> export, with no model rerun on edits", async () => {
  await waitFor(() => $("#app").textContent.includes("integration-fixture"));
  assert.match($("#app").textContent, /让每一份学分/);
  assert($('[data-action="match"]').disabled);
  // Drive actual file inputs and their File.text() path for all three user documents.
  for (const type of ["transcript", "descriptions", "requirements"]) {
    const file = new w.File([toCSV(DEMO[type], type)], type + ".csv", {
      type: "text/csv",
    });
    const transfer = new w.DataTransfer();
    transfer.items.add(file);
    const input = $("#upload-" + type);
    input.files = transfer.files;
    input.dispatchEvent(new w.Event("change", { bubbles: true }));
    await waitFor(() => $("#editor").open);
    assert($("#source-text").value.includes(DEMO[type][0].id));
    click('[data-action="apply-source"]');
    assert(!$("#editor").open);
    assert.equal(saved().sources[type].rows.length, DEMO[type].length);
  }
  assert(!$('[data-action="match"]').disabled);
  click('[data-action="match"]');
  await waitFor(() => saved().hasRun);
  assert.equal(created, 1);
  assert.equal(saved().edges.length, 16);
  assert.equal(llmCalls, 8);
  assert.equal(saved().runInfo.validatedCount, 24);
  click('[data-action="evidence"]');
  assert($(".evidence-row").textContent.includes("课程描述"));
  assert($(".evidence-row blockquote").textContent.length > 30);
  const input = $("[data-ects]");
  const old = Number(input.value);
  // A partial allocation is rejected; the previous full budget is retained.
  input.value = String(old - 0.5);
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  assert.equal(saved().edges[0].ects, old);
  assert.match($("#toast").textContent, /只能分配 0 或/);
  assert.equal(created, 1);
  // Full -> unallocated -> full is a valid deterministic manual edit.
  const allocate = (value) => {
    const field = $("[data-ects]");
    field.value = String(value);
    field.dispatchEvent(new w.Event("change", { bubbles: true }));
  };
  allocate(0);
  assert.equal(saved().edges[0].ects, 0);
  assert.equal(created, 1);
  allocate(old);
  assert.equal(saved().edges[0].ects, old);
  assert.equal(created, 1);
  click('[data-action="confirm"]');
  assert.equal(saved().edges[0].status, "confirmed");
  assert.match($("#app").textContent, /已确认学分/);
  assert.equal(created, 1);
  // Excess allocation must reject and retain previous value.
  const excess = $("[data-ects]");
  const stable = saved().edges[0].ects;
  excess.value = "900";
  excess.dispatchEvent(new w.Event("change", { bubbles: true }));
  assert.equal(saved().edges[0].ects, stable);
  assert.match($("#toast").textContent, /超过可用/);
  // Lower the conversion factor: deterministic full-budget scaling, no model call, review reset.
  const factor = $("#credit-factor");
  factor.value = "1";
  factor.dispatchEvent(new w.Event("change", { bubbles: true }));
  assert.equal(saved().factor, 1);
  assert(saved().edges.every((e) => e.status === "pending"));
  assert.equal(created, 1);
  // Reassign to a module that currently has a zero-ECTS candidate edge:
  // full budget and evidence move, and the duplicate zero edge is removed.
  const select = $("[data-module]");
  const firstId = select.dataset.module;
  const firstEdge = saved().edges.find((e) => e.id === firstId);
  const zeroPeer = saved().edges.find(
    (e) => e.courseId === firstEdge.courseId && e.ects === 0,
  );
  const target = DEMO.requirements.find((m) => m.id === zeroPeer.moduleId);
  const edgeCountBefore = saved().edges.length;
  select.value = target.id;
  select.dispatchEvent(new w.Event("change", { bubbles: true }));
  const moved = saved().edges.find((e) => e.id === firstId);
  assert.equal(moved.moduleId, target.id);
  assert.equal(moved.requirementEvidence, target.description);
  assert.equal(
    moved.ects,
    DEMO.transcript.find((c) => c.id === moved.courseId).credits,
  );
  assert(!saved().edges.some((e) => e.id === zeroPeer.id));
  assert.equal(saved().edges.length, edgeCountBefore - 1);
  assert.equal(created, 1);
  // Splitting a course across target modules is rejected in the UI.
  const beforeAdd = saved().edges.length;
  click('[data-action="add"]');
  $("#add-course").value = "CS101";
  $("#add-module").value = DEMO.requirements.find(
    (m) =>
      !saved().edges.some((e) => e.courseId === "CS101" && e.moduleId === m.id),
  ).id;
  $("#add-ects").value = ".25";
  $("#add-note").value = "Manual check of the uploaded syllabus";
  click('[data-action="save-add"]');
  assert.match($("#add-error").textContent, /多个目标模块/);
  assert.equal(saved().edges.length, beforeAdd);
  assert(!saved().edges.some((e) => e.note.includes("Manual check")));
  assert.equal(created, 1);
  $("#editor").close();
  // Removing an unallocated edge keeps allocated credit unchanged.
  const allocatedBefore = saved().edges
    .filter((e) => e.ects > 0)
    .reduce((sum, e) => sum + e.ects, 0);
  const zeroEdge = saved().edges.find((e) => e.ects === 0);
  click(`[data-action="remove"][data-id="${zeroEdge.id}"]`);
  assert(!saved().edges.some((e) => e.id === zeroEdge.id));
  assert.equal(
    saved().edges
      .filter((e) => e.ects > 0)
      .reduce((sum, e) => sum + e.ects, 0),
    allocatedBefore,
  );
  assert.equal(created, 1);
  // Export artifacts contain evidence, statuses, credit rule and all current changes.
  const blobs = [];
  w.URL.createObjectURL = (b) => {
    blobs.push(b);
    return "blob:test";
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = () => {};
  click('[data-action="nav"][data-view="report"]');
  assert($(".report-details"));
  click('[data-action="export-json"]');
  click('[data-action="export-report"]');
  assert.equal(blobs.length, 2);
  const json = JSON.parse(await blobs[0].text());
  assert.equal(json.creditRule.factor, 1);
  assert(json.allocations[0].evidence);
  assert.equal(json.allocations[0].requirementEvidence, target.description);
  const html = await blobs[1].text();
  assert(html.includes("课程匹配与学分分配报告"));
  assert(html.includes("ECTS"));
  assert.equal(created, 1);
  assert.equal(
    llmCalls,
    8,
    "edits, confirmations and exports must never re-call the LLM",
  );
  assert(json.llmAssessments.length === 24);
  assert(!JSON.stringify(json).includes("integration-only-test-key"));
  await model.dispose();
  w.happyDOM.abort();
});
