import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInput,
  toCSV,
  joinCourses,
  calculate,
  matchCourses,
  DEMO,
} from "../src/core.js";
const cs = () => joinCourses(DEMO.transcript, DEMO.descriptions);
test("uploaded CSV and JSON preserve description commas, quotes, multilingual names and credits", () => {
  for (const type of ["transcript", "descriptions", "requirements"])
    assert.deepEqual(
      parseInput(toCSV(DEMO[type], type), type).map(
        ({ source, ...row }) => row,
      ),
      DEMO[type],
    );
  const r = parseInput(
    'id,name,description\nA,"有逗号的课程","Mathematics, vectors and \"\"matrix\"\" operations"',
    "descriptions",
  );
  assert.equal(
    r[0].description,
    'Mathematics, vectors and "matrix" operations',
  );
  assert.equal(
    parseInput(JSON.stringify(DEMO.transcript), "transcript").length,
    8,
  );
  assert.throws(
    () => parseInput("id,name,credits\nA,Test,\n", "transcript"),
    /学分无效/,
  );
  assert.throws(
    () => parseInput("id,name,description\nA,Test,\n", "descriptions"),
    /描述/,
  );
  assert.throws(
    () => parseInput("id,name,credits\nA,One,4\nA,Two,2", "transcript"),
    /重复/,
  );
});
test("deterministic edits enforce single-module, full-course allocation without double counting", () => {
  const courses = cs(),
    mods = DEMO.requirements;
  // One course per target module, each allocated in full.
  const edges = [
    { id: "a", courseId: "CS101", moduleId: "CS", ects: 6, status: "pending" },
    {
      id: "b",
      courseId: "MA101",
      moduleId: "MATH",
      ects: 7.5,
      status: "confirmed",
    },
  ];
  const t = calculate(courses, mods, edges, 1.5);
  assert.equal(t.totals.CS101, 6);
  assert.equal(t.totals.MA101, 7.5);
  assert.equal(t.allocated, 13.5);
  assert.equal(t.confirmed, 7.5);
  assert.equal(t.modules.CS.allocated, 6);
  assert.equal(t.modules.MATH.allocated, 7.5);
  assert.equal(t.modules.MATH.confirmed, 7.5);
  assert.equal(t.pending, 1);
  // Credit conservation: allocated + unallocated = available.
  assert.equal(t.allocated + t.unallocated, t.available);
  // Manual module reassignment is allowed while keeping the full course budget.
  const reassigned = edges.map((e) =>
    e.id === "a" ? { ...e, moduleId: "STAT" } : e,
  );
  const moved = calculate(courses, mods, reassigned, 1.5);
  assert.equal(moved.totals.CS101, 6);
  assert.equal(moved.modules.CS.allocated, 0);
  assert.equal(moved.modules.STAT.allocated, 6);
  assert.equal(moved.allocated, t.allocated);
  // A course may stay unallocated (0) and can be allocated in full again.
  const cleared = edges.map((e) => (e.id === "a" ? { ...e, ects: 0 } : e));
  const zeroed = calculate(courses, mods, cleared, 1.5);
  assert.equal(zeroed.totals.CS101, 0);
  assert.equal(zeroed.allocated, 7.5);
  assert.equal(zeroed.unallocated, t.unallocated + 6);
  assert.equal(calculate(courses, mods, edges, 1.5).allocated, t.allocated);
  // Splitting one course across two target modules is rejected.
  assert.throws(
    () =>
      calculate(courses, mods, [
        { ...edges[0], ects: 4 },
        {
          id: "split",
          courseId: "CS101",
          moduleId: "MATH",
          ects: 2,
          status: "pending",
        },
      ], 1.5),
    /多个目标模块/,
  );
  // Partial allocation of a course is rejected.
  assert.throws(
    () => calculate(courses, mods, [{ ...edges[0], ects: 5.5 }], 1.5),
    /只能分配 0 或 6/,
  );
  // Duplicate edges and exceeding the course budget are rejected.
  assert.throws(
    () =>
      calculate(courses, mods, [edges[0], { ...edges[0], id: "dup" }], 1.5),
    /只能保留/,
  );
  assert.throws(
    () => calculate(courses, mods, [{ ...edges[0], ects: 6.01 }], 1.5),
    /超过可用/,
  );
  // Invalid amounts remain rejected.
  assert.throws(
    () => calculate(courses, mods, [{ ...edges[0], ects: NaN }], 1.5),
    /非负数/,
  );
  assert.throws(
    () => calculate(courses, mods, [{ ...edges[0], ects: 6.001 }], 1.5),
    /两位小数/,
  );
  assert.equal(calculate(courses, mods, [], 1).available, 28);
});
test("retrieval embeds descriptions rather than names and keeps exact source evidence", async () => {
  const seen = [];
  const courses = [
    {
      id: "X",
      name: "Misleading course title: Art History",
      credits: 3,
      description: "Linear algebra vector spaces matrices and eigenvalues.",
      descriptionSource: "syllabus.pdf · page 2",
    },
  ];
  const modules = [
    {
      id: "Y",
      name: "Mathematics",
      required_ects: 4,
      description: "Matrix theory and linear algebra vectors.",
    },
  ];
  const r = await matchCourses(courses, modules, async (text) => {
    seen.push(...text);
    return text.map(() => [1, 0, 1]);
  });
  assert(seen.every((x) => !x.includes("Art History")));
  assert(seen.some((x) => x.includes("eigenvalues")));
  assert.equal(r.candidates[0].source, "syllabus.pdf · page 2");
  assert(courses[0].description.includes(r.candidates[0].evidence));
  assert.equal(r.edges.length, 0);
});
