import type { FailureCode } from "./types";

export class PdfError extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
  ) {
    super(message);
  }
}
