import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FileRegistry } from "./file-registry";
import type { MergeInput } from "./types";

export const useValidation = (
  inputs: readonly MergeInput[],
  files: FileRegistry,
  setInputs: Dispatch<SetStateAction<MergeInput[]>>,
  announce: (message: string) => void,
) => {
  const validationId = inputs.find((input) => input.status === "pending")?.id;
  useEffect(() => {
    if (!validationId) {
      return;
    }
    const file = files.get(validationId);
    if (!file) {
      return;
    }
    const controller = new AbortController();
    const validate = async () => {
      try {
        const { validatePdf } = await import("@repo/pdf-engine/merge");
        if (controller.signal.aborted) {
          return;
        }
        const outcome = await validatePdf(
          { id: validationId, name: file.name, blob: file },
          { signal: controller.signal },
        );
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
            ? `${file.name}: PDF validation finished.`
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
                    "The local PDF engine could not load. Retry validation or reload after saving your work elsewhere.",
                }
              : input,
          ),
        );
        announce(`${file.name}: validation could not load. Retry or remove the file.`);
      }
    };
    void validate();
    return () => controller.abort();
  }, [validationId, files, setInputs, announce]);
  return validationId;
};
