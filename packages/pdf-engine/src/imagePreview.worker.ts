import type { ImagePreviewRequest } from "./imagePreview";
import { PdfError } from "./pdfError";
import { enforceLimit } from "./resourceLimits";
import type { WorkerResponse } from "./workerClient";

const send = (message: WorkerResponse<Blob, never>) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<ImagePreviewRequest>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    const { blob, limits = {} } = event.data;
    enforceLimit(blob.size, limits.inputBytes, "Image input bytes", "Use a smaller source image.");
    const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value);
    const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
    if (!png && !jpeg) {
      throw new PdfError("unsupported", "Image previews require JPEG or PNG content.");
    }
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    enforceLimit(bitmap.width, limits.width, "Image width", "Use a smaller source image.");
    enforceLimit(bitmap.height, limits.height, "Image height", "Use a smaller source image.");
    enforceLimit(
      bitmap.width * bitmap.height,
      limits.decodedPixels,
      "Decoded image pixels",
      "Use a smaller source image.",
    );
    const scale = Math.min(1, 144 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const context = canvas.getContext("2d");
    if (!context) {
      throw new PdfError("unsupported", "This browser cannot draw an optional image preview.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    send({
      type: "result",
      result: { kind: "success", value: await canvas.convertToBlob({ type: "image/png" }) },
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
