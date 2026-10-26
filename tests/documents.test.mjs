import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { DOMMatrix, Path2D, ImageData } from "@napi-rs/canvas";
import { parseInput } from "../src/core.js";
const w = new Window({ url: "https://test.example" });
w.document.body.innerHTML =
  '<div id="app"></div><dialog id="editor"></dialog><div id="toast"></div>';
for (const k of [
  "window",
  "document",
  "localStorage",
  "Blob",
  "File",
  "URL",
  "Event",
  "HTMLElement",
])
  globalThis[k] = k === "window" ? w : w[k];
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
// Node adapter for PDF.js's browser worker. Browser deployment uses its actual same-origin worker.
globalThis.pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.mjs");
const { extractFile } = await import("../src/app.js");
test("real text PDF and DOCX uploads produce parseable course records", async () => {
  const pdfText = await extractFile(
    new w.File(
      [await readFile("tests/fixtures/transcript.pdf")],
      "transcript.pdf",
      { type: "application/pdf" },
    ),
  );
  const transcript = parseInput(pdfText, "transcript", "transcript.pdf");
  assert.equal(transcript[0].id, "CS101");
  assert.equal(transcript[0].credits, 4);
  const docxText = await extractFile(
    new w.File(
      [await readFile("tests/fixtures/descriptions.docx")],
      "descriptions.docx",
    ),
  );
  const descriptions = parseInput(docxText, "descriptions");
  assert.equal(descriptions[0].id, "CS101");
  assert(descriptions[0].description.includes("functions"));
  await assert.rejects(
    () => extractFile(new w.File(["not an image"], "scan.png")),
    /暂不支持/,
  );
  w.happyDOM.abort();
});
