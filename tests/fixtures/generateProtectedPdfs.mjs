import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(new URL("../../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument, PDFHexString, PDFName, PDFString } = require("pdf-lib");
const destination = (name) => new URL(name, import.meta.url);
const md5 = (bytes) => createHash("md5").update(bytes).digest();
const padding = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);
const paddedPassword = (password) =>
  Buffer.concat([Buffer.from(password, "ascii"), padding]).subarray(0, 32);

// Revision 2's legacy RC4 is used only to manufacture rejection fixtures.
const rc4 = (key, input) => {
  const state = Uint8Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + state[i] + key[i % key.length]) % 256;
    [state[i], state[j]] = [state[j], state[i]];
  }
  let i = 0;
  j = 0;
  return Buffer.from(
    input.map((byte) => {
      i = (i + 1) % 256;
      j = (j + state[i]) % 256;
      [state[i], state[j]] = [state[j], state[i]];
      return byte ^ state[(state[i] + state[j]) % 256];
    }),
  );
};

const encryptedPdf = (password) => {
  const id = md5(Buffer.from("PDFBurrow generated encryption fixture"));
  const owner = rc4(md5(paddedPassword("fixture-owner")).subarray(0, 5), paddedPassword(password));
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(-4);
  const key = md5(Buffer.concat([paddedPassword(password), owner, permissions, id])).subarray(0, 5);
  const user = rc4(key, padding);
  const streamKey = md5(Buffer.concat([key, Buffer.from([4, 0, 0, 0, 0])])).subarray(0, 10);
  const stream = rc4(
    streamKey,
    Buffer.from("BT /F1 24 Tf 30 100 Td (Protected fixture page) Tj ET"),
  );
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),
      stream,
      Buffer.from("\nendstream"),
    ]),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P -4 >>`,
  ];
  const parts = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(parts.reduce((total, part) => total + part.length, 0));
    parts.push(Buffer.from(`${index + 1} 0 obj\n`), Buffer.from(object), Buffer.from("\nendobj\n"));
  }
  const xrefOffset = parts.reduce((total, part) => total + part.length, 0);
  const xref = offsets
    .map((offset, index) =>
      index ? `${String(offset).padStart(10, "0")} 00000 n \n` : "0000000000 65535 f \n",
    )
    .join("");
  parts.push(
    Buffer.from(
      `xref\n0 7\n${xref}trailer\n<< /Size 7 /Root 1 0 R /Encrypt 6 0 R /ID [<${id.toString("hex")}> <${id.toString("hex")}>] >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(parts);
};

const signedPdf = async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  page.drawText("Locally signed test document", { x: 20, y: 100, size: 14 });
  const signature = doc.context.register(
    doc.context.obj({
      Type: "Sig",
      Filter: "Adobe.PPKLite",
      SubFilter: "adbe.pkcs7.detached",
      ByteRange: [0, 9999999999, 9999999999, 9999999999],
      Contents: PDFHexString.of("0".repeat(8192)),
    }),
  );
  const field = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Widget",
      FT: "Sig",
      T: PDFString.of("Fixture signature"),
      Rect: [0, 0, 0, 0],
      P: page.ref,
      V: signature,
    }),
  );
  page.node.set(PDFName.of("Annots"), doc.context.obj([field]));
  doc.catalog.set(PDFName.of("AcroForm"), doc.context.obj({ Fields: [field], SigFlags: 3 }));
  const bytes = Buffer.from(await doc.save({ useObjectStreams: false }));
  const placeholder = Buffer.from(`<${"0".repeat(8192)}>`);
  const start = bytes.indexOf(placeholder);
  if (start < 0) {
    throw new Error("Missing signature placeholder.");
  }
  const end = start + placeholder.length;
  const originalRange = "/ByteRange [ 0 9999999999 9999999999 9999999999 ]";
  const rangeOffset = bytes.indexOf(originalRange);
  if (rangeOffset < 0) {
    throw new Error("Missing byte-range placeholder.");
  }
  bytes.write(
    `/ByteRange [ 0 ${start} ${end} ${bytes.length - end} ]`.padEnd(originalRange.length),
    rangeOffset,
    "ascii",
  );
  const directory = await mkdtemp(join(tmpdir(), "pdfburrow-signature-fixture-"));
  const path = (name) => join(directory, name);
  try {
    await writeFile(
      path("content.bin"),
      Buffer.concat([bytes.subarray(0, start), bytes.subarray(end)]),
    );
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-sha256",
        "-keyout",
        path("key.pem"),
        "-out",
        path("certificate.pem"),
        "-subj",
        "/CN=PDFBurrow test fixture only",
        "-days",
        "36500",
      ],
      { stdio: "pipe" },
    );
    execFileSync("openssl", [
      "cms",
      "-sign",
      "-binary",
      "-in",
      path("content.bin"),
      "-signer",
      path("certificate.pem"),
      "-inkey",
      path("key.pem"),
      "-outform",
      "DER",
      "-out",
      path("signature.der"),
      "-md",
      "sha256",
      "-nosmimecap",
    ]);
    execFileSync("openssl", [
      "cms",
      "-verify",
      "-binary",
      "-inform",
      "DER",
      "-in",
      path("signature.der"),
      "-content",
      path("content.bin"),
      "-noverify",
      "-out",
      path("verified.bin"),
    ]);
    const signatureHex = (await readFile(path("signature.der"))).toString("hex");
    if (signatureHex.length > 8192) {
      throw new Error("Signature exceeds its reserved space.");
    }
    bytes.write(signatureHex.padEnd(8192, "0"), start + 1, "ascii");
    return bytes;
  } finally {
    await rm(directory, { recursive: true });
  }
};

await writeFile(destination("encryptedOpen.pdf"), encryptedPdf("fixture-open"));
await writeFile(destination("encryptedEmpty.pdf"), encryptedPdf(""));
await writeFile(destination("signed.pdf"), await signedPdf());
console.log(
  "Generated two encrypted PDFs and one verified detached CMS signature; no key retained.",
);
