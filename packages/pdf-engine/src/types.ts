export interface DocumentInput {
  readonly id: string;
  readonly blob: Blob;
}

export interface PdfOutput {
  readonly blob: Blob;
  readonly suggestedFilename: string;
}
