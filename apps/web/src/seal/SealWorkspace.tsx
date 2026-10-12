import { useId } from "react";
import { Button, ConfirmDiscard, Input, Label, RadioGroup, RadioGroupItem } from "@repo/core-ui";
import { SealKeyControls } from "./SealKeyControls";
import { SealVerification } from "./SealVerification";
import type { usePersonalSeal } from "./usePersonalSeal";

export const SealWorkspace = ({ seal }: { seal: ReturnType<typeof usePersonalSeal> }) => {
  const { pdfInput, result, failure } = seal;
  const id = useId();
  return (
    <>
      <section className="max-w-3xl py-8" aria-labelledby="seal-heading" aria-busy={seal.busy}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="seal-heading" className="text-xl font-semibold">
            Seal the bytes, not just the page
          </h2>
          <Button variant="ghost" disabled={!seal.hasWork || seal.busy} onClick={seal.requestReset}>
            Start over
          </Button>
        </div>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Create or verify a cryptographic proof for an exact PDF. Your PDF is never rewritten or
          uploaded. The proof is a separate file, not an embedded certificate signature recognized
          by PDF readers.
        </p>
        {!seal.capable && (
          <p role="alert" className="mt-4 text-destructive">
            This browser cannot use local Web Crypto. Use a current browser over HTTPS or localhost.
          </p>
        )}
        <fieldset disabled={seal.busy || !seal.capable} className="mt-6">
          <legend className="sr-only">Personal seal controls</legend>
          <RadioGroup
            aria-label="Personal seal operation"
            className="flex flex-wrap gap-6"
            name="seal-mode"
            value={seal.mode}
            disabled={seal.busy || !seal.capable}
            onValueChange={(mode) => {
              if (mode === "seal" || mode === "verify") {
                seal.setMode(mode);
              }
            }}
          >
            {(["seal", "verify"] as const).map((mode) => (
              <div key={mode} className="flex min-h-11 items-center gap-2">
                <RadioGroupItem id={`${id}-${mode}`} value={mode} />
                <Label htmlFor={`${id}-${mode}`} className="min-h-11">
                  {mode === "seal" ? "Create seal" : "Verify seal"}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="mt-4 space-y-2">
            <Label htmlFor={`${id}-pdf`}>PDF to seal or verify</Label>
            <Input
              id={`${id}-pdf`}
              ref={pdfInput}
              type="file"
              accept=".pdf,application/pdf"
              disabled={Boolean(seal.pdfName)}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  seal.select("pdf", file);
                }
                event.target.value = "";
              }}
            />
          </div>
          {seal.pdfName && <p className="mt-2 break-all text-sm">{seal.pdfName}</p>}
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Up to 20 MiB. Finish all edits before sealing. This tool checks a PDF header and exact
            bytes, not document structure or whether its contents are safe.
          </p>
          {seal.mode === "seal" ? (
            <>
              <SealKeyControls seal={seal} />
              <p className="mt-8 max-w-prose text-sm">
                Selecting Create proof signs this statement: "I approve the contents of this PDF."
                No trusted timestamp or identity verification is provided.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  disabled={
                    !seal.pdfName ||
                    !seal.fingerprint ||
                    (seal.backupReady && !seal.backupRequested) ||
                    seal.proofReady
                  }
                  onClick={seal.seal}
                >
                  Create proof
                </Button>
                {seal.proofReady && (
                  <Button variant="outline" onClick={() => seal.download("proof")}>
                    Download proof
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 space-y-2">
                <Label htmlFor={`${id}-proof`}>Seal proof file</Label>
                <Input
                  id={`${id}-proof`}
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      seal.select("proof", file);
                    }
                    event.target.value = "";
                  }}
                />
              </div>
              {seal.proofFileName && <p className="mt-2 break-all text-sm">{seal.proofFileName}</p>}
              <div className="mt-6 space-y-2">
                <Label htmlFor={`${id}-fingerprint`}>Trusted signer fingerprint (optional)</Label>
                <Input
                  id={`${id}-fingerprint`}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={71}
                  value={seal.trustedFingerprint}
                  onChange={(event) => seal.setTrustedFingerprint(event.target.value)}
                  aria-describedby={`${id}-fingerprint-help`}
                />
              </div>
              <p
                id={`${id}-fingerprint-help`}
                className="mt-2 max-w-prose text-sm text-muted-foreground"
              >
                Paste the SHA256 fingerprint confirmed separately with the signer, not one copied
                from this proof. Without it, verification cannot establish who signed.
              </p>
              <Button
                className="mt-4"
                disabled={!seal.pdfName || !seal.proofFileName}
                onClick={seal.verify}
              >
                Verify proof
              </Button>
            </>
          )}
        </fieldset>
        <div
          ref={result}
          tabIndex={-1}
          className="mt-4 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p role="status" className="text-sm">
            {seal.notice}
          </p>
          {seal.mode === "verify" && <SealVerification result={seal.verification} />}
        </div>
        {seal.error && (
          <p ref={failure} tabIndex={-1} role="alert" className="mt-4 text-destructive">
            {seal.error}
          </p>
        )}
      </section>
      <ConfirmDiscard
        open={seal.confirmation}
        description="This clears PDFs, proofs, passwords and the unlocked key from this tab. Save your encrypted key and proof first. Downloaded files are unchanged; losing your key or password cannot be recovered."
        keepLabel="Keep working"
        discardLabel="Start over"
        onKeep={seal.keep}
        onDiscard={seal.confirmReset}
      />
    </>
  );
};
