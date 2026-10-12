import type { FailureCode } from "./types";

export class PdfError extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
    readonly feature?: "forms",
  ) {
    super(message);
  }
}
