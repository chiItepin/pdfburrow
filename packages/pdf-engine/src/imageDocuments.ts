import { PDFDocument } from "pdf-lib";
import { decodeImage, imagePng } from "./decodeImage";
import { imageLayout, imageOutputNames } from "./imageLayout";
import { inspectImage } from "./inspectImage";
import type { ImagesRequest } from "./imageTypes";
import { enforceLimit } from "./resourceLimits";
import type { PdfOutput, PdfProgress } from "./types";

export const convertImageDocuments = async (
  { inputs, settings, limits = {} }: ImagesRequest,
  onProgress: (progress: PdfProgress) => void,
): Promise<readonly PdfOutput[]> => {
  const { filenames } = imageOutputNames(
    inputs.map((input) => input.name),
    settings,
  );
  enforceLimit(inputs.length, limits.inputCount, "Image input count", "Remove some images.");
  enforceLimit(inputs.length, limits.totalPages, "Output page count", "Remove some images.");
  enforceLimit(
    filenames.length,
    limits.outputCount,
    "Output PDF count",
    "Combine images into one PDF.",
  );
  enforceLimit(
    inputs.reduce((sum, input) => sum + input.blob.size, 0),
    limits.totalInputBytes,
    "Total image input bytes",
    "Remove images or prepare smaller source files.",
  );
  let pixels = 0;
  for (const [index, input] of inputs.entries()) {
    onProgress({ phase: "validating", completed: index, total: inputs.length });
    const info = await inspectImage(input.blob, limits);
    pixels += info.width * info.height;
    enforceLimit(pixels, limits.totalPixels, "Total decoded image pixels", "Remove some images.");
  }
  let document = await PDFDocument.create();
  let bytes = 0;
  const outputs: PdfOutput[] = [];
  const save = async (name: string) => {
    onProgress({ phase: "saving", completed: outputs.length, total: filenames.length });
    const data = await document.save();
    bytes += data.byteLength;
    enforceLimit(bytes, limits.outputBytes, "Total generated PDF bytes", "Remove some images.");
    outputs.push({
      blob: new Blob([new Uint8Array(data)], { type: "application/pdf" }),
      suggestedFilename: name,
    });
  };
  for (const [index, input] of inputs.entries()) {
    const { bitmap, info } = await decodeImage(input, limits);
    try {
      const layout = imageLayout(info.width, info.height, input.rotation, settings, limits);
      const png = await imagePng(bitmap, input.rotation);
      const image = await document.embedPng(await png.arrayBuffer());
      const page = document.addPage([layout.pageWidth, layout.pageHeight]);
      page.drawImage(image, {
        x: layout.x,
        y: layout.y,
        width: layout.drawWidth,
        height: layout.drawHeight,
      });
    } finally {
      bitmap.close();
    }
    onProgress({ phase: "converting", completed: index + 1, total: inputs.length });
    if (settings.grouping === "separate") {
      await save(filenames[index]!);
      document = await PDFDocument.create();
    }
  }
  if (settings.grouping === "combined") {
    await save(filenames[0]!);
  }
  return outputs;
};
