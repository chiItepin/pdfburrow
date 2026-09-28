import { readFile } from "node:fs/promises";
import { basePath, outputDirectory } from "./buildOptions.mjs";
import { startServer } from "./server.mjs";

const builtBase = JSON.parse(await readFile(`${outputDirectory}/base-path.json`, "utf8"));
if (builtBase !== basePath) {
  throw new Error(
    "The preview base differs from the build. Rebuild with the same PDFBURROW_BASE_PATH.",
  );
}
const server = await startServer(4173);
process.once("SIGINT", () => server.close());
process.once("SIGTERM", () => server.close());
