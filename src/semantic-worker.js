import { env, pipeline } from "./vendor/transformers.web.min.js";
import { matchCourses } from "./core.js";
env.allowRemoteModels = false;
env.localModelPath = "/models/";
env.backends.onnx.wasm.wasmPaths = "/vendor/";
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let model;
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({
      type: "progress",
      text: "正在加载本地语义模型（首次约 23 MB）…",
    });
    if (!model)
      model = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        dtype: "q8",
        device: "wasm",
      });
    const embed = async (texts) => {
      const all = [];
      for (let i = 0; i < texts.length; i += 8) {
        self.postMessage({
          type: "progress",
          text: `正在理解课程内容 ${Math.min(i + 8, texts.length)} / ${texts.length}…`,
        });
        const output = await model(texts.slice(i, i + 8), {
          pooling: "mean",
          normalize: true,
        });
        all.push(...output.tolist());
      }
      return all;
    };
    const result = await matchCourses(
      data.courses,
      data.modules,
      embed,
      data.factor,
      (text) => self.postMessage({ type: "progress", text }),
    );
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      text:
        "语义模型运行失败：" +
        error.message +
        "。请使用支持 WebAssembly 的新版浏览器，刷新后重试。",
    });
  }
};
