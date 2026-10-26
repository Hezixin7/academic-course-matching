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
test("deterministic edits split and reallocate credits without embedding calls or double counting", () => {
  const courses = cs(),
    mods = DEMO.requirements;
  const edges = [
    { id: "a", courseId: "CS101", moduleId: "CS", ects: 4, status: "pending" },
    {
      id: "b",
      courseId: "CS101",
      moduleId: "MATH",
      ects: 2,
      status: "confirmed",
    },
    {
      id: "c",
      courseId: "MA101",
      moduleId: "MATH",
      ects: 7.5,
      status: "pending",
    },
  ];
  const t = calculate(courses, mods, edges, 1.5);
  assert.equal(t.totals.CS101, 6);
  assert.equal(t.allocated, 13.5);
  assert.equal(t.confirmed, 2);
  assert.equal(t.modules.MATH.allocated, 9.5);
  const edited = edges.map((e) => (e.id === "a" ? { ...e, ects: 3.25 } : e));
  const after = calculate(courses, mods, edited, 1.5);
  assert.equal(after.allocated, 12.75);
  assert.equal(after.unallocated, t.unallocated + 0.75);
  assert.equal(after.modules.CS.allocated, 3.25);
  assert.throws(
    () =>
      calculate(courses, mods, [
        ...edges,
        {
          id: "x",
          courseId: "CS101",
          moduleId: "STAT",
          ects: 0.01,
          status: "pending",
        },
      ]),
    /超过可用/,
  );
  assert.throws(
    () =>
      calculate(courses, mods, [
        ...edges,
        {
          id: "x",
          courseId: "CS101",
          moduleId: "CS",
          ects: 0,
          status: "pending",
        },
      ]),
    /只能保留/,
  );
  assert.throws(
    () => calculate(courses, mods, [{ ...edges[0], ects: NaN }]),
    /非负数/,
  );
  assert.throws(
    () => calculate(courses, mods, [{ ...edges[0], ects: 2.001 }]),
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
