import { useId } from "react";
import { Button, Field, FieldDescription, FieldLabel, Input, Label } from "@repo/core-ui";
import type { usePersonalSeal } from "./usePersonalSeal";

export const SealKeyControls = ({ seal }: { seal: ReturnType<typeof usePersonalSeal> }) => {
  const id = useId();
  return (
    <section className="mt-8" aria-labelledby="seal-key-heading">
      <h3 id="seal-key-heading" className="text-lg font-semibold">
        Your signing key
      </h3>
      {seal.fingerprint ? (
        <>
          <p className="mt-2 text-sm">
            Key unlocked for this tab. Share this fingerprint separately:
          </p>
          <p className="mt-2 break-all select-all">{seal.fingerprint}</p>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Recipients must confirm this fingerprint through a channel they already trust. A key is
            not proof of your name or identity.
          </p>
          {seal.backupReady && (
            <>
              <Button className="mt-4" variant="outline" onClick={() => seal.download("key")}>
                Download encrypted key
              </Button>
              <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                {seal.backupRequested
                  ? "Backup download requested. Confirm it was saved before continuing."
                  : "Save your backup before sealing. Losing the key or password means losing access; there is no recovery service."}
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Create a reusable key, or unlock one from your password-encrypted backup. No key or
            password is saved in browser storage. Use a long, unique passphrase; there is no
            recovery.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor={`${id}-key-file`}>Encrypted key file (optional)</Label>
            <Input
              id={`${id}-key-file`}
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  seal.select("key", file);
                }
                event.target.value = "";
              }}
            />
          </div>
          {seal.keyFileName && <p className="mt-2 break-all text-sm">{seal.keyFileName}</p>}
          <Field className="mt-4 max-w-md">
            <FieldLabel htmlFor={`${id}-password`}>Key password</FieldLabel>
            <Input
              id={`${id}-password`}
              type="password"
              autoComplete="off"
              minLength={12}
              maxLength={1024}
              value={seal.password}
              onChange={(event) => seal.setPassword(event.target.value)}
              aria-describedby={`${id}-password-help`}
            />
            <FieldDescription id={`${id}-password-help`}>
              Use at least 12 characters. A long, unique passphrase is safer.
            </FieldDescription>
          </Field>
          {!seal.keyFileName && (
            <Field className="mt-4 max-w-md">
              <FieldLabel htmlFor={`${id}-repeat-password`}>Repeat password</FieldLabel>
              <Input
                id={`${id}-repeat-password`}
                type="password"
                autoComplete="off"
                maxLength={1024}
                value={seal.repeatPassword}
                onChange={(event) => seal.setRepeatPassword(event.target.value)}
                aria-describedby={`${id}-repeat-password-help`}
              />
              <FieldDescription id={`${id}-repeat-password-help`}>
                Enter the same password again.
              </FieldDescription>
            </Field>
          )}
          <Button
            className="mt-4"
            variant="outline"
            disabled={seal.password.length < 12}
            onClick={seal.keyFileName ? seal.unlockKey : seal.createKey}
          >
            {seal.keyFileName ? "Unlock signing key" : "Create signing key"}
          </Button>
        </>
      )}
    </section>
  );
};
