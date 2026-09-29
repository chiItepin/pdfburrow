import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FileRegistry } from "./fileRegistry";
import type { InputRow } from "./types";
import { imageLimits, pdfLimits } from "./resourcePolicy";

export const useValidation = (
  inputs: readonly InputRow[],
  files: FileRegistry,
  setInputs: Dispatch<SetStateAction<InputRow[]>>,
  announce: (message: string) => void,
) => {
  const pending = inputs.find((input) => input.status === "pending");
  const validationId = pending?.id;
  const kind = pending?.kind;
  useEffect(() => {
    if (!validationId) {
      return;
    }
    const file = files.get(validationId);
    if (!file) {
      setInputs((current) =>
        current.map((input) =>
          input.id === validationId
            ? {
                ...input,
                status: "error",
                message: "This input is no longer available. Remove it and add it again.",
              }
            : input,
        ),
      );
      return;
    }
    const controller = new AbortController();
    const validate = async () => {
      try {
        const engine =
          kind === "image"
            ? await import("@repo/pdf-engine/images")
            : await import("@repo/pdf-engine/merge");
        if (controller.signal.aborted) {
          return;
        }
        const input = { id: validationId, name: file.name, blob: file };
        const outcome =
          "validateImage" in engine
            ? await engine.validateImage(input, { signal: controller.signal }, imageLimits)
            : await engine.validatePdf(input, { signal: controller.signal, limits: pdfLimits });
        if (controller.signal.aborted || outcome.kind === "cancelled") {
          return;
        }
        setInputs((current) =>
          current.map((input) => {
            if (input.id !== validationId) {
              return input;
            }
            if (outcome.kind === "success") {
              return { ...input, status: "ready", info: outcome.value };
            }
            return { ...input, status: "error", message: outcome.message };
          }),
        );
        announce(
          outcome.kind === "success"
            ? `${file.name}: ${kind === "image" ? "Image" : "PDF"} validation finished.`
            : `${file.name} needs attention. Retry validation or remove this file.`,
        );
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setInputs((current) =>
          current.map((input) =>
            input.id === validationId
              ? {
                  ...input,
                  status: "error",
                  message:
                    "The local validation engine could not load. Retry validation or reload after saving your work elsewhere.",
                }
              : input,
          ),
        );
        announce(`${file.name}: validation could not load. Retry or remove the file.`);
      }
    };
    void validate();
    return () => controller.abort();
  }, [validationId, kind, files, setInputs, announce]);
  return validationId;
};
