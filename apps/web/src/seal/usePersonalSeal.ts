import { useEffect, useRef, useState } from "react";
import { useFocusAfterCommit } from "@repo/core-ui";
import { createSealSession } from "./sealSession";
import { useHydrated } from "../workspace/useHydrated";
import { useBeforeUnload } from "../workspace/useBeforeUnload";

export const usePersonalSeal = () => {
  const [session] = useState(createSealSession);
  const [state, setState] = useState(session.snapshot);
  const [mode, setMode] = useState<"seal" | "verify">("seal");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [trustedFingerprint, setTrustedFingerprint] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const active = useRef(false);
  const mounted = useRef(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const failure = useRef<HTMLParagraphElement>(null);
  const focusAfterCommit = useFocusAfterCommit();
  const hydrated = useHydrated();
  const capable = !hydrated || Boolean(globalThis.crypto?.subtle);
  const hasWork =
    busy || state.hasWork || Boolean(password || repeatPassword || trustedFingerprint);
  useBeforeUnload(hasWork);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      session.clear();
    };
  }, [session]);

  const reportError = (cause: unknown) => {
    setError(cause instanceof Error ? cause.message : "The local operation failed. Retry.");
    focusAfterCommit(() => failure.current);
  };
  const discard = () => {
    session.clear();
    setState(session.snapshot());
    setPassword("");
    setRepeatPassword("");
    setTrustedFingerprint("");
    setError("");
    setNotice("");
    setMode("seal");
    setConfirmation(false);
  };
  const run = async (operation: () => Promise<void>, message: string) => {
    if (active.current || !capable) {
      return;
    }
    active.current = true;
    setBusy(true);
    setError("");
    setNotice("Working locally. Wait for this operation to finish before changing tools.");
    try {
      await operation();
      if (mounted.current) {
        setNotice(message);
        focusAfterCommit(() => result.current);
      } else {
        session.clear();
      }
    } catch (cause) {
      if (mounted.current) {
        setNotice("");
        reportError(cause);
      }
    } finally {
      active.current = false;
      if (mounted.current) {
        setState(session.snapshot());
        setBusy(false);
      }
    }
  };
  return {
    ...state,
    mode,
    password,
    repeatPassword,
    trustedFingerprint,
    busy,
    capable,
    notice,
    error,
    confirmation,
    pdfInput,
    result,
    failure,
    hasWork,
    discard,
    setPassword,
    setRepeatPassword,
    setMode: (value: "seal" | "verify") => {
      setMode(value);
      setError("");
      setNotice("");
    },
    setTrustedFingerprint: (value: string) => {
      setTrustedFingerprint(value);
      session.clearVerification();
      setState(session.snapshot());
    },
    select: (kind: "pdf" | "key" | "proof", file: File) => {
      if (active.current) {
        return;
      }
      setError("");
      setNotice("");
      try {
        session.select(kind, file);
        setState(session.snapshot());
      } catch (cause) {
        reportError(cause);
      }
    },
    createKey: () => {
      if (password !== repeatPassword) {
        reportError(new Error("The passwords do not match. Enter the same passphrase twice."));
        return;
      }
      const value = password;
      setPassword("");
      setRepeatPassword("");
      void run(() => session.createKey(value), "Signing key ready. Download its encrypted backup.");
    },
    unlockKey: () => {
      const value = password;
      setPassword("");
      setRepeatPassword("");
      void run(() => session.unlockKey(value), "Key unlocked for this tab only.");
    },
    seal: () =>
      void run(() => session.seal(), "Seal ready. Share the original PDF and its proof together."),
    verify: () =>
      void run(() => session.verify(trustedFingerprint), "Local verification finished."),
    download: (kind: "key" | "proof") => {
      setError("");
      try {
        session.download(kind);
        setState(session.snapshot());
        setNotice("Download requested. Confirm that your browser saved the file.");
      } catch (cause) {
        reportError(cause);
      }
    },
    requestReset: () => setConfirmation(true),
    keep: () => setConfirmation(false),
    confirmReset: () => {
      if (!active.current) {
        discard();
        focusAfterCommit(() => pdfInput.current);
      }
    },
  };
};
