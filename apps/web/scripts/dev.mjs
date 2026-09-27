import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { appDirectory } from "./build-options.mjs";
import { tailwindArguments, tailwindExecutable, watchApplication, writeHtml } from "./build.mjs";
import { startServer } from "./server.mjs";

const builder = await watchApplication();
const server = await startServer(5173).catch(async (error) => {
  await builder.dispose();
  throw error;
});
const tailwind = spawn(tailwindExecutable, [...tailwindArguments, "--watch=always"], {
  cwd: appDirectory,
  stdio: "inherit",
});
const htmlWatcher = watch(new URL("../index.html", import.meta.url), () => {
  void writeHtml().catch((error) => console.error("HTML rebuild failed:", error));
});
let stopping = false;
const stop = async () => {
  if (stopping) {
    return;
  }
  stopping = true;
  htmlWatcher.close();
  tailwind.kill();
  server.close();
  await builder.dispose();
};
tailwind.on("error", (error) => {
  console.error("Stylesheet watcher failed:", error);
  process.exitCode = 1;
  void stop();
});
tailwind.on("exit", (code) => {
  if (stopping) {
    return;
  }
  console.error(`Stylesheet watcher exited unexpectedly (${code}).`);
  process.exitCode = 1;
  void stop();
});
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
console.log("Watching source files. Refresh manually when ready; drafts are never auto-reloaded.");
