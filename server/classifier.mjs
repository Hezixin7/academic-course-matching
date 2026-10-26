import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  mkdir,
  writeFile,
  appendFile,
  rename,
} from "node:fs/promises";
import { resolve } from "node:path";
import { PROMPT_VERSION, messagesFor } from "./prompt.mjs";
import {
  validateRequest,
  validateOutput,
  reviewOnly,
  AppError,
} from "./validation.mjs";
export function stableJSON(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJSON).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stableJSON(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
const digest = (value) =>
  createHash("sha256").update(stableJSON(value)).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function responseJSON(response) {
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 1024 * 1024)
      throw new AppError(
        "PROVIDER_RESPONSE_TOO_LARGE",
        "模型响应过大，已停止处理。",
        502,
      );
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(
      "PROVIDER_INVALID_RESPONSE",
      "模型服务返回了无效响应。",
      502,
    );
  }
}
export function createClassifier({
  config,
  dataDir,
  fetchImpl = fetch,
  delay = sleep,
}) {
  const active = new Map();
  const configured = () => Boolean(config.apiKey && config.model);
  async function classify(raw) {
    const input = validateRequest(raw);
    if (!configured())
      throw new AppError(
        "LLM_NOT_CONFIGURED",
        "请先在项目 .env 中配置 LLM_API_KEY，再重启服务。",
        503,
      );
    // SHA-256 生成请求的唯一标识
    const key = digest({
      baseURL: config.baseURL,
      model: config.model,
      promptVersion: PROMPT_VERSION,
      thinking: config.thinking,
      maxTokens: config.maxTokens,
      input,
    });
    // 正在执行的请求去重
    if (active.has(key)) return active.get(key);
    const promise = execute(input, key).finally(() => active.delete(key));
    active.set(key, promise);
    return promise;
  }
  // 记录日志
  async function execute(input, key) {
    const started = Date.now(),
      requestId = randomUUID();
    const trace = {
      requestId,
      at: new Date().toISOString(),
      inputHash: key,
      model: config.model,
      promptVersion: PROMPT_VERSION,
      cacheHit: false,
      attempts: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      latencyMs: 0,
    };
    const cacheDir = dataDir ? resolve(dataDir, "cache") : null;
    async function finish(assessments, status) {
      trace.latencyMs = Date.now() - started;
      trace.status = status;
      if (dataDir) {
        try {
          await mkdir(dataDir, { recursive: true });
          await appendFile(
            resolve(dataDir, "traces.jsonl"),
            JSON.stringify(trace) + "\n",
          );
        } catch {
          trace.storageWarning = "TRACE_WRITE_FAILED";
        }
      }
      return { assessments, trace };
    }
    if (cacheDir) {
      try {
        const cached = JSON.parse(
          await readFile(resolve(cacheDir, key + ".json"), "utf8"),
        );
        // 去读磁盘缓存
        if (
          cached.promptVersion === PROMPT_VERSION && // 1. 提示词版本匹配吗？
          Date.now() - cached.createdAt < 24 * 60 * 60 * 1000 // 2. 缓存过期了吗？（24小时内）
        ) {
          // 3. 用当前输入的 input 去验证一下缓存里的内容（看它是否合格）
          const checked = validateOutput(cached.content, input);
          // 4. 如果验证结果“每一项（every）”都是有效的（valid）
          if (checked.every((a) => a.validation.valid)) {
            trace.cacheHit = true;// 记录日志：缓存命中了！
            return finish(checked, "cached");// 直接返回缓存的结果，不用重新跑 AI 或发请求了！
          }
        }
      } catch {}
    }
    const url = config.baseURL + "/chat/completions";
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const attemptStart = Date.now();
      let status = null;
      let response;
      try {
        const body = {
          model: config.model,
          messages: messagesFor(input),
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: config.maxTokens,
          stream: false,
        };
        if (new URL(config.baseURL).hostname === "api.deepseek.com")
          body.thinking = { type: config.thinking };
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + config.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body), // 将请求参数转成标准的 JSON 字符串
          // 超时控制！
          signal: AbortSignal.timeout(config.timeoutMs),
          // 安全策略：如果服务器返回重定向（比如 301/302），直接报错
          redirect: "error",
        });
        status = response.status;
        if (!response.ok) {
          await response.body?.cancel();
          if (
            (status === 429 || status >= 500) &&
            attempt < config.maxAttempts
          ) {
            // 记录这一次失败（Trace 记录）
            trace.attempts.push({
              attempt, //第几次尝试
              status, //HTTP状态码
              latencyMs: Date.now() - attemptStart, // 本次尝试耗时
              code: "RETRYABLE_HTTP", // 错误代号
            });
            // 智能延迟等待 退避策略
            await delay(250 * attempt);
            continue;
          }
          const code = [401, 403].includes(status)
            ? "PROVIDER_AUTH_ERROR"
            : status === 429
              ? "PROVIDER_RATE_LIMIT"
              : "PROVIDER_HTTP_ERROR";
          trace.attempts.push({
            attempt,
            status,
            latencyMs: Date.now() - attemptStart,
            code,
          });
          return finish(
            reviewOnly(
              input,
              code,
              "模型服务请求失败，未生成可计分判定。请检查后重试。",
            ),
            "provider_error",
          );
        }
        const payload = await responseJSON(response);
        const u = payload.usage || {};
        trace.usage = {
          inputTokens: Number(u.prompt_tokens) || 0,
          outputTokens: Number(u.completion_tokens) || 0,
          totalTokens: Number(u.total_tokens) || 0,
        };
        trace.providerModel =
          typeof payload.model === "string" ? payload.model : config.model;
        const choice = payload.choices?.[0];
        const content = choice?.message?.content;
        trace.attempts.push({
          attempt,
          status,
          latencyMs: Date.now() - attemptStart,
          code: choice?.finish_reason === "length" ? "TRUNCATED" : "OK",
        });
        if (
          choice?.finish_reason === "length" ||
          typeof content !== "string" ||
          !content.trim()
        )
          return finish(
            reviewOnly(
              input,
              "EMPTY_OR_TRUNCATED",
              "模型返回为空或已截断，请人工复核。",
            ),
            "validation_failed",
          );
        const assessments = validateOutput(content, input);
        const valid = assessments.every((a) => a.validation.valid);
        if (valid && cacheDir) {
          try {
            await mkdir(cacheDir, { recursive: true });
            const path = resolve(cacheDir, key + ".json");
            const temp = path + "." + requestId + ".tmp";
            await writeFile(
              temp,
              JSON.stringify({
                promptVersion: PROMPT_VERSION,
                content,
                createdAt: Date.now(),
              }),
            );
            await rename(temp, path);
          } catch {
            trace.storageWarning = "CACHE_WRITE_FAILED";
          }
        }
        return finish(assessments, valid ? "validated" : "validation_failed");
      } catch (error) {
        const code =
          error.name === "TimeoutError" || error.name === "AbortError"
            ? "PROVIDER_TIMEOUT"
            : error instanceof AppError // 业务错误 不重试
              ? error.code
              : "PROVIDER_CONNECTION_ERROR";
        // 将这次异常的详细信息记录到 Trace 中
        trace.attempts.push({
          attempt,
          status,
          latencyMs: Date.now() - attemptStart,
          code,
        });
        // 是否能继续重试
        if (attempt < config.maxAttempts && !(error instanceof AppError)) {
          await delay(250 * attempt); // 退避策略
          continue;
        }
        return finish(
          reviewOnly(input, code, "模型调用未完成，保留为待复核，不自动计分。"),
          "provider_error",
        );
      }
    }
  }
  return {
    classify,
    status: () => ({
      configured: configured(),
      model: config.model,
      provider: new URL(config.baseURL).hostname,
      promptVersion: PROMPT_VERSION,
    }),
  };
}
