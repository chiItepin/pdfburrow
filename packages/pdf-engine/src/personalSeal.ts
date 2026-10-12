import {
  decodeBase64,
  encodeBase64,
  hexBytes,
  jsonFile,
  parseProof,
  readSealJson,
  recordBytes,
  sealAlgorithm,
  sealIntent,
  sealPdfLimit,
} from "./sealFormat.ts";
import type { SealProof, SealRecord } from "./sealFormat.ts";
import { importSealPublicKey, keyFingerprint } from "./sealKeys.ts";
import type { SealSigner } from "./sealKeys.ts";

export { createSealKey, unlockSealKey } from "./sealKeys.ts";
export type { SealSigner } from "./sealKeys.ts";
export { sealFileLimit, sealPdfLimit, sealIntent } from "./sealFormat.ts";

export type SealVerification =
  | { readonly state: "invalid"; readonly message: string }
  | {
      readonly state: "verified";
      readonly fingerprint: string;
      readonly trust: "unconfirmed" | "matched" | "mismatch";
    };

const pdfDigest = async (pdf: Blob) => {
  if (pdf.size < 8 || pdf.size > sealPdfLimit) {
    throw new Error("Choose a nonempty PDF of at most 20 MiB.");
  }
  const bytes = await pdf.arrayBuffer();
  const header = new TextDecoder().decode(bytes.slice(0, 8));
  if (!/^%PDF-[12]\.\d/.test(header)) {
    throw new Error(
      "This file has no supported PDF header. Choose a PDF, not an image or key file.",
    );
  }
  return { sha256: hexBytes(await crypto.subtle.digest("SHA-256", bytes)), bytes: pdf.size };
};

export const createPersonalSeal = async (pdf: Blob, signer: SealSigner): Promise<Blob> => {
  const record: SealRecord = {
    format: "pdfburrow-personal-seal",
    version: 1,
    algorithm: sealAlgorithm,
    publicKey: signer.publicKey,
    document: await pdfDigest(pdf),
    intent: sealIntent,
    nonce: hexBytes(crypto.getRandomValues(new Uint8Array(16)).buffer),
  };
  const proof: SealProof = {
    ...record,
    signature: encodeBase64(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        signer.privateKey,
        recordBytes(record),
      ),
    ),
  };
  return jsonFile(proof);
};

export const verifyPersonalSeal = async (
  pdf: Blob,
  proofFile: Blob,
  trustedFingerprint = "",
): Promise<SealVerification> => {
  const trusted = trustedFingerprint
    .trim()
    .replace(/^SHA256:/i, "")
    .toLowerCase();
  if (trustedFingerprint.trim() && !/^[a-f0-9]{64}$/.test(trusted)) {
    throw new Error(
      "A trusted fingerprint must contain exactly 64 hexadecimal characters, optionally prefixed with SHA256:.",
    );
  }
  const proof = parseProof(await readSealJson(proofFile, "Seal proof"));
  const document = await pdfDigest(pdf);
  if (document.bytes !== proof.document.bytes || document.sha256 !== proof.document.sha256) {
    return {
      state: "invalid",
      message: "Document mismatch. This PDF is not the exact file covered by the proof.",
    };
  }
  const key = await importSealPublicKey(proof.publicKey);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    decodeBase64(proof.signature, 64, "signature"),
    recordBytes(proof),
  );
  if (!valid) {
    return { state: "invalid", message: "Invalid signature. The proof may have been changed." };
  }
  const fingerprint = await keyFingerprint(proof.publicKey);
  return {
    state: "verified",
    fingerprint,
    trust: !trusted ? "unconfirmed" : fingerprint === `SHA256:${trusted}` ? "matched" : "mismatch",
  };
};
