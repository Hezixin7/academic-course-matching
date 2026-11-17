# Academic Course Matching Copilot · LLM Edition

**面向中国本科申请德国硕士课程匹配材料审核的两阶段 LLM 应用：课程描述语义召回 → LLM 成对判定 → 原文证据校验 → 人工复核 → 确定性学分分配。**

前端、Node.js 后端、模型文件、示例资料、Prompt、校验器、测试与评测脚本均包含在项目中，可以放到自己的 GitHub 并独立运行。

不包含 Agent 编排、模型训练或官方录取资格认定。它的主要工程内容是两阶段推理、结构化输出契约、证据出处校验、失败隔离、人工复核、可重算业务逻辑及可复现评测。

## 本地运行

需要 Node.js 22.13+，推荐 Node.js 24。打开终端，进入包含 package.json 的项目目录。

```bash
npm run bootstrap
npm run setup
```

`bootstrap` 使用锁文件安装依赖，并通过标准环境变量跳过不需要的 CUDA 下载。它替代旧版有 npm 配置警告的安装方式。ZIP 附带 MiniLM 权重，`setup` 会校验 SHA-256；从 GitHub 克隆时会下载缺失权重。

复制 `.env.example` 为 `.env`，用编辑器在 **自己的电脑** 填写密钥：

```dotenv
LLM_API_BASE=https://api.deepseek.com
LLM_API_KEY=在这里填写你自己的密钥
LLM_MODEL=deepseek-flash
LLM_THINKING_MODE=disabled
LLM_TIMEOUT_MS=45000
PORT=5173
HOST=127.0.0.1
```

不要把真实密钥提交到 GitHub或发送到聊天。示例配置使用 DeepSeek 的 Chat Completions JSON 模式；也可配置支持同样 `/chat/completions` 和 JSON object 格式的兼容服务。Anthropic 原生接口、Responses-only 接口不是本适配器的协议。

```bash
npm run dev
```

打开 **http://127.0.0.1:5173**。页面应显示模型配置已读取。点击「体验示例项目」→「开始 LLM 匹配」。配置读取成功只证明环境变量存在；第一次实际调用才会验证密钥和服务可用性。

修改 `.env` 或 `server/` 后请停止并重启服务。修改 `src/` 后自动重建，刷新浏览器即可。

没有密钥也能运行页面，在“运行方式”里选择 **仅检索预览**。完整模式的判定按钮会保持不可用。

构建后启动：

```bash
npm run build
npm start
```

本版需要 Node.js 后端处理模型调用，不是仅上传 `dist/` 就能运行完整功能的静态页面。静态资源采用域名根路径。默认服务仅监听本机地址；没有多用户认证，不要直接作为公网多用户服务开放。

## 如何使用

1. 上传成绩单、课程描述、目标模块要求，或使用 `examples/` 中的三份 CSV。
2. 校对解析结果，确认课程编号一致、描述完整、原始学分正确。
3. 设置学分换算，默认 1 中国学分 = 1.5 ECTS，仅是可调整的估算规则。
4. 完整模式先用本地 MiniLM 对描述编码，逐课召回 Top-3 模块。
5. 每门课与这三个模块一起交给 LLM，返回匹配/部分匹配/不匹配/证据不足，以及判断理由、缺失主题和两侧原文引用。
6. 后端严格检查响应字段、课程/模块编号、数量和引用出处。错误输出、伪造引用、超时和接口故障进入待复核，不生成可计分建议。
7. 核对候选明细和证据，人工增删/调整匹配和学分，再逐条确认。
8. 导出 JSON 或 HTML 报告，保留判定、校验、运行摘要和人工复核记录。

支持 CSV、TSV、JSON、TXT、Markdown、文字型 PDF、DOCX。单文件 10 MB、每类最多 150 行、PDF 最多 80 页。复杂 PDF/DOCX 表格需人工整理，扫描件未提供 OCR。完整 LLM 模式每条描述限制 8000 字符；长描述在召回阶段最多处理前 8 个片段。英文描述的 embedding 效果更稳，中德术语归一化不是完整翻译。

## 学分分配规则

- 每门课可用预算是 `round(原始学分 × 换算系数, 2)`。
- 仅通过契约和引用校验的 `match` / `partial` 可以生成待复核匹配。
- 只有一个完整 `match` 时，可给它全额预算初稿。
- 多个完整匹配竞争同一门课时，初始分配均为 0；部分匹配初始也为 0，由用户选择一个模块并整门分配。
- 一门课程只能分配到一个目标模块，不能拆分；每门课必须为 0 或整门预算，且总额不可超过预算。同课同模块不能重复添加。
- 修改学分只执行本地 `calculate()`，不调用 embedding 或 LLM；修改模块会使原 LLM 判断失效，标记为人工指定。
- “已分配”包含待复核金额，“已确认”仅包含人工确认的金额。

没有把相似度当作内容覆盖比例。引用存在只证明出处，不能证明 LLM 的推理或课程等价关系一定正确。

## 运行记录与隐私

- 密钥只在 Node 后端 `.env` 中读取，不发送给前端。
- 原始文件留在浏览器解析；完整模式会把课程描述、课程名称及目标模块描述发送给你配置的模型服务。
- 浏览器 localStorage 保存资料、匹配、判定和运行记录。0.2 使用新的存储命名空间，不覆盖旧版浏览器状态。
- `.data/traces.jsonl` 记录输入哈希、模型、Prompt 版本、尝试次数、状态、token 与耗时，不记录密钥和原始描述。
- `.data/cache/` 保存有效模型输出，含引用片段，应视为私人材料。缓存有效期 24 小时，输入/模型/Prompt/生成配置变更会使键变化；读取缓存还会重新验证引用。
- 清除浏览器项目资料不会删除后端缓存。需要彻底移除本地记录时，停止服务后删除 `.data/`。
- 取消操作停止后续请求；已经发出的模型请求可能仍执行并产生费用。token 汇总仅来自服务实际返回的 usage，不是账单保证。

## 自动测试与评测

```bash
npm test
node eval/validate-benchmark.mjs
# Benchmark V2: 100 门课程 / 20 个模块 / 2,000 个标签
npm run eval -- --split=dev --dataset=eval/data/benchmark-v2.json
npm run eval -- --split=test --dataset=eval/data/benchmark-v2.json
# Benchmark V1 向后兼容验证（写入 /tmp，不改动已保留的 V1 结果）
npm run eval -- --split=dev --dataset=eval/data/seed.json --out=/tmp/v1-dev-retrieval.json
npm run eval -- --split=test --dataset=eval/data/seed.json --out=/tmp/v1-test-retrieval.json
```

测试包括真实 MiniLM 推理、文件解析、真实 HTTP 接口与测试模型服务的联通、结构化结果校验、引用伪造/超时/重试/缓存、前端完整交互链路，以及 Benchmark V2 的数据完整性和泄漏校验。交互测试统计推理与 API 调用次数，确认编辑、确认和导出不会触发新调用。

### Benchmark V1 与 V2

- **Benchmark V1**（保留不动）：16 门合成课程、6 个模块、96 个完整标签，dev 8 门 / test 8 门；原 `eval/results/dev-retrieval.json` 与 `test-retrieval.json` 保留。新脚本复跑 V1 的关键 K=3 指标与旧结果完全一致。
- **Benchmark V2**：100 门课程（dev 40 / test 60）、20 个模块、2,000 个完整标签（dev 800 / test 1,200）。场景分布为 straightforward 25%、paraphrase 25%、partial 20%、hard-negative 20%、无有效匹配 10%。hard-negative 课程有一个真实匹配模块和一个词汇上更接近但明确不覆盖的 decoy 模块；无有效匹配课程没有任何正标签。
- 标签为 **合成数据**，由 `eval/data/generate-v2.mjs` 确定性生成，**未经独立人工专家验证**。生成过程、标签口径、QA 与局限见 [Benchmark V2 方法](docs/BENCHMARK.md)。
- 检索相关性定义为 `match` 或 `partial`。没有 match/partial 的课程不进入 Recall/HitRate/MRR 分母；V2 有 10 门此类课程（dev 4 / test 6）。`partial` 只表示内容相关且不完整，不代表学分拆分。
- **MRR@K** 指第一个相关模块出现在前 K 名时的倒数排名；前 K 名没有相关模块记 0。Recall@K 为逐课召回率的宏平均。

### Benchmark V2 实际结果

Test split（54 门有正标签的课程）：

| 检索策略 | R@1 | H@1 | MRR@1 | R@3 | H@3 | MRR@3 | R@5 | H@5 | MRR@5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 课程名 embedding | 0.722 | 0.722 | 0.722 | 0.889 | 0.889 | 0.799 | 0.981 | 0.981 | 0.822 |
| 课程描述 embedding | 0.963 | 0.963 | 0.963 | 1.000 | 1.000 | 0.981 | 1.000 | 1.000 | 0.981 |
| 关键词 Jaccard | 0.815 | 0.815 | 0.815 | 1.000 | 1.000 | 0.898 | 1.000 | 1.000 | 0.898 |

Dev split（36 门有正标签的课程）：

| 检索策略 | R@1 | H@1 | MRR@1 | R@3 | H@3 | MRR@3 | R@5 | H@5 | MRR@5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 课程名 embedding | 0.833 | 0.833 | 0.833 | 0.889 | 0.889 | 0.861 | 0.944 | 0.944 | 0.874 |
| 课程描述 embedding | 0.917 | 0.917 | 0.917 | 1.000 | 1.000 | 0.958 | 1.000 | 1.000 | 0.958 |
| 关键词 Jaccard | 0.861 | 0.861 | 0.861 | 1.000 | 1.000 | 0.931 | 1.000 | 1.000 | 0.931 |

描述 embedding 在 test 的 R@1 上比关键词高 14.8 个百分点，MRR@3 高 8.3 个百分点；但在 K=3 和 K=5 的 Recall/HitRate 上两者都达到 1.000。课程名 embedding 最弱。这些是合成集上的检索结果，不是真实申请准确率。

**候选削减（相对穷举匹配）：** test 的 60×20=1,200 对中，K=1/3/5 分别保留 60/180/300 对，候选数减少 95%/85%/75%；dev 的 800 对同样为 95%/85%/75%。这只是候选数量比例，不是实测 API 成本节省。

**延迟（5 次重复，Apple M1 Pro，8 逻辑核，16 GB，Node v24.15.0，MiniLM q8 CPU）：**

| 策略 | Test 冷启动总计 | Test 热运行中位数 | Test embedding 中位数 | Dev 热运行中位数 | Dev embedding 中位数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 课程描述 embedding | 310.2 ms | 202.1 ms | 201.4 ms | 147.4 ms | 146.9 ms |
| 课程名 embedding | 36.5 ms（首次） | 35.6 ms | 34.5 ms | 25.1 ms | 24.5 ms |
| 关键词 Jaccard | 7.1 ms（首次） | 5.6 ms | — | 2.3 ms | — |

冷启动总计 = 模型加载 + 第一次描述检索；模型加载单独记录为 test 93.4 ms / dev 169.1 ms。名称与关键词检索在描述检索之后运行，因此其首次运行已是模型热状态。单机、单进程、无 GPU，延迟会受系统负载影响。

真正调用模型做分类评测：

```bash
npm run eval:llm -- --split=test --dataset=eval/data/benchmark-v2.json
```

它会产生模型调用费用，并输出分类混淆矩阵、Macro-F1、相关性 Precision/Recall/F1、拒答数量、引用校验通过率、token 与耗时记录。未配置密钥时直接报错，不伪造分数。已附的检索报告中 LLM 状态为 `not_run`。

**当前验证边界：** 18 项自动测试已通过（原有 15 项 + 3 项 Benchmark V2 校验）；DOM 测试用 Happy DOM，模型 API 测试使用明确标注的测试服务，不等于真实 DeepSeek 端到端验证。作者环境没有用户密钥，尚未执行真实付费 LLM 调用或真实浏览器验收。Benchmark V2 是合成数据，未经独立人工验证；hard-negative 设计在 dev split 上做过难度 sanity check，test split 定稿后只运行一次，未用 test 结果修改数据。hard-negative 与标签口径包含作者判断。不能把合成集分数写成真实申请准确率，也不能仅凭候选削减宣称 API 成本下降。展示项目前，请用自己的密钥和真实、可合法使用的资料完成一次验收，再补充人工标注评测。

## 源码结构

```text
src/
  app.js                  页面交互、两阶段流程与浏览器状态
  core.js                 解析、描述召回与确定性学分计算
  proposals.js            通过校验的判定 → 保守分配初稿
  semantic-worker.js      本地 MiniLM 推理
  index.html / styles.css
server/
  prompt.mjs              版本化 Prompt
  validation.mjs          输入契约、输出契约与原文引用校验
  classifier.mjs          模型适配器、重试、缓存与 trace
  api.mjs                 后端 API、同源检查与请求大小限制
  config.mjs              后端环境变量读取
scripts/
  install.mjs             可跨平台运行的 CPU 依赖安装
  download-model.mjs      固定版本模型下载与 SHA-256
  build.mjs / server.mjs / dev.mjs
  evaluate.mjs            检索和真实 LLM 分类评测
eval/
  data/seed.json          Benchmark V1 合成种子数据和标签
  data/benchmark-v2.json  Benchmark V2（100 课程 / 20 模块 / 2,000 标签）
  data/generate-v2.mjs    Benchmark V2 确定性生成器
  validate-benchmark.mjs  结构、标签、场景和泄漏校验
  metrics.mjs             指标计算
  results/                V1 / V2 实际检索报告
tests/                   单元、模型、HTTP、交互与 benchmark 校验测试
docs/                    架构、API、评测、验收和简历说明
```


## 项目说明

- [架构与取舍](docs/ARCHITECTURE.md)
- [API 与错误处理](docs/API.md)
- [评测结果及边界](docs/EVALUATION.md)
- [Benchmark V2 方法与质量校验](docs/BENCHMARK.md)
- [验收清单](docs/VALIDATION.md)
- [简历与面试准备](docs/PORTFOLIO.md)

自有代码 MIT；第三方模型/库保留各自许可证，见 `licenses/`。模型固定版本与校验和见 `model-manifest.json`。

接口实现参考：

- https://api-docs.deepseek.com/guides/json_mode/
- https://api-docs.deepseek.com/api/create-chat-completion/
- https://api-docs.deepseek.com/zh-cn/

模型名称与服务支持可能变化，可通过 `.env` 调整，不要把编程助手的 Harness 本身当作本应用的模型 API。
