import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { startServer } from "./server.mjs";
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
let building = false,
  pending = false;
async function rebuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  const code = await new Promise((resolveCode, reject) => {
    const child = spawn(process.execPath, ["scripts/build.mjs"], {
      stdio: "inherit",
    });
    child.on("exit", resolveCode);
    child.on("error", reject);
  });
  building = false;
  if (code !== 0)
    console.error(
      "Build failed. Fix the error and save a source file to retry.",
    );
  if (pending) {
    pending = false;
    await rebuild();
  }
  return code;
}
if ((await rebuild()) !== 0) process.exit(1);
startServer();
let timer;
watch("src", { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(
    () => rebuild().then(() => console.log("Rebuilt. Refresh the browser.")),
    250,
  );
});
