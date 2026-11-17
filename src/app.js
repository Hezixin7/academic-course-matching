import { buildAllocations, verdictLabel } from "./proposals.js";
import {
  parseInput,
  toCSV,
  joinCourses,
  calculate,
  round,
  fmt,
  DEMO,
  headers,
} from "./core.js";
const $ = (s) => document.querySelector(s);
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  review:
    '<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M9 3v4h6V3zM9 14l3 3 9-10"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  upload:
    '<path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
  spark:
    '<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="m16 3 5 5-12 12H4v-5L16 3Zm-3 3 5 5"/>',
  book: '<path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2V4Zm9 2v15"/>',
};
const icon = (n, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n] || icons.file}</svg>`;
const types = ["transcript", "descriptions", "requirements"];
const labels = {
  transcript: "成绩单",
  descriptions: "课程描述",
  requirements: "目标项目要求",
};
const fresh = () => ({
  version: 2,
  mode: "full",
  assessments: [],
  traces: [],
  runInfo: null,
  sources: {},
  factor: 1.5,
  creditUnit: "中国学分",
  project: "我的硕士申请",
  edges: [],
  candidates: [],
  hasRun: false,
  isDemo: false,
  updatedAt: null,
  log: [],
});
let state = fresh();
let storageOK = true;
try {
  const s = JSON.parse(localStorage.getItem("coursewise.v2"));
  if (s && s.version === 2) {
    for (const t of types)
      if (s.sources?.[t]) parseInput(toCSV(s.sources[t].rows, t), t);
    if (s.hasRun)
      calculate(
        joinCourses(s.sources.transcript.rows, s.sources.descriptions.rows),
        s.sources.requirements.rows,
        s.edges,
        s.factor,
      );
    state = s;
  }
} catch {
  state = fresh();
}
let view = "workspace",
  filter = "all",
  busy = false,
  progress = "",
  activeEditor = null,
  worker = null,
  expanded = new Set();
let llmStatus = { configured: false, checked: false };
let requestAbort = null;
let runToken = 0;
const courses = () =>
  joinCourses(
    state.sources.transcript?.rows || [],
    state.sources.descriptions?.rows || [],
  );
const modules = () => state.sources.requirements?.rows || [];
const ready = () => types.every((t) => state.sources[t]?.rows?.length);
const totals = () => calculate(courses(), modules(), state.edges, state.factor);
function save() {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem("coursewise.v2", JSON.stringify(state));
  } catch {
    storageOK = false;
    toast("浏览器存储空间不足，请导出报告保存当前结果。", "error");
  }
}
function audit(action) {
  state.log.push({ at: new Date().toISOString(), action });
  if (state.log.length > 150) state.log.shift();
}
let toastTimer;
function toast(msg, type = "success") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "";
  }, 5500);
}
function render() {
  const t = totals(),
    pending = t.pending;
  $("#app").innerHTML =
    `<aside class="sidebar"><a class="brand" href="#" data-action="nav" data-view="workspace"><span class="brand-mark">${icon("book")}</span><span>Coursewise<span class="brand-sub">ACADEMIC COPILOT</span></span></a><div class="workspace-label">PERSONAL WORKSPACE</div><nav>${[
      ["workspace", "grid", "匹配工作台"],
      ["review", "review", "人工复核"],
      ["report", "file", "匹配报告"],
    ]
      .map(
        ([id, ic, l]) =>
          `<button class="nav-item ${view === id ? "active" : ""}" data-action="nav" data-view="${id}">${icon(ic)}<span>${l}</span>${id === "review" && pending ? `<span class="nav-count">${pending}</span>` : ""}</button>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-note"><span class="tiny-label">BUILT ON EVIDENCE</span><p>每一门课程，<br>都值得被认真看见。</p><div class="mini-line"></div><small>从课程内容出发，<br>为你的下一步提供依据。</small></div><div class="sidebar-bottom"><button class="nav-item ${view === "guide" ? "active" : ""}" data-action="nav" data-view="guide">${icon("help")}格式与匹配规则</button><div class="local-badge"><i></i> ${storageOK ? "资料保存在当前浏览器" : "请导出以保存结果"}</div></div></aside>
 <div class="shell"><header class="topbar"><div class="breadcrumb">我的工作空间 <span>/</span> <strong>${view === "workspace" ? "课程匹配" : view === "review" ? "人工复核" : view === "report" ? "匹配报告" : "使用指南"}</strong></div><div class="top-right"><span class="privacy">${icon("lock")}本地资料处理</span><span class="avatar">ME</span></div></header><main>${view === "workspace" ? workspace(t) : view === "guide" ? guide() : view === "review" ? review(t) : report(t)}</main><footer><span>COURSEWISE <b>·</b> Make your learning count.</span><span>以原始材料为依据 · 最终认定以院校审核为准</span></footer></div>`;
  for (const input of document.querySelectorAll(".file-input"))
    input.addEventListener("change", (e) => {
      if (e.target.files[0]) upload(e.target.dataset.type, e.target.files[0]);
    });
  for (const area of document.querySelectorAll("[data-drop]")) {
    area.addEventListener("dragover", (e) => {
      e.preventDefault();
      area.classList.add("dragover");
    });
    area.addEventListener("dragleave", () => area.classList.remove("dragover"));
    area.addEventListener("drop", (e) => {
      e.preventDefault();
      area.classList.remove("dragover");
      if (e.dataTransfer.files[0] && !busy)
        upload(area.dataset.drop, e.dataTransfer.files[0]);
    });
  }
}
function workspace(t) {
  return `<section class="heading"><div><div class="eyebrow">YOUR NEXT CHAPTER, MAPPED.</div><h1>让每一份学分，都有据可循<span>。</span></h1><p>从课程内容到申请要求，把复杂的匹配变成清晰、可复核的结果。</p></div><button class="button secondary" data-action="demo" ${busy ? "disabled" : ""}>${icon("spark")}体验示例项目</button></section>
 <div class="steps"><div class="step ${ready() ? "done" : "current"}"><span>${ready() ? icon("check") : "1"}</span><div><strong>准备申请资料</strong><small>成绩单 · 课程描述 · 项目要求</small></div></div><div class="step-line"></div><div class="step ${state.hasRun ? "done" : ready() ? "current" : ""}"><span>${state.hasRun ? icon("check") : "2"}</span><div><strong>语义匹配</strong><small>读懂课程内容，保留原文证据</small></div></div><div class="step-line"></div><div class="step ${state.hasRun ? "current" : ""}"><span>3</span><div><strong>复核与调整</strong><small>人工确认，学分即时重算</small></div></div></div>
 <section class="panel uploads-panel"><div class="section-head"><div><h2><span class="section-number">01</span> 你的申请资料</h2><p>上传三类材料，或直接粘贴内容。建议先下载模板查看格式。</p></div><span class="count-tag">${types.filter((t) => state.sources[t]).length} / 3 已就绪</span></div><div class="upload-grid">${types.map((type, i) => uploadCard(type, i)).join("")}</div>
 ${llmSettings()}<div class="settings-bar"><div class="conversion"><label for="credit-factor">学分换算</label><span>1 <select id="credit-unit" aria-label="原始学分单位" ${busy ? "disabled" : ""}><option ${state.creditUnit === "中国学分" ? "selected" : ""}>中国学分</option><option ${state.creditUnit === "ECTS" ? "selected" : ""}>ECTS</option><option ${state.creditUnit === "其他学分" ? "selected" : ""}>其他学分</option></select> = <input id="credit-factor" type="number" min="0.01" max="10" step="0.01" value="${state.factor}" ${busy ? "disabled" : ""}> ECTS</span><span class="conversion-note">可调整的估算规则</span></div><button class="button primary" data-action="match" ${!ready() || busy || (state.mode === "full" && !llmStatus.configured) ? "disabled" : ""}>${busy ? '<span class="spinner"></span>' : icon("spark")}${busy ? "正在分析课程内容" : state.mode === "full" ? "开始 LLM 匹配" : "开始检索预览"}${!busy ? icon("arrow") : ""}</button></div><div class="model-note">${icon("lock")} 原始文件在浏览器解析；完整模式发送课程描述与目标要求到所配置的 LLM 服务，密钥仅存后端。</div>${busy ? `<div class="progress-panel" role="status"><span class="spinner"></span><span id="progress-text">${esc(progress)}</span><button class="text-button" data-action="cancel">取消</button></div>` : ""}</section>
 ${state.hasRun ? results(t) : `<section class="empty-result"><div class="empty-orbit">${icon("grid")}<span></span></div><div><h3>下一步，看到你的课程全景</h3><p>完成上传后，这里将显示模块覆盖、课程匹配和可追溯证据。</p><button class="text-button" data-action="demo">没有材料？先用示例试一试 ${icon("arrow")}</button></div><span class="empty-label">FROM LEARNING<br>TO POSSIBILITY</span></section>`}`;
}
function uploadCard(type, i) {
  const s = state.sources[type];
  return `<article class="upload-card ${s ? "loaded" : ""}" data-drop="${type}"><div class="upload-card-top"><span class="file-icon ${type}">${icon(type === "descriptions" ? "book" : "file")}</span><span class="upload-index">0${i + 1}</span></div><h3>${labels[type]}</h3><p>${type === "transcript" ? "课程编号、课程名称与原始学分" : type === "descriptions" ? "教学内容、知识点与学习成果" : "目标模块、内容要求与最低 ECTS"}</p><input class="file-input" id="upload-${type}" data-type="${type}" type="file" accept=".csv,.tsv,.json,.txt,.md,.pdf,.docx" hidden ${busy ? "disabled" : ""}>${s ? `<button class="uploaded-file" data-action="edit-source" data-type="${type}" ${busy ? "disabled" : ""}>${icon("check")}<span><strong>${esc(s.name)}</strong><small>${s.rows.length} ${type === "requirements" ? "个模块" : "门课程"} · 点击校对</small></span>${icon("edit")}</button>` : `<button class="drop-zone" data-action="upload" data-type="${type}" ${busy ? "disabled" : ""}>${icon("upload")}<strong>点击上传 <span>或拖拽到这里</span></strong><small>PDF · DOCX · CSV · JSON · TXT</small></button>`}<div class="upload-links"><button class="text-button" data-action="${s ? "upload" : "paste"}" data-type="${type}" ${busy ? "disabled" : ""}>${s ? "替换文件" : "粘贴文本"}</button><button class="text-button muted" data-action="template" data-type="${type}">${icon("download")}下载模板</button></div></article>`;
}
function stats(t) {
  return `<div class="stats-grid"><div class="stat"><span>已分配学分 <small>含待复核</small></span><strong>${fmt(t.allocated)}<small>ECTS</small></strong><div>可用 ${fmt(t.available)} · 未分配 ${fmt(t.unallocated)}</div></div><div class="stat"><span>已确认学分</span><strong>${fmt(t.confirmed)}<small>ECTS</small></strong><div>仅计入人工确认的匹配</div></div><div class="stat"><span>模块覆盖 <small>按当前分配</small></span><strong>${modules().filter((m) => t.modules[m.id].allocated >= m.required_ects).length}<small>/ ${modules().length} 个模块</small></strong><div>目标合计 ${fmt(modules().reduce((s, m) => s + m.required_ects, 0))} ECTS</div></div><button class="stat review-stat" data-action="nav" data-view="review"><span>等待人工复核 ${icon("arrow")}</span><strong>${t.pending}<small>条匹配</small></strong><div><i></i> 模型建议需要你的判断</div></button></div>`;
}
function moduleCards(t) {
  return `<div class="modules-grid">${modules()
    .map((m, i) => {
      const v = t.modules[m.id],
        percent = Math.min(100, (v.allocated / (m.required_ects || 1)) * 100),
        gap = Math.max(0, round(m.required_ects - v.allocated));
      return `<article class="module-card"><div><span class="module-letter">${String(i + 1).padStart(2, "0")}</span><span class="${gap ? "status-neutral" : "status-green"}">${gap ? "尚差 " + fmt(gap) : "分配已覆盖"}</span></div><h3>${esc(m.name)}</h3><p><strong>${fmt(v.allocated)}</strong><span>/ ${fmt(m.required_ects)} ECTS</span></p><div class="meter"><span style="width:${percent}%"></span></div><small>已确认 ${fmt(v.confirmed)} ECTS</small></article>`;
    })
    .join("")}</div>`;
}
function results(t) {
  return `<section class="results-section"><div class="section-head"><div><h2><span class="section-number">02</span> 匹配全景 ${state.isDemo ? '<span class="demo-tag">示例数据</span>' : ""}</h2><p>描述召回 → LLM 判定 → 原文证据校验。所有建议都需人工复核，课程学分不能重复使用。</p></div><button class="button secondary small" data-action="nav" data-view="report">${icon("file")}查看报告</button></div>${runPanel()}${stats(t)}${moduleCards(t)}${table(t)}${candidateTable()}</section>`;
}
function table(t, onlyReview = false) {
  const rows = state.edges.filter((e) =>
    filter === "pending"
      ? e.status !== "confirmed"
      : filter === "confirmed"
        ? e.status === "confirmed"
        : true,
  );
  return `<section class="panel matches-panel"><div class="table-toolbar"><div class="tabs" role="group" aria-label="匹配状态筛选">${[
    ["all", "全部匹配"],
    ["pending", "待复核"],
    ["confirmed", "已确认"],
  ]
    .map(
      ([v, l]) =>
        `<button data-action="filter" data-filter="${v}" class="${filter === v ? "selected" : ""}">${l}${v === "all" ? ` <span>${state.edges.length}</span>` : ""}</button>`,
    )
    .join(
      "",
    )}</div><button class="button secondary small" data-action="add">${icon("plus")}手动添加匹配</button></div><div class="table-wrap"><table class="match-table"><thead><tr><th>原始课程 / 可用学分</th><th>目标模块</th><th>语义相似度</th><th>分配 ECTS</th><th>复核状态</th><th>操作</th></tr></thead><tbody>${rows.map((e) => matchRow(e, t)).join("") || '<tr><td colspan="6" class="empty-row">暂无符合条件的匹配。你可以手动添加，或切换筛选条件。</td></tr>'}</tbody></table></div><div class="table-foot">${icon("help")} 相似度用于排列候选，并非录取概率。修改分配、模块与确认状态均在本地重算。<span>${state.edges.length} 条匹配</span></div></section>`;
}
function matchRow(e, t) {
  const c = courses().find((c) => c.id === e.courseId),
    m = modules().find((m) => m.id === e.moduleId);
  return `<tr class="${expanded.has(e.id) ? "row-open" : ""}"><td><div class="course-cell"><strong>${esc(c.name)}</strong><small>${esc(c.id)} <b>·</b> ${fmt(c.credits * state.factor)} ECTS 可用</small></div></td><td><select data-module="${esc(e.id)}" aria-label="${esc(c.name)}的目标模块">${modules()
    .map(
      (m) =>
        `<option value="${esc(m.id)}" ${e.moduleId === m.id ? "selected" : ""}>${esc(m.name)}</option>`,
    )
    .join(
      "",
    )}</select></td><td>${e.score === null ? '<span class="muted">人工指定</span>' : `<span class="score"><i style="--score:${e.score * 100}%"></i>${Math.round(e.score * 100)}%</span>`}<button class="evidence-link" data-action="evidence" data-id="${esc(e.id)}">${expanded.has(e.id) ? "收起证据" : "查看证据"} ${icon("arrow")}</button></td><td><input class="credit-input" type="number" step="0.01" min="0" max="${round(c.credits * state.factor)}" value="${e.ects}" data-ects="${esc(e.id)}" aria-label="${esc(c.name)}分配至${esc(m.name)}的ECTS"></td><td><button class="status-pill ${e.status === "confirmed" ? "confirmed" : "pending"}" data-action="confirm" data-id="${esc(e.id)}">${icon(e.status === "confirmed" ? "check" : "clock")}${e.status === "confirmed" ? "已确认" : "待复核"}</button></td><td><button class="icon-button" data-action="remove" data-id="${esc(e.id)}" aria-label="删除${esc(c.name)}到${esc(m.name)}的匹配">${icon("trash")}</button></td></tr>${expanded.has(e.id) ? `<tr class="evidence-row"><td colspan="6"><div class="evidence-grid"><div><span class="tiny-label">课程描述 · 原文证据</span><blockquote>${esc(e.evidence || "人工指定：请在下方记录依据，并对照课程原文。")}</blockquote><small>${esc(e.source || c.descriptionSource || "手动添加")}</small></div><div><span class="tiny-label">目标要求 · 原文依据</span><blockquote>${esc(e.requirementEvidence || m.description)}</blockquote><small>${esc(e.requirementSource || m.source || "项目要求")}</small></div></div>${e.llmReason ? `<div class="llm-reason"><strong>${esc(verdictLabel[e.llmDecision] || "人工指定")}</strong><p>${esc(e.llmReason)}</p>${e.missingTopics?.length ? `<p>待核实主题：${esc(e.missingTopics.join("、"))}</p>` : ""}<small>${e.validation?.valid ? "原文引用校验通过；这不代表模型的推理已被证明正确。" : "人工指定或已调整；请对照原始材料。"}</small></div>` : ""}<div class="review-note"><label>人工复核备注<input data-note="${esc(e.id)}" value="${esc(e.note)}" placeholder="记录判断理由、缺失材料或需要向院校确认的问题"></label><span>${e.manual ? "此匹配经过人工调整" : "按描述向量的余弦相似度召回；待人工核实内容覆盖与深度。"}</span></div></td></tr>` : ""}`;
}
function review(t) {
  return `<section class="heading"><div><div class="eyebrow">HUMAN JUDGMENT MATTERS.</div><h1>由你，做最后的判断<span>。</span></h1><p>核对证据，调整模块与学分；点击“待复核”确认，点击“已确认”可重新打开。</p></div><button class="button secondary" data-action="nav" data-view="workspace">返回工作台</button></section>${state.hasRun ? `${stats(t)}<div class="review-banner">${icon("review")}<div><strong>复核时，检查“内容是否覆盖”和“学分是否合理”。</strong><p>展开每条匹配的原文证据；修改分配或模块后，该条匹配会重新进入待复核。</p></div></div>${table(t, true)}${candidateTable()}` : emptyPage("尚未生成匹配结果", "请先完成三类材料的上传并开始匹配。")}`;
}
function emptyPage(title, text) {
  return `<div class="panel empty-page">${icon("book")}<h2>${title}</h2><p>${text}</p><button class="button primary" data-action="nav" data-view="workspace">前往匹配工作台 ${icon("arrow")}</button></div>`;
}
function report(t) {
  return `<section class="heading"><div><div class="eyebrow">A CLEARER PICTURE.</div><h1>你的学习，有迹可循<span>。</span></h1><p>匹配结果、LLM 判定、证据校验和运行记录，汇成一份可以带走的报告。</p></div>${state.hasRun ? `<div class="button-group"><button class="button secondary" data-action="export-json">${icon("download")}JSON 数据</button><button class="button primary" data-action="export-report">${icon("download")}下载报告</button></div>` : ""}</section>${
    !state.hasRun
      ? emptyPage(
          "报告将在匹配完成后生成",
          "先准备材料，报告会保留每条分配的依据。",
        )
      : `${runPanel()}${stats(t)}<section class="panel report-intro"><div class="section-head"><h2>课程匹配与学分分配报告 ${state.isDemo ? '<span class="demo-tag">示例</span>' : ""}</h2><span class="count-tag">${state.edges.length && !t.pending ? "已完成人工复核" : "待复核草稿"}</span></div><div class="report-meta"><div><label>申请项目</label><input id="project-name" value="${esc(state.project)}" maxlength="100" aria-label="申请项目名称"></div><div><label>换算规则</label><strong>1 ${esc(state.creditUnit)} = ${state.factor} ECTS</strong><small>用户设定，仅用于估算</small></div><div><label>生成方式</label><strong>${state.runInfo?.mode === "full" ? "embedding + LLM 判定 + 人工复核" : "仅 embedding 检索预览"}</strong><small>模型判断需复核，不构成录取认定</small></div></div><div class="source-list">${types.map((type) => `<div>${icon("file")}<span>${labels[type]}</span><strong>${esc(state.sources[type].name)}</strong><small>${state.sources[type].rows.length} 条记录</small></div>`).join("")}</div></section>${moduleCards(t)}<section class="panel report-details"><h2>分配明细与依据</h2>${
          state.edges
            .map((e) => {
              const c = courses().find((c) => c.id === e.courseId),
                m = modules().find((m) => m.id === e.moduleId);
              return `<article class="report-edge"><div><h3>${esc(c.name)} ${icon("arrow")} ${esc(m.name)}</h3><span class="status-pill ${e.status === "confirmed" ? "confirmed" : "pending"}">${fmt(e.ects)} ECTS · ${e.status === "confirmed" ? "已确认" : "待复核"}</span></div><div class="evidence-grid"><div><label>课程内容</label><blockquote>${esc(e.evidence || c.description)}</blockquote><small>${esc(e.source || c.descriptionSource)}</small></div><div><label>项目要求</label><blockquote>${esc(e.requirementEvidence || m.description)}</blockquote><small>${esc(e.requirementSource || m.source)}</small></div></div>${e.llmReason ? `<p class="report-note">${esc(verdictLabel[e.llmDecision] || "人工判定")}：${esc(e.llmReason)}</p>` : ""}${e.note ? `<p class="report-note">复核备注：${esc(e.note)}</p>` : ""}</article>`;
            })
            .join("") ||
          '<p class="muted">无已分配匹配。请回到人工复核页添加。</p>'
        }</section>${candidateTable()}<section class="panel audit-panel"><h2>操作记录</h2>${state.log
          .slice(-12)
          .reverse()
          .map(
            (l) =>
              `<div><time>${new Date(l.at).toLocaleString("zh-CN")}</time><span>${esc(l.action)}</span></div>`,
          )
          .join(
            "",
          )}</section><div class="report-disclaimer">本报告是辅助复核材料，不构成官方 ECTS 换算或录取资格认定。相似度不代表内容完全等价；同一课程的学分已按预算约束分配。</div>`
  }`;
}
function guide() {
  return `<section class="heading"><div><div class="eyebrow">RETRIEVE. REASON. VERIFY.</div><h1>每个判定，都要有依据<span>。</span></h1><p>这是包含后端 LLM 判定的两阶段匹配项目。</p></div></section><section class="panel guide-panel"><h2>01 / 资料导入</h2><p>支持 CSV、TSV、JSON、TXT、Markdown、文字型 PDF 与 DOCX。单文件 10 MB，每类最多 150 行，PDF 最多 80 页；复杂表格需人工整理，扫描件暂不支持 OCR。</p>${types.map((type) => `<div class="format-example"><h3>${labels[type]}<button class="text-button" data-action="template" data-type="${type}">下载模板</button></h3><code>${headers[type].join(", ")}</code></div>`).join("")}<h2>02 / 召回、判定与校验</h2><p>本地 MiniLM 使用课程描述向量召回 Top-3 模块；课程名称只用于展示与关联。长描述最多处理前 8 个片段，英文语义效果更稳。完整模式把课程描述和候选要求发送到后端配置的模型服务；API Key 仅存于后端 .env，不进入浏览器。</p><p>LLM 返回匹配、部分匹配、不匹配或证据不足，以及理由和两侧原文引用。后端严格检查字段、编号、数量及引用是否来自相应原文。格式错误、引用伪造、超时或服务失败均进入待复核，不生成可计分建议。引用校验只证明出处，不能证明模型判断正确。</p><p>没有密钥时可以选择仅检索预览，该模式不调用 LLM、不自动分配学分，界面会明确标注。</p><h2>03 / 人工复核与学分</h2><p>所有建议均需人工确认。唯一完整匹配可获得全额预算初稿；存在多个完整匹配时，各条初始分配为 0，用户只能选择其中一个模块并整门分配，不能拆分；部分匹配初始也为 0。没有按相似度自动推断内容覆盖比例。你可以人工增删、重新指定模块并记录依据。</p><p>默认 1 中国学分 = 1.5 ECTS，是可调整的估算值。每门课预算是原始学分乘系数，保留两位小数；一门课程只能分配到一个目标模块，且必须 0 或整门预算，不能重复使用。编辑与重算只执行本地确定性逻辑，不重新执行 embedding、不调用 LLM。修改后需要重新复核。</p><h2>04 / 运行记录与保存</h2><p>界面展示模型、Prompt 版本、token 用量、重试、缓存与耗时。相同输入、模型及 Prompt 的有效结果可缓存 24 小时；缓存不保存密钥。后端 .data/traces.jsonl 仅记录输入哈希与运行元数据，缓存含模型输出引用，应视作私人材料。</p><p>浏览器 localStorage 保存资料和结果，不跨设备同步。原始文件不上传，但完整模式需要发送描述文本到你选择的模型服务。取消只能停止后续处理，已发出的远程请求可能仍执行。没有公开部署所需的多用户认证，请保持本地访问。</p><button class="button danger" data-action="reset">清除本浏览器的项目资料</button></section>`;
}

function openEditor(type, raw = "", name = "手动输入", error = "") {
  activeEditor = { type, name };
  const dialog = $("#editor");
  dialog.innerHTML = `<form method="dialog" class="editor-form"><div class="dialog-head"><div><span class="eyebrow">CHECK YOUR SOURCE</span><h2>校对${labels[type]}</h2></div><button class="icon-button" value="cancel" aria-label="关闭">✕</button></div><p>每行一条记录。请确认编号、学分与描述；应用后将更新资料并清除旧匹配。</p><div class="editor-tip">${type === "descriptions" ? "课程编号应与成绩单一致，必须包含完整课程内容。" : type === "requirements" ? "每个目标模块分别填写最低 ECTS 与内容要求。" : "只保留你计划纳入申请的已获得学分课程。"}<br>列：<code>${headers[type].join(", ")}</code></div><label class="sr-only" for="source-text">${labels[type]}内容</label><textarea id="source-text" spellcheck="false" placeholder="${headers[type].join(",")}">${esc(raw)}</textarea><div id="editor-error" class="inline-error" role="alert">${esc(error)}</div><div class="dialog-foot"><small>来源：${esc(name)}</small><div><button class="button secondary" value="cancel">取消</button><button type="button" class="button primary" data-action="apply-source">校验并应用 ${icon("check")}</button></div></div></form>`;
  dialog.showModal();
}
async function extractFile(file) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("文件超过 10 MB，请先精简。");
  const ext = file.name.split(".").pop().toLowerCase();
  if (["csv", "tsv", "json", "txt", "md"].includes(ext)) return file.text();
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({
      data: await file.arrayBuffer(),
      cMapUrl: "/vendor/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/vendor/standard_fonts/",
      useSystemFonts: true,
    }).promise;
    if (pdf.numPages > 80) {
      await pdf.destroy();
      throw new Error("PDF 超过 80 页，请仅保留相关课程。");
    }
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines = [];
      for (const item of content.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform[5] / 3) * 3;
        let line = lines.find((l) => Math.abs(l.y - y) < 3);
        if (!line) {
          line = { y, items: [] };
          lines.push(line);
        }
        line.items.push({ x: item.transform[4], text: item.str });
      }
      pages.push(
        lines
          .sort((a, b) => b.y - a.y)
          .map((l) =>
            l.items
              .sort((a, b) => a.x - b.x)
              .map((x) => x.text)
              .join("  "),
          )
          .join("\n"),
      );
    }
    await pdf.destroy();
    const text = pages.join("\n");
    if (text.trim().length < 15)
      throw new Error(
        "PDF 未包含可读取文字，可能是扫描件。请先 OCR 或粘贴文字。",
      );
    return text;
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth/mammoth.browser.js");
    return (
      await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    ).value;
  }
  throw new Error("暂不支持此格式。请使用 PDF、DOCX、CSV、JSON 或 TXT。");
}
async function upload(type, file) {
  if (busy) return;
  toast("正在读取 " + file.name + "…");
  try {
    const raw = await extractFile(file);
    let error = "";
    let normalized = raw;
    try {
      const rows = parseInput(raw, type, file.name);
      normalized = toCSV(rows, type);
    } catch (e) {
      error = "已提取文字，请按模板整理后应用：" + e.message;
    }
    openEditor(type, normalized, file.name, error);
  } catch (e) {
    toast(e.message, "error");
  }
}
function applySource() {
  try {
    const { type, name } = activeEditor;
    const rows = parseInput($("#source-text").value, type, name);
    state.sources[type] = { name, rows };
    state.edges = [];
    state.candidates = [];
    state.hasRun = false;
    state.assessments = [];
    state.traces = [];
    state.runInfo = null;
    state.isDemo = false;
    audit(`导入${labels[type]}：${name}（${rows.length} 条）`);
    save();
    $("#editor").close();
    render();
    toast(`已导入 ${rows.length} 条${labels[type]}记录`);
  } catch (e) {
    $("#editor-error").textContent = e.message;
  }
}
function demo() {
  if (busy) return;
  if (types.some((t) => state.sources[t])) {
    const dialog = $("#editor");
    dialog.innerHTML = `<form method="dialog" class="confirm-dialog"><h2>用示例替换当前资料？</h2><p>当前浏览器的项目资料和匹配结果将被替换。你可以先下载报告保留现有结果。</p><div><button class="button secondary">取消</button><button type="button" data-action="load-demo" class="button primary">载入示例</button></div></form>`;
    dialog.showModal();
    return;
  }
  loadDemo();
}
function loadDemo() {
  state = fresh();
  state.isDemo = true;
  for (const type of types)
    state.sources[type] = {
      name: "示例_" + labels[type] + ".csv",
      rows: parseInput(
        toCSV(DEMO[type], type),
        type,
        "示例_" + labels[type] + ".csv",
      ),
    };
  state.project = "Data Science M.Sc. · 示例申请";
  audit("载入示例项目（非真实院校录取标准）");
  save();
  $("#editor").close();
  render();
  toast("示例资料已就绪。完整匹配需配置 LLM；也可选择仅检索预览。");
}
async function refreshConfig() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error();
    llmStatus = { ...(await response.json()), checked: true };
  } catch {
    llmStatus = {
      configured: false,
      checked: true,
      error: "无法连接本地后端，请用 npm run dev 启动。",
    };
  }
  render();
}
function llmSettings() {
  return `<div class="llm-settings"><div><label for="run-mode">运行方式</label><select id="run-mode" ${busy ? "disabled" : ""}><option value="full" ${state.mode === "full" ? "selected" : ""}>完整流程：embedding + LLM 判定</option><option value="retrieval" ${state.mode === "retrieval" ? "selected" : ""}>仅检索预览（不含 LLM，不自动分配学分）</option></select></div><p>${llmStatus.configured ? `配置已读取：${esc(llmStatus.model)} · ${esc(llmStatus.promptVersion)}。实际调用时验证密钥与服务状态。` : esc(llmStatus.error || "完整流程需先复制 .env.example 为 .env，填写 LLM_API_KEY，再重启本地服务。")}</p><button class="text-button" data-action="refresh-config" ${busy ? "disabled" : ""}>重新读取状态</button></div>`;
}
function setProgress(text) {
  progress = text;
  const el = $("#progress-text");
  if (el) el.textContent = text;
}
function runPanel() {
  const run = state.runInfo;
  if (!run) return "";
  return `<section class="run-panel"><div><strong>${run.mode === "full" ? "两阶段匹配运行记录" : "仅语义检索预览 · 未调用 LLM"}</strong><span>${esc(run.model || "MiniLM")} ${run.promptVersion ? "/ " + esc(run.promptVersion) : ""}</span></div><p>${run.mode === "full" ? `${run.validatedCount} / ${run.decisionCount} 个判定通过契约与引用校验；${run.failedCount} 个需要排查。LLM 请求 ${run.providerAttempts} 次，缓存命中 ${run.cacheHits} 次。输入 ${run.inputTokens} / 输出 ${run.outputTokens} tokens。` : "当前只展示候选排序，不具备 LLM 判定和自动学分分配。"}用时 ${fmt(run.latencyMs / 1000)} 秒。</p><small>多目标匹配和部分匹配保留人工分配入口；引用存在不等于判断正确。调用失败或校验不通过不自动计分。</small></section>`;
}
function candidateTable() {
  if (!state.candidates.length) return "";
  return `<details class="panel candidate-panel" ${!state.edges.length ? "open" : ""}><summary>候选与 LLM 判定明细 <span>${state.candidates.length} 条 · 包含未通过、拒绝和证据不足的候选</span></summary><div class="table-wrap"><table class="match-table"><thead><tr><th>课程 → 模块</th><th>检索相似度</th><th>LLM 判定 / 校验</th><th>判断理由</th><th>人工处理</th></tr></thead><tbody>${state.candidates
    .map((c) => {
      const a = state.assessments.find(
        (a) => a.courseId === c.courseId && a.moduleId === c.moduleId,
      );
      const course = courses().find((x) => x.id === c.courseId),
        module = modules().find((x) => x.id === c.moduleId);
      return `<tr><td>${esc(course?.name)} → ${esc(module?.name)}</td><td>${Math.round(c.score * 100)}%</td><td><strong class="verdict">${esc(verdictLabel[a?.decision || "not_run"])}</strong><small>${a?.validation?.valid ? "契约及引用校验通过" : esc(a?.validation?.codes?.join(", ") || "未判定")}</small></td><td><p>${esc(a?.reason || "仅完成检索；需要 LLM 或人工进一步判断。")}</p>${a?.courseQuote ? `<details><summary>查看引用</summary><blockquote>${esc(a.courseQuote)}</blockquote><blockquote>${esc(a.requirementQuote)}</blockquote></details>` : ""}</td><td><button class="text-button" data-action="add-candidate" data-course="${esc(c.courseId)}" data-module="${esc(c.moduleId)}">人工添加</button></td></tr>`;
    })
    .join("")}</tbody></table></div></details>`;
}
async function runMatch() {
  if (!ready() || busy) return;
  if (state.mode === "full" && !llmStatus.configured) {
    toast("请先配置 .env 中的 LLM_API_KEY，再重启服务。", "error");
    return;
  }
  const cs = courses(),
    mods = modules();
  const missing = cs.filter((c) => !c.description);
  if (missing.length) {
    toast(
      "以下课程缺少描述：" + missing.map((c) => c.name).join("、"),
      "error",
    );
    return;
  }
  if (
    state.mode === "full" &&
    [...cs, ...mods].some((c) => c.description.length > 8000)
  ) {
    toast("完整模式每条描述最多 8000 字符，请先精简。", "error");
    return;
  }
  const token = ++runToken,
    mode = state.mode,
    started = Date.now();
  busy = true;
  progress = "正在进行课程描述语义召回…";
  render();
  worker = new Worker("/semantic-worker.js", { type: "module" });
  worker.onmessage = async ({ data }) => {
    if (token !== runToken) return;
    if (data.type === "progress") setProgress(data.text);
    else if (data.type === "error") {
      busy = false;
      worker?.terminate();
      worker = null;
      render();
      toast(data.text, "error");
    } else if (data.type === "result") {
      worker?.terminate();
      worker = null;
      const candidates = data.result.candidates,
        assessments = [],
        traces = [];
      requestAbort = new AbortController();
      if (mode === "full") {
        let stopped = false;
        for (let i = 0; i < cs.length; i++) {
          if (token !== runToken) return;
          const course = cs[i],
            ranked = candidates.filter((c) => c.courseId === course.id);
          const selected = ranked.map((c) =>
            mods.find((m) => m.id === c.moduleId),
          );
          setProgress(
            `LLM 逐课判定与证据校验 ${i + 1} / ${cs.length}：${course.name}`,
          );
          const clean = (r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
          });
          try {
            if (stopped) throw new Error("先前调用失败，已停止后续请求。");
            //
            const response = await fetch("/api/classify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                course: clean(course),
                modules: selected.map(clean),
              }),
              signal: requestAbort.signal,
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error?.message || "后端请求失败");
            traces.push(result.trace);
            assessments.push(
              ...result.assessments.map((a) => ({
                ...a,
                requestId: result.trace.requestId,
              })),
            );
            if (
              result.assessments.some((a) =>
                a.validation?.codes?.some((c) =>
                  ["PROVIDER_AUTH_ERROR", "PROVIDER_RATE_LIMIT"].includes(c),
                ),
              )
            )
              stopped = true;
          } catch (error) {
            if (token !== runToken) return;
            assessments.push(
              ...selected.map((m) => ({
                courseId: course.id,
                moduleId: m.id,
                decision: "needs_review",
                reason: error.message,
                courseQuote: "",
                requirementQuote: "",
                missingTopics: [],
                validation: { valid: false, codes: ["REQUEST_FAILED"] },
              })),
            );
          }
        }
      }
      if (token !== runToken) return;
      state.candidates = candidates;
      state.assessments = assessments;
      state.traces = traces;
      state.edges =
        mode === "full"
          ? buildAllocations(cs, mods, candidates, assessments, state.factor)
          : [];
      const sum = (k) => traces.reduce((n, t) => n + (t.usage?.[k] || 0), 0);
      state.runInfo = {
        mode,
        model: mode === "full" ? llmStatus.model : "all-MiniLM-L6-v2",
        promptVersion: mode === "full" ? llmStatus.promptVersion : null,
        decisionCount: assessments.length,
        validatedCount: assessments.filter((a) => a.validation.valid).length,
        failedCount: assessments.filter((a) => !a.validation.valid).length,
        providerAttempts: traces.reduce((n, t) => n + t.attempts.length, 0),
        cacheHits: traces.filter((t) => t.cacheHit).length,
        inputTokens: sum("inputTokens"),
        outputTokens: sum("outputTokens"),
        latencyMs: Date.now() - started,
      };
      state.hasRun = true;
      state.generatedAt = new Date().toISOString();
      audit(
        `${mode === "full" ? "完成两阶段匹配" : "仅检索预览"}：${cs.length} 门课程、${state.edges.length} 条待复核匹配`,
      );
      save();
      busy = false;
      requestAbort = null;
      render();
      toast(
        mode === "full"
          ? `LLM 判定完成：${state.edges.length} 条建议待复核，校验失败 ${state.runInfo.failedCount} 条。`
          : "检索完成；未调用 LLM，不自动分配学分。",
      );
      document
        .querySelector(".results-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  worker.onerror = () => {
    if (token !== runToken) return;
    busy = false;
    worker?.terminate();
    worker = null;
    render();
    toast("模型线程未能启动，请重试。", "error");
  };
  worker.postMessage({ courses: cs, modules: mods, factor: state.factor });
}

function updateEdges(next, action) {
  try {
    calculate(courses(), modules(), next, state.factor);
    state.edges = next;
    audit(action);
    save();
    render();
    return true;
  } catch (e) {
    toast(e.message, "error");
    render();
    return false;
  }
}
function editEdge(id, changes, action) {
  const next = state.edges.map((e) => (e.id === id ? { ...e, ...changes } : e));
  return updateEdges(next, action);
}
function addDialog() {
  const dialog = $("#editor");
  dialog.innerHTML = `<form method="dialog" class="add-form"><div class="dialog-head"><h2>手动添加匹配</h2><button class="icon-button" aria-label="关闭">✕</button></div><p>一门课程只能分配到一个目标模块，且必须 0 或按整门课程预算全额分配。更换模块请使用表格中的模块选择。添加后请记录原文依据并复核。</p><label>原始课程<select id="add-course">${courses()
    .map(
      (c) =>
        `<option value="${esc(c.id)}">${esc(c.id)} · ${esc(c.name)}（整门预算 ${fmt(round(c.credits * state.factor))} ECTS）</option>`,
    )
    .join(
      "",
    )}</select></label><label>目标模块<select id="add-module">${modules()
    .map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`)
    .join(
      "",
    )}</select></label><label>分配 ECTS（0 或整门预算）<input id="add-ects" type="number" value="0" min="0" step="0.01"></label><label>复核依据<textarea id="add-note" placeholder="说明课程内容与模块要求的关系"></textarea></label><p class="inline-error" id="add-error"></p><div class="dialog-foot"><button class="button secondary">取消</button><button class="button primary" type="button" data-action="save-add">添加并复核 ${icon("plus")}</button></div></form>`;
  dialog.showModal();
}
function saveAdd() {
  const courseId = $("#add-course").value,
    moduleId = $("#add-module").value;
  const c = courses().find((c) => c.id === courseId),
    m = modules().find((m) => m.id === moduleId);
  const next = [
    ...state.edges,
    {
      id: "manual-" + crypto.randomUUID(),
      courseId,
      moduleId,
      ects: Number($("#add-ects").value),
      score: null,
      status: "pending",
      manual: true,
      note: $("#add-note").value,
      evidence: c.description,
      requirementEvidence: m.description,
      source: c.descriptionSource,
      requirementSource: m.source,
    },
  ];
  try {
    calculate(courses(), modules(), next, state.factor);
    state.edges = next;
    audit(`手动添加 ${c.name} → ${m.name}`);
    save();
    $("#editor").close();
    render();
    toast("已添加匹配，请核对证据并确认");
  } catch (e) {
    $("#add-error").textContent = e.message;
  }
}
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
function exportData() {
  const t = totals();
  download(
    "coursewise-matching-report.json",
    JSON.stringify(
      {
        format: "coursewise-report-v2",
        generatedAt: new Date().toISOString(),
        project: state.project,
        isDemo: state.isDemo,
        engine:
          state.runInfo?.mode === "full"
            ? "description embedding -> LLM pair classification -> citation validation -> human review -> deterministic credits"
            : "retrieval preview only; no LLM",
        creditRule: { unit: state.creditUnit, factor: state.factor },
        sources: state.sources,
        runInfo: state.runInfo,
        llmAssessments: state.assessments,
        modelTraces: state.traces,
        allocations: state.edges,
        candidates: state.candidates,
        totals: t,
        audit: state.log,
      },
      null,
      2,
    ),
    "application/json",
  );
  toast("JSON 报告已下载");
}
function exportReport() {
  const t = totals();
  let body = report(t);
  body = body
    .replace(/<button[\s\S]*?<\/button>/g, "")
    .replace(
      /<input id="project-name"[^>]*>/,
      `<strong>${esc(state.project)}</strong>`,
    );
  download(
    "coursewise-matching-report.html",
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.project)} · 课程匹配报告</title><style>body{font:14px/1.8 system-ui,sans-serif;color:#263e38;max-width:1060px;margin:45px auto;padding:0 25px}h1{font-size:30px}h2{font-size:20px}h3{font-size:16px}.heading p,.muted,small{color:#65746f}.icon{width:16px;height:16px;vertical-align:middle}.stats-grid,.modules-grid,.report-meta{display:flex;gap:16px;flex-wrap:wrap;margin:26px 0}.stat,.module-card{flex:1;min-width:150px;background:#f3f6f2;padding:18px;border:1px solid #dce5df;border-radius:8px}.stat>strong{display:block;font-size:26px}.stat small{font-size:12px;margin-left:5px}.stat>div{font-size:12px}.stat>span,.module-card small{display:block}.module-card p strong{font-size:23px}.report-intro,.report-details,.audit-panel{border-top:1px solid #dce5df;margin-top:30px;padding-top:20px}.report-meta>div{flex:1}.report-meta label,.report-meta strong,.report-meta small{display:block}.source-list>div{display:flex;gap:12px}.report-edge{border-bottom:1px solid #dce5df;padding:20px 0;break-inside:avoid}.report-edge>div:first-child{display:flex;justify-content:space-between;align-items:center}.evidence-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}blockquote{margin:10px 0;padding:14px;background:#f7f8f5;border-left:3px solid #8bac93}.status-pill,.count-tag,.demo-tag{font-size:12px;background:#f3eddc;padding:5px 9px;border-radius:5px}.confirmed{background:#e2eee3}.audit-panel>div{display:flex;gap:20px}.audit-panel time{color:#6a7d71}.report-disclaimer{margin-top:30px;font-size:12px}.button-group{display:none}.eyebrow{font-size:11px;letter-spacing:2px}.meter{background:#dee5dc;height:5px}.meter span{display:block;height:5px;background:#517e66}@media print{body{margin:0;max-width:none}.heading{break-after:avoid}.stats-grid,.modules-grid{break-inside:avoid}}@media(max-width:650px){.evidence-grid{grid-template-columns:1fr}}</style><body>${body}<p><small>导出于 ${new Date().toLocaleString("zh-CN")} · 可通过浏览器打印另存为 PDF。</small></p></body></html>`,
    "text/html",
  );
  toast("可解释报告已下载，可在浏览器中打印为 PDF");
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (el.disabled) return;
  if (
    busy &&
    [
      "confirm",
      "remove",
      "add",
      "save-add",
      "edit-source",
      "apply-source",
      "demo",
      "load-demo",
      "reset",
      "confirm-reset",
      "add-candidate",
    ].includes(a)
  ) {
    toast("匹配正在运行，请完成或取消后修改。", "error");
    return;
  }
  e.preventDefault();
  if (a === "nav") {
    if (busy && el.dataset.view !== "workspace") {
      toast("匹配正在运行，请完成或取消后切换。", "error");
      return;
    }
    view = el.dataset.view;
    filter = view === "review" ? "pending" : "all";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (a === "upload") $("#upload-" + el.dataset.type).click();
  else if (a === "paste")
    openEditor(el.dataset.type, headers[el.dataset.type].join(",") + "\n");
  else if (a === "edit-source") {
    const s = state.sources[el.dataset.type];
    openEditor(el.dataset.type, toCSV(s.rows, el.dataset.type), s.name);
  } else if (a === "apply-source") applySource();
  else if (a === "template")
    download(
      "coursewise-" + el.dataset.type + "-template.csv",
      "\uFEFF" + toCSV(DEMO[el.dataset.type], el.dataset.type),
      "text/csv;charset=utf-8",
    );
  else if (a === "demo") demo();
  else if (a === "load-demo") loadDemo();
  else if (a === "match") runMatch();
  else if (a === "refresh-config") refreshConfig();
  else if (a === "add-candidate") {
    addDialog();
    $("#add-course").value = el.dataset.course;
    $("#add-module").value = el.dataset.module;
  } else if (a === "cancel") {
    runToken++;
    requestAbort?.abort();
    requestAbort = null;
    worker?.terminate();
    worker = null;
    busy = false;
    render();
    toast("已停止后续处理，原有结果保留；已发出的模型请求可能仍执行。");
  } else if (a === "filter") {
    filter = el.dataset.filter;
    render();
  } else if (a === "evidence") {
    expanded.has(el.dataset.id)
      ? expanded.delete(el.dataset.id)
      : expanded.add(el.dataset.id);
    render();
  } else if (a === "confirm") {
    const edge = state.edges.find((x) => x.id === el.dataset.id);
    editEdge(
      edge.id,
      { status: edge.status === "confirmed" ? "pending" : "confirmed" },
      `${edge.courseId} → ${edge.moduleId}：${edge.status === "confirmed" ? "重新打开复核" : "人工确认"}`,
    );
    toast("已更新复核状态，学分已重算");
  } else if (a === "remove") {
    updateEdges(
      state.edges.filter((x) => x.id !== el.dataset.id),
      "删除匹配并释放学分预算",
    );
  } else if (a === "add") addDialog();
  else if (a === "save-add") saveAdd();
  else if (a === "export-json") exportData();
  else if (a === "export-report") exportReport();
  else if (a === "reset") {
    const d = $("#editor");
    d.innerHTML =
      '<form method="dialog" class="confirm-dialog"><h2>清除本浏览器的项目资料？</h2><p>这会删除已解析的材料和匹配结果。建议先导出报告。</p><div><button class="button secondary">取消</button><button type="button" class="button danger" data-action="confirm-reset">清除资料</button></div></form>';
    d.showModal();
  } else if (a === "confirm-reset") {
    state = fresh();
    localStorage.removeItem("coursewise.v2");
    $("#editor").close();
    render();
    toast("项目资料已清除");
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (busy) {
    render();
    return;
  }
  if (el.id === "run-mode") {
    state.mode = el.value;
    save();
    render();
  } else if (el.dataset.ects) {
    const raw = el.value;
    const next = Number(raw);
    if (raw === "") {
      toast("请输入分配学分", "error");
      render();
      return;
    }
    editEdge(
      el.dataset.ects,
      { ects: next, status: "pending", manual: true },
      `调整分配学分为 ${raw} ECTS`,
    );
  } else if (el.dataset.module) {
    const m = modules().find((m) => m.id === el.value);
    const edge = state.edges.find((x) => x.id === el.dataset.module);
    const duplicate = state.edges.find(
      (x) =>
        x.id !== edge.id &&
        x.courseId === edge.courseId &&
        x.moduleId === el.value,
    );
    const removable = duplicate?.ects === 0 ? duplicate : null;
    const next = state.edges
      .filter((x) => x !== removable)
      .map((x) =>
        x.id === edge.id
          ? {
              ...x,
              moduleId: el.value,
              llmDecision: "manual",
              llmReason: "人工修改了目标模块，原 LLM 判定不再适用。",
              validation: null,
              modelTraceId: null,
              status: "pending",
              manual: true,
              score: null,
              requirementEvidence: m.description,
              requirementSource: m.source,
            }
          : x,
      );
    updateEdges(
      next,
      removable
        ? "人工调整目标模块，并移除同课程的重复零分配匹配"
        : "人工调整目标模块",
    );
  } else if (el.dataset.note) {
    const edge = state.edges.find((x) => x.id === el.dataset.note);
    if (edge) {
      edge.note = el.value;
      audit("更新人工复核备注");
      save();
    }
  } else if (el.id === "credit-factor") {
    const next = Number(el.value),
      old = state.factor;
    try {
      if (!el.value) throw new Error("请填写有效系数");
      const courseById = new Map(courses().map((c) => [c.id, c]));
      const edges = state.edges.map((x) => ({
        ...x,
        ects:
          x.ects > 0
            ? round(courseById.get(x.courseId).credits * next)
            : 0,
        status: "pending",
      }));
      calculate(courses(), modules(), edges, next);
      state.factor = next;
      state.edges = edges;
      audit(`换算系数由 ${old} 调整为 ${next}；按整门预算重算分配`);
      save();
      render();
      toast("已按新系数重算，相关匹配需要重新复核");
    } catch (err) {
      toast(err.message, "error");
      render();
    }
  } else if (el.id === "credit-unit") {
    state.creditUnit = el.value;
    save();
  } else if (el.id === "project-name") {
    state.project = el.value.trim() || "我的硕士申请";
    save();
  }
});
render();
refreshConfig();
export { extractFile };
