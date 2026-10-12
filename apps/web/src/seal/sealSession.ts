import { safeFilenameStem } from "@repo/pdf-engine/filename";
import { sealFileLimit, sealPdfLimit } from "@repo/pdf-engine/personal-seal";
import type { SealSigner, SealVerification } from "@repo/pdf-engine/personal-seal";

type OutputKind = "key" | "proof";
interface Download {
  readonly blob: Blob;
  readonly name: string;
  requested: boolean;
  url?: string;
}

export const createSealSession = () => {
  let pdf: File | undefined;
  let keyFile: File | undefined;
  let proofFile: File | undefined;
  let signer: SealSigner | undefined;
  let verification: SealVerification | null = null;
  const outputs = new Map<OutputKind, Download>();
  const release = (kind: OutputKind) => {
    const output = outputs.get(kind);
    if (output?.url) {
      URL.revokeObjectURL(output.url);
    }
    outputs.delete(kind);
  };
  const clearVerification = () => {
    verification = null;
  };
  const snapshot = () => ({
    pdfName: pdf?.name ?? "",
    keyFileName: keyFile?.name ?? "",
    proofFileName: proofFile?.name ?? "",
    fingerprint: signer?.fingerprint ?? "",
    backupReady: outputs.has("key"),
    backupRequested: outputs.get("key")?.requested ?? false,
    proofReady: outputs.has("proof"),
    verification,
    hasWork: Boolean(pdf || keyFile || proofFile || signer || outputs.size),
  });
  return {
    snapshot,
    clearVerification,
    select: (kind: "pdf" | "key" | "proof", file: File) => {
      const limit = kind === "pdf" ? sealPdfLimit : sealFileLimit;
      if (!file.size || file.size > limit) {
        throw new Error(
          kind === "pdf"
            ? "Choose a nonempty PDF of at most 20 MiB."
            : "Choose a nonempty key or proof file of at most 16 KiB.",
        );
      }
      if (kind === "pdf") {
        pdf = file;
        release("proof");
      } else if (kind === "key") {
        keyFile = file;
        signer = undefined;
        release("key");
        release("proof");
      } else {
        proofFile = file;
      }
      clearVerification();
    },
    createKey: async (password: string) => {
      const { createSealKey } = await import("@repo/pdf-engine/personal-seal");
      const created = await createSealKey(password);
      release("key");
      release("proof");
      signer = created.signer;
      outputs.set("key", {
        blob: created.backup,
        name: "personal-seal-key.json",
        requested: false,
      });
    },
    unlockKey: async (password: string) => {
      if (!keyFile) {
        throw new Error("Choose your encrypted key file first.");
      }
      const { unlockSealKey } = await import("@repo/pdf-engine/personal-seal");
      signer = await unlockSealKey(keyFile, password);
    },
    seal: async () => {
      if (!pdf || !signer) {
        throw new Error("Choose a PDF and create or unlock a signing key first.");
      }
      if (outputs.has("key") && !outputs.get("key")?.requested) {
        throw new Error("Download your encrypted key backup before sealing. Confirm it was saved.");
      }
      const { createPersonalSeal } = await import("@repo/pdf-engine/personal-seal");
      const blob = await createPersonalSeal(pdf, signer);
      release("proof");
      outputs.set("proof", {
        blob,
        name: `${safeFilenameStem(pdf.name, ".pdf")}.proof.json`,
        requested: false,
      });
    },
    verify: async (trustedFingerprint: string) => {
      if (!pdf || !proofFile) {
        throw new Error("Choose both the PDF and its proof file.");
      }
      clearVerification();
      const { verifyPersonalSeal } = await import("@repo/pdf-engine/personal-seal");
      verification = await verifyPersonalSeal(pdf, proofFile, trustedFingerprint);
    },
    download: (kind: OutputKind) => {
      const output = outputs.get(kind);
      if (!output) {
        throw new Error("No download is available. Create a key or seal first.");
      }
      const anchor = document.createElement("a");
      try {
        output.url ??= URL.createObjectURL(output.blob);
        anchor.href = output.url;
        anchor.download = output.name;
        document.body.append(anchor);
        anchor.click();
        output.requested = true;
      } finally {
        anchor.remove();
      }
    },
    clear: () => {
      release("key");
      release("proof");
      pdf = undefined;
      keyFile = undefined;
      proofFile = undefined;
      signer = undefined;
      clearVerification();
    },
  };
};
