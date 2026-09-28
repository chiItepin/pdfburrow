import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { basePath, outputDirectory } from "./buildOptions.mjs";

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json"],
  [".map", "application/json"],
]);

/** @param {import("node:http").IncomingMessage} request @param {import("node:http").ServerResponse} response */
const serveRequest = async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Invalid URL");
    return;
  }
  if (pathname === basePath.slice(0, -1) && basePath !== "/") {
    response.writeHead(302, { Location: basePath }).end();
    return;
  }
  const file = resolve(outputDirectory, pathname.slice(basePath.length) || "index.html");
  if (!pathname.startsWith(basePath) || !file.startsWith(`${outputDirectory}${sep}`)) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      response.writeHead(404).end("Not found");
      return;
    }
    throw error;
  }
  response.writeHead(200, {
    "Content-Type": contentTypes.get(extname(file)) ?? "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
  } else {
    createReadStream(file)
      .on("error", (error) => response.destroy(error))
      .pipe(response);
  }
};

/** @param {number} defaultPort */
export const startServer = async (defaultPort) => {
  const portIndex = process.argv.indexOf("--port");
  const port = portIndex < 0 ? defaultPort : Number(process.argv[portIndex + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer from 1 to 65535.");
  }
  const server = createServer((request, response) => {
    void serveRequest(request, response).catch((error) => {
      console.error("Static file request failed:", error);
      if (!response.headersSent) {
        response.writeHead(500).end("Static file request failed");
      } else {
        response.destroy();
      }
    });
  });
  await new Promise((resolveStarted, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolveStarted(undefined));
  });
  console.log(`PDFBurrow: http://127.0.0.1:${port}${basePath}`);
  return server;
};
