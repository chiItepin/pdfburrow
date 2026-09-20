import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const base = process.env.PDFBURROW_BASE_PATH ?? "/pdfburrow/";
if (!base.startsWith("/") || !base.endsWith("/") || base.includes("//") || /[?#\\]/u.test(base)) {
  throw new Error("PDFBURROW_BASE_PATH must be an absolute path with a trailing slash.");
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  worker: { format: "es" },
  build: { manifest: true },
});
