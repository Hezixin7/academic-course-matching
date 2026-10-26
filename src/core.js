export const round = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const fmt = (n) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const normalizeId = (x) =>
  String(x ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
export const headers = {
  transcript: ["id", "name", "credits"],
  descriptions: ["id", "name", "description"],
  requirements: ["id", "name", "required_ects", "description"],
};
const aliases = {
  id: [
    "id",
    "course_id",
    "module_id",
    "code",
    "课程编号",
    "课程代码",
    "编号",
    "模块编号",
  ],
  name: [
    "name",
    "course",
    "course_name",
    "module",
    "module_name",
    "课程名称",
    "课程名",
    "模块名称",
    "模块",
    "名称",
  ],
  credits: ["credits", "credit", "学分", "原始学分", "ects"],
  description: [
    "description",
    "content",
    "syllabus",
    "课程描述",
    "课程内容",
    "描述",
    "要求",
    "内容",
    "learning_outcomes",
  ],
  required_ects: [
    "required_ects",
    "required",
    "minimum_ects",
    "ects",
    "credits",
    "所需学分",
    "要求学分",
    "最低学分",
    "学分",
  ],
};
export function csvRows(input) {
  const rows = [];
  let row = [],
    field = "",
    quote = false;
  for (let i = 0; i < input.length; i++) {
    let c = input[i];
    if (c === '"') {
      if (quote && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quote = !quote;
    } else if (!quote && (c === "," || c === "\t" || c === "|")) {
      row.push(field.trim());
      field = "";
    } else if (!quote && (c === "\n" || c === "\r")) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quote) throw new Error("有未闭合的引号，请检查 CSV 格式。");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
const getField = (row, k) => {
  const key = Object.keys(row).find((t) =>
    aliases[k].includes(
      t
        .toLowerCase()
        .trim()
        .replace(/^\uFEFF/, ""),
    ),
  );
  return key === undefined ? "" : row[key];
};
export function parseInput(text, type, source = "手动输入") {
  text = text.trim().replace(/^\uFEFF/, "");
  if (!text) throw new Error("内容为空，请上传文件或粘贴文本。");
  let objects;
  if (text.startsWith("[") || text.startsWith("{")) {
    const j = JSON.parse(text);
    objects = Array.isArray(j)
      ? j
      : j[type] || j.courses || j.modules || j.rows;
    if (!Array.isArray(objects)) throw new Error("JSON 应为对象数组。");
  } else {
    let rows = csvRows(text);
    if (rows[0]?.length === 1) {
      rows = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.trim().split(/\s{2,}/));
    }
    if (!rows.length) throw new Error("未找到数据行。");
    const known = rows[0].some((x) =>
      Object.values(aliases).flat().includes(x.toLowerCase()),
    );
    const cols = known ? rows.shift() : headers[type];
    objects = rows.map((r) =>
      Object.fromEntries(cols.map((k, i) => [k, r[i] ?? ""])),
    );
  }
  if (!objects.length) throw new Error("只找到表头，没有数据行。");
  const ids = new Set();
  const result = objects.map((r, i) => {
    const name = String(getField(r, "name")).trim();
    const id = String(getField(r, "id") || name).trim();
    if (!id) throw new Error(`第 ${i + 1} 行缺少编号或名称。`);
    if (ids.has(normalizeId(id)))
      throw new Error(`编号 ${id} 重复，请合并或修改。`);
    ids.add(normalizeId(id));
    const item = {
      id,
      name: name || id,
      source: `${source} · 数据行 ${i + 1}`,
    };
    if (type === "transcript" || type === "requirements") {
      const key = type === "transcript" ? "credits" : "required_ects";
      const raw = String(getField(r, key)).trim();
      const num = Number(raw);
      if (!raw || !Number.isFinite(num) || num < 0 || num > 500)
        throw new Error(`${id} 的学分无效，请填写 0–500 之间的数字。`);
      item[key] = num;
    }
    if (type !== "transcript") {
      item.description = String(getField(r, "description")).trim();
      if (item.description.length < 8)
        throw new Error(
          `${id} 缺少有效描述（至少 8 个字符）。匹配需要课程内容，不能只有名称。`,
        );
    }
    return item;
  });
  if (result.length > 150)
    throw new Error("最小版本每份资料最多支持 150 行，请拆分后上传。");
  return result;
}
export function toCSV(rows, type) {
  return [
    headers[type],
    ...rows.map((r) => headers[type].map((k) => r[k] ?? "")),
  ]
    .map((row) =>
      row.map((x) => '"' + String(x).replaceAll('"', '""') + '"').join(","),
    )
    .join("\n");
}
export function joinCourses(transcript, descriptions) {
  const map = new Map(descriptions.map((d) => [normalizeId(d.id), d]));
  const byName = new Map(descriptions.map((d) => [normalizeId(d.name), d]));
  return transcript.map((c) => {
    const d = map.get(normalizeId(c.id)) || byName.get(normalizeId(c.name));
    return {
      ...c,
      description: d?.description || "",
      descriptionSource: d?.source || "",
    };
  });
}
export const glossary = [
  [
    /线性代数|lineare algebra/gi,
    " linear algebra matrices vectors eigenvalues ",
  ],
  [
    /微积分|高等数学|differentialrechnung/gi,
    " calculus differentiation integration ",
  ],
  [/概率|wahrscheinlichkeit/gi, " probability random variables distributions "],
  [/统计|statistik/gi, " statistics estimation hypothesis regression "],
  [
    /机器学习|maschinelles lernen/gi,
    " machine learning supervised learning classification regression ",
  ],
  [/数据结构|datenstrukturen/gi, " data structures trees graphs hash tables "],
  [/算法|algorithmen/gi, " algorithms complexity sorting searching "],
  [
    /编程|程序设计|programmierung/gi,
    " programming functions objects debugging ",
  ],
  [/数据库|datenbanken/gi, " databases relational SQL queries transactions "],
  [
    /操作系统|betriebssysteme/gi,
    " operating systems processes memory concurrency ",
  ],
  [/计算机网络|rechnernetze/gi, " computer networks protocols routing TCP IP "],
  [
    /软件工程|softwaretechnik/gi,
    " software engineering testing requirements design ",
  ],
  [/优化|optimierung/gi, " optimization gradient descent convex "],
  [
    /离散数学|diskrete mathematik/gi,
    " discrete mathematics logic combinatorics graphs ",
  ],
  [
    /深度学习|tiefes lernen/gi,
    " deep learning neural networks backpropagation ",
  ],
  [
    /人工智能|künstliche intelligenz/gi,
    " artificial intelligence search reasoning ",
  ],
  [/数值|numerisch/gi, " numerical methods "],
  [
    /研究方法|wissenschaftliche methoden/gi,
    " research methods experimental design evaluation ",
  ],
];
export function semanticText(text) {
  let extra = "";
  for (const [re, en] of glossary) {
    re.lastIndex = 0;
    if (re.test(text)) extra += en;
    re.lastIndex = 0;
  }
  return text + "\n" + extra;
}
export function chunks(text) {
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?]?/g) || [text];
  const out = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > 650 && current) {
      out.push(current.trim());
      current = "";
    }
    if (sentence.length > 650) {
      if (current) out.push(current.trim());
      current = "";
      for (let i = 0; i < sentence.length; i += 600)
        out.push(sentence.slice(i, i + 650));
    } else current += " " + sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out.slice(0, 8);
}
export function cosine(a, b) {
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
function mean(vectors) {
  const a = new Array(vectors[0].length).fill(0);
  for (const v of vectors)
    for (let i = 0; i < a.length; i++) a[i] += v[i] / vectors.length;
  return a;
}
export async function matchCourses(
  courses,
  modules,
  embed,
  factor = 1.5,
  onProgress = () => {},
) {
  const texts = [];
  const ranges = [];
  for (const row of [...courses, ...modules]) {
    const parts = chunks(row.description);
    const start = texts.length;
    texts.push(...parts.map(semanticText));
    ranges.push({ start, count: parts.length, parts });
  }
  onProgress("正在将课程描述转换为语义向量…");
  const vectors = await embed(texts);
  const means = ranges.map((r) =>
    mean(vectors.slice(r.start, r.start + r.count)),
  );
  const edges = [];
  const candidates = [];
  for (let i = 0; i < courses.length; i++) {
    if (!courses[i].description) continue;
    const ranked = modules
      .map((m, j) => {
        const ri = ranges[i],
          rj = ranges[courses.length + j];
        let best = { score: -1, course: "", requirement: "" };
        for (let a = 0; a < ri.count; a++)
          for (let b = 0; b < rj.count; b++) {
            const score = cosine(vectors[ri.start + a], vectors[rj.start + b]);
            if (score > best.score)
              best = { score, course: ri.parts[a], requirement: rj.parts[b] };
          }
        return {
          courseId: courses[i].id,
          moduleId: m.id,
          score: Math.max(0, cosine(means[i], means[courses.length + j])),
          evidence: best.course,
          requirementEvidence: best.requirement,
          source: courses[i].descriptionSource,
          requirementSource: m.source,
        };
      })
      .sort((a, b) => b.score - a.score);
    candidates.push(...ranked.slice(0, 3));
  }
  return { edges, candidates };
}
export function calculate(courses, modules, edges, factor = 1.5) {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 10)
    throw new Error("换算系数必须大于 0 且不超过 10。");
  const totals = new Map(courses.map((c) => [c.id, 0]));
  const modTotals = new Map(
    modules.map((m) => [m.id, { allocated: 0, confirmed: 0 }]),
  );
  const pairs = new Set();
  for (const edge of edges) {
    if (!totals.has(edge.courseId) || !modTotals.has(edge.moduleId))
      throw new Error("匹配引用了不存在的课程或模块。");
    const pair = edge.courseId + "\0" + edge.moduleId;
    if (pairs.has(pair))
      throw new Error("同一课程到同一模块只能保留一条匹配。");
    pairs.add(pair);
    if (
      !Number.isFinite(edge.ects) ||
      edge.ects < 0 ||
      Math.abs(edge.ects - round(edge.ects)) > 0.000001
    )
      throw new Error("分配学分必须为非负数，最多两位小数。");
    totals.set(edge.courseId, round(totals.get(edge.courseId) + edge.ects));
    const m = modTotals.get(edge.moduleId);
    m.allocated = round(m.allocated + edge.ects);
    if (edge.status === "confirmed")
      m.confirmed = round(m.confirmed + edge.ects);
  }
  for (const c of courses) {
    const budget = round(c.credits * factor);
    if (totals.get(c.id) > budget + 0.00001)
      throw new Error(
        `${c.name} 已分配 ${fmt(totals.get(c.id))} ECTS，超过可用 ${fmt(budget)} ECTS。请先减少其他分配。`,
      );
  }
  const available = round(
    courses.reduce((s, c) => s + round(c.credits * factor), 0),
  );
  const allocated = round([...totals.values()].reduce((a, b) => a + b, 0));
  return {
    available,
    allocated,
    unallocated: round(available - allocated),
    confirmed: round(
      [...modTotals.values()].reduce((a, b) => a + b.confirmed, 0),
    ),
    totals: Object.fromEntries(totals),
    modules: Object.fromEntries(modTotals),
    pending: edges.filter((e) => e.status !== "confirmed").length,
  };
}
export const DEMO = {
  transcript: [
    { id: "CS101", name: "程序设计基础", credits: 4 },
    { id: "CS202", name: "数据结构与算法", credits: 4 },
    { id: "MA101", name: "高等数学", credits: 5 },
    { id: "MA202", name: "线性代数", credits: 3 },
    { id: "MA301", name: "概率论与数理统计", credits: 3 },
    { id: "CS301", name: "机器学习", credits: 3 },
    { id: "CS203", name: "数据库系统", credits: 3 },
    { id: "CS304", name: "软件工程", credits: 3 },
  ],
  descriptions: [
    {
      id: "CS101",
      name: "程序设计基础",
      description:
        "Programming in Python and C++. Variables, control flow, functions, recursion, object-oriented programming, debugging and unit testing. Students implement and test small software programs.",
    },
    {
      id: "CS202",
      name: "数据结构与算法",
      description:
        "Data structures and algorithms: arrays, linked lists, stacks, queues, trees, graphs and hash tables. Sorting, searching, graph traversal, dynamic programming and asymptotic time and space complexity.",
    },
    {
      id: "MA101",
      name: "高等数学",
      description:
        "Single and multivariable calculus. Limits, continuity, differentiation, partial derivatives, integration, infinite series and ordinary differential equations. Mathematical analysis and proof exercises.",
    },
    {
      id: "MA202",
      name: "线性代数",
      description:
        "Linear algebra: vector spaces, matrices, systems of linear equations, determinants, eigenvalues, eigenvectors, orthogonality and matrix decomposition. Applications of linear transformations.",
    },
    {
      id: "MA301",
      name: "概率论与数理统计",
      description:
        "Probability theory and mathematical statistics. Random variables, probability distributions, conditional probability, expectation, variance, sampling, parameter estimation, hypothesis testing and linear regression.",
    },
    {
      id: "CS301",
      name: "机器学习",
      description:
        "Machine learning and statistical learning: supervised classification and regression, model selection and cross-validation. Statistical estimation, probability distributions, optimization and gradient descent. Practical implementation of learning algorithms in Python.",
    },
    {
      id: "CS203",
      name: "数据库系统",
      description:
        "Relational databases and data management. Entity relationship modeling, relational algebra, SQL queries, normalization, transactions, indexing and database design. Implementation of a small database application.",
    },
    {
      id: "CS304",
      name: "软件工程",
      description:
        "Software engineering: requirements analysis, object-oriented software design, architecture, version control, unit and integration testing, agile development and collaborative software project implementation.",
    },
  ],
  requirements: [
    {
      id: "MATH",
      name: "数学基础",
      required_ects: 12,
      description:
        "Mathematical foundations including calculus, differentiation and integration, linear algebra, vector spaces, matrices, eigenvalues and mathematical analysis.",
    },
    {
      id: "STAT",
      name: "概率与统计",
      required_ects: 9,
      description:
        "Probability and statistics: random variables, distributions, statistical estimation, hypothesis testing, regression, statistical learning and model evaluation.",
    },
    {
      id: "CS",
      name: "计算机科学基础",
      required_ects: 12,
      description:
        "Computer science fundamentals: programming, data structures, algorithms, complexity analysis, software engineering, software testing and implementation of algorithms.",
    },
    {
      id: "DATA",
      name: "数据管理",
      required_ects: 6,
      description:
        "Data management and databases: relational data modeling, SQL, relational algebra, normalization, transactions, indexing and database systems.",
    },
  ],
};
