import type { Outcome, PdfInfo, PdfOutput, PdfProgress } from "@repo/pdf-engine";

export type PdfInputRow = { id: string; name: string; size: number } & (
  { status: "pending" } | { status: "ready"; info: PdfInfo } | { status: "error"; message: string }
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
export interface Thumbnail {
  url?: string;
  error?: string;
}

export interface OutputSummary {
  readonly filename: string;
  readonly bytes: number;
}
