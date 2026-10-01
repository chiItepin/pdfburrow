import type {
  ImageInfo,
  MarkupInfo,
  Outcome,
  PdfInfo,
  PdfOutput,
  PdfProgress,
} from "@repo/pdf-engine";

export type InputRow = {
  id: string;
  name: string;
  size: number;
  kind: "pdf" | "image" | "markup";
} & (
  | { status: "pending" }
  | { status: "ready"; info: PdfInfo | ImageInfo | MarkupInfo }
  | { status: "error"; message: string }
);

export type DocumentJob =
  | { phase: "editing" | "cancelled" | "cancelling" | "complete" }
  | { phase: "processing"; progress?: PdfProgress }
  | { phase: "error"; message: string };

export type DocumentTask = (context: {
  signal: AbortSignal;
  onProgress: (progress: PdfProgress) => void;
}) => Promise<Outcome<readonly PdfOutput[]>>;

export type MoveDirection = "up" | "down";
export type DiscardAction = "reset" | "edit";
export type Thumbnail =
  | { state: "queued" | "rendering" | "paused" }
  | { state: "ready"; url: string }
  | { state: "error"; message: string };

export interface OutputSummary {
  readonly filename: string;
  readonly bytes: number;
}
