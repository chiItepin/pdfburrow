import type { Ref } from "react";
import { FileDropzone } from "@repo/core-ui";

interface FilePickerProps {
  disabled: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  onAddFiles: (files: FileList) => void;
}

export const FilePicker = ({ disabled, buttonRef, onAddFiles }: FilePickerProps) => {
  return (
    <FileDropzone
      regionLabel="Add PDF files"
      inputLabel="Choose PDF files"
      label="Add PDFs"
      accept=".pdf,application/pdf"
      disabled={disabled}
      buttonRef={buttonRef}
      onAddFiles={onAddFiles}
    >
      <p className="mt-3 text-sm text-muted-foreground">
        Your documents stay on your device. No uploads.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Or drop PDF files here. Encrypted PDFs, interactive forms, and digital signatures are not
        supported.
      </p>
    </FileDropzone>
  );
};
