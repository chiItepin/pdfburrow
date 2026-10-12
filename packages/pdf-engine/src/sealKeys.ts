import {
  decodeBase64,
  encodeBase64,
  exactObject,
  hexBytes,
  jsonFile,
  readSealJson,
  sealAlgorithm,
} from "./sealFormat.ts";
import type { SealKeyFile } from "./sealFormat.ts";

export interface SealSigner {
  readonly privateKey: CryptoKey;
  readonly publicKey: string;
  readonly fingerprint: string;
}
export const keyFingerprint = async (publicKey: string) =>
  `SHA256:${hexBytes(await crypto.subtle.digest("SHA-256", decodeBase64(publicKey, 91, "public key")))}`;

export const importSealPublicKey = (publicKey: string) =>
  crypto.subtle.importKey(
    "spki",
    decodeBase64(publicKey, 91, "public key"),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

const passwordKey = async (password: string, salt: string) => {
  if (password.length < 12 || password.length > 1024) {
    throw new Error("Use a password of 12 to 1024 characters. A long, unique passphrase is safer.");
  }
  const bytes = new TextEncoder().encode(password);
  try {
    const material = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: 600000,
        salt: decodeBase64(salt, 16, "key salt"),
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    bytes.fill(0);
  }
};

const keyHeader = (file: Omit<SealKeyFile, "ciphertext">) =>
  new TextEncoder().encode(
    JSON.stringify({
      format: file.format,
      version: file.version,
      algorithm: file.algorithm,
      publicKey: file.publicKey,
      iterations: file.iterations,
      salt: file.salt,
      iv: file.iv,
    }),
  );

const parseKeyFile = (value: unknown): SealKeyFile => {
  const file = exactObject(
    value,
    ["format", "version", "algorithm", "publicKey", "iterations", "salt", "iv", "ciphertext"],
    "encrypted key",
  );
  if (
    file.format !== "pdfburrow-encrypted-seal-key" ||
    file.version !== 1 ||
    file.algorithm !== sealAlgorithm ||
    file.iterations !== 600000 ||
    typeof file.publicKey !== "string" ||
    typeof file.salt !== "string" ||
    typeof file.iv !== "string" ||
    typeof file.ciphertext !== "string"
  ) {
    throw new Error("Unsupported or malformed encrypted seal key.");
  }
  decodeBase64(file.publicKey, 91, "public key");
  decodeBase64(file.salt, 16, "key salt");
  decodeBase64(file.iv, 12, "key IV");
  decodeBase64(file.ciphertext, 154, "encrypted private key");
  return {
    format: file.format,
    version: file.version,
    algorithm: file.algorithm,
    publicKey: file.publicKey,
    iterations: file.iterations,
    salt: file.salt,
    iv: file.iv,
    ciphertext: file.ciphertext,
  };
};

const loadSigner = async (privateBytes: ArrayBuffer, publicKey: string): Promise<SealSigner> => {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const publicCryptoKey = await importSealPublicKey(publicKey);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    challenge,
  );
  if (
    !(await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicCryptoKey,
      signature,
      challenge,
    ))
  ) {
    throw new Error("The private key does not match the public key.");
  }
  return { privateKey, publicKey, fingerprint: await keyFingerprint(publicKey) };
};

export const createSealKey = async (password: string) => {
  const header = {
    format: "pdfburrow-encrypted-seal-key",
    version: 1,
    algorithm: sealAlgorithm,
    publicKey: "",
    iterations: 600000,
    salt: encodeBase64(crypto.getRandomValues(new Uint8Array(16)).buffer),
    iv: encodeBase64(crypto.getRandomValues(new Uint8Array(12)).buffer),
  } as const;
  const wrappingKey = await passwordKey(password, header.salt);
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const publicKey = encodeBase64(await crypto.subtle.exportKey("spki", pair.publicKey));
  const privateBytes = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const completeHeader = { ...header, publicKey };
  try {
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64(header.iv, 12, "key IV"),
        additionalData: keyHeader(completeHeader),
        tagLength: 128,
      },
      wrappingKey,
      privateBytes,
    );
    const file = parseKeyFile({ ...completeHeader, ciphertext: encodeBase64(ciphertext) });
    return { signer: await loadSigner(privateBytes, publicKey), backup: jsonFile(file) };
  } finally {
    new Uint8Array(privateBytes).fill(0);
  }
};

export const unlockSealKey = async (blob: Blob, password: string): Promise<SealSigner> => {
  const file = parseKeyFile(await readSealJson(blob, "Encrypted key"));
  const wrappingKey = await passwordKey(password, file.salt);
  let privateBytes: ArrayBuffer;
  try {
    privateBytes = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64(file.iv, 12, "key IV"),
        additionalData: keyHeader(file),
        tagLength: 128,
      },
      wrappingKey,
      decodeBase64(file.ciphertext, 154, "encrypted private key"),
    );
  } catch (cause) {
    if (!(cause instanceof DOMException) || cause.name !== "OperationError") {
      throw cause;
    }
    throw new Error(
      "The password is incorrect or the encrypted key was changed. Retry or choose your original key file.",
    );
  }
  try {
    return await loadSigner(privateBytes, file.publicKey);
  } finally {
    new Uint8Array(privateBytes).fill(0);
  }
};
