# 后端接口

所有 API 同源访问。密钥和模型服务地址不能由请求正文覆盖。

## GET /api/status

返回 `configured`、`model`、`provider` 和 `promptVersion`。不返回密钥。configured 表示配置存在，不表示认证成功。

## POST /api/classify

Content-Type 为 application/json。请求只允许：

```json
{
  "course": {"id":"CS101","name":"Programming","description":"A complete course description..."},
  "modules": [
    {"id":"CS","name":"Computer Science","description":"A complete requirement description..."}
  ]
}
```

最多三个模块；编号不可重复；描述 8–8000 字符。不要发送学分、学生姓名、整个原始文件或 API Key。

响应：

```json
{
  "assessments": [
    {
      "courseId": "CS101",
      "moduleId": "CS",
      "decision": "needs_review",
      "reason": "模型引用未能通过原文校验，请人工复核。",
      "courseQuote": "",
      "requirementQuote": "",
      "missingTopics": [],
      "validation": {"valid":false,"codes":["INVALID_COURSE_QUOTE"]}
    }
  ],
  "trace": {
    "requestId": "an actual generated request ID",
    "model": "configured model",
    "promptVersion": "course-pair-v1.0",
    "cacheHit": false,
    "status": "validation_failed",
    "attempts": [],
    "usage": {"inputTokens":0,"outputTokens":0,"totalTokens":0},
    "latencyMs": 0
  }
}
```

上面是字段说明示例，不是实际运行结果。正常输出的 decision 为 match / partial / no_match / insufficient_evidence；校验或服务失败转换为 needs_review。

### HTTP 与业务错误

| 情况 | 行为 |
| --- | --- |
| 配置缺失 | HTTP 503，LLM_NOT_CONFIGURED |
| 非法输入/字段 | HTTP 400 |
| 跨源请求 | HTTP 403 |
| 正文过大 | HTTP 413 |
| 非 JSON 请求 | HTTP 415 |
| 后端并发限制 | HTTP 429 |
| 上游认证/超时/服务错误 | HTTP 200，assessment 为 needs_review，trace 为 provider_error |
| 上游输出契约或引用错误 | HTTP 200，assessment 为 needs_review，trace 为 validation_failed |
| 有效结果或缓存 | HTTP 200，trace 为 validated 或 cached |

HTTP 200 代表接口成功处理了判定请求，不代表课程匹配通过。前端必须检查每条 validation 和 decision。所有正向建议仍待人工确认。

## 错误代码

INVALID_JSON / INVALID_SCHEMA / INVALID_COURSE_QUOTE / INVALID_REQUIREMENT_QUOTE / EMPTY_OR_TRUNCATED / PROVIDER_AUTH_ERROR / PROVIDER_RATE_LIMIT / PROVIDER_HTTP_ERROR / PROVIDER_TIMEOUT / PROVIDER_CONNECTION_ERROR。

API 不接受或执行工具，不返回私有模型思维链，仅保留简短的判断依据。失败响应不会回传模型服务的原始错误正文，以避免泄漏环境或认证信息。
