import type { SealVerification as Verification } from "@repo/pdf-engine/personal-seal";

export const SealVerification = ({ result }: { result: Verification | null }) => {
  if (!result) {
    return null;
  }
  if (result.state === "invalid") {
    return (
      <p role="alert" className="mt-4 text-destructive">
        {result.message}
      </p>
    );
  }
  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold">
        {result.trust === "matched"
          ? "Document unchanged. Trusted key matched."
          : result.trust === "mismatch"
            ? "Document unchanged, but signer key does not match."
            : "Document unchanged. Signer identity unconfirmed."}
      </h3>
      <p className="mt-2 break-all select-all">{result.fingerprint}</p>
      <p
        role={result.trust === "mismatch" ? "alert" : undefined}
        className={`mt-2 max-w-prose text-sm ${result.trust === "mismatch" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {result.trust === "matched"
          ? "The signature is valid and matches the fingerprint you supplied. This does not independently verify a person's identity, signing time, or legal validity."
          : result.trust === "mismatch"
            ? "Do not treat this as approval by the expected signer. Confirm the correct key fingerprint through a trusted, separate channel."
            : "The proof validates against its included key only. An attacker could replace both the PDF and proof. Supply a fingerprint received through a trusted, separate channel."}
      </p>
    </div>
  );
};
