import type { ImagePreviewRequest } from "./imagePreview";
import { decodeImage, imagePng } from "./decodeImage";
import { PdfError } from "./pdfError";
import { enforceLimit } from "./resourceLimits";
import type { WorkerResponse } from "./workerClient";

const send = (message: WorkerResponse<Blob, never>) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<ImagePreviewRequest>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    const { blob, limits = {} } = event.data;
    enforceLimit(blob.size, limits.inputBytes, "Image input bytes", "Use a smaller source image.");
    ({ bitmap } = await decodeImage(
      { id: "preview", name: "", blob },
      { perInputBytes: limits.inputBytes, perImagePixels: limits.decodedPixels },
    ));
    enforceLimit(bitmap.width, limits.width, "Image width", "Use a smaller source image.");
    enforceLimit(bitmap.height, limits.height, "Image height", "Use a smaller source image.");
    enforceLimit(
      bitmap.width * bitmap.height,
      limits.decodedPixels,
      "Decoded image pixels",
      "Use a smaller source image.",
    );
    const scale = Math.min(1, 144 / Math.max(bitmap.width, bitmap.height));
    send({
      type: "result",
      result: { kind: "success", value: await imagePng(bitmap, 0, scale) },
    });
  } catch (error) {
    send({
      type: "result",
      result: {
        kind: "failure",
        code: error instanceof PdfError ? error.code : "unsupported",
        message:
          error instanceof PdfError
            ? error.message
            : "Image preview unavailable. Required validation is separate from optional previews.",
      },
    });
  } finally {
    bitmap?.close();
  }
};
