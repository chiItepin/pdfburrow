export const sealAlgorithm = "ECDSA-P256-SHA256";
export const sealIntent = "I approve the contents of this PDF.";
export const sealFileLimit = 16 * 1024;
export const sealPdfLimit = 20 * 1024 * 1024;

export interface SealRecord {
  readonly format: "pdfburrow-personal-seal";
  readonly version: 1;
  readonly algorithm: typeof sealAlgorithm;
  readonly publicKey: string;
  readonly document: { readonly sha256: string; readonly bytes: number };
  readonly intent: typeof sealIntent;
  readonly nonce: string;
}
export interface SealProof extends SealRecord {
  readonly signature: string;
}
export interface SealKeyFile {
  readonly format: "pdfburrow-encrypted-seal-key";
  readonly version: 1;
  readonly algorithm: typeof sealAlgorithm;
  readonly publicKey: string;
  readonly iterations: 600000;
  readonly salt: string;
  readonly iv: string;
  readonly ciphertext: string;
}
export const encodeBase64 = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

export const decodeBase64 = (value: unknown, bytes: number, label: string) => {
  if (
    typeof value !== "string" ||
    value.length !== Math.ceil(bytes / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error(`Invalid ${label} encoding.`);
  }
  const decoded = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if (decoded.length !== bytes || encodeBase64(decoded.buffer) !== value) {
    throw new Error(`Invalid ${label} encoding.`);
  }
  return decoded;
};

export const exactObject = (value: unknown, keys: readonly string[], label: string) => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new Error(`Invalid ${label} fields. Use an original PDFBurrow file.`);
  }
  return value as Record<string, unknown>;
};

export const readSealJson = async (blob: Blob, label: string): Promise<unknown> => {
  if (!blob.size || blob.size > sealFileLimit) {
    throw new Error(`${label} must be a nonempty file of at most 16 KiB.`);
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(await blob.arrayBuffer());
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON. Choose an original PDFBurrow file.`);
  }
};

export const parseProof = (value: unknown): SealProof => {
  const proof = exactObject(
    value,
    ["format", "version", "algorithm", "publicKey", "document", "intent", "nonce", "signature"],
    "seal proof",
  );
  const document = exactObject(proof.document, ["sha256", "bytes"], "document record");
  if (
    proof.format !== "pdfburrow-personal-seal" ||
    proof.version !== 1 ||
    proof.algorithm !== sealAlgorithm ||
    proof.intent !== sealIntent ||
    typeof proof.publicKey !== "string" ||
    typeof proof.signature !== "string" ||
    typeof proof.nonce !== "string" ||
    !/^[a-f0-9]{32}$/.test(proof.nonce) ||
    typeof document.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(document.sha256) ||
    typeof document.bytes !== "number" ||
    !Number.isSafeInteger(document.bytes) ||
    document.bytes < 8 ||
    document.bytes > sealPdfLimit
  ) {
    throw new Error("Unsupported or malformed personal seal proof.");
  }
  decodeBase64(proof.publicKey, 91, "public key");
  decodeBase64(proof.signature, 64, "signature");
  return {
    format: proof.format,
    version: proof.version,
    algorithm: proof.algorithm,
    publicKey: proof.publicKey,
    document: { sha256: document.sha256, bytes: document.bytes },
    intent: proof.intent,
    nonce: proof.nonce,
    signature: proof.signature,
  };
};

export const recordBytes = (record: SealRecord) =>
  new TextEncoder().encode(
    JSON.stringify({
      format: record.format,
      version: record.version,
      algorithm: record.algorithm,
      publicKey: record.publicKey,
      document: { sha256: record.document.sha256, bytes: record.document.bytes },
      intent: record.intent,
      nonce: record.nonce,
    }),
  );

export const hexBytes = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

export const jsonFile = (value: SealProof | SealKeyFile) =>
  new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" });
