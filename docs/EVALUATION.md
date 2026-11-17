# 评测结果与边界

本报告由实际运行的检索结果生成。数据是合成的，不是用户成绩单、真实院校要求或专家验证标签。Benchmark V2 的构造、标签口径、QA 和局限见 [BENCHMARK.md](BENCHMARK.md)。

## 1. Benchmark V1（保留）

V1 仍是 `eval/data/seed.json`：16 门课程、6 个模块、96 个完整标签；dev 8 门 / test 8 门。现有结果文件 `eval/results/dev-retrieval.json`、`test-retrieval.json` 保留不动。

| 检索方法 | Dev Recall@3 | Dev HitRate@3 | Dev MRR@3 | Test Recall@3 | Test HitRate@3 | Test MRR@3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 课程名 embedding | 0.929 | 1.000 | 1.000 | 0.833 | 0.833 | 0.833 |
| 课程描述 embedding | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| 关键词 Jaccard | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |

有正标签的课程：dev 7 门、test 6 门。用扩展后的 `scripts/evaluate.mjs` 复跑 V1 时，K=3 的三个策略指标与上述保留结果逐项一致；新脚本只增加 K=1/5、延迟和候选削减字段。

V1 很小，词汇重合明显，关键词也达到 1.0；它用于回归和流程校验，不能证明 embedding 优于关键词检索。

## 2. Benchmark V2 数据

| 指标 | 数值 |
| --- | ---: |
| 课程 / 模块 / 标签 | 100 / 20 / 2,000 |
| Dev 课程 / 标签 | 40 / 800 |
| Test 课程 / 标签 | 60 / 1,200 |
| 有正标签的课程（dev / test） | 90（36 / 54） |
| match / partial / no_match | 70 / 20 / 1,910 |
| 场景（总体） | 25 / 25 / 20 / 20 / 10 |
| 场景（dev） | 10 / 10 / 8 / 8 / 4 |
| 场景（test） | 15 / 15 / 12 / 12 / 6 |

场景依次为 straightforward / paraphrase / partial / hard-negative / no-valid-match。hard-negative 课程有一个真实目标模块和一个词汇上更接近但明确不覆盖的 decoy 模块，因此会进入召回指标并参与排名竞争。没有正标签的 10 门课程不进入 Recall/HitRate/MRR 分母。

检索相关性为 `match` 或 `partial`。`partial` 只表示内容相关且不完整，与学分拆分无关。

## 3. Benchmark V2 检索结果

### Test split（54 门有正标签课程）

| 策略 | R@1 | H@1 | MRR@1 | R@3 | H@3 | MRR@3 | R@5 | H@5 | MRR@5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 课程名 embedding | 0.722 | 0.722 | 0.722 | 0.889 | 0.889 | 0.799 | 0.981 | 0.981 | 0.822 |
| 课程描述 embedding | 0.963 | 0.963 | 0.963 | 1.000 | 1.000 | 0.981 | 1.000 | 1.000 | 0.981 |
| 关键词 Jaccard | 0.815 | 0.815 | 0.815 | 1.000 | 1.000 | 0.898 | 1.000 | 1.000 | 0.898 |

### Dev split（36 门有正标签课程）

| 策略 | R@1 | H@1 | MRR@1 | R@3 | H@3 | MRR@3 | R@5 | H@5 | MRR@5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 课程名 embedding | 0.833 | 0.833 | 0.833 | 0.889 | 0.889 | 0.861 | 0.944 | 0.944 | 0.874 |
| 课程描述 embedding | 0.917 | 0.917 | 0.917 | 1.000 | 1.000 | 0.958 | 1.000 | 1.000 | 0.958 |
| 关键词 Jaccard | 0.861 | 0.861 | 0.861 | 1.000 | 1.000 | 0.931 | 1.000 | 1.000 | 0.931 |

### 解读

- Test R@1：描述 embedding 0.963 > 关键词 0.815 > 课程名 0.722。
- Test MRR@3：描述 embedding 0.981 > 关键词 0.898 > 课程名 0.799。
- K=3 与 K=5 时，描述 embedding 和关键词的 Recall/HitRate 都达到 1.000；描述 embedding 的优势主要体现在 R@1 和 MRR。
- 课程名 embedding 在三项指标和三个 K 上都弱于描述 embedding，符合“名称不参与描述召回”的设计。
- 这是合成数据上的结果，不能外推为真实申请匹配准确率。

## 4. 候选削减

相对穷举匹配（每门课与所有模块比较）：

| K | Test 穷举 pair | Test 保留 pair | Test 削减 | Dev 穷举 pair | Dev 保留 pair | Dev 削减 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1,200 | 60 | 95% | 800 | 40 | 95% |
| 3 | 1,200 | 180 | 85% | 800 | 120 | 85% |
| 5 | 1,200 | 300 | 75% | 800 | 200 | 75% |

生产流程使用 Top-3，因此候选数为 85% 的削减。该比例只描述候选数量，**没有**测量 token、API 费用或端到端时延；不能据此宣称实际成本下降。

## 5. 延迟与 embedding 计算时间

协议：单进程、CPU、Xenova/all-MiniLM-L6-v2 q8；模型只加载一次；每个策略重复 5 次。第一次描述检索在模型加载后立即执行，记为冷启动；其余为热运行。名称和关键词检索在描述检索之后运行，因此其首次运行已是模型热状态。

硬件：Apple M1 Pro，8 逻辑核，16 GB 内存，macOS 24.6.0，Node v24.15.0。单机测量，未做隔离或统计显著性检验。

| 策略 | Test 冷启动总计 | Test 热中位数 | Test embedding 中位数 | Dev 热中位数 | Dev embedding 中位数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 描述 embedding | 310.2 ms | 202.1 ms | 201.4 ms | 147.4 ms | 146.9 ms |
| 名称 embedding | 36.5 ms（首次） | 35.6 ms | 34.5 ms | 25.1 ms | 24.5 ms |
| 关键词 Jaccard | 7.1 ms（首次） | 5.6 ms | — | 2.3 ms | — |

冷启动总计 = 模型加载 + 第一次描述检索。模型加载单独记录：test 93.4 ms、dev 169.1 ms。描述检索的热运行几乎全部由 embedding 计算构成（test 202.1 ms 中约 201.4 ms；dev 147.4 ms 中约 146.9 ms）。延迟随课程数增加而增加，test 的 60 门课程高于 dev 的 40 门。

## 6. MRR 与指标口径

- **Recall@K**：逐课相关模块召回率的宏平均，仅统计至少有一个 match/partial 的课程。
- **HitRate@K**：至少有一个相关模块进入前 K 的课程比例。
- **MRR@K**：第一个相关模块出现在前 K 名时的倒数排名；前 K 名没有相关模块记 0。因此 MRR@1 与 R@1 在小样本上数值相同。
- 没有相关模块的课程不进入以上三个指标的分母；它们不会被算作检索失败。V2 有 10 门此类课程。
- 所有指标按 split 分别计算，不对 dev/test 混合。

## 7. LLM 分类

**尚未运行真实 LLM 评测。** 已保留的检索报告和 V2 报告中的 `llmStatus` 均为 `not_run`。自动测试中的模型服务响应 fixture 不能用于模型质量评估。

配置自己的密钥后运行：

```bash
npm run eval:llm -- --split=test --dataset=eval/data/benchmark-v2.json
```

报告包含召回候选上的四分类指标，以及未召回组合默认为 no_match 的端到端指标。主要查看 Macro-F1、相关性 Precision/Recall/F1、abstained 和混淆矩阵，不要只看被大量负例抬高的 accuracy。输出与引用校验是确定性规则，不能测出模型理由的语义正确性；仍需人工标签。失败/needs_review 被当作错误或拒答，不会从分母里删掉。

## 8. 复现

```bash
npm test
node eval/validate-benchmark.mjs
npm run eval -- --split=dev --dataset=eval/data/benchmark-v2.json
npm run eval -- --split=test --dataset=eval/data/benchmark-v2.json
```

V1 向后兼容验证（写入临时路径，避免覆盖保留结果）：

```bash
npm run eval -- --split=dev --dataset=eval/data/seed.json --out=/tmp/v1-dev-retrieval.json
npm run eval -- --split=test --dataset=eval/data/seed.json --out=/tmp/v1-test-retrieval.json
```

## 9. 局限

- Benchmark V2 是合成数据，未经独立人工标注或领域专家验证；场景和标签包含作者判断。
- 每个有正标签的课程只有一个正模块；没有覆盖多正标签或多对多匹配场景。
- 10 门无有效匹配课程不进入召回指标分母，因此这些指标不直接衡量假阳性或排序精度。
- 关键词基线只抽取 `[a-z]{3,}` 英文词，忽略中文和带变音符的德语词；这是现有基线，不是完整多语言检索器。
- 延迟来自单机、单进程、CPU q8 模型，5 次重复，无置信区间；不能外推到其他硬件或生产负载。
- 候选削减是数量比例，不是实测费用节省。
- 未调用付费 LLM；没有真实模型分类、费用或时延结论。
- Test split 在数据集定稿后只运行一次；dev 用于流程与难度 sanity check。hard-negative 场景在 dev 上检查过与目标的竞争程度，未用 test 结果修改数据或标签。
