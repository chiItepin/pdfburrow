import {
  PDFDocument,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
} from "pdf-lib";

// Synthetic 64x64 white image with a central 32x32 black square, encoded by libtiff Group 4.
const faxData = Buffer.from("//81A1f//////////////+P//gAgAg==", "base64");

const segment = (number: number, type: number, data: Buffer) => {
  const header = Buffer.alloc(11);
  header.writeUInt32BE(number);
  header[4] = type;
  header[6] = 1;
  header.writeUInt32BE(data.length, 7);
  return Buffer.concat([header, data]);
};

const jbig2Data = () => {
  const pageInfo = Buffer.alloc(19);
  pageInfo.writeUInt32BE(64);
  pageInfo.writeUInt32BE(64, 4);
  const region = Buffer.alloc(18);
  region.writeUInt32BE(64);
  region.writeUInt32BE(64, 4);
  region[17] = 1; // An immediate generic region using MMR, without shared globals.
  return Buffer.concat([
    segment(1, 48, pageInfo),
    segment(2, 39, Buffer.concat([region, faxData])),
    segment(3, 49, Buffer.alloc(0)),
  ]);
};

export const compressedScanPdf = async (codec: "JBIG2Decode" | "CCITTFaxDecode") => {
  const document = await PDFDocument.create();
  const image = document.context.register(
    document.context.stream(codec === "JBIG2Decode" ? jbig2Data() : faxData, {
      Type: "XObject",
      Subtype: "Image",
      Width: 64,
      Height: 64,
      BitsPerComponent: 1,
      ColorSpace: "DeviceGray",
      Filter: codec,
      ...(codec === "CCITTFaxDecode"
        ? { DecodeParms: { K: -1, Columns: 64, Rows: 64, BlackIs1: true } }
        : {}),
    }),
  );
  for (let index = 0; index < 6; index++) {
    const page = document.addPage([300, 400]);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(256, 0, 0, 256, 20, 70),
      drawObject(page.node.newXObject("Scan", image)),
      popGraphicsState(),
    );
  }
  return {
    name: `${codec}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  };
};
