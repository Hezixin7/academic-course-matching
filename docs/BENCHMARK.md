# Benchmark V1 / V2：构造、标签与质量校验

本文件说明检索评测数据的来源、标签口径、split 隔离、质量检查和局限。两个 benchmark 都是**合成数据**，不是真实成绩单、真实院校要求或专家标注集。

## 1. 文件与版本

| 版本 | 数据文件 | 结果文件 | 状态 |
| --- | --- | --- | --- |
| Benchmark V1 | `eval/data/seed.json` | `eval/results/dev-retrieval.json`, `eval/results/test-retrieval.json` | 保留不动 |
| Benchmark V2 | `eval/data/benchmark-v2.json` | `eval/results/v2-dev-retrieval.json`, `eval/results/v2-test-retrieval.json` | 本版新增 |

Benchmark V2 由 `eval/data/generate-v2.mjs` 确定性生成。生成器只使用 Node.js 标准库，不调用 LLM、外部 API 或付费服务。课程文本为手工编写的场景素材；标签由课程场景、目标模块和 decoy 模块字段推导。

## 2. 数据规模

| 指标 | V1 | V2 |
| --- | ---: | ---: |
| 课程 | 16 | 100 |
| 目标模块 | 6 | 20 |
| 完整 pair 标签 | 96 | 2,000 |
| Dev 课程 / 标签 | 8 / 48 | 40 / 800 |
| Test 课程 / 标签 | 8 / 48 | 60 / 1,200 |
| 有正标签（match/partial）的课程 | 13 | 90 |
| Dev 有正标签课程 | 7 | 36 |
| Test 有正标签课程 | 6 | 54 |
| 零正标签课程 | 3 | 10 |

V2 标签分布：`match` 70、`partial` 20、`no_match` 1,910。正标签共 90 个，负标签 1,910 个。每个有正标签的课程恰好有一个正标签；因此“有正标签课程数”等于正标签数 90。

## 3. 场景分布

| 场景 | 总体 | Dev | Test | 标签规则 |
| --- | ---: | ---: | ---: | --- |
| straightforward | 25 | 10 | 15 | 目标模块 `match`；其余 `no_match` |
| paraphrase | 25 | 10 | 15 | 目标模块 `match`；其余 `no_match` |
| partial | 20 | 8 | 12 | 目标模块 `partial`；其余 `no_match` |
| hard-negative | 20 | 8 | 12 | 目标模块 `match`；decoy 及其余 `no_match` |
| no valid match | 10 | 4 | 6 | 全部 `no_match` |

### 场景定义

- **straightforward**：课程描述与目标模块描述和 learning outcomes 高度对应。
- **paraphrase**：同一内容用同义词、替代术语或德英混合术语表达，减少逐词重合。
- **partial**：只覆盖目标模块的一部分，并明确说明重要主题未教授。`partial` 是检索相关性标签，不是学分拆分。
- **hard-negative**：课程有一个真实匹配模块，同时与一个 decoy 模块共享词汇，但明确不覆盖 decoy 的内容。decoy 在课程元数据中记录为 `decoyModuleId`，标签为 `no_match`。这类课程会进入检索指标，因此 decoy 与真实目标会竞争排名。
- **no valid match**：非计算机或无关领域课程，所有模块均为 `no_match`。这类课程不进入 Recall/HitRate/MRR 分母。

## 4. 标签口径

- `match`：课程描述和学习目标实质覆盖目标模块要求，不以关键词重合作为依据。
- `partial`：覆盖目标模块的一个真子集，且明确缺少重要要求；在检索中视为相关。
- `no_match`：没有实质覆盖。hard-negative 的 decoy 即使词汇重合高，也因缺少实质内容而标为 `no_match`。
- 检索相关性：`match` 或 `partial`。
- 没有相关模块的课程（V2 共 10 门）不进入 Recall@K、HitRate@K、MRR@K 的分母；它们不会被当作“检索失败”计入平均。它们仍保留完整标签，可用于分类评测。
- `MRR@K`：第一个相关模块出现在前 K 名时的倒数排名；前 K 名无相关模块记 0。
- `Recall@K`：逐课相关标签召回率的宏平均。
- `HitRate@K`：至少命中一个相关模块的课程比例。

每个标签都带有 `rationale` 文本。生成器根据场景推导 rationale；它只解释标签规则，不构成独立人工审核。

## 5. Split 与泄漏控制

- Dev 课程 ID 为 `D001`–`D040`，test 为 `T001`–`T060`，集合完全不相交。
- 课程名称唯一；描述不得完全重复。
- 描述近重复检查使用 Unicode 字母 token 集合的 Jaccard 相似度，阈值为 0.80。当前 V2 的最大跨课程相似度为 **0.7368**，没有达到阈值的 pair；没有跨 split 近重复描述。
- 目标模块是两个 split 共用的评测类别，不视为泄漏；泄漏检查针对课程文本和课程 ID。
- 标签矩阵要求每门课程恰好有 20 个标签，每个模块恰好出现一次。

## 6. 质量校验结果

`eval/validate-benchmark.mjs` 与 `tests/benchmark.test.mjs` 检查以下项目；当前 V2 全部通过：

- 版本为 2，`synthetic: true`，`humanValidated: false`，provenance 明确标注合成数据。
- 100 个唯一课程 ID、20 个唯一模块 ID；dev 40 / test 60。
- 2,000 个标签，完整覆盖 100×20 的课程—模块矩阵，无重复、无未知 ID。
- 场景计数：25/25/20/20/10；dev 10/10/8/8/4；test 15/15/12/12/6。
- 标签计数：match 70、partial 20、no_match 1,910；有正标签课程 90（dev 36 / test 54）。
- 场景—标签一致：straightforward/paraphrase 恰好一个 match；partial 恰好一个 partial；hard-negative 恰好一个 match 且 decoy 为 no_match；no valid match 没有正标签。
- 20/20 个 hard-negative decoy 均为 `no_match`。
- 近重复检查：0 个 pair 达到 0.80 阈值。
- 探索性歧义检查：非目标、非 decoy 模块中关键词 Jaccard ≥ 0.35 但标为 `no_match` 的 pair 数为 0（该阈值仅为提示，不作为标签依据）。
- V1 文件仍为 version 1、16 门课程、6 个模块、96 个标签，原有结果文件存在且保持 K=3 指标。

## 7. 复现

```bash
# 重新生成 V2（确定性；会覆盖 eval/data/benchmark-v2.json）
node eval/data/generate-v2.mjs

# 结构与标签 QA
node eval/validate-benchmark.mjs

# 自动化测试（含 Benchmark V2 校验）
npm test

# V2 检索评测
npm run eval -- --split=dev --dataset=eval/data/benchmark-v2.json
npm run eval -- --split=test --dataset=eval/data/benchmark-v2.json
```

V1 向后兼容验证请写入临时路径，避免覆盖已保留结果：

```bash
npm run eval -- --split=dev --dataset=eval/data/seed.json --out=/tmp/v1-dev-retrieval.json
npm run eval -- --split=test --dataset=eval/data/seed.json --out=/tmp/v1-test-retrieval.json
```

## 8. 局限

- 数据完全合成，未经独立人工标注或领域专家验证；场景和标签包含作者判断。
- 每个有正标签的课程只有一个正模块。这使 Recall/HitRate/MRR 主要衡量“能否找到唯一目标”，没有覆盖多正标签、课程—模块多对多匹配的场景。
- 10 门无有效匹配课程不进入检索召回指标分母；这些指标因此不直接衡量假阳性率或排序精度。
- 关键词基线只抽取 `[a-z]{3,}` 英文词，忽略中文和带变音符的德语词；这是现有基线的既定实现，不是完整多语言检索器。
- 检索延迟在单机、单进程、CPU、q8 MiniLM 上测量，未做隔离、重复实验设计或统计显著性检验；不能外推到其他硬件或生产负载。
- 候选削减率只是候选数量比例，没有测量真实 API token、费用或端到端时延。
- 未运行真实付费 LLM 评测；已有检索报告的 `llmStatus` 为 `not_run`。
- 测试 split 在最终数据集定稿后运行一次；开发 split 用于流程与数据难度 sanity check。hard-negative 场景曾在 dev 上检查“是否真的与目标竞争”，该过程没有使用 test 结果，也没有针对 test 修改标签。
- 标签与场景由作者设计，未做双人标注一致性（inter-annotator agreement）分析。
