import { readFile, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(resolve(root, "model-manifest.json"), "utf8"),
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const file of manifest.files) {
  const target = resolve(root, "models", manifest.id, file.path);
  try {
    if (hash(await readFile(target)) === file.sha256) {
      console.log("Verified " + file.path);
      continue;
    }
  } catch {}
  console.log("Downloading " + file.path);
  const response = await fetch(
    `https://huggingface.co/${manifest.id}/resolve/${manifest.revision}/${file.path}`,
    { signal: AbortSignal.timeout(180000) },
  );
  if (!response.ok)
    throw new Error(`Download failed: ${response.status} ${file.path}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== file.sha256)
    throw new Error("Model checksum mismatch: " + file.path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = target + ".download";
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log("Saved " + file.path);
}
console.log("Model ready.");
