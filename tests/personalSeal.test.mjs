import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import {
  createSealKey,
  unlockSealKey,
  createPersonalSeal,
  verifyPersonalSeal,
  sealPdfLimit,
  sealFileLimit,
} from "../packages/pdf-engine/src/personalSeal.ts";
import { parseProof, recordBytes } from "../packages/pdf-engine/src/sealFormat.ts";

const require = createRequire(new URL("../packages/pdf-engine/package.json", import.meta.url));
const { PDFDocument } = require("pdf-lib");
const document = await PDFDocument.create();
document.addPage([300, 400]);
const pdfBytes = await document.save();
const pdf = new Blob([pdfBytes], { type: "application/pdf" });
const password = "my long unique test passphrase";
const key = await createSealKey(password);
const proof = await createPersonalSeal(pdf, key.signer);
const originalProof = JSON.parse(await proof.text());
const json = (value) => new Blob([JSON.stringify(value)]);

test("seal artifacts independently verify with Node crypto, cover exact bytes and never rewrite the PDF", async () => {
  const publicKey = createPublicKey({
    key: Buffer.from(originalProof.publicKey, "base64"),
    format: "der",
    type: "spki",
  });
  assert.equal(
    verify(
      "sha256",
      recordBytes(parseProof(originalProof)),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(originalProof.signature, "base64"),
    ),
    true,
  );
  assert.equal(originalProof.document.sha256, createHash("sha256").update(pdfBytes).digest("hex"));
  assert.equal(originalProof.document.bytes, pdfBytes.length);
  assert.deepEqual(new Uint8Array(await pdf.arrayBuffer()), pdfBytes);
  assert.equal(key.signer.privateKey.extractable, false);
  const result = await verifyPersonalSeal(pdf, proof);
  assert.equal(result.state, "verified");
  assert.equal(result.trust, "unconfirmed");
  assert.equal(result.fingerprint, key.signer.fingerprint);
});

test("trusted fingerprints distinguish matching keys, unconfirmed signers and replacement keys", async () => {
  assert.equal((await verifyPersonalSeal(pdf, proof, key.signer.fingerprint)).trust, "matched");
  assert.equal(
    (await verifyPersonalSeal(pdf, proof, key.signer.fingerprint.toUpperCase())).trust,
    "matched",
  );
  assert.equal((await verifyPersonalSeal(pdf, proof, "0".repeat(64))).trust, "mismatch");
  for (const malformed of ["SHA256:", "a".repeat(63), "x".repeat(64)]) {
    await assert.rejects(verifyPersonalSeal(pdf, proof, malformed), /fingerprint must contain/);
  }
  const other = await createSealKey(password);
  const substituted = await createPersonalSeal(pdf, other.signer);
  assert.equal(
    (await verifyPersonalSeal(pdf, substituted, key.signer.fingerprint)).trust,
    "mismatch",
  );
});

test("changes to document bytes, signatures and signed record fields cannot validate", async () => {
  const changed = new Uint8Array(pdfBytes);
  changed[changed.length - 5] ^= 1;
  for (const changedPdf of [new Blob([changed]), new Blob([pdfBytes, "\n"])]) {
    assert.deepEqual(await verifyPersonalSeal(changedPdf, proof), {
      state: "invalid",
      message: "Document mismatch. This PDF is not the exact file covered by the proof.",
    });
  }
  const signatureBytes = Buffer.from(originalProof.signature, "base64");
  signatureBytes[0] ^= 1;
  for (const mutation of [
    { signature: signatureBytes.toString("base64") },
    { nonce: "0".repeat(32) },
    { document: { ...originalProof.document, sha256: "0".repeat(64) } },
    { document: { ...originalProof.document, bytes: originalProof.document.bytes + 1 } },
  ]) {
    assert.deepEqual(await verifyPersonalSeal(pdf, json({ ...originalProof, ...mutation })), {
      state: "invalid",
      message: "Invalid signature. The proof may have been changed.",
    });
  }
  const repeated = JSON.parse(await (await createPersonalSeal(pdf, key.signer)).text());
  assert.notEqual(repeated.nonce, originalProof.nonce);
  assert.equal((await verifyPersonalSeal(pdf, json(repeated))).state, "verified");
});

test("proof parsing is strict, bounded and independent of JSON key order", async () => {
  const reordered = Object.fromEntries(Object.entries(originalProof).reverse());
  assert.equal((await verifyPersonalSeal(pdf, json(reordered))).state, "verified");
  for (const malformed of [
    null,
    [],
    { ...originalProof, version: 2 },
    { ...originalProof, intent: "I did not approve this PDF." },
    { ...originalProof, extra: true },
    { ...originalProof, document: { ...originalProof.document, extra: true } },
    { ...originalProof, publicKey: "invalid" },
    { ...originalProof, signature: "invalid" },
    { ...originalProof, document: { ...originalProof.document, bytes: 1.5 } },
  ]) {
    await assert.rejects(verifyPersonalSeal(pdf, json(malformed)));
  }
  await assert.rejects(verifyPersonalSeal(pdf, new Blob(["{"])), /not valid JSON/);
  await assert.rejects(
    verifyPersonalSeal(pdf, new Blob([new Uint8Array(sealFileLimit + 1)])),
    /16 KiB/,
  );
  await assert.rejects(verifyPersonalSeal(new Blob(["not a PDF"]), proof), /PDF header/);
});

test("password-encrypted keys reopen without changing the fingerprint and authenticate their header", async () => {
  const unlocked = await unlockSealKey(key.backup, password);
  assert.equal(unlocked.fingerprint, key.signer.fingerprint);
  assert.equal(unlocked.privateKey.extractable, false);
  const reopenedProof = await createPersonalSeal(pdf, unlocked);
  assert.equal(
    (await verifyPersonalSeal(pdf, reopenedProof, key.signer.fingerprint)).trust,
    "matched",
  );
  const backup = JSON.parse(await key.backup.text());
  assert.equal(backup.iterations, 600000);
  assert.equal(backup.privateKey, undefined);
  await assert.rejects(
    unlockSealKey(key.backup, "an incorrect long password"),
    /password is incorrect/,
  );
  const changed = Buffer.from(backup.ciphertext, "base64");
  changed[0] ^= 1;
  await assert.rejects(
    unlockSealKey(json({ ...backup, ciphertext: changed.toString("base64") }), password),
    /password is incorrect/,
  );
  const other = await createSealKey(password);
  const otherFile = JSON.parse(await other.backup.text());
  await assert.rejects(
    unlockSealKey(json({ ...backup, publicKey: otherFile.publicKey }), password),
    /password is incorrect/,
  );
  await assert.rejects(
    unlockSealKey(json({ ...backup, iterations: 999999999 }), password),
    /malformed/,
  );
  await assert.rejects(createSealKey("short"), /12 to 1024/);
  await assert.rejects(createSealKey("x".repeat(1025)), /12 to 1024/);
});

test("PDF size limits are inclusive and oversized inputs fail before hashing", async () => {
  const bytes = new Uint8Array(sealPdfLimit);
  bytes.set(new TextEncoder().encode("%PDF-1.7"));
  const boundary = new Blob([bytes]);
  const boundaryProof = await createPersonalSeal(boundary, key.signer);
  assert.equal((await verifyPersonalSeal(boundary, boundaryProof)).state, "verified");
  await assert.rejects(createPersonalSeal(new Blob([bytes, "x"]), key.signer), /20 MiB/);
});
