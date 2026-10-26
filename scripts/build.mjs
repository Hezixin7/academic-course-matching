import { build } from "esbuild";
import {
  cp,
  mkdir,
  copyFile,
  readFile,
  writeFile,
  rm,
  access,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
try {
  await access("models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx");
} catch {
  throw new Error("Model files are missing. Run npm run setup first.");
}
await rm("dist", { recursive: true, force: true });
await mkdir("dist/vendor", { recursive: true });
await build({
  entryPoints: ["src/app.js"],
  outfile: "dist/app.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  external: ["pdfjs-dist", "mammoth/mammoth.browser.js"],
});
let app = await readFile("dist/app.js", "utf8");
app = app
  .replaceAll('import("pdfjs-dist")', 'import("/vendor/pdf.min.mjs")')
  .replaceAll(
    'import("mammoth/mammoth.browser.js")',
    'import("/vendor/mammoth-reader.js")',
  );
await writeFile("dist/app.js", app);
for (const name of [
  "index.html",
  "styles.css",
  "core.js",
  "semantic-worker.js",
])
  await copyFile("src/" + name, "dist/" + name);
await cp("models", "dist/models", { recursive: true });
await cp("licenses", "dist/licenses", { recursive: true });
await copyFile(
  "node_modules/@huggingface/transformers/dist/transformers.web.min.js",
  "dist/vendor/transformers.web.min.js",
);
for (const name of [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
])
  await copyFile(
    "node_modules/onnxruntime-web/dist/" + name,
    "dist/vendor/" + name,
  );
for (const name of ["pdf.min.mjs", "pdf.worker.min.mjs"])
  await copyFile(
    "node_modules/pdfjs-dist/build/" + name,
    "dist/vendor/" + name,
  );
for (const name of ["cmaps", "standard_fonts"])
  await cp("node_modules/pdfjs-dist/" + name, "dist/vendor/" + name, {
    recursive: true,
  });
await build({
  stdin: {
    contents:
      "import mammoth from 'mammoth/mammoth.browser.js'; export const extractRawText = mammoth.extractRawText;",
    resolveDir: root,
  },
  outfile: "dist/vendor/mammoth-reader.js",
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2022",
});
console.log("Built dist/: application, model, WASM and document readers.");
