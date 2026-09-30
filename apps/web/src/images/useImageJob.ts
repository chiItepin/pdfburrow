import { useState } from "react";
import type { ImageRotation, ImageSettings } from "@repo/pdf-engine";
import { defaultImageSettings, imageOutputNames } from "@repo/pdf-engine/image-layout";
import type { useDocumentWorkspace } from "../workspace/useDocumentWorkspace";
import { imageLimits } from "../workspace/resourcePolicy";
import { useHydrated } from "../workspace/useHydrated";

const turns: readonly ImageRotation[] = [0, 90, 180, 270];

export const useImageJob = (workspace: ReturnType<typeof useDocumentWorkspace>) => {
  const hydrated = useHydrated();
  const { draft, execution } = workspace;
  const [settings, setSettings] = useState(defaultImageSettings);
  const [rotations, setRotations] = useState(new Map<string, ImageRotation>());
  const names = draft.inputs.length
    ? imageOutputNames(
        draft.inputs.map((input) => input.name),
        settings,
      )
    : undefined;
  const capable =
    workspace.capable &&
    (!hydrated ||
      (typeof createImageBitmap === "function" &&
        typeof OffscreenCanvas === "function" &&
        typeof OffscreenCanvas.prototype.convertToBlob === "function"));
  const { job } = execution;
  const progress = job.phase === "processing" ? job.progress : undefined;
  const status =
    job.phase === "cancelling"
      ? "Stopping the local image worker..."
      : job.phase === "cancelled"
        ? "Conversion cancelled. Your images, order, rotations, and settings are unchanged."
        : job.phase === "processing"
          ? progress?.phase === "converting"
            ? `Converted ${progress.completed} of ${progress.total} images.`
            : progress?.phase === "saving"
              ? `Saving PDF ${progress.completed + 1} of ${progress.total}...`
              : "Checking images in the local worker..."
          : workspace.notice;
  return {
    settings,
    rotations,
    names,
    capable,
    status,
    progress,
    changeSettings: (next: ImageSettings) => {
      if (execution.editable) {
        execution.editDraft();
        setSettings(next);
      }
    },
    rotateFile: (id: string, direction: "left" | "right") => {
      if (!execution.editable || !draft.inputs.some((input) => input.id === id)) {
        return;
      }
      execution.editDraft();
      const turn =
        turns[(turns.indexOf(rotations.get(id) ?? 0) + (direction === "left" ? 3 : 1)) % 4]!;
      setRotations((current) => new Map(current).set(id, turn));
      workspace.announce(`Image rotated ${direction}. Additional rotation: ${turn} degrees.`);
    },
    removeFile: (id: string) => {
      if (!execution.editable) {
        return;
      }
      setRotations((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
      workspace.removeFile(id);
    },
    generate: () => {
      if (!execution.editable || !draft.ready || !capable) {
        return;
      }
      void execution.start(async (options) => {
        const inputs = draft.inputs.map((input) => {
          const blob = draft.files.get(input.id);
          if (!blob) {
            throw new Error(`The input ${input.name} is no longer available.`);
          }
          return { id: input.id, name: input.name, blob, rotation: rotations.get(input.id) ?? 0 };
        });
        const { imagesToPdf } = await import("@repo/pdf-engine/images");
        return imagesToPdf({ inputs, settings, limits: imageLimits }, options);
      });
    },
  };
};
