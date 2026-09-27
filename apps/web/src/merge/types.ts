import type { PdfInfo, PdfProgress } from "@repo/pdf-engine";

export type MergeInput = { id: string; name: string; size: number } & (
  { status: "pending" } | { status: "ready"; info: PdfInfo } | { status: "error"; message: string }
);

export type MergeJob =
  | { phase: "editing" | "cancelled" | "cancelling" }
  | { phase: "complete"; filename: string; bytes: number }
  | { phase: "processing"; progress?: PdfProgress }
  | { phase: "error"; message: string };

export type DiscardAction = "reset" | "edit";
export type MoveDirection = "up" | "down";
export interface Thumbnail {
  url?: string;
  error?: string;
}
