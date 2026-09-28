import { getDocument, PDFWorker } from "pdfjs-dist";
/** The caller serializes previews and releases returned object URLs. */
export const previewPdf = async (
  blob: Blob,
  signal: AbortSignal,
  pageNumber = 1,
): Promise<Blob> => {
  signal.throwIfAborted();
  const port = new Worker(new URL("./pdf.worker.min.js", import.meta.url), { type: "module" });
  const worker = PDFWorker.create({ port });
  const canvas = document.createElement("canvas");
  let task: ReturnType<typeof getDocument> | undefined;
  let fail: (error: Error) => void;
  const failure = new Promise<never>((_, reject) => {
    fail = reject;
  });
  const abort = () => fail(new DOMException("Preview cancelled.", "AbortError"));
  port.onerror = (event) => {
    event.preventDefault();
    fail(new Error("The local preview worker failed."));
  };
  port.onmessageerror = () =>
    fail(new Error("The local preview worker response could not be read."));
  signal.addEventListener("abort", abort, { once: true });
  const render = async () => {
    const bytes = await blob.arrayBuffer();
    signal.throwIfAborted();
    task = getDocument({
      data: bytes,
      worker,
      useSystemFonts: false,
      disableFontFace: true,
      useWasm: false,
      wasmUrl: new URL("./pdfjs/", import.meta.url).href,
      stopAtErrors: true,
    });
    const pdf = await task.promise;
    signal.throwIfAborted();
    const page = await pdf.getPage(pageNumber);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 144 / Math.max(original.width, original.height) });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport, background: "white" }).promise;
    signal.throwIfAborted();
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (image) =>
          image ? resolve(image) : reject(new Error("Preview image could not be created.")),
        "image/png",
      );
    });
  };
  try {
    return await Promise.race([render(), failure]);
  } finally {
    try {
      await Promise.race([task?.destroy(), failure]);
    } finally {
      signal.removeEventListener("abort", abort);
      worker.destroy();
      port.terminate();
      canvas.width = canvas.height = 0;
    }
  }
};
