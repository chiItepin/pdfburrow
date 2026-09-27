import { useRef } from "react";
import type { Ref } from "react";
import { Button } from "@repo/core-ui";

interface FilePickerProps {
  disabled: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  onAddFiles: (files: FileList) => void;
}

export const FilePicker = ({ disabled, buttonRef, onAddFiles }: FilePickerProps) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section
      aria-label="Add PDF files"
      className="my-5 rounded-lg border-2 border-dashed bg-white p-6"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) {
          onAddFiles(event.dataTransfer.files);
        }
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        aria-label="Choose PDF files"
        disabled={disabled}
        onChange={(event) => {
          if (event.target.files) {
            onAddFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />
      <Button ref={buttonRef} disabled={disabled} onClick={() => input.current?.click()}>
        Add PDFs
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">
        Or drop PDF files here. Encrypted PDFs, interactive forms, and digital signatures are not
        supported.
      </p>
    </section>
  );
};
