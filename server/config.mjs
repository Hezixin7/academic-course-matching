import { resolve } from "node:path";
export function loadEnv(root = process.cwd()) {
  try {
    process.loadEnvFile(resolve(root, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
export function readConfig(env = process.env) {
  const baseURL = env.LLM_API_BASE || "https://api.deepseek.com";
  const url = new URL(baseURL);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("LLM_API_BASE must be a plain HTTP(S) provider base URL.");
  if (
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("Remote model providers must use HTTPS.");
  return {
    baseURL: baseURL.replace(/\/$/, ""),
    apiKey: env.LLM_API_KEY || "",
    model: env.LLM_MODEL || "deepseek-flash",
    timeoutMs: Math.min(
      120000,
      Math.max(1000, Number(env.LLM_TIMEOUT_MS) || 45000),
    ),
    maxAttempts: 2,
    maxTokens: 4096,
    thinking: env.LLM_THINKING_MODE || "disabled",
  };
}
