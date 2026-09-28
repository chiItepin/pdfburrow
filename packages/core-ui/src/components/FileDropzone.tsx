import { useRef } from "react";
import type { ReactNode, Ref } from "react";
import { Button } from "../primitives/Button";

export const FileDropzone = ({
  disabled,
  buttonRef,
  onAddFiles,
  accept,
  multiple = true,
  label,
  inputLabel,
  regionLabel,
  children,
}: {
  disabled: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  onAddFiles: (files: FileList) => void;
  accept: string;
  multiple?: boolean;
  label: string;
  inputLabel: string;
  regionLabel: string;
  children: ReactNode;
}) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section
      aria-label={regionLabel}
      className="my-5 rounded-lg border-2 border-dashed bg-card p-6 text-card-foreground"
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
        accept={accept}
        multiple={multiple}
        className="hidden"
        aria-label={inputLabel}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.files) {
            onAddFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />
      <Button ref={buttonRef} disabled={disabled} onClick={() => input.current?.click()}>
        {label}
      </Button>
      {children}
    </section>
  );
};
