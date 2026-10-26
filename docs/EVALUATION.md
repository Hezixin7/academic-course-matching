# 评测结果与边界

本报告由实际运行的检索结果生成。数据是手工编写的合成种子，不是用户成绩单、真实院校要求或专家验证标签。

- 共 16 门课程、6 个模块和 96 个完整组合标签。
- 按课程划分：dev 8 门 / 48 对，test 8 门 / 48 对。
- Recall 与 MRR 仅对至少一个 match/partial 标签的课程统计：dev 7 门、test 6 门；完全无关课程不进入检索召回指标。
- match 与 partial 都作为“相关”标签。

| 检索方法 | Dev Recall@3 | Test Recall@3 | Test HitRate@3 | Test MRR@3 |
| --- | ---: | ---: | ---: | ---: |
| 课程名 embedding | 0.929 | 0.833 | 0.833 | 0.833 |
| 课程描述 embedding | 1.000 | 1.000 | 1.000 | 1.000 |
| 描述关键词 Jaccard | 1.000 | 1.000 | 1.000 | 1.000 |

这些样例规模很小，描述的词汇重合较明显，关键词基线同样达到 1.0。因此只能用来复现回归和比较流程，不能声称真实匹配准确率 100%，也不能证明 embedding 优于关键词检索。

## LLM 分类

**尚未运行真实 LLM 评测。** `eval/results/*-retrieval.json` 中的 LLM 状态为 `not_run`。自动测试中的模型服务响应 fixture 不能用于模型质量评估。

配置自己的密钥后运行：

```bash
npm run eval:llm -- --split=test
```

报告包含召回候选上的四分类指标，以及未召回组合默认为 no_match 的端到端指标。主要查看 Macro-F1、相关性 Precision/Recall/F1、abstained 和混淆矩阵，不要只看被大量负例抬高的 accuracy。
输出与引用校验是确定性规则，不能测出模型理由的语义正确性；仍需人工标签。失败/needs_review 被当作错误或拒答，不会从分母里删掉。

## 复现与扩展

```bash
npm run setup
npm run eval -- --split=dev
npm run eval -- --split=test
npm run eval:llm -- --split=test --dataset=eval/data/seed.json
```

数据格式见 seed.json，每门课程需要 split 字段和所有目标模块上的明确标签。请由人工核验标签及其理由，保持测试课程隔离。先在 dev 调阈值和 Prompt，再固定代码跑 test。保留数据版本、模型返回版本、Prompt 版本、缓存状态与失败样例。
当前 MRR 是候选列表内的 MRR@3，Recall@3 为逐课 Recall 的宏平均。
LLM live 报告可能包含私人资料引用，被默认排除出 Git。
