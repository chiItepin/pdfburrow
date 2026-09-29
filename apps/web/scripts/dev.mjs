import { spawn } from "node:child_process";
import { unwatchFile, watch, watchFile } from "node:fs";
import { appDirectory } from "./buildOptions.mjs";
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
const htmlTemplate = new URL("../index.html", import.meta.url);
watchFile(htmlTemplate, { interval: 250 }, (current, previous) => {
  // macOS can report template reads as changes; only content updates need a rebuild.
  if (current.mtimeMs !== previous.mtimeMs || current.size !== previous.size) {
    void writeHtml().catch((error) => console.error("HTML rebuild failed:", error));
  }
});
const disclosureWatcher = watch(new URL("../public/", import.meta.url), () => {
  void writeHtml().catch((error) => console.error("Disclosure rebuild failed:", error));
});
let stopping = false;
const stop = async () => {
  if (stopping) {
    return;
  }
  stopping = true;
  unwatchFile(htmlTemplate);
  disclosureWatcher.close();
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
