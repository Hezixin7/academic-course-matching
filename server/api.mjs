import { AppError } from "./validation.mjs";
const json = (res, status, data) => {
  res
    .writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    })
    .end(JSON.stringify(data));
};
async function bodyJSON(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 128 * 1024)
      throw new AppError("BODY_TOO_LARGE", "请求超过 128 KB。", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("INVALID_JSON", "请求必须为合法 JSON。");
  }
}
export function createApi(classifier) {
  let active = 0;
  return async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    if (!path.startsWith("/api/")) return false;
    try {
      if (
        request.headers.origin &&
        new URL(request.headers.origin).host !== request.headers.host
      )
        throw new AppError("ORIGIN_REJECTED", "只接受同源请求。", 403);
      if (request.headers["sec-fetch-site"] === "cross-site")
        throw new AppError("ORIGIN_REJECTED", "只接受同源请求。", 403);
      if (path === "/api/status" && request.method === "GET") {
        json(response, 200, classifier.status());
        return true;
      }
      if (path !== "/api/classify" || request.method !== "POST")
        throw new AppError("NOT_FOUND", "接口不存在。", 404);
      if (
        !String(request.headers["content-type"]).startsWith("application/json")
      )
        throw new AppError(
          "INVALID_CONTENT_TYPE",
          "请发送 application/json。",
          415,
        );
      if (active >= 2)
        throw new AppError("BUSY", "服务正在处理其他请求，请稍后重试。", 429);
      active++;
      try {
        const input = await bodyJSON(request);
        const result = await classifier.classify(input);
        json(response, 200, result);
      } finally {
        active--;
      }
    } catch (error) {
      json(response, error instanceof AppError ? error.status : 500, {
        error: {
          code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
          message:
            error instanceof AppError
              ? error.message
              : "后端处理失败，请检查本地服务。",
        },
      });
    }
    return true;
  };
}
