import { spawn } from "node:child_process";
const cli = process.env.npm_execpath;
if (!cli) throw new Error("Run this script with npm run bootstrap.");
const child = spawn(process.execPath, [cli, "ci"], {
  stdio: "inherit",
  env: { ...process.env, ONNXRUNTIME_NODE_INSTALL: "skip" },
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
